import {
  BadRequestException,
  ConflictException,
  Injectable,
  Inject,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from './db/db.module';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { QuerySearchJobsDto } from './dto/query-search-jobs.dto';

@Injectable()
export class JobServiceService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async list({
    status,
    limit = 50,
    offset = 0,
  }: {
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const params: any[] = [];
    let where = '';

    if (status) {
      params.push(status);
      where = `WHERE status = $1`;
    }

    params.push(limit, offset);

    const sql = `
      SELECT
        id,
        company_id,
        title,
        status,
        created_at
      FROM public.job_offers
      ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    try {
      const { rows } = await this.pool.query(sql, params);
      return rows;
    } catch {
      throw new InternalServerErrorException('Unexpected error listing job offers');
    }
  }

  async findOne(id: string) {
    try {
      const { rows } = await this.pool.query(
        `
        SELECT
          id,
          company_id,
          title,
          description,
          employment_type,
          location_type,
          skills,
          requirements,
          location,
          salary,
          currency,
          status,
          created_at,
          updated_at
        FROM public.job_offers
        WHERE id = $1
        `,
        [id],
      );
      if (!rows[0]) throw new NotFoundException('job_offer_not_found');
      return rows[0];
    } catch (err: any) {
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Unexpected error finding job offer');
    }
  }

  // POST /jobs
  async create(input: CreateJobDto) {
    const sql = `
      INSERT INTO public.job_offers
        (
          company_id,
          title,
          description,
          employment_type,
          location_type,
          skills,
          requirements,
          location,
          salary,
          currency,
          status
        )
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'open')
      RETURNING
        id,
        company_id,
        title,
        description,
        employment_type,
        location_type,
        skills,
        requirements,
        location,
        salary::double precision AS salary,  -- 👈 cast
        currency,
        status,
        created_at,
        updated_at
    `;
    const params = [
      input.companyId,
      input.title,
      input.description,
      input.employmentType,
      input.locationType,
      input.skills ?? null,
      input.requirements ?? null,
      input.location ?? null,
      input.salary ?? null,
      input.currency ?? null,
    ];

    try {
      const { rows } = await this.pool.query(sql, params);
      return rows[0];
    } catch (err: any) {
      if (err.code === '22P02') {
        throw new BadRequestException('Invalid enum or data type');
      }
      if (err.code === '23503') {
        throw new BadRequestException(`Invalid reference: ${err.detail}`);
      }
      if (err.code === '23505') {
        throw new ConflictException('Job offer already exists');
      }
      throw new InternalServerErrorException('Unexpected error creating job offer');
    }
  }

  // PATCH /jobs/:id
  async update(id: string, patch: UpdateJobDto) {
    const sets: string[] = [];
    const params: any[] = [];
    const push = (col: string, val: any) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };

    if (patch.title !== undefined)          push('title', patch.title);
    if (patch.description !== undefined)    push('description', patch.description);
    if (patch.employmentType !== undefined) push('employment_type', patch.employmentType);
    if (patch.locationType !== undefined)   push('location_type', patch.locationType);
    if (patch.skills !== undefined)         push('skills', patch.skills);
    if (patch.requirements !== undefined)   push('requirements', patch.requirements);
    if (patch.location !== undefined)       push('location', patch.location);
    if (patch.status !== undefined)         push('status', patch.status);
    if (patch.salary !== undefined)         push('salary', patch.salary);       // 👈 incluye salary
    if (patch.currency !== undefined)       push('currency', patch.currency);   // 👈 incluye currency

    if (sets.length === 0) {
      // nada que actualizar -> devuelve el actual
      return this.findOne(id);
    }

    sets.push(`updated_at = now()`);
    params.push(id);

    const sql = `
      UPDATE public.job_offers
      SET ${sets.join(', ')}
      WHERE id = $${params.length}
      RETURNING
        id,
        company_id,
        title,
        description,
        employment_type,
        location_type,
        skills,
        requirements,
        location,
        salary::double precision AS salary,  -- 👈 cast
        currency,
        status,
        created_at,
        updated_at
    `;

    try {
      const { rows } = await this.pool.query(sql, params);
      if (!rows[0]) throw new NotFoundException('job_offer_not_found');
      return rows[0];
    } catch (err: any) {
      if (err.code === '22P02') throw new BadRequestException('Invalid enum or data type');
      if (err.code === '23503') throw new BadRequestException(`Invalid reference: ${err.detail}`);
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Unexpected error updating job offer');
    }
  }

  // DELETE /jobs/:id
  async remove(id: string) {
    try {
      const { rows } = await this.pool.query(
        `DELETE FROM public.job_offers WHERE id = $1 RETURNING id`,
        [id],
      );
      if (!rows[0]) throw new NotFoundException('job_offer_not_found');
      return { ok: true };
    } catch (err: any) {
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Unexpected error deleting job offer');
    }
  }

  // GET /jobs/search
  async search(q: QuerySearchJobsDto) {
    const normArray = (v: any): string[] | undefined => {
      if (v == null) return undefined;
      if (Array.isArray(v)) return v.filter(x => x != null && String(x).length);
      if (typeof v === 'string' && v.length) return [v];
      return undefined;
    };
    const toNum = (v: any): number | undefined => {
      if (v == null || v === '') return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    (q as any).skillsAny = (q as any).skillsAny ?? (q as any)['skillsAny[]'];
    (q as any).skillsAll = (q as any).skillsAll ?? (q as any)['skillsAll[]'];

    q.skillsAny = normArray((q as any).skillsAny);
    q.skillsAll = normArray((q as any).skillsAll);
    q.minSalary = toNum((q as any).minSalary);
    q.maxSalary = toNum((q as any).maxSalary);
    q.limit = toNum((q as any).limit) ?? 20;
    q.offset = toNum((q as any).offset) ?? 0;

    const where: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (q.q) {
      where.push(`(
        to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'')) @@ plainto_tsquery('simple', $${i})
        OR title ILIKE '%' || $${i} || '%'
        OR description ILIKE '%' || $${i} || '%'
      )`);
      params.push(q.q);
      i++;
    }

    if (q.employmentType) { where.push(`employment_type = $${i++}`); params.push(q.employmentType); }
    if (q.locationType)   { where.push(`location_type   = $${i++}`); params.push(q.locationType); }
    if (q.status)         { where.push(`status          = $${i++}`); params.push(q.status); }
    if (q.companyId)      { where.push(`company_id      = $${i++}`); params.push(q.companyId); }

    if (q.location) {
      where.push(`location ILIKE '%' || $${i} || '%'`);
      params.push(q.location);
      i++;
    }

    if (q.minSalary != null) { where.push(`salary IS NOT NULL AND salary >= $${i++}`); params.push(q.minSalary); }
    if (q.maxSalary != null) { where.push(`salary IS NOT NULL AND salary <= $${i++}`); params.push(q.maxSalary); }

    if (q.skillsAny && q.skillsAny.length) {
      where.push(`skills && $${i}::text[]`);
      params.push(q.skillsAny);
      i++;
    }
    if (q.skillsAll && q.skillsAll.length) {
      where.push(`skills @> $${i}::text[]`);
      params.push(q.skillsAll);
      i++;
    }

    let order = 'created_at DESC';
    if (q.orderBy === 'oldest')       order = 'created_at ASC';
    else if (q.orderBy === 'salary_desc') order = 'salary DESC NULLS LAST, created_at DESC';
    else if (q.orderBy === 'salary_asc')  order = 'salary ASC NULLS LAST, created_at DESC';

    const limit = q.limit!;
    const offset = q.offset!;

    const sql = `
      WITH filtered AS (
        SELECT
          id,
          company_id,
          title,
          description,
          employment_type,
          location_type,
          skills,
          requirements,
          location,
          salary::double precision AS salary,  -- 👈 cast aquí también
          currency,
          status,
          created_at,
          updated_at
        FROM public.job_offers
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      )
      SELECT jsonb_build_object(
        'items', (
          SELECT COALESCE(jsonb_agg(row_to_json(f.*)), '[]'::jsonb)
          FROM (
            SELECT *
            FROM filtered
            ORDER BY ${order}
            LIMIT $${i} OFFSET $${i + 1}
          ) f
        ),
        'total', (SELECT COUNT(*)::int FROM filtered)
      ) AS result;
    `;
    params.push(limit, offset);

    if (process.env.DEBUG_JOBS) {
      console.log('[JOBS search] where=', where.join(' AND ') || '(none)');
      console.log('[JOBS search] params=', params);
      console.log('[JOBS search] order=', order, ' limit=', limit, ' offset=', offset);
    }

    try {
      const { rows } = await this.pool.query(sql, params);
      return rows[0]?.result ?? { items: [], total: 0 };
    } catch (err: any) {
      if (err.code === '22P02') throw new BadRequestException('invalid_input_syntax');
      throw new InternalServerErrorException('Unexpected error searching job offers');
    }
  }
}
