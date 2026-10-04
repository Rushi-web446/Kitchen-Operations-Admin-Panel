import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogueController } from './catalogue.controller';
import { CatalogueService } from './catalogue.service';
import { DatabaseModule } from '../database/database.module';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [DatabaseModule, AuthModule, PricingModule],
  controllers: [CatalogueController],
  providers: [CatalogueService],
})
export class CatalogueModule {}
