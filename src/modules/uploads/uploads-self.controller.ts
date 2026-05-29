import {
  Controller,
  Headers,
  Post,
  UploadedFile,
  UseInterceptors,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadsService } from './uploads-service.service';

@Controller('uploads/self')
export class UploadsSelfController {
  constructor(private readonly uploads: UploadsService) { }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, 
    }),
  )
  async uploadAvatarOneShot(
    @Headers('x-user-id') userId: string | undefined,
    @UploadedFile() file: any,
    @Headers('x-internal-gateway') fromGateway: string | undefined,
  ) {
    if (!fromGateway) {
      throw new ForbiddenException('forbidden_origin');
    }

    if (!userId) {
      throw new UnauthorizedException('missing_user_id');
    }
    return this.uploads.uploadAvatarOneShot(userId, file);
  }

  @Post('cover')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadCoverOneShot(
    @Headers('x-user-id') userId: string | undefined,
    @UploadedFile() file: any,
    @Headers('x-internal-gateway') fromGateway: string | undefined,
  ) {
    if (!fromGateway) {
      throw new ForbiddenException('forbidden_origin');
    }
    if (!userId) {
      throw new UnauthorizedException('missing_user_id');
    }
    return this.uploads.uploadCoverOneShot(userId, file);
  }
}
