import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from 'src/common/db/pg.constants';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { SearchCompaniesDto } from './dto/search-companies.dto';

type Row = {
  id: string;
  name: string;
  email: string;
  admin_id: string | null;
  website: string | null;
  description: string | null;
  industry: string | null;
  location: string | null;
  profile_picture: string | null;
  cover_photo: string | null;
  company_rating: number | null;
  bool_verified: boolean | null;
  verified_at: string | null;
  subscription_plan: string | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) { }

  async list(limit = 20, offset = 0): Promise<Row[]> {
    const q = `
      SELECT id, name, email, admin_id, website, description, industry, location,
             profile_picture, cover_photo,
             company_rating, bool_verified, verified_at, subscription_plan,
             created_at, updated_at
      FROM companies
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const { rows } = await this.pool.query<Row>(q, [limit, offset]);
    return rows;
  }

  async getById(id: string): Promise<Row | undefined> {
    const q = `
      SELECT id, name, email, admin_id, website, description, industry, location,
             profile_picture, cover_photo,
             company_rating, bool_verified, verified_at, subscription_plan,
             created_at, updated_at
      FROM companies
      WHERE id = $1
    `;
    const { rows } = await this.pool.query<Row>(q, [id]);
    return rows[0];
  }

  async findByAdminId(adminId: string): Promise<Row | undefined> {
    const q = `
      SELECT id, name, email, admin_id, website, description, industry, location,
             profile_picture, cover_photo,
             company_rating, bool_verified, verified_at, subscription_plan,
             created_at, updated_at
      FROM companies
      WHERE admin_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const { rows } = await this.pool.query<Row>(q, [adminId]);
    return rows[0];
  }

  async create(dto: CreateCompanyDto): Promise<Row> {
    const q = `
      INSERT INTO companies (
        name, email, admin_id, website, description, industry, location,
        profile_picture, cover_photo,
        company_rating, bool_verified, verified_at, subscription_plan
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,
        $10,$11,$12,$13::subscription_plan
      )
      RETURNING id, name, email, admin_id, website, description, industry, location,
                profile_picture, cover_photo,
                company_rating, bool_verified, verified_at, subscription_plan,
                created_at, updated_at
    `;
    const values = [
      dto.name,
      dto.email,
      dto.adminId ?? null,
      dto.website ?? null,
      dto.description ?? null,
      dto.industry ?? null,
      dto.location ?? null,
      dto.profilePicture ?? null,
      dto.coverPhoto ?? null,
      dto.companyRating ?? null,
      dto.boolVerified ?? null,
      dto.verifiedAt ?? null,
      dto.subscriptionPlan ?? null,
    ];
    const { rows } = await this.pool.query<Row>(q, values);
    return rows[0];
  }

  async update(id: string, dto: UpdateCompanyDto): Promise<Row | undefined> {
    const sets: string[] = [];
    const vals: any[] = [];
    const add = (col: string, val: any, cast?: string) => {
      const idx = vals.length + 1;
      sets.push(`${col} = $${idx}${cast ? `::${cast}` : ''}`);
      vals.push(val);
    };

    if (dto.name !== undefined) add('name', dto.name);
    if (dto.email !== undefined) add('email', dto.email);
    if (dto.adminId !== undefined) add('admin_id', dto.adminId ?? null);
    if (dto.website !== undefined) add('website', dto.website ?? null);
    if (dto.description !== undefined) add('description', dto.description ?? null);
    if (dto.industry !== undefined) add('industry', dto.industry ?? null);
    if (dto.location !== undefined) add('location', dto.location ?? null);
    if (dto.profilePicture !== undefined) add('profile_picture', dto.profilePicture ?? null);
    if (dto.coverPhoto !== undefined) add('cover_photo', dto.coverPhoto ?? null);
    if (dto.companyRating !== undefined) add('company_rating', dto.companyRating ?? null);
    if (dto.boolVerified !== undefined) add('bool_verified', dto.boolVerified ?? null);
    if (dto.verifiedAt !== undefined) add('verified_at', dto.verifiedAt ?? null);
    if (dto.subscriptionPlan !== undefined) {
      add('subscription_plan', dto.subscriptionPlan ?? null, 'subscription_plan');
    }

    if (sets.length === 0) {
      return this.getById(id);
    }

    const q = `
      UPDATE companies
      SET ${sets.join(', ')}, updated_at = NOW()
      WHERE id = $${vals.length + 1}
      RETURNING id, name, email, admin_id, website, description, industry, location,
                profile_picture, cover_photo,
                company_rating, bool_verified, verified_at, subscription_plan,
                created_at, updated_at
    `;
    vals.push(id);
    const { rows } = await this.pool.query<Row>(q, vals);
    return rows[0];
  }

  async remove(id: string) {
    const q = `DELETE FROM companies WHERE id = $1`;
    await this.pool.query(q, [id]);
    return true;
  }

  async search(dto: SearchCompaniesDto): Promise<Row[]> {
    const where: string[] = [];
    const vals: any[] = [];
    const add = (fragment: string, val?: any, cast?: string) => {
      if (val === undefined) return;
      const idx = vals.length + 1;
      if (val !== null && cast) {
        where.push(`${fragment} $${idx}::${cast}`);
      } else {
        where.push(`${fragment} $${idx}`);
      }
      vals.push(val);
    };

    if (dto.q) {
      const idx = vals.length + 1;
      const pat = `%${dto.q}%`;
      where.push(
        `(
          name ILIKE $${idx}
          OR email ILIKE $${idx}
          OR description ILIKE $${idx}
          OR industry ILIKE $${idx}
          OR location ILIKE $${idx}
        )`
      );
      vals.push(pat);
    }

    if (dto.subscriptionPlan !== undefined && dto.subscriptionPlan !== null) {
      add(`subscription_plan =`, dto.subscriptionPlan, 'subscription_plan');
    }
    if (dto.boolVerified !== undefined && dto.boolVerified !== null) {
      add(`bool_verified =`, dto.boolVerified);
    }
    if (dto.minRating !== undefined && dto.minRating !== null) {
      add(`company_rating >=`, dto.minRating);
    }
    if (dto.maxRating !== undefined && dto.maxRating !== null) {
      add(`company_rating <=`, dto.maxRating);
    }
    if (dto.industry !== undefined && dto.industry !== null) {
      add(`industry ILIKE`, `%${dto.industry}%`);
    }
    if (dto.location !== undefined && dto.location !== null) {
      add(`location ILIKE`, `%${dto.location}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const sortMap: Record<string, string> = {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      name: 'name',
      rating: 'company_rating',
    };
    const sortCol = sortMap[dto.sortBy || 'createdAt'] || 'created_at';
    const order = (dto.order || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    vals.push(dto.limit ?? 50);
    vals.push(dto.offset ?? 0);

    const q = `
      SELECT id, name, email, admin_id, website, description, industry, location,
             profile_picture, cover_photo,
             company_rating, bool_verified, verified_at, subscription_plan,
             created_at, updated_at
      FROM companies
      ${whereSql}
      ORDER BY ${sortCol} ${order}
      LIMIT $${vals.length - 1} OFFSET $${vals.length}
    `;
    const { rows } = await this.pool.query<Row>(q, vals);
    return rows;
  }
}
