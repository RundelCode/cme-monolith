// src/modules/companies/dto/update-company.dto.ts
import { Expose, Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, IsUrl, IsBoolean, IsNumber, IsUUID } from 'class-validator';
import { SubscriptionPlan } from './subscription-plan.enum';
import { ToNullIfEmpty, ToBooleanOrNull, ToNumberOrNull } from './_utils';

export class UpdateCompanyDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEmail() email?: string;

  @IsOptional()
  @IsUUID()
  @ToNullIfEmpty()
  adminId?: string | null;

  @IsOptional() @IsUrl() @ToNullIfEmpty()
  website?: string | null;

  @IsOptional() @IsString() @ToNullIfEmpty()
  description?: string | null;

  @IsOptional() @IsString() @ToNullIfEmpty()
  industry?: string | null;

  @IsOptional() @IsString() @ToNullIfEmpty()
  location?: string | null;

  @IsOptional()
  @IsUrl()
  @ToNullIfEmpty()
  @Transform(({ value, obj }) => value ?? obj?.profile_picture ?? null, { toClassOnly: true })
  profilePicture?: string | null;

  @IsOptional()
  @IsUrl()
  @ToNullIfEmpty()
  @Transform(({ value, obj }) => value ?? obj?.cover_photo ?? null, { toClassOnly: true })
  coverPhoto?: string | null;

  @Expose({ name: 'cover_photo' })
  private _cover?: unknown;

  @IsOptional() @IsNumber() @ToNumberOrNull()
  companyRating?: number | null;

  @IsOptional() @IsBoolean() @ToBooleanOrNull()
  boolVerified?: boolean | null;

  @IsOptional() @ToNullIfEmpty()
  verifiedAt?: string | null;

  @IsOptional() @IsEnum(SubscriptionPlan) @ToNullIfEmpty()
  subscriptionPlan?: SubscriptionPlan | null;
}
