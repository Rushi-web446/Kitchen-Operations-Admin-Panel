import { KitchenUnitStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';

export class KitchenBoardQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  deliveryDate?: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  kitchenStation?: string;

  @IsOptional()
  @IsEnum(KitchenUnitStatus)
  status?: KitchenUnitStatus;
}