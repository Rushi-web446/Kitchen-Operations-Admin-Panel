import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { AdminKitchenController, KitchenController } from './kitchen.controller';
import { KitchenUnitProvisioningService } from './kitchen-unit-provisioning.service';
import { KitchenUnitWorkflowService } from './kitchen-unit-workflow.service';
import { KitchenBoardService } from './kitchen-board.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [KitchenController, AdminKitchenController],
  providers: [
    KitchenUnitProvisioningService,
    KitchenUnitWorkflowService,
    KitchenBoardService,
  ],
  exports: [KitchenUnitProvisioningService],
})
export class KitchenModule {}
