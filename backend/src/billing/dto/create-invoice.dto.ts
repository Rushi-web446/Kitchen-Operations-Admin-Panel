import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, IsPositive, Min } from 'class-validator';

export class CreateInvoiceDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyId!: number;

  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  orderIds!: number[];
}
