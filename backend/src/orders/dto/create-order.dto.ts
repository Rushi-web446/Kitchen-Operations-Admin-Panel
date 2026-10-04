import { OrderStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class DeliveryAddressSnapshotDto {
  @IsString()
  @Length(1, 120)
  recipientName!: string;

  @IsString()
  @Length(1, 180)
  addressLine1!: string;

  @IsOptional()
  @IsString()
  @Length(1, 180)
  addressLine2?: string;

  @IsString()
  @Length(1, 100)
  city!: string;

  @IsString()
  @Length(1, 100)
  region!: string;

  @IsString()
  @Length(1, 24)
  postalCode!: string;

  @IsString()
  @Length(2, 2)
  country!: string;
}

export class SelectedOptionGroupDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  optionGroupId!: number;

  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  optionIds!: number[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedOptionPortionDto)
  portions?: SelectedOptionPortionDto[];
}

export class SelectedOptionPortionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  optionId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  portionId!: number;
}

export class OrderCombinationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedOptionGroupDto)
  selections!: SelectedOptionGroupDto[];
}

export class CreateOrderLineDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dishId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderCombinationDto)
  combinations!: OrderCombinationDto[];
}

export class CreateOrderDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  deliveryAddressId?: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  deliveryDate!: string;

  @Matches(/^\d{2}:\d{2}$/)
  deliveryTime!: string;

  @IsOptional()
  @IsIn([OrderStatus.DRAFT, OrderStatus.PLACED])
  status?: OrderStatus;

  @IsOptional()
  @IsBoolean()
  overrideCutoff?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryAddressSnapshotDto)
  deliveryAddressSnapshot?: DeliveryAddressSnapshotDto;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  packaging?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderLineDto)
  lines!: CreateOrderLineDto[];
}
