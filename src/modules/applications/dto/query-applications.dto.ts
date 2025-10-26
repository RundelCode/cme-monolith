import { Type } from 'class-transformer';
import { IsBooleanString, IsOptional, IsUUID, IsInt, Min } from 'class-validator';

export class QueryApplicationsDto {
  @IsOptional() @IsUUID()
  jobOfferId?: string;

  @IsOptional() @IsUUID()
  candidateId?: string;

  @IsOptional() @IsBooleanString()
  accepted?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset?: number = 0;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit?: number = 50;
}
