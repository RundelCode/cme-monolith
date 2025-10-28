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
  ValidationPipe,
  NotFoundException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { SearchCompaniesDto } from './dto/search-companies.dto';
import { CompaniesService } from './company-service.service';
import { HttpAuthGuard } from 'src/common/auth/http-auth.guard';

const bodyPipe = new ValidationPipe({
  transform: true,
  whitelist: false,
  forbidNonWhitelisted: false,
});

const queryPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: false,
});

@Controller('companies')
export class CompaniesController {
  constructor(private readonly service: CompaniesService) { }

  @Get()
  list(@Query('limit') limit = 50, @Query('offset') offset = 0) {
    return this.service.list(Number(limit), Number(offset));
  }

  @Get('search')
  async search(@Query(queryPipe) dto: SearchCompaniesDto) {
    const items = await this.service.search(dto as any);
    return Array.isArray(items) ? items : { items };
  }

  @Get(':id')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const row = await this.service.getById(id);
    if (!row) throw new NotFoundException('Company not found');
    return row;
  }

  @UseGuards(HttpAuthGuard)
  @Post()
  async create(@Req() req: any, @Body(bodyPipe) dto: CreateCompanyDto) {
    console.log("[CompaniesController:create] dto recibido >>>", dto);
    return this.service.create(dto);
  }

  @UseGuards(HttpAuthGuard)
  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body(bodyPipe) dto: UpdateCompanyDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(id);
  }

  @Get('by-admin/:adminId')
  async byAdmin(@Param('adminId', new ParseUUIDPipe()) adminId: string) {
    const row = await this.service.findByAdminId(adminId);
    if (!row) throw new NotFoundException('Company not found for this admin');
    return row;
  }
}
