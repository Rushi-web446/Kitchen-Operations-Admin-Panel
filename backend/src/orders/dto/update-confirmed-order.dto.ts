import {
  IsInt, IsOptional, IsString, Length, Matches, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateConfirmedOrderDto {
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  deliveryTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  deliveryAddressId?: number;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  packaging?: string;
}
