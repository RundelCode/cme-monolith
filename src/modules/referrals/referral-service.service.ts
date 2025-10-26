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
import { CreateReferralDto } from './dto/create-referral.dto';
import { UpdateReferralDto } from './dto/update-referral.dto';
import { QueryReferralsDto } from './dto/query-referrals.dto';

type ReferralStatus =
  | 'submitted'
  | 'accepted_by_candidate'
  | 'declined_by_candidate'
  | 'reviewing'
  | 'rejected'
  | 'shortlist'
  | 'hired';

@Injectable()
export class ReferralsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // --------------------------
  // Helpers
  // --------------------------

  private async generateUniqueReferralCode(): Promise<string> {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const gen = () =>
      Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');

    for (let i = 0; i < 5; i++) {
      const code = gen();
      const { rows } = await this.pool.query(
        `SELECT 1 FROM public.referrals WHERE referral_code = $1 LIMIT 1`,
        [code],
      );
      if (rows.length === 0) return code;
    }
    return gen();
  }

  /** Evita duplicados lógicos sin tocar el esquema */
  private async _ensureNotDuplicate(input: {
    headhunterId: string;
    candidateId?: string | null;
    jobOfferId: string;
  }) {
    const { headhunterId, candidateId, jobOfferId } = input;

    const where =
      candidateId && candidateId.trim().length
        ? `headhunter_id = $1 AND candidate_id = $2 AND job_offer_id = $3`
        : `headhunter_id = $1 AND candidate_id IS NULL AND job_offer_id = $2`;

    const params = candidateId && candidateId.trim().length
      ? [headhunterId, candidateId, jobOfferId]
      : [headhunterId, jobOfferId];

    const { rows } = await this.pool.query(
      `SELECT id FROM public.referrals WHERE ${where} LIMIT 1`,
      params,
    );
    if (rows[0]) {
      throw new ConflictException('referral_already_exists');
    }
  }

  /** Trae referral + company_id vía job_offer_id (para validaciones) */
  private async _getReferralWithCompany(referralId: string) {
    const sql = `
      SELECT r.id,
             r.status,
             r.candidate_id,
             r.job_offer_id,
             r.headhunter_id,
             j.company_id
      FROM public.referrals r
      JOIN public.job_offers j ON j.id = r.job_offer_id
      WHERE r.id = $1
    `;
    const { rows } = await this.pool.query(sql, [referralId]);
    const row = rows[0];
    if (!row) throw new NotFoundException('referral_not_found');
    return row as {
      id: string;
      status: ReferralStatus;
      candidate_id: string | null;
      job_offer_id: string;
      headhunter_id: string;
      company_id: string;
    };
  }

  /** ¿Existe un pago IN con status succeeded para esta referral (oferta/empresa)? */
  private async _hasSucceededInPaymentForReferral(referralId: string): Promise<boolean> {
    const sql = `
      SELECT EXISTS(
        SELECT 1
        FROM public.referrals r
        JOIN public.job_offers j ON j.id = r.job_offer_id
        JOIN public.payments   p ON p.job_offer_id = r.job_offer_id AND p.company_id = j.company_id
        WHERE r.id = $1
          AND p.direction = 'in'::payment_direction
          AND p.status = 'succeeded'::payment_status
      ) AS ok
    `;
    const { rows } = await this.pool.query(sql, [referralId]);
    return !!rows?.[0]?.ok;
  }

  /** Si se intenta pasar a hired sin pago previo, rechaza */
  private async _assertCanSetHired(referralId: string) {
    const paid = await this._hasSucceededInPaymentForReferral(referralId);
    if (!paid) {
      throw new BadRequestException('cannot_hire_without_payment');
    }
  }

  // --------------------------
  // CRUD
  // --------------------------

  async create(input: CreateReferralDto) {
    // Evitar duplicados lógicos (mismo headhunter + candidate + job_offer)
    await this._ensureNotDuplicate({
      headhunterId: input.headhunterId,
      candidateId: input.candidateId ?? null,
      jobOfferId: input.jobOfferId,
    });

    const referralCode = input.referralCode ?? (await this.generateUniqueReferralCode());

    const sql = `
      INSERT INTO public.referrals
        (headhunter_id, candidate_id, job_offer_id, status, referral_code)
      VALUES ($1,$2,$3,$4::referral_status,$5)
      RETURNING id, headhunter_id, candidate_id, job_offer_id, status, referral_code, created_at
    `;
    const params = [
      input.headhunterId,
      input.candidateId ?? null,
      input.jobOfferId,
      input.status ?? 'submitted',
      referralCode,
    ];

    try {
      const { rows } = await this.pool.query(sql, params);
      return rows[0];
    } catch (err: any) {
      if (err.code === '23503') throw new BadRequestException(`Invalid reference: ${err.detail}`);
      if (err.code === '22P02') throw new BadRequestException('Invalid enum or data type');
      if (err.code === '23505') {
        if (String(err.detail || '').includes('referral_code')) {
          throw new ConflictException('referral_code_conflict_try_again');
        }
        throw new ConflictException('referral_already_exists');
      }
      if (err.code === '23502') {
        const col = err.column || 'unknown_column';
        throw new BadRequestException(`null_violation: ${col}`);
      }
      throw new InternalServerErrorException('Unexpected error creating referral');
    }
  }

  async list(q: QueryReferralsDto) {
    const where: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (q.headhunterId) { where.push(`headhunter_id = $${i++}`); params.push(q.headhunterId); }
    if (q.candidateId)  { where.push(`candidate_id = $${i++}`);  params.push(q.candidateId); }
    if (q.jobOfferId)   { where.push(`job_offer_id = $${i++}`);  params.push(q.jobOfferId); }
    if (q.status)       { where.push(`status = $${i++}`);        params.push(q.status); }

    const limit  = q.limit  ?? 50;
    const offset = q.offset ?? 0;

    const sql = `
      SELECT id, headhunter_id, candidate_id, job_offer_id, status, referral_code, created_at, updated_at
      FROM public.referrals
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY created_at DESC
      LIMIT $${i++} OFFSET $${i++}
    `;
    params.push(limit, offset);

    try {
      const { rows } = await this.pool.query(sql, params);
      return rows;
    } catch {
      throw new InternalServerErrorException('Unexpected error listing referrals');
    }
  }

  async listByHeadhunter(headhunterId: string, q: QueryReferralsDto) {
    const limit  = q.limit  ?? 50;
    const offset = q.offset ?? 0;

    const sql = `
      SELECT id, headhunter_id, candidate_id, job_offer_id, status, referral_code, created_at, updated_at
      FROM public.referrals
      WHERE headhunter_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    try {
      const { rows } = await this.pool.query(sql, [headhunterId, limit, offset]);
      return rows;
    } catch {
      throw new InternalServerErrorException('Unexpected error listing by headhunter');
    }
  }

  async listByCandidate(candidateId: string, q: QueryReferralsDto) {
    const limit  = q.limit  ?? 50;
    const offset = q.offset ?? 0;

    const sql = `
      SELECT id, headhunter_id, candidate_id, job_offer_id, status, referral_code, created_at, updated_at
      FROM public.referrals
      WHERE candidate_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    try {
      const { rows } = await this.pool.query(sql, [candidateId, limit, offset]);
      return rows;
    } catch {
      throw new InternalServerErrorException('Unexpected error listing by candidate');
    }
  }

  async findOne(id: string) {
    try {
      const { rows } = await this.pool.query(
        `SELECT * FROM public.referrals WHERE id = $1`,
        [id],
      );
      if (!rows[0]) throw new NotFoundException('referral_not_found');
      return rows[0];
    } catch (err: any) {
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Unexpected error finding referral');
    }
  }

  /**
   * Patch genérico (status, candidate_id).
   * Si el status objetivo es 'hired', valida pago previo IN:succeeded.
   */
  async update(id: string, patch: UpdateReferralDto) {
    const sets: string[] = [];
    const params: any[] = [];
    let i = 1;

    const wantsHired =
      patch.status !== undefined && String(patch.status) === 'hired';

    if (patch.status !== undefined) {
      sets.push(`status = $${i++}::referral_status`);
      params.push(patch.status);
    }

    const candidate =
      (patch.candidateId && String(patch.candidateId)) ||
      (patch.candidate_id && String(patch.candidate_id)) ||
      undefined;

    if (candidate !== undefined) {
      sets.push(`candidate_id = $${i++}`);
      params.push(candidate);
    }

    if (!sets.length) return this.findOne(id);

    // Regla: no se permite hired sin pago
    if (wantsHired) {
      await this._assertCanSetHired(id);
    }

    sets.push(`updated_at = now()`);
    params.push(id);

    const sql = `
      UPDATE public.referrals
      SET ${sets.join(', ')}
      WHERE id = $${i}
      RETURNING id, headhunter_id, candidate_id, job_offer_id, status, referral_code, updated_at
    `;
    try {
      const { rows } = await this.pool.query(sql, params);
      if (!rows[0]) throw new NotFoundException('referral_not_found');
      return rows[0];
    } catch (err: any) {
      if (err.code === '22P02') throw new BadRequestException('Invalid enum or data type');
      if (err.code === '23503') throw new BadRequestException(`Invalid reference: ${err.detail}`);
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Unexpected error updating referral');
    }
  }

  /**
   * Update de status directo.
   * Aplica la misma regla de negocio: hired requiere pago previo.
   */
  async updateStatus(
    id: string,
    status:
      | 'submitted'
      | 'accepted_by_candidate'
      | 'declined_by_candidate'
      | 'reviewing'
      | 'rejected'
      | 'shortlist'
      | 'hired',
  ) {
    // Bloqueo de dominio para hired
    if (status === 'hired') {
      await this._assertCanSetHired(id);
    }

    try {
      const { rows } = await this.pool.query(
        `
          UPDATE public.referrals
          SET status = $2::referral_status, updated_at = now()
          WHERE id = $1
          RETURNING id, headhunter_id, candidate_id, job_offer_id, status, referral_code, updated_at
        `,
        [id, status],
      );
      if (!rows[0]) throw new NotFoundException('referral_not_found');
      return rows[0];
    } catch (err: any) {
      if (err.code === '22P02') throw new BadRequestException('Invalid enum or data type');
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Unexpected error updating status');
    }
  }

  async remove(id: string) {
    try {
      const { rows } = await this.pool.query(
        `DELETE FROM public.referrals WHERE id = $1 RETURNING id`,
        [id],
      );
      if (!rows[0]) throw new NotFoundException('referral_not_found');
      return { ok: true };
    } catch (err: any) {
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Unexpected error deleting referral');
    }
  }
}
