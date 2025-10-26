import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, ParseUUIDPipe, ValidationPipe,
  NotFoundException,
} from '@nestjs/common';
import { CompaniesService } from './company-service.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { SearchCompaniesDto } from './dto/search-companies.dto';

const bodyPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: false,
});

const queryPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: false,
});

@Controller('companies')
export class CompaniesController {
  constructor(private readonly service: CompaniesService) {}

  @Get()
  list(@Query('limit') limit = 50, @Query('offset') offset = 0) {
    return this.service.list(Number(limit), Number(offset));
  }

  @Get('search')
  search(@Query(queryPipe) dto: SearchCompaniesDto) {
    return this.service.search(dto);
  }

  @Get(':id')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const row = await this.service.getById(id);
    if (!row) throw new NotFoundException('Company not found');
    return row;
  }

  @Post()
  create(@Body(bodyPipe) dto: CreateCompanyDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(bodyPipe) dto: UpdateCompanyDto,
  ) {
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
