import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsUUID, IsInt, Min } from 'class-validator';

export class QueryNotificationsDto {
  @IsOptional() @IsUUID() userId?: string;

  @IsOptional()
  @IsIn(['queued', 'sent', 'failed'])
  status?: 'queued' | 'sent' | 'failed';

  @IsOptional()
  @IsIn(['job_offer', 'recommendation', 'payment', 'system_message'])
  notificationType?: 'job_offer' | 'recommendation' | 'payment' | 'system_message';

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset?: number = 0;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit?: number = 50;
}
