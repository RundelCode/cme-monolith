import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class QueryReferralsDto {
  @IsOptional() @IsUUID() headhunterId?: string;
  @IsOptional() @IsUUID() candidateId?: string;
  @IsOptional() @IsUUID() jobOfferId?: string;

  @IsOptional()
  @IsIn(['submitted','accepted_by_candidate','declined_by_candidate','reviewing','rejected','shortlist','hired'])
  status?: 'submitted' | 'accepted_by_candidate' | 'declined_by_candidate' |
           'reviewing' | 'rejected' | 'shortlist' | 'hired';

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number = 50;
}
