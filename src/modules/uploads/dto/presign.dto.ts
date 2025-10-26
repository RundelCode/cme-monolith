import { 
  IsNotEmpty, 
  IsOptional, 
  IsString, 
  IsUUID, 
  Matches 
} from 'class-validator';

export class PresignDto {
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[^\\/:"*?<>|]+$/, {
    message: 'filename contiene caracteres inválidos',
  })
  filename!: string;

  @IsString()
  @IsOptional()
  contentType?: string;
}
