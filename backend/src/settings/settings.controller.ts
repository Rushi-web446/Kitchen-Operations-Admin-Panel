import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateKitchenHolidayDto,
  CreateKitchenStationDto,
  CreatePortionSizeDto,
  UpdatePortionSizeDto,
  UpdateKitchenStationDto,
  UpdateSettingsDto,
} from './dto/settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get() {
    return this.settings.get();
  }

  @Put()
  update(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }

  @Post('holidays')
  addHoliday(@Body() dto: CreateKitchenHolidayDto) {
    return this.settings.addHoliday(dto);
  }

  @Delete('holidays/:id')
  removeHoliday(@Param('id', ParseIntPipe) id: number) {
    return this.settings.removeHoliday(id);
  }

  @Get('kitchen-stations')
  @Roles(Role.ADMIN, Role.KITCHEN)
  listKitchenStations() {
    return this.settings.listKitchenStations();
  }

  @Post('kitchen-stations')
  createKitchenStation(@Body() dto: CreateKitchenStationDto) {
    return this.settings.createKitchenStation(dto.name);
  }

  @Patch('kitchen-stations/:id')
  updateKitchenStation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateKitchenStationDto,
  ) {
    return this.settings.updateKitchenStation(id, dto.active);
  }

  @Get('portion-sizes')
  @Roles(Role.ADMIN, Role.KITCHEN)
  listPortionSizes() {
    return this.settings.listPortionSizes();
  }

  @Post('portion-sizes')
  createPortionSize(@Body() dto: CreatePortionSizeDto) {
    return this.settings.createPortionSize(dto.name);
  }

  @Patch('portion-sizes/:id')
  updatePortionSize(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePortionSizeDto,
  ) {
    return this.settings.updatePortionSize(id, dto.active);
  }
}
