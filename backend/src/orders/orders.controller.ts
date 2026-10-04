import {
	Body,
	Controller,
	Get,
	Param,
	Patch,
	ParseIntPipe,
	Post,
	Query,
	UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { ProcessCutoffDto } from './dto/process-cutoff.dto';
import { UpdateConfirmedOrderDto } from './dto/update-confirmed-order.dto';
import { CutoffProcessorService } from './cutoff-processor.service';
import { OrderCreationService } from './order-creation.service';
import { OrderQueryService } from './order-query.service';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class OrdersController {
	constructor(
		private readonly orderCreation: OrderCreationService,
		private readonly cutoffProcessor: CutoffProcessorService,
		private readonly orderQuery: OrderQueryService,
	) {}

	@Post()
	create(
		@Body() dto: CreateOrderDto,
		@CurrentUser() user: AuthenticatedUser,
	) {
		return this.orderCreation.create(dto, user.role);
	}

	@Post('quote')
	quote(
		@Body() dto: CreateOrderDto,
		@CurrentUser() user: AuthenticatedUser,
	) {
		return this.orderCreation.quote(dto, user.role);
	}

	@Patch(':id/edit')
	updatePending(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: CreateOrderDto,
		@CurrentUser() user: AuthenticatedUser,
	) {
		return this.orderCreation.updatePending(id, dto, user.role);
	}

	@Get()
	list(@Query() query: ListOrdersDto) {
		return this.orderQuery.list(query);
	}

	@Get(':id')
	getById(@Param('id', ParseIntPipe) id: number) {
		return this.orderQuery.getById(id);
	}

	@Patch(':id')
	updateConfirmed(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: UpdateConfirmedOrderDto,
	) {
		return this.orderQuery.updateConfirmed(id, dto);
	}

	@Post('process-cutoff')
	processCutoff(@Body() dto: ProcessCutoffDto) {
		return this.cutoffProcessor.process(dto.deliveryDate);
	}

	@Post(':id/cancel')
	cancel(@Param('id', ParseIntPipe) id: number) {
		return this.orderQuery.cancel(id);
	}

	@Post(':id/reject')
	reject(@Param('id', ParseIntPipe) id: number) {
		return this.orderQuery.reject(id);
	}
}
