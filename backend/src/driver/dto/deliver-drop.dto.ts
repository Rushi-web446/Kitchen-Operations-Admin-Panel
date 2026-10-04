import { IsOptional, IsString, IsUrl, Length } from 'class-validator';

export class DeliverDropDto {
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  note?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @Length(1, 2048)
  photoUrl?: string;
}