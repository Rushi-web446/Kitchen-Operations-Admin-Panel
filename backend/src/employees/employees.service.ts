import {
  BadRequestException, ConflictException, HttpException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { parseCsvRecords } from './csv-parser';
import {
  CreateEmployeeDto, ListEmployeesDto, UpdateEmployeeDto,
} from './dto/employee.dto';

const EMPLOYEE_INCLUDE = {
  company: { select: { id: true, name: true } },
  allergens: { include: { allergen: { select: { id: true, name: true } } } },
  dietaryPreferences: { include: { dietaryTag: { select: { id: true, name: true } } } },
  _count: { select: { orders: true } },
};

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListEmployeesDto) {
    const where: Prisma.EmployeeWhereInput = {
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.search ? {
        OR: [
          { name: { contains: query.search.trim(), mode: 'insensitive' } },
          { email: { contains: query.search.trim(), mode: 'insensitive' } },
        ],
      } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where, include: EMPLOYEE_INCLUDE, orderBy: { name: 'asc' },
        take: query.limit, skip: query.offset,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { data: data.map(formatEmployee), meta: { total, limit: query.limit, offset: query.offset } };
  }

  async get(id: number) {
    const employee = await this.prisma.employee.findUnique({ where: { id }, include: EMPLOYEE_INCLUDE });
    if (!employee) throw new NotFoundException('Employee was not found');
    return formatEmployee(employee);
  }

  async create(dto: CreateEmployeeDto) {
    await this.validate(dto);
    try {
      const employee = await this.prisma.employee.create({
        data: {
          companyId: dto.companyId,
          name: dto.name.trim(),
          email: dto.email.trim().toLowerCase(),
          canChooseDeliveryAddress: dto.canChooseDeliveryAddress ?? false,
          canChangeDeliveryTime: dto.canChangeDeliveryTime ?? false,
          canChangePackaging: dto.canChangePackaging ?? false,
          ...(dto.allergenIds?.length ? { allergens: { create: dto.allergenIds.map((allergenId) => ({ allergenId })) } } : {}),
          ...(dto.dietaryTagIds?.length ? { dietaryPreferences: { create: dto.dietaryTagIds.map((dietaryTagId) => ({ dietaryTagId })) } } : {}),
        },
        include: EMPLOYEE_INCLUDE,
      });
      return formatEmployee(employee);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async importCsv(companyId: number, csv: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('Company was not found');

    const records = parseCsvRecords(csv);
    if (records.length > 501) throw new BadRequestException('CSV can contain at most 500 employee rows');
    const headers = records[0]?.map((header) => header.trim().toLowerCase()) ?? [];
    const nameIndex = headers.indexOf('name');
    const emailIndex = headers.indexOf('email');
    if (nameIndex < 0 || emailIndex < 0) {
      throw new BadRequestException('CSV must include name and email columns');
    }

    const imported: Array<{ row: number; id: number; name: string; email: string }> = [];
    const errors: Array<{ row: number; message: string }> = [];
    for (const [index, fields] of records.slice(1).entries()) {
      const row = index + 2;
      if (fields.every((field) => field.trim() === '')) continue;
      try {
        const employee = await this.create({
          companyId,
          name: fields[nameIndex]?.trim() ?? '',
          email: fields[emailIndex]?.trim() ?? '',
          canChooseDeliveryAddress: parseCsvBoolean(fields[headers.indexOf('canchosedeliveryaddress')], 'canChooseDeliveryAddress'),
          canChangeDeliveryTime: parseCsvBoolean(fields[headers.indexOf('canchangedeliverytime')], 'canChangeDeliveryTime'),
          canChangePackaging: parseCsvBoolean(fields[headers.indexOf('canchangepackaging')], 'canChangePackaging'),
        });
        imported.push({ row, id: employee.id, name: employee.name, email: employee.email });
      } catch (error) {
        if (!(error instanceof HttpException)) throw error;
        const response = error.getResponse();
        const message = typeof response === 'string'
          ? response
          : typeof response === 'object' && response !== null && 'message' in response
            ? response.message
            : error.message;
        errors.push({
          row,
          message: Array.isArray(message) ? message.join('. ') : String(message),
        });
      }
    }
    return { imported, errors, importedCount: imported.length, errorCount: errors.length };
  }

  async update(id: number, dto: UpdateEmployeeDto) {
    const current = await this.prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        companyId: true,
        email: true,
        ownedCompany: { select: { id: true } },
      },
    });
    if (!current) throw new NotFoundException('Employee was not found');
    if (dto.companyId !== undefined && dto.companyId !== current.companyId && current.ownedCompany) {
      throw new BadRequestException('A company owner cannot be moved to another company');
    }
    await this.validate(dto, id);
    const nextCompanyId = dto.companyId ?? current.companyId;
    const nextEmail = dto.email?.trim().toLowerCase() ?? current.email;
    if (dto.companyId !== undefined || dto.email !== undefined) {
      await this.ensureEmailDomain(nextCompanyId, nextEmail);
    }
    try {
      const employee = await this.prisma.$transaction(async (tx) => {
        if (dto.allergenIds !== undefined) {
          await tx.employeeAllergen.deleteMany({ where: { employeeId: id } });
          if (dto.allergenIds.length) {
            await tx.employeeAllergen.createMany({ data: [...new Set(dto.allergenIds)].map((allergenId) => ({ employeeId: id, allergenId })) });
          }
        }
        if (dto.dietaryTagIds !== undefined) {
          await tx.employeeDietaryPreference.deleteMany({ where: { employeeId: id } });
          if (dto.dietaryTagIds.length) {
            await tx.employeeDietaryPreference.createMany({ data: [...new Set(dto.dietaryTagIds)].map((dietaryTagId) => ({ employeeId: id, dietaryTagId })) });
          }
        }
        return tx.employee.update({
          where: { id },
          data: {
            ...(dto.companyId !== undefined ? { companyId: dto.companyId } : {}),
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.email !== undefined ? { email: nextEmail } : {}),
            ...(dto.canChooseDeliveryAddress !== undefined ? { canChooseDeliveryAddress: dto.canChooseDeliveryAddress } : {}),
            ...(dto.canChangeDeliveryTime !== undefined ? { canChangeDeliveryTime: dto.canChangeDeliveryTime } : {}),
            ...(dto.canChangePackaging !== undefined ? { canChangePackaging: dto.canChangePackaging } : {}),
          },
          include: EMPLOYEE_INCLUDE,
        });
      });
      return formatEmployee(employee);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async referenceData() {
    const [allergens, dietaryTags] = await this.prisma.$transaction([
      this.prisma.allergen.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      this.prisma.dietaryTag.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    ]);
    return { allergens, dietaryTags };
  }

  private async validate(dto: CreateEmployeeDto | UpdateEmployeeDto, excludedId?: number) {
    if (dto.companyId !== undefined) {
      const company = await this.prisma.company.findUnique({ where: { id: dto.companyId }, select: { id: true } });
      if (!company) throw new NotFoundException('Company was not found');
    }
    if (dto.email) {
      const existing = await this.prisma.employee.findFirst({
        where: { email: { equals: dto.email.trim(), mode: 'insensitive' }, ...(excludedId ? { id: { not: excludedId } } : {}) },
        select: { id: true },
      });
      if (existing) throw new ConflictException('An employee with this email already exists');
    }
    const allergenIds = dto.allergenIds ?? [];
    const dietaryTagIds = dto.dietaryTagIds ?? [];
    const [allergens, tags] = await this.prisma.$transaction([
      this.prisma.allergen.count({ where: { id: { in: allergenIds } } }),
      this.prisma.dietaryTag.count({ where: { id: { in: dietaryTagIds } } }),
    ]);
    if (allergens !== new Set(allergenIds).size) throw new BadRequestException('One or more allergens were not found');
    if (tags !== new Set(dietaryTagIds).size) throw new BadRequestException('One or more dietary tags were not found');
    if (dto.email && dto.companyId) await this.ensureEmailDomain(dto.companyId, dto.email);
  }

  private async ensureEmailDomain(companyId: number, email: string) {
    const domain = email.trim().toLowerCase().split('@').at(-1);
    if (!domain) throw new BadRequestException('Employee email is invalid');
    const match = await this.prisma.companyEmailDomain.findFirst({ where: { companyId, domain } });
    if (!match) throw new BadRequestException('Employee email domain must be registered to the selected company');
  }

  private rethrow(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('An employee with this email already exists');
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new BadRequestException('A selected related record does not exist');
    }
    throw error;
  }
}

function formatEmployee<T extends {
  allergens: Array<{ allergen: { id: number; name: string } }>;
  dietaryPreferences: Array<{ dietaryTag: { id: number; name: string } }>;
}>(employee: T) {
  return {
    ...employee,
    allergens: employee.allergens.map(({ allergen }) => allergen),
    dietaryPreferences: employee.dietaryPreferences.map(({ dietaryTag }) => dietaryTag),
  };
}

function parseCsvBoolean(value: string | undefined, field: string) {
  if (!value?.trim()) return false;
  switch (value.trim().toLowerCase()) {
    case 'true':
    case 'yes':
    case '1':
      return true;
    case 'false':
    case 'no':
    case '0':
      return false;
    default:
      throw new BadRequestException(`${field} must be true or false`);
  }
}
