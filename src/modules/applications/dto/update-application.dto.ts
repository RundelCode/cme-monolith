import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateApplicationDto {
  @IsOptional() @IsBoolean()
  accepted?: boolean;

  @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;
}
