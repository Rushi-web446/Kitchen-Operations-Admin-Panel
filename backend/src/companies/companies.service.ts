import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  CompanyHolidayDto,
  CreateCompanyDto,
  ListCompaniesDto,
  UpdateCompanyDto,
} from './dto/company.dto';

const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
  'aol.com', 'proton.me', 'protonmail.com', 'live.com', 'msn.com',
]);

const COMPANY_INCLUDE = {
  emailDomains: { orderBy: { domain: 'asc' as const } },
  addresses: { orderBy: [{ isDefault: 'desc' as const }, { id: 'asc' as const }] },
  employees: {
    select: {
      id: true, name: true, email: true, canChooseDeliveryAddress: true,
      canChangeDeliveryTime: true, canChangePackaging: true,
    },
    orderBy: { name: 'asc' as const },
  },
  owner: { select: { id: true, name: true, email: true } },
  priceTier: { select: { id: true, name: true } },
  defaultDriver: { select: { id: true, user: { select: { name: true, email: true } } } },
  holidays: { orderBy: { date: 'asc' as const } },
  _count: { select: { orders: true, invoices: true } },
} satisfies Prisma.CompanyInclude;

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListCompaniesDto) {
    const where: Prisma.CompanyWhereInput = query.search
      ? { name: { contains: query.search.trim(), mode: 'insensitive' } }
      : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        include: COMPANY_INCLUDE,
        orderBy: { name: 'asc' },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.company.count({ where }),
    ]);
    return { data: data.map(formatCompany), meta: { total, limit: query.limit, offset: query.offset } };
  }

  async get(id: number) {
    const company = await this.prisma.company.findUnique({ where: { id }, include: COMPANY_INCLUDE });
    if (!company) throw new NotFoundException('Company was not found');
    return formatCompany(company);
  }

  async create(dto: CreateCompanyDto) {
    if (dto.ownerEmployeeId !== undefined || dto.defaultDriverId !== undefined) {
      throw new BadRequestException('Set the owner and default driver after assigning employees and drivers to the company');
    }
    const domains = normalizeDomains(dto.emailDomains);
    validateAddresses(dto.addresses);
    await this.validateReferences(dto);
    try {
      const company = await this.prisma.company.create({
        data: {
          name: dto.name.trim(),
          billingContactName: dto.billingContactName?.trim(),
          billingContactEmail: dto.billingContactEmail?.trim().toLowerCase(),
          ...(dto.priceTierId ? { priceTier: { connect: { id: dto.priceTierId } } } : {}),
          ...(dto.ownerEmployeeId ? { owner: { connect: { id: dto.ownerEmployeeId } } } : {}),
          ...(dto.defaultDriverId ? { defaultDriver: { connect: { id: dto.defaultDriverId } } } : {}),
          defaultDeliveryTime: dto.defaultDeliveryTime ? toDatabaseTime(dto.defaultDeliveryTime) : null,
          deliveryMinutes: dto.deliveryMinutes,
          deliveryWorkingDays: dto.deliveryWorkingDays,
          defaultPackaging: dto.defaultPackaging,
          driverInstructions: dto.driverInstructions,
          emailDomains: { create: domains.map((domain) => ({ domain })) },
          addresses: { create: addressData(dto.addresses) },
          ...(dto.hiddenCategoryIds?.length
            ? { hiddenCategories: { create: [...new Set(dto.hiddenCategoryIds)].map((categoryId) => ({ categoryId })) } }
            : {}),
          ...(dto.hiddenDishIds?.length
            ? { hiddenDishes: { create: [...new Set(dto.hiddenDishIds)].map((dishId) => ({ dishId })) } }
            : {}),
        },
        include: COMPANY_INCLUDE,
      });
      return formatCompany(company);
    } catch (error) {
      this.rethrowConstraintError(error);
    }
  }

  async update(id: number, dto: UpdateCompanyDto) {
    await this.requireCompany(id);
    if (dto.addresses) validateAddresses(dto.addresses);
    await this.validateReferences(dto, id);
    try {
      const company = await this.prisma.$transaction(async (tx) => {
        if (dto.emailDomains) {
          const domains = normalizeDomains(dto.emailDomains);
          await tx.companyEmailDomain.deleteMany({ where: { companyId: id } });
          await tx.companyEmailDomain.createMany({ data: domains.map((domain) => ({ companyId: id, domain })) });
        }
        if (dto.addresses) {
          await tx.companyAddress.deleteMany({ where: { companyId: id } });
          await tx.companyAddress.createMany({ data: addressData(dto.addresses).map((address) => ({ ...address, companyId: id })) });
        }
        if (dto.hiddenCategoryIds) {
          await tx.companyCategoryRestriction.deleteMany({ where: { companyId: id } });
          const ids = [...new Set(dto.hiddenCategoryIds)];
          if (ids.length) await tx.companyCategoryRestriction.createMany({ data: ids.map((categoryId) => ({ companyId: id, categoryId })) });
        }
        if (dto.hiddenDishIds) {
          await tx.companyDishRestriction.deleteMany({ where: { companyId: id } });
          const ids = [...new Set(dto.hiddenDishIds)];
          if (ids.length) await tx.companyDishRestriction.createMany({ data: ids.map((dishId) => ({ companyId: id, dishId })) });
        }
        return tx.company.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.billingContactName !== undefined ? { billingContactName: dto.billingContactName.trim() } : {}),
            ...(dto.billingContactEmail !== undefined ? { billingContactEmail: dto.billingContactEmail.trim().toLowerCase() } : {}),
            ...(dto.priceTierId !== undefined ? { priceTierId: dto.priceTierId } : {}),
            ...(dto.ownerEmployeeId !== undefined ? { ownerEmployeeId: dto.ownerEmployeeId } : {}),
            ...(dto.defaultDriverId !== undefined ? { defaultDriverId: dto.defaultDriverId } : {}),
            ...(dto.defaultDeliveryTime !== undefined ? { defaultDeliveryTime: toDatabaseTime(dto.defaultDeliveryTime) } : {}),
            ...(dto.deliveryMinutes !== undefined ? { deliveryMinutes: dto.deliveryMinutes } : {}),
            ...(dto.deliveryWorkingDays !== undefined ? { deliveryWorkingDays: dto.deliveryWorkingDays } : {}),
            ...(dto.defaultPackaging !== undefined ? { defaultPackaging: dto.defaultPackaging } : {}),
            ...(dto.driverInstructions !== undefined ? { driverInstructions: dto.driverInstructions } : {}),
          },
          include: COMPANY_INCLUDE,
        });
      });
      return formatCompany(company);
    } catch (error) {
      this.rethrowConstraintError(error);
    }
  }

  async addHoliday(companyId: number, dto: CompanyHolidayDto) {
    await this.requireCompany(companyId);
    try {
      return this.prisma.companyHoliday.create({
        data: { companyId, date: toDatabaseDate(dto.date), description: dto.description },
        select: { id: true, date: true, description: true },
      });
    } catch (error) {
      this.rethrowConstraintError(error);
    }
  }

  async removeHoliday(companyId: number, holidayId: number) {
    const result = await this.prisma.companyHoliday.deleteMany({ where: { id: holidayId, companyId } });
    if (result.count === 0) throw new NotFoundException('Company holiday was not found');
    return { success: true };
  }

  async listDrivers() {
    return this.prisma.driver.findMany({
      select: { id: true, companyId: true, user: { select: { name: true, email: true } } },
      orderBy: { user: { name: 'asc' } },
    });
  }

  private async requireCompany(id: number) {
    const exists = await this.prisma.company.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Company was not found');
  }

  private async validateReferences(dto: CreateCompanyDto | UpdateCompanyDto, currentCompanyId?: number) {
    if (dto.priceTierId !== undefined) {
      const exists = await this.prisma.priceTier.findUnique({ where: { id: dto.priceTierId }, select: { id: true } });
      if (!exists) throw new BadRequestException('Price tier was not found');
    }
    if (dto.ownerEmployeeId !== undefined && dto.ownerEmployeeId !== null) {
      const employee = await this.prisma.employee.findUnique({ where: { id: dto.ownerEmployeeId }, select: { companyId: true } });
      if (!employee || (currentCompanyId !== undefined && employee.companyId !== currentCompanyId)) {
        throw new BadRequestException('Company owner must be an employee of this company');
      }
    }
    if (dto.defaultDriverId !== undefined && dto.defaultDriverId !== null) {
      const driver = await this.prisma.driver.findUnique({ where: { id: dto.defaultDriverId }, select: { companyId: true } });
      if (!driver || (currentCompanyId !== undefined && driver.companyId !== currentCompanyId)) {
        throw new BadRequestException('Default driver must belong to this company');
      }
    }
    if (dto.hiddenCategoryIds?.length) {
      const count = await this.prisma.category.count({ where: { id: { in: dto.hiddenCategoryIds } } });
      if (count !== new Set(dto.hiddenCategoryIds).size) throw new BadRequestException('One or more categories were not found');
    }
    if (dto.hiddenDishIds?.length) {
      const count = await this.prisma.dish.count({ where: { id: { in: dto.hiddenDishIds } } });
      if (count !== new Set(dto.hiddenDishIds).size) throw new BadRequestException('One or more dishes were not found');
    }
  }

  private rethrowConstraintError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('An email domain is already claimed by another company');
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new BadRequestException('A selected related record does not exist');
    }
    throw error;
  }
}

function normalizeDomains(domains: string[]) {
  const normalized = domains.map((domain) => domain.trim().toLowerCase().replace(/^@/, ''));
  if (normalized.some((domain) =>
    [...PUBLIC_EMAIL_DOMAINS].some((publicDomain) =>
      domain === publicDomain || domain.endsWith(`.${publicDomain}`),
    ),
  )) {
    throw new BadRequestException('Public email domains cannot be assigned to a company');
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new BadRequestException('Email domains must be unique');
  }
  return normalized;
}

function validateAddresses(addresses: Array<{ isDefault?: boolean }>) {
  if (addresses.filter((address) => address.isDefault).length > 1) {
    throw new BadRequestException('Only one company address can be the default');
  }
}

function addressData<T extends { isDefault?: boolean; country?: string }>(addresses: T[]) {
  const hasDefault = addresses.some((address) => address.isDefault);
  return addresses.map((address, index) => ({
    ...address,
    country: address.country ?? 'IN',
    isDefault: hasDefault ? address.isDefault === true : index === 0,
  }));
}

function toDatabaseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.toISOString().slice(0, 10) !== value) throw new BadRequestException('Invalid calendar date');
  return date;
}

function toDatabaseTime(value: string) {
  return new Date(`1970-01-01T${value}:00.000Z`);
}

function formatCompany<T extends {
  defaultDeliveryTime: Date | null;
  emailDomains: Array<{ domain: string }>;
  addresses: Array<{ [key: string]: unknown }>;
  holidays: Array<{ id: number; date: Date; description: string | null }>;
  defaultDriver: { id: number; user: { name: string; email: string } } | null;
  _count: { orders: number; invoices: number };
}>(company: T) {
  return {
    ...company,
    defaultDeliveryTime: company.defaultDeliveryTime
      ? `${String(company.defaultDeliveryTime.getUTCHours()).padStart(2, '0')}:${String(company.defaultDeliveryTime.getUTCMinutes()).padStart(2, '0')}`
      : null,
    emailDomains: company.emailDomains.map(({ domain }) => domain),
    holidays: company.holidays.map((holiday) => ({
      ...holiday,
      date: holiday.date.toISOString().slice(0, 10),
    })),
    defaultDriver: company.defaultDriver
      ? { id: company.defaultDriver.id, ...company.defaultDriver.user }
      : null,
  };
}
