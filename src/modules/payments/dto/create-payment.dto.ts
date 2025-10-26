import { IsUUID, IsNumber, IsPositive, IsString, IsIn, IsOptional } from 'class-validator';

export class CreatePaymentDto {
  @IsOptional() @IsUUID()
  jobOfferId?: string;

  @IsOptional() @IsUUID()
  headhunterId?: string;

  @IsUUID()
  companyId!: string;

  @IsNumber() @IsPositive()
  amount!: number;

  @IsString()
  currency!: string;

  // Debe coincidir con tu enum de DB: 'in' | 'out'
  @IsOptional()
  @IsIn(['in', 'out'])
  direction?: 'in' | 'out';

  @IsOptional()
  @IsString()
  pspPaymentId?: string;
}
