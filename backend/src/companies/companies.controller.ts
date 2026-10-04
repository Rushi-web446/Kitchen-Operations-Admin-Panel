import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CompanyHolidayDto, CreateCompanyDto, ListCompaniesDto, UpdateCompanyDto,
} from './dto/company.dto';
import { CompaniesService } from './companies.service';

@Controller('companies')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  list(@Query() query: ListCompaniesDto) {
    return this.companies.list(query);
  }

  @Get('drivers')
  listDrivers() {
    return this.companies.listDrivers();
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.companies.get(id);
  }

  @Post()
  create(@Body() dto: CreateCompanyDto) {
    return this.companies.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCompanyDto) {
    return this.companies.update(id, dto);
  }

  @Post(':id/holidays')
  addHoliday(@Param('id', ParseIntPipe) id: number, @Body() dto: CompanyHolidayDto) {
    return this.companies.addHoliday(id, dto);
  }

  @Delete(':id/holidays/:holidayId')
  removeHoliday(
    @Param('id', ParseIntPipe) id: number,
    @Param('holidayId', ParseIntPipe) holidayId: number,
  ) {
    return this.companies.removeHoliday(id, holidayId);
  }
}
