import { Body, Controller, Get, Param, ParseIntPipe, Put, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PricingService } from './pricing.service';
import { UpdateTierPricesDto } from './dto/tier-prices.dto';

@Controller(['pricing', 'admin/pricing'])
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('tiers')
  listTiers() {
    return this.pricingService.listTiers();
  }

  @Get('companies/:companyId/tier')
  getCompanyTier(@Param('companyId', ParseIntPipe) companyId: number) {
    return this.pricingService.resolveCompanyPriceTier(companyId);
  }

  @Get('tiers/:tierId/dish-prices')
  listDishPrices(@Param('tierId', ParseIntPipe) tierId: number) {
    return this.pricingService.listDishPrices(tierId);
  }

  @Put('tiers/:tierId/dish-prices')
  updateDishPrices(
    @Param('tierId', ParseIntPipe) tierId: number,
    @Body() dto: UpdateTierPricesDto,
  ) {
    return this.pricingService.updateDishPrices(tierId, dto.prices);
  }

  @Get('tiers/:tierId/option-prices')
  listOptionPrices(@Param('tierId', ParseIntPipe) tierId: number) {
    return this.pricingService.listOptionPrices(tierId);
  }

  @Put('tiers/:tierId/option-prices')
  updateOptionPrices(
    @Param('tierId', ParseIntPipe) tierId: number,
    @Body() dto: UpdateTierPricesDto,
  ) {
    return this.pricingService.updateOptionPrices(tierId, dto.prices);
  }
}
