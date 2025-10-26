import {
  BadRequestException,
  ConflictException,
  Injectable,
  Inject,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../db/db.module';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { QueryApplicationsDto } from './dto/query-applications.dto';

@Injectable()
export class ApplicationsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) { }

  async create(input: CreateApplicationDto) {
    const sql = `
      INSERT INTO public.applications
        (job_offer_id, candidate_id, accepted, notes)
      VALUES ($1, $2, $3, $4)
      RETURNING id, job_offer_id, candidate_id, accepted, notes, created_at
    `;
    const params = [
      input.jobOfferId,
      input.candidateId,
      input.accepted,
      input.notes ?? null,
    ];
    try {
      const { rows } = await this.pool.query(sql, params);
      return rows[0];
    } catch (err: any) {
      if (err.code === '23503') {
        // FK violation (job_offer_id, candidate_id)
        throw new BadRequestException(`Invalid reference: ${err.detail}`);
      }
      if (err.code === '22P02') {
        // type/enum cast issue
        throw new BadRequestException('Invalid data type');
      }
      if (err.code === '23505') {
        // por si el modelo tuviera unique compuesto (no lo tienes ahora)
        throw new ConflictException('Application already exists');
      }
      throw new InternalServerErrorException('Unexpected error creating application');
    }
  }

  async list(q: QueryApplicationsDto) {
    const where: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (q.jobOfferId) { where.push(`job_offer_id = $${i++}`); params.push(q.jobOfferId); }
    if (q.candidateId) { where.push(`candidate_id = $${i++}`); params.push(q.candidateId); }
    if (q.accepted !== undefined) { where.push(`accepted = $${i++}`); params.push(q.accepted === 'true'); }

    const limit = q.limit ?? 50;
    const offset = q.offset ?? 0;

    const sql = `
      SELECT id, job_offer_id, candidate_id, accepted, notes, created_at, updated_at
      FROM public.applications
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY created_at DESC
      LIMIT $${i++} OFFSET $${i++}
    `;
    params.push(limit, offset);

    try {
      const { rows } = await this.pool.query(sql, params);
      return rows;
    } catch {
      throw new InternalServerErrorException('Unexpected error listing applications');
    }
  }

  async findOne(id: string) {
    try {
      const { rows } = await this.pool.query(
        `SELECT * FROM public.applications WHERE id = $1`,
        [id],
      );
      if (!rows[0]) throw new NotFoundException('application_not_found');
      return rows[0];
    } catch (err: any) {
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Unexpected error finding application');
    }
  }

  async update(id: string, patch: UpdateApplicationDto) {
    const sets: string[] = [];
    const params: any[] = [];
    const push = (col: string, val: any) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };

    if (patch.accepted !== undefined) push('accepted', patch.accepted);
    if (patch.notes !== undefined) push('notes', patch.notes);

    if (!sets.length) return this.findOne(id);

    sets.push('updated_at = now()');
    params.push(id);

    const sql = `
      UPDATE public.applications
      SET ${sets.join(', ')}
      WHERE id = $${params.length}
      RETURNING id, job_offer_id, candidate_id, accepted, notes, updated_at
    `;

    try {
      const { rows } = await this.pool.query(sql, params);
      if (!rows[0]) throw new NotFoundException('application_not_found');
      return rows[0];
    } catch (err: any) {
      if (err.code === '22P02') throw new BadRequestException('Invalid data type');
      if (err.code === '23503') throw new BadRequestException(`Invalid reference: ${err.detail}`);
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Unexpected error updating application');
    }
  }

  async remove(id: string) {
    try {
      const { rows } = await this.pool.query(
        `DELETE FROM public.applications WHERE id = $1 RETURNING id`,
        [id],
      );
      if (!rows[0]) throw new NotFoundException('application_not_found');
      return { ok: true };
    } catch (err: any) {
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Unexpected error deleting application');
    }
  }
}
