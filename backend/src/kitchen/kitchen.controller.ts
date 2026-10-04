import {
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
import { KitchenBoardQueryDto } from './dto/kitchen-board-query.dto';
import { KitchenBoardService } from './kitchen-board.service';
import { KitchenUnitWorkflowService } from './kitchen-unit-workflow.service';

@Controller('kitchen')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.KITCHEN)
export class KitchenController {
	constructor(
		private readonly board: KitchenBoardService,
		private readonly workflow: KitchenUnitWorkflowService,
	) {}

	@Get('orders')
	listOrders(@Query() query: KitchenBoardQueryDto) {
		return this.board.list(query);
	}

	@Post('units/:id/start')
	startUnit(@Param('id', ParseIntPipe) id: number) {
		return this.workflow.start(id);
	}

	@Post('units/:id/done')
	completeUnit(@Param('id', ParseIntPipe) id: number) {
		return this.workflow.complete(id);
	}
}

@Controller('admin/kitchen')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminKitchenController {
	constructor(private readonly workflow: KitchenUnitWorkflowService) {}

	@Post('orders/:id/force-complete')
	forceCompleteOrder(@Param('id', ParseIntPipe) id: number) {
		return this.workflow.forceCompleteOrder(id);
	}
}
