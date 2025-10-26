import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Matches, Length } from 'class-validator';

export class CreateReferralDto {
  @IsUUID() headhunterId!: string;

  @IsOptional()
  @IsUUID()
  candidateId?: string | null;

  @IsUUID() jobOfferId!: string;

  @IsOptional()
  @IsIn(['submitted','accepted_by_candidate','declined_by_candidate','reviewing','rejected','shortlist','hired'])
  status?: 'submitted' | 'accepted_by_candidate' | 'declined_by_candidate' |
           'reviewing' | 'rejected' | 'shortlist' | 'hired';

  @IsOptional()
  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.toUpperCase() : value)
  @Length(6,6)
  @Matches(/^[A-Z0-9]{6}$/)
  referralCode?: string;
}
