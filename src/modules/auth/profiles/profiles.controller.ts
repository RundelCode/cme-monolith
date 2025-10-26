import {
  Controller, Get, Post, Patch, Body, Query, Param,
  UseGuards, ValidationPipe, ParseUUIDPipe
} from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { SearchProfilesDto } from '../dto/search-profiles.dto';
import { HttpAuthGuard } from 'src/common/auth/http-auth.guard';
import { AuthUser } from 'src/common/auth/auth-user.decorator';

const queryPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: false,
});

const bodyPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: false,
});

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly svc: ProfilesService) {}

  @Get('search')
  searchGet(@Query(queryPipe) dto: SearchProfilesDto) {
    return this.svc.search(dto);
  }

  @Post('search')
  searchPost(@Body(bodyPipe) dto: SearchProfilesDto) {
    return this.svc.search(dto);
  }

  @UseGuards(HttpAuthGuard)
  @Get('me')
  getMe(@AuthUser() user: any) {
    return this.svc.findOne(user.id);
  }

  @UseGuards(HttpAuthGuard)
  @Post('me')
  upsertMe(
    @AuthUser() user: any,
    @Body() body: {
      email?: string; full_name?: string; phone?: string;
      role?: 'candidate'|'company_admin'|'headhunter'|'admin';
      status?: 'active'|'inactive'|'banned'|'pending';
      profile_picture?: string; cover_photo?: string; occupation?: string; about_me?: string;
      skills?: string[]; experience?: any; education?: any; cv_url?: string;
      reputation_score?: number;
    }
  ) {
    const payload = { email: user.email, ...body };
    return this.svc.upsert(user.id, payload);
  }

  @UseGuards(HttpAuthGuard)
  @Patch('me')
  patchMe(@AuthUser() user: any, @Body() patch: Record<string, any>) {
    return this.svc.updatePartial(user.id, patch);
  }

  @Get(':id')
  getById(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.svc.findOne(id);
  }
}
