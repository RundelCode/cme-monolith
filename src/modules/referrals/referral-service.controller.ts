import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ReferralsService } from './referral-service.service';
import { CreateReferralDto } from './dto/create-referral.dto';
import { UpdateReferralDto } from './dto/update-referral.dto';
import { QueryReferralsDto } from './dto/query-referrals.dto';
import { UpdateReferralStatusDto } from './dto/update-referral-status.dto';

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly service: ReferralsService) { }

  @Post()
  create(@Body() dto: CreateReferralDto) {
    return this.service.create(dto);
  }

  @Get()
  list(@Query() q: QueryReferralsDto) {
    return this.service.list(q);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateReferralDto) {
    return this.service.update(id, dto);
  }


  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(id);
  }

  @Get('by-headhunter/:headhunterId')
  listByHeadhunter(@Param('headhunterId', new ParseUUIDPipe()) headhunterId: string, @Query() q: QueryReferralsDto) {
    return this.service.listByHeadhunter(headhunterId, q);
  }

  @Get('by-candidate/:candidateId')
  listByCandidate(@Param('candidateId', new ParseUUIDPipe()) candidateId: string, @Query() q: QueryReferralsDto) {
    return this.service.listByCandidate(candidateId, q);
  }

  @Patch(':id/status')
  updateStatus(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateReferralStatusDto) {
    return this.service.updateStatus(id, dto.status);
  }
}
