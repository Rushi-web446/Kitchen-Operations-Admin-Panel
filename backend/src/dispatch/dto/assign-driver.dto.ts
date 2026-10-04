import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class AssignDriverDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  driverId!: number;
}