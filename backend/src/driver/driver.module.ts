import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { DriverController } from './driver.controller';
import { DriverDropService } from './driver-drop.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [DriverController],
  providers: [DriverDropService],
})
export class DriverModule {}