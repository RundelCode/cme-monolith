// apps/company-service/src/dto/search-companies.dto.ts
import { Transform } from 'class-transformer';
import {
  IsBoolean, IsEnum, IsIn, IsNumber, IsOptional, IsString,
} from 'class-validator';
import { SubscriptionPlan } from './subscription-plan.enum';
import { ToBooleanOrNull, ToNumberOrNull, ToNullIfEmpty } from './_utils';

export class SearchCompaniesDto {
  @IsOptional()
  @IsString()
  @ToNullIfEmpty()
  q?: string | null;

  @IsOptional()
  @IsEnum(SubscriptionPlan)
  @ToNullIfEmpty()
  subscriptionPlan?: SubscriptionPlan | null;

  @IsOptional()
  @IsBoolean()
  @ToBooleanOrNull()
  boolVerified?: boolean | null;

  @IsOptional()
  @IsNumber()
  @ToNumberOrNull()
  minRating?: number | null;

  @IsOptional()
  @IsNumber()
  @ToNumberOrNull()
  maxRating?: number | null;

  @IsOptional()
  @IsString()
  @ToNullIfEmpty()
  industry?: string | null;

  @IsOptional()
  @IsString()
  @ToNullIfEmpty()
  location?: string | null;

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'name', 'rating'])
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'rating';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @Transform(({ value }) => Number.isFinite(+value) ? +value : 50)
  limit?: number = 50;

  @IsOptional()
  @Transform(({ value }) => Number.isFinite(+value) ? +value : 0)
  offset?: number = 0;
}
