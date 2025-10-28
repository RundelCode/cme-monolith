import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class UpdateReferralDto {
  @IsOptional()
  @IsIn([
    'submitted',
    'accepted_by_candidate',
    'declined_by_candidate',
    'reviewing',
    'rejected',
    'shortlist',
    'hired'
  ])
  status?:
    | 'submitted'
    | 'accepted_by_candidate'
    | 'declined_by_candidate'
    | 'reviewing'
    | 'rejected'
    | 'shortlist'
    | 'hired';

  @IsOptional()
  @IsUUID()
  candidateId?: string;

  @IsOptional()
  @IsUUID()
  candidate_id?: string;
}
