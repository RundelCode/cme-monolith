import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateNotificationDto {
  @IsUUID() userId!: string;

  @IsString() @MaxLength(180)
  title!: string;

  @IsString() @MaxLength(5000)
  message!: string;

  @IsIn(['job_offer', 'recommendation', 'payment', 'system_message'])
  notificationType!: 'job_offer' | 'recommendation' | 'payment' | 'system_message';

  @IsIn(['email', 'system'])
  channel!: 'email' | 'system';

  @IsOptional()
  @IsUUID()
  relatedId?: string;
}
