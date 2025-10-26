import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { extname } from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class UploadsService {
  private admin: SupabaseClient;
  private readonly avatarsBucket: string;
  private readonly coversBucket: string;
  private readonly logger = new Logger(UploadsService.name);

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL');
    const service = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !service) {
      throw new BadRequestException('Supabase config missing');
    }

    this.admin = createClient(url, service, { auth: { persistSession: false } });
    this.avatarsBucket =
      this.config.get<string>('UPLOADS_AVATARS_BUCKET') ?? 'user-avatars';
    this.coversBucket =
      this.config.get<string>('UPLOADS_COVERS_BUCKET') ?? 'user-covers';

    this.logger.log(
      `Initialized UploadsService with buckets: avatars=${this.avatarsBucket}, covers=${this.coversBucket}`,
    );
  }

  // ----------- AUTH HELPERS -----------
  private parseBearer(authHeader?: string): string | null {
    if (!authHeader) return null;
    const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
    return m?.[1] ?? null;
  }

  /**
   * Versión "estricta": si no hay token o no existe el usuario → 401
   */
  async getUserIdByAccessTokenOrThrow(authHeader?: string): Promise<string> {
    const token = this.parseBearer(authHeader);
    if (!token) {
      throw new UnauthorizedException('missing_bearer_token');
    }
    const { data, error } = await this.admin.auth.getUser(token);
    if (error || !data?.user?.id) {
      this.logger.warn(`[auth] getUser failed: ${error?.message || 'no user'}`);
      throw new UnauthorizedException('invalid_token');
    }
    return data.user.id;
  }

  // ----------- VALIDATION -----------
  private validateMulterImage(file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('file_required');
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!ok.includes(file.mimetype)) throw new BadRequestException('invalid_mime');
    if (file.size > 10 * 1024 * 1024)
      throw new BadRequestException('file_too_large');
  }

  // ----------- CORE UPLOAD -----------
  private async uploadBuffer(
    bucket: string,
    objectPath: string,
    file: Express.Multer.File,
  ) {
    const { error } = await this.admin.storage.from(bucket).upload(objectPath, file.buffer, {
      contentType: file.mimetype,
      upsert: false, // evita sobrescribir
    });

    if (error) {
      this.logger.error(`[uploadBuffer] ${error.message}`);
      throw new BadRequestException('upload_failed');
    }

    const { data: pub } = this.admin.storage.from(bucket).getPublicUrl(objectPath);
    return { url: pub.publicUrl, bucket, path: objectPath };
  }

  // ----------- PUBLIC METHODS -----------
  async uploadAvatarOneShot(userId: string, file: Express.Multer.File) {
    this.validateMulterImage(file);
    const ext = (extname(file.originalname || '') || '.jpg').toLowerCase();
    const path = `users/${userId}/avatar-${randomUUID()}${ext}`;
    return this.uploadBuffer(this.avatarsBucket, path, file);
  }

  async uploadCoverOneShot(userId: string, file: Express.Multer.File) {
    this.validateMulterImage(file);
    const ext = (extname(file.originalname || '') || '.jpg').toLowerCase();
    const path = `users/${userId}/cover-${randomUUID()}${ext}`;
    return this.uploadBuffer(this.coversBucket, path, file);
  }
}
