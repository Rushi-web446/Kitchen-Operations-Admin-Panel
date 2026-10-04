import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { BillingController, InvoiceController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [DatabaseModule],
  controllers: [BillingController, InvoiceController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
