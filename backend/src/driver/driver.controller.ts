import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { DeliverDropDto } from './dto/deliver-drop.dto';
import { DriverDropService } from './driver-drop.service';

@Controller('driver')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DRIVER)
export class DriverController {
  constructor(private readonly driverDrops: DriverDropService) {}

  @Get('drops')
  listAssignedDrops(@CurrentUser() user: AuthenticatedUser) {
    if (!user.driverId) {
      throw new ForbiddenException('Authenticated user has no driver profile');
    }
    return this.driverDrops.listToday(user.driverId);
  }

  @Get('drops/today')
  listToday(@CurrentUser() user: AuthenticatedUser) {
    if (!user.driverId) {
      throw new ForbiddenException('Authenticated user has no driver profile');
    }
    return this.driverDrops.listToday(user.driverId);
  }

  @Get('drops/:id')
  getDrop(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!user.driverId) {
      throw new ForbiddenException('Authenticated user has no driver profile');
    }
    return this.driverDrops.getDrop(user.driverId, id);
  }

  @Post('drops/:id/deliver')
  deliver(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeliverDropDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!user.driverId) {
      throw new ForbiddenException('Authenticated user has no driver profile');
    }
    return this.driverDrops.deliver(user.driverId, id, dto);
  }
}