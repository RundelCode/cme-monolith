import { IsNotEmpty, IsString } from 'class-validator';

export class PresignResponseDto {
  @IsString()
  @IsNotEmpty()
  bucket!: string;

  @IsString()
  @IsNotEmpty()
  path!: string;

  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @IsNotEmpty()
  publicUrl!: string;
}
