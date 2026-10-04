import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BillingService } from './billing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { ListInvoicesDto } from './dto/list-invoices.dto';

@Controller(['billing', 'admin/billing'])
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('uninvoiced-orders')
  listUninvoicedOrders(@Query('companyId') companyId?: string) {
    return this.billingService.listUninvoicedOrders(
      companyId !== undefined && companyId !== '' ? Number(companyId) : undefined,
    );
  }

  @Post('invoices')
  createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.billingService.createInvoice(dto);
  }

  @Get('invoices')
  listInvoices(@Query() query: ListInvoicesDto) {
    return this.billingService.listInvoices(query);
  }

  @Get('invoices/:id')
  getInvoice(@Param('id', ParseIntPipe) id: number) {
    return this.billingService.getInvoice(id);
  }

  @Post('invoices/:id/pay')
  markInvoicePaid(@Param('id', ParseIntPipe) id: number) {
    return this.billingService.markInvoicePaid(id);
  }
}

@Controller(['invoices', 'admin/invoices'])
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class InvoiceController {
  constructor(private readonly billingService: BillingService) {}

  @Post()
  createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.billingService.createInvoice(dto);
  }

  @Get()
  listInvoices(@Query() query: ListInvoicesDto) {
    return this.billingService.listInvoices(query);
  }

  @Get(':id')
  getInvoice(@Param('id', ParseIntPipe) id: number) {
    return this.billingService.getInvoice(id);
  }

  @Post(':id/pay')
  markInvoicePaid(@Param('id', ParseIntPipe) id: number) {
    return this.billingService.markInvoicePaid(id);
  }
}
