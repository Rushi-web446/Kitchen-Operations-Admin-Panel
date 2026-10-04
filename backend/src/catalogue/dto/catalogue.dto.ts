import { Type } from 'class-transformer';
import {
  ArrayUnique, IsArray, IsBoolean, IsInt, IsNumberString,
  IsOptional, IsString, IsUrl, Length, Matches, Max, Min,
  ValidateNested,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CategoryDto {
  @IsString() @Length(1, 100) name!: string;
  @IsOptional() @IsString() @Length(1, 500) description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) displayOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() secret?: boolean;
}

export class DishDto {
  @Type(() => Number) @IsInt() @Min(1) categoryId!: number;
  @IsString() @Length(1, 160) name!: string;
  @IsOptional() @IsString() @Length(1, 2000) description?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) @Length(1, 2048) imageUrl?: string;
  @IsString() @Length(1, 80) sku!: string;
  @Matches(/^(HOT|COLD)$/i) temperature!: string;
  @IsNumberString() costPrice!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) displayOrder?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) minimumOrderQuantity?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() @Length(1, 60) kitchenStation?: string;
  @IsOptional() @IsArray() @ArrayUnique() @Type(() => Number) @IsInt({ each: true }) allergenIds?: number[];
  @IsOptional() @IsArray() @ArrayUnique() @Type(() => Number) @IsInt({ each: true }) dietaryTagIds?: number[];
  @IsOptional() @IsArray() @ArrayUnique() @Type(() => Number) @IsInt({ each: true }) optionGroupIds?: number[];
}

export class OptionDto {
  @IsString() @Length(1, 120) name!: string;
  @IsNumberString() costPrice!: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsArray() @ArrayUnique() @Type(() => Number) @IsInt({ each: true }) allergenIds?: number[];
  @IsOptional() @IsArray() @ArrayUnique() @Type(() => Number) @IsInt({ each: true }) dietaryTagIds?: number[];
}

export class OptionGroupDto {
  @IsString() @Length(1, 120) name!: string;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsBoolean() usesPortions?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minSelections?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maxSelections?: number;
  @IsOptional() @IsArray() @ArrayUnique() @Type(() => Number) @IsInt({ each: true }) optionIds?: number[];
  @IsOptional() @IsArray() @ArrayUnique() @Type(() => Number) @IsInt({ each: true }) dishIds?: number[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OptionGroupPortionDto) portions?: OptionGroupPortionDto[];
}

export class OptionGroupPortionDto {
  @Type(() => Number) @IsInt() @Min(1) optionId!: number;
  @Type(() => Number) @IsInt() @Min(1) portionSizeId!: number;
  @IsNumberString() extraPrice!: string;
}

export class ListCatalogueDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) categoryId?: number;
  @IsOptional() @IsString() @Length(1, 100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset = 0;
}

export class MenuPreviewQueryDto {
  @Type(() => Number) @IsInt() @Min(1) companyId!: number;
  @Type(() => Number) @IsInt() @Min(1) employeeId!: number;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) deliveryDate?: string;
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean()
  includeSecretCategories?: boolean;
}

export class ReferenceNameDto {
  @IsString() @Length(1, 100) name!: string;
}
