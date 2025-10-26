import { IsUUID, IsNumber, IsPositive, IsString, IsOptional, Min, Max } from 'class-validator';

export class StartReferralCheckoutDto {
  @IsUUID()
  referralId!: string;

  @IsNumber() @IsPositive()
  amount!: number;

  @IsString()
  currency!: string; // 'COP', 'PAB', etc.

  @IsOptional() @Min(0) @Max(1)
  referralPercent?: number; // default via env REFERRAL_PERCENT
}
