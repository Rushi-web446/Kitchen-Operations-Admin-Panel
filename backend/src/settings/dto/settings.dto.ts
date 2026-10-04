import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length,
  Matches, Max, Min,
} from 'class-validator';
import { Weekday } from '@prisma/client';

export class UpdateSettingsDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  cutoffWorkingDays!: number;

  @Matches(/^\d{2}:\d{2}$/)
  cutoffTime!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(Weekday, { each: true })
  workingDays!: Weekday[];
}

export class CreateKitchenHolidayDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  description?: string;
}

export class CreateKitchenStationDto {
  @IsString()
  @Length(1, 60)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9 _-]*$/)
  name!: string;
}

export class UpdateKitchenStationDto {
  @IsBoolean()
  active!: boolean;
}

export class CreatePortionSizeDto {
  @IsString()
  @Length(1, 40)
  name!: string;
}

export class UpdatePortionSizeDto {
  @IsBoolean()
  active!: boolean;
}
