import { IsIn, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export type PaymentDirectionTs = 'in' | 'out';
export type PaymentStatusTs = 'pending' | 'succeeded' | 'failed';

export class QueryPaymentsDto {
  @IsOptional() @IsUUID() companyId?: string;
  @IsOptional() @IsUUID() headhunterId?: string;
  @IsOptional() @IsUUID() jobOfferId?: string;

  @IsOptional()
  @IsIn(['in', 'out'])
  direction?: PaymentDirectionTs;

  @IsOptional()
  @IsIn(['pending', 'succeeded', 'failed'])
  status?: PaymentStatusTs;

  @IsOptional()
  from?: string;

  @IsOptional()
  to?: string;


  @IsOptional()
  mine?: string | boolean;


  @IsOptional()
  all?: string | boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
