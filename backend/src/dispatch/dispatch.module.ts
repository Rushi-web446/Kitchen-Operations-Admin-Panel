import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { DispatchBoardService } from './dispatch-board.service';
import { DispatchController } from './dispatch.controller';
import { DispatchWorkflowService } from './dispatch-workflow.service';
import { DropGroupingService } from './drop-grouping.service';
import { DispatchService } from './dispatch.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [DispatchController],
  providers: [DispatchService, DispatchBoardService, DispatchWorkflowService, DropGroupingService],
})
export class DispatchModule {}
