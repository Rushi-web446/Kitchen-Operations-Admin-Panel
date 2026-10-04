import { Type } from 'class-transformer';
import {
  ArrayUnique, IsArray, IsBoolean, IsEmail, IsInt, IsOptional, IsString,
  Length, Max, Min,
} from 'class-validator';

export class CreateEmployeeDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyId!: number;

  @IsString()
  @Length(1, 120)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsBoolean()
  canChooseDeliveryAddress?: boolean;

  @IsOptional()
  @IsBoolean()
  canChangeDeliveryTime?: boolean;

  @IsOptional()
  @IsBoolean()
  canChangePackaging?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  allergenIds?: number[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  dietaryTagIds?: number[];
}

export class UpdateEmployeeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyId?: number;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  canChooseDeliveryAddress?: boolean;

  @IsOptional()
  @IsBoolean()
  canChangeDeliveryTime?: boolean;

  @IsOptional()
  @IsBoolean()
  canChangePackaging?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  allergenIds?: number[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  dietaryTagIds?: number[];
}

export class ListEmployeesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyId?: number;

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

export class ImportEmployeesDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyId!: number;

  @IsString()
  @Length(1, 1_000_000)
  csv!: string;
}
