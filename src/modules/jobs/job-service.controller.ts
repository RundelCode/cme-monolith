import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JobServiceService } from './job-service.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { QuerySearchJobsDto } from './dto/query-search-jobs.dto';



function asArray(v: any): string[] | undefined {
  if (v == null) return undefined;
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === 'string' && v.length) return [v];
  return undefined;
}
function toNum(v: any): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}


@Controller('jobs')
export class JobServiceController {
  constructor(private readonly jobService: JobServiceService) { }

  @Get()
  list(
    @Query('status') status?: string,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    return this.jobService.list({
      status,
      limit: Number(limit),
      offset: Number(offset),
    });
  }

  @Get('search')
  async search(@Query() raw: any) {
    const skillsAny = asArray(raw.skillsAny ?? raw['skillsAny[]']);
    const skillsAll = asArray(raw.skillsAll ?? raw['skillsAll[]']);

    const q: QuerySearchJobsDto = {
      q: raw.q,
      employmentType: raw.employmentType,
      locationType: raw.locationType,
      location: raw.location,
      companyId: raw.companyId,
      status: raw.status,
      minSalary: toNum(raw.minSalary),
      maxSalary: toNum(raw.maxSalary),
      skillsAny,
      skillsAll,
      orderBy: raw.orderBy,
      limit: toNum(raw.limit) ?? 20,
      offset: toNum(raw.offset) ?? 0,
    };

    if (process.env.DEBUG_JOBS) {
      console.log('[JOBS /search] raw=', raw);
      console.log('[JOBS /search] normalized=', q);
    }

    return this.jobService.search(q);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.jobService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateJobDto) {
    console.log('[REST /jobs] body recibido:', body);
    return this.jobService.create(body); 
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() patch: UpdateJobDto,
  ) {
    return this.jobService.update(id, patch);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.jobService.remove(id);
  }
}
