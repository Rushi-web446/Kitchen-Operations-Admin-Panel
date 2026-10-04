import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { OrderPricingService } from '../orders/order-pricing.service';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PricingController],
  providers: [PricingService, OrderPricingService],
  exports: [PricingService],
})
export class PricingModule {}
