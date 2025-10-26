import { IsIn } from 'class-validator';

export class UpdateReferralStatusDto {
  @IsIn(['submitted','accepted_by_candidate','declined_by_candidate','reviewing','rejected','shortlist','hired'])
  status!: 'submitted' | 'accepted_by_candidate' | 'declined_by_candidate' |
           'reviewing' | 'rejected' | 'shortlist' | 'hired';
}
