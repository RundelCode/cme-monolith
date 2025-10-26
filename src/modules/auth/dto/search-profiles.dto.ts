import { Transform } from 'class-transformer';
import {
  IsArray, IsBoolean, IsEnum, IsIn, IsNumber, IsOptional, IsString, Min, MaxLength, ArrayNotEmpty, ArrayMinSize
} from 'class-validator';

export class SearchProfilesDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsEnum(['candidate','company_admin','headhunter','admin'] as const)
  role?: 'candidate' | 'company_admin' | 'headhunter' | 'admin';

  @IsOptional()
  @IsEnum(['active','inactive','banned','pending'] as const)
  status?: 'active' | 'inactive' | 'banned' | 'pending';

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => value != null ? Number(value) : value)
  minReputation?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => value != null ? Number(value) : value)
  maxReputation?: number;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => Array.isArray(value) ? value : (value ? [value] : undefined))
  skillsAny?: string[];

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => Array.isArray(value) ? value : (value ? [value] : undefined))
  skillsAll?: string[];

  @IsOptional()
  @IsIn(['createdAt','updatedAt','reputation','name'])
  sortBy?: 'createdAt' | 'updatedAt' | 'reputation' | 'name';

  @IsOptional()
  @IsIn(['asc','desc','ASC','DESC'])
  order?: 'asc' | 'desc' | 'ASC' | 'DESC';

  @IsOptional()
  @Transform(({ value }) => Number.isFinite(+value) ? +value : 50)
  @Min(1)
  limit?: number = 50;

  @IsOptional()
  @Transform(({ value }) => Number.isFinite(+value) ? +value : 0)
  @Min(0)
  offset?: number = 0;
}
