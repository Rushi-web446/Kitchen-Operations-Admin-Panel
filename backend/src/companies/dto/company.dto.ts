import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Weekday } from '@prisma/client';

export class CompanyAddressDto {
  @IsString()
  @Length(1, 80)
  label!: string;

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

  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateCompanyDto {
  @IsString()
  @Length(1, 160)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @Matches(/^[a-z0-9.-]+\.[a-z]{2,}$/i, { each: true })
  emailDomains!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CompanyAddressDto)
  addresses!: CompanyAddressDto[];

  @IsOptional()
  @IsString()
  @Length(1, 120)
  billingContactName?: string;

  @IsOptional()
  @IsEmail()
  billingContactEmail?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priceTierId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ownerEmployeeId?: number;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  defaultDeliveryTime?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  deliveryMinutes = 60;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(Weekday, { each: true })
  deliveryWorkingDays: Weekday[] = [
    Weekday.MONDAY, Weekday.TUESDAY, Weekday.WEDNESDAY, Weekday.THURSDAY, Weekday.FRIDAY,
  ];

  @IsOptional()
  @IsString()
  @Length(1, 80)
  defaultPackaging?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  driverInstructions?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultDriverId?: number;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  hiddenCategoryIds?: number[];

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  hiddenDishIds?: number[];
}

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @Length(1, 160)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @Matches(/^[a-z0-9.-]+\.[a-z]{2,}$/i, { each: true })
  emailDomains?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CompanyAddressDto)
  addresses?: CompanyAddressDto[];

  @IsOptional()
  @IsString()
  @Length(1, 120)
  billingContactName?: string;

  @IsOptional()
  @IsEmail()
  billingContactEmail?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priceTierId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ownerEmployeeId?: number | null;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  defaultDeliveryTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  deliveryMinutes?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(Weekday, { each: true })
  deliveryWorkingDays?: Weekday[];

  @IsOptional()
  @IsString()
  @Length(1, 80)
  defaultPackaging?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  driverInstructions?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultDriverId?: number | null;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  hiddenCategoryIds?: number[];

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  hiddenDishIds?: number[];
}

export class ListCompaniesDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}

export class CompanyHolidayDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  description?: string;
}
