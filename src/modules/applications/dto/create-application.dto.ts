import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateApplicationDto {
  @IsUUID() jobOfferId!: string;
  @IsUUID() candidateId!: string;
  @IsBoolean() accepted!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
