import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsInt, IsNumberString, IsOptional, Min,
  ValidateNested,
} from 'class-validator';

export class TierPriceEntryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  itemId!: number;

  @IsOptional()
  @IsNumberString()
  overridePrice?: string;
}

export class UpdateTierPricesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TierPriceEntryDto)
  prices!: TierPriceEntryDto[];
}
