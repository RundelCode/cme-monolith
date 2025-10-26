import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseServer } from './supabase.server';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class HttpAuthGuard implements CanActivate {
  constructor(
    private readonly supabase: SupabaseServer,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers['authorization'] || '';
    const token =
      typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')
        ? auth.slice(7).trim()
        : null;

    if (!token) throw new UnauthorizedException('Missing token');

    const { user } = await this.supabase.getUserFromToken(token);
    if (!user) throw new UnauthorizedException('Invalid token');

    req.user = user;
    return true;
  }
}
