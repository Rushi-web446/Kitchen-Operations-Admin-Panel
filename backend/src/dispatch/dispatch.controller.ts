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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { DispatchDropQueryDto } from './dto/dispatch-drop-query.dto';
import { GroupReadyOrdersDto } from './dto/group-ready-orders.dto';
import { DispatchBoardService } from './dispatch-board.service';
import { DispatchWorkflowService } from './dispatch-workflow.service';
import { DropGroupingService } from './drop-grouping.service';

@Controller('dispatch')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DISPATCH)
export class DispatchController {
	constructor(
		private readonly grouping: DropGroupingService,
		private readonly board: DispatchBoardService,
		private readonly workflow: DispatchWorkflowService,
	) {}

	@Post('drops/group')
	groupReadyOrders(@Body() dto: GroupReadyOrdersDto) {
		return this.grouping.groupReadyOrders(dto.deliveryDate);
	}

	@Get('drops')
	listDrops(@Query() query: DispatchDropQueryDto) {
		return this.board.list(query);
	}

	@Get('drivers')
	listDrivers(
		@Query('companyId', new ParseIntPipe({ optional: true })) companyId?: number,
	) {
		return this.board.listDrivers(companyId);
	}

	@Post('drops/:id/assign-driver')
	assignDriver(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: AssignDriverDto,
	) {
		return this.workflow.assignDriver(id, dto);
	}

	@Post('drops/:id/ready')
	markReady(@Param('id', ParseIntPipe) id: number) {
		return this.workflow.markDispatchReady(id);
	}

	@Post('drops/:id/out-for-delivery')
	startDelivery(@Param('id', ParseIntPipe) id: number) {
		return this.workflow.startDelivery(id);
	}
}
