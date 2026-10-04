import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { KitchenModule } from '../kitchen/kitchen.module';
import { CutoffCalculatorService } from './cutoff-calculator.service';
import { CutoffProcessorService } from './cutoff-processor.service';
import { CutoffSchedulerService } from './cutoff-scheduler.service';
import { OrderCreationService } from './order-creation.service';
import { OrderPlanningService } from './order-planning.service';
import { OrderPricingService } from './order-pricing.service';
import { OrderQueryService } from './order-query.service';
import { OrdersController } from './orders.controller';

@Module({
  imports: [DatabaseModule, AuthModule, KitchenModule],
  controllers: [OrdersController],
  providers: [
    CutoffCalculatorService,
    CutoffProcessorService,
    CutoffSchedulerService,
    OrderCreationService,
    OrderPlanningService,
    OrderPricingService,
    OrderQueryService,
  ],
})
export class OrdersModule {}
