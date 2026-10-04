import { IsOptional, Matches } from 'class-validator';

export class DashboardSummaryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  deliveryDate?: string;
}
