import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdatePaymentDto {
  @IsOptional()
  @IsIn(['pending', 'succeeded', 'failed'])
  status?: 'pending' | 'succeeded' | 'failed';

  @IsOptional()
  @IsString()
  pspPaymentId?: string;
}
