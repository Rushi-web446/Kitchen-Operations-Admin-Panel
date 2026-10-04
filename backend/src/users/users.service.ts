import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        driver: {
          select: {
            id: true,
            company: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async create(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Name is required');
    if (dto.role === Role.DRIVER && dto.driverCompanyId === undefined) {
      throw new BadRequestException('A company is required for a driver account');
    }
    if (dto.role !== Role.DRIVER && dto.driverCompanyId !== undefined) {
      throw new BadRequestException('Only driver accounts can be assigned to a company');
    }

    const passwordHash = await hash(dto.password, 12);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { name, email, role: dto.role, passwordHash },
          select: { id: true, name: true, email: true, role: true },
        });
        if (dto.role !== Role.DRIVER) return { ...user, driver: null };

        const company = await tx.company.findUnique({
          where: { id: dto.driverCompanyId },
          select: { id: true, name: true },
        });
        if (!company) throw new BadRequestException('Driver company was not found');
        const driver = await tx.driver.create({
          data: { userId: user.id, companyId: company.id },
          select: { id: true, company: { select: { id: true, name: true } } },
        });
        return { ...user, driver };
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A staff account already exists for this email');
      }
      throw error;
    }
  }
}
