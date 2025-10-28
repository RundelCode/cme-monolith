import {
  BadRequestException,
  ConflictException,
  Injectable,
  Inject,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';
import { MercadoPagoConfig, Preference, Payment as MPPayment } from 'mercadopago';
import { StartReferralCheckoutDto } from './dto/start-hire-checkout.dto';
import { PG_POOL } from 'src/common/db/pg.constants';

type ListInput = QueryPaymentsDto & { limit: number; offset: number };

@Injectable()
export class PaymentServiceService {
  private client: MercadoPagoConfig;
  private preferences: Preference;
  private payments: MPPayment;

  private readonly FRONTEND = (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  private readonly API_BASE = (() => {
    const v = (process.env.API_BASE_URL || '').replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(v)) throw new Error('API_BASE_URL must be an absolute http(s) URL');
    return v;
  })();

  private readonly REF_PCT = Number(process.env.REFERRAL_PERCENT ?? '0.2');

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    const accessToken = (process.env.MP_ACCESS_TOKEN || '').trim();
    if (!accessToken) throw new Error('MP_ACCESS_TOKEN is required');
    this.client = new MercadoPagoConfig({ accessToken });
    this.preferences = new Preference(this.client);
    this.payments = new MPPayment(this.client);
  }

  /* ===================== Helpers ===================== */

  /** Convierte string ISO o epoch-ms a Date; si es inválida, retorna null */
  private parseDateLoose(v?: string | null): Date | null {
    if (!v) return null;
    const asNum = Number(v);
    if (!Number.isNaN(asNum) && asNum > 0) {
      try { return new Date(asNum); } catch { /* ignore */ }
    }
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return new Date(t);
    return null;
  }

  private buildWhere(base: string[], params: any[], q: ListInput): { whereSql: string; params: any[] } {
    let idx = params.length + 1;

    if (q.companyId) { base.push(`company_id = $${idx++}`); params.push(q.companyId); }
    if (q.headhunterId) { base.push(`headhunter_id = $${idx++}`); params.push(q.headhunterId); }
    if (q.jobOfferId) { base.push(`job_offer_id = $${idx++}`); params.push(q.jobOfferId); }

    if (q.direction) { base.push(`direction = $${idx++}::payment_direction`); params.push(q.direction); }
    if (q.status) { base.push(`status = $${idx++}::payment_status`); params.push(q.status); }

    const fromDate = this.parseDateLoose(q.from as any);
    const toDate = this.parseDateLoose(q.to as any);
    if (fromDate) { base.push(`created_at >= $${idx++}`); params.push(fromDate.toISOString()); }
    if (toDate) { base.push(`created_at <= $${idx++}`); params.push(toDate.toISOString()); }

    const whereSql = base.length ? `WHERE ${base.join(' AND ')}` : '';
    return { whereSql, params };
  }

  private async countAndList(whereSql: string, params: any[], limit: number, offset: number) {
    const countSql = `SELECT COUNT(*)::int AS total FROM public.payments ${whereSql};`;
    const listSql = `
      SELECT id, job_offer_id, headhunter_id, company_id, amount, currency, direction, psp_payment_id, status, created_at, updated_at
      FROM public.payments
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2};
    `;
    const countParams = params.slice();
    const listParams = params.concat([limit, offset]);

    // Logs de depuración
    console.debug('[payments:list] SQL COUNT:', countSql, '::', countParams);
    console.debug('[payments:list] SQL LIST :', listSql, '::', listParams);

    const { rows: [c] } = await this.pool.query(countSql, countParams);
    const { rows } = await this.pool.query(listSql, listParams);
    return { total: Number(c?.total ?? 0), items: rows };
  }

  private buildBackUrls(paymentId: string) {
    const u = (path: string) => `${this.FRONTEND}${path}?pid=${paymentId}`;
    const success = u('/payments/success');
    const failure = u('/payments/failure');
    const pending = u('/payments/pending');
    const isAbs = (x: string) => /^https?:\/\//i.test(x);
    if (!isAbs(success) || !isAbs(failure) || !isAbs(pending))
      throw new BadRequestException('FRONTEND_BASE_URL must be absolute (http/https)');
    return { success, failure, pending };
  }

  /* ===================== Create ===================== */

  async create(input: CreatePaymentDto) {
    const sql = `
      INSERT INTO public.payments
        (job_offer_id, headhunter_id, company_id, amount, currency, direction, psp_payment_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *;
    `;
    const params = [
      input.jobOfferId ?? null,
      input.headhunterId ?? null,
      input.companyId ?? null,
      input.amount,
      input.currency,
      input.direction ?? null,
      input.pspPaymentId ?? null,
    ];
    try {
      const { rows } = await this.pool.query(sql, params);
      return rows[0];
    } catch (err: any) {
      if (err.code === '22P02') throw new BadRequestException('Invalid enum or data type');
      if (err.code === '23503') throw new BadRequestException(`Invalid reference: ${err.detail}`);
      if (err.code === '23505') throw new ConflictException('Payment already exists');
      throw new InternalServerErrorException('Unexpected error creating payment');
    }
  }

  /* ===================== LIST (general) ===================== */

  async list(qIn: QueryPaymentsDto) {
    const q: ListInput = {
      ...qIn,
      limit: Math.max(1, Math.min(100, Number(qIn.limit ?? 20))),
      offset: Math.max(0, Number(qIn.offset ?? 0)),
    };

    const where: string[] = [];
    const params: any[] = [];

    const { whereSql, params: finalParams } = this.buildWhere(where, params, q);
    console.debug('[payments:list] where:', whereSql || '(sin where)', 'params:', finalParams);

    return this.countAndList(whereSql, finalParams, q.limit, q.offset);
  }

  /* ===================== LIST MINE (resolviendo admin_id) ===================== */

  async listMine(opts: {
    meCompanyId: string | null;
    meHeadhunterId: string | null;
    query: QueryPaymentsDto;
    tryResolveCompanyFromAdmin?: boolean;
  }) {
    const { query } = opts;
    const q: ListInput = {
      ...query,
      limit: Math.max(1, Math.min(100, Number(query.limit ?? 20))),
      offset: Math.max(0, Number(query.offset ?? 0)),
    };

    let meCompanyId = opts.meCompanyId ?? null;
    let meHeadhunterId = opts.meHeadhunterId ?? null;

    // Intentamos resolver company_id por admin_id (según tu schema)
    if (!meCompanyId && opts.tryResolveCompanyFromAdmin && meHeadhunterId) {
      try {
        const { rows: compRows } = await this.pool.query(
          `SELECT id FROM public.companies WHERE admin_id = $1 LIMIT 1`,
          [meHeadhunterId],
        );
        if (compRows[0]?.id) {
          meCompanyId = compRows[0].id;
          console.debug('[payments:listMine] Resuelto meCompanyId por admin_id:', meCompanyId);
        }
      } catch (e) {
        console.warn('[payments:listMine] Error resolviendo companies.admin_id -> company_id:', (e as any)?.message);
      }
    }

    // Si no hay company, intentamos usar siempre el user.id como headhunterId (listado “del usuario”)
    if (!meHeadhunterId) {
      try {
        const { rows: who } = await this.pool.query(`SELECT current_setting('app.user_id', true) AS uid`);
        if (who[0]?.uid) meHeadhunterId = who[0].uid;
      } catch {
        // si no hay GUC app.user_id, nos quedamos con null y seguimos
      }
    }

    const where: string[] = [];
    const params: any[] = [];
    let idx = 1;

    // Caso “all=true”: OR entre company y headhunter si ambos existen
    const allFlag = typeof q.all === 'string' ? q.all === 'true' : !!q.all;

    if (allFlag && meCompanyId && meHeadhunterId) {
      where.push(`(company_id = $${idx++} OR headhunter_id = $${idx++})`);
      params.push(meCompanyId, meHeadhunterId);
    } else if (meCompanyId) {
      where.push(`company_id = $${idx++}`);
      params.push(meCompanyId);
    } else if (meHeadhunterId) {
      where.push(`headhunter_id = $${idx++}`);
      params.push(meHeadhunterId);
    } else {
      // Sin señales ⇒ no romper: devolver vacío coherente
      console.debug('[payments:listMine] Sin companyId ni headhunterId. Devolviendo vacío.');
      return { total: 0, items: [] };
    }

    // Filtros extra del DTO, excepto company/headhunter (ya metidos)
    const extraWhere: string[] = [];
    const built = this.buildWhere(extraWhere, [], q);
    const cleanedWhere = built.whereSql
      .replace(/WHERE\s*/i, '')
      .split(/\s+AND\s+/i)
      .filter((frag) => frag && !/^(company_id|headhunter_id)\s*=/.test(frag));

    if (cleanedWhere.length) where.push(...cleanedWhere);
    const finalParams = params.concat(built.params);

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    console.debug('[payments:listMine] where:', whereSql, 'params:', finalParams);

    return this.countAndList(whereSql, finalParams, q.limit, q.offset);
  }

  /* ===================== CRUD y MP ===================== */

  async findOne(id: string) {
    const { rows } = await this.pool.query(`SELECT * FROM public.payments WHERE id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException('payment_not_found');
    return rows[0];
  }

  async update(id: string, patch: UpdatePaymentDto) {
    const sets: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (patch.status !== undefined) { sets.push(`status = $${i++}`); params.push(patch.status); }
    if (patch.pspPaymentId !== undefined) { sets.push(`psp_payment_id = $${i++}`); params.push(patch.pspPaymentId); }

    if (!sets.length) return this.findOne(id);

    const sql = `
      UPDATE public.payments
      SET ${sets.join(', ')}, updated_at = now()
      WHERE id = $${i}
      RETURNING *;
    `;
    params.push(id);

    const { rows } = await this.pool.query(sql, params);
    if (!rows[0]) throw new NotFoundException('payment_not_found');
    return rows[0];
  }

  async remove(id: string) {
    const { rows } = await this.pool.query(
      `DELETE FROM public.payments WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('payment_not_found');
    return { ok: true };
  }

  async getReceiptData(id: string) {
    const payment = await this.findOne(id);
    return { payment, company: payment.company_id, job: payment.job_offer_id, headhunter: payment.headhunter_id };
  }

  /** Checkout desde referralId */
  async startReferralCheckout(input: StartReferralCheckoutDto) {
    const ref = await this._getReferralContext(input.referralId);
    if (ref.status === 'hired') throw new BadRequestException('referral_already_hired');

    const { rows: [payment] } = await this.pool.query(
      `INSERT INTO public.payments
       (job_offer_id, headhunter_id, company_id, amount, currency, direction, status)
       VALUES ($1,$2,$3,$4,$5,$6::payment_direction,$7::payment_status)
       RETURNING *`,
      [
        ref.job_offer_id,
        null,
        ref.company_id,
        input.amount,
        input.currency ?? 'COP',
        'in',
        'pending',
      ]
    );

    const back_urls = this.buildBackUrls(payment.id);

    try {
      const pref = await this.preferences.create({
        body: {
          items: [{
            id: payment.id,
            title: 'Hiring referral fee',
            quantity: 1,
            unit_price: Number(input.amount),
            currency_id: input.currency ?? 'COP',
          }],
          back_urls,
          // auto_return: 'approved',
          notification_url: `${this.API_BASE}/payments/webhook?pid=${payment.id}`,
          metadata: {
            paymentId: payment.id,
            referralId: input.referralId,
            jobOfferId: ref.job_offer_id,
            companyId: ref.company_id,
            candidateId: ref.candidate_id,
            headhunterId: ref.headhunter_id,
            referralPercent: String(input.referralPercent ?? this.REF_PCT),
          },
        }
      });
      const initPoint = (pref as any)?.init_point || (pref as any)?.sandbox_init_point;
      if (!initPoint) throw new Error('MercadoPago: init_point not returned');
      return { checkoutUrl: initPoint, paymentId: payment.id };
    } catch (e: any) {
      console.error('[MP PREF ERROR]', {
        message: e?.message, status: e?.status, error: e?.error, cause: e?.cause, name: e?.name,
      });
      throw new BadRequestException(e?.message || 'mercadopago_preference_error');
    }
  }

  private async _getReferralContext(referralId: string) {
    const sql = `
      SELECT r.id, r.status, r.candidate_id, r.job_offer_id, r.headhunter_id, j.company_id
      FROM public.referrals r
      JOIN public.job_offers j ON j.id = r.job_offer_id
      WHERE r.id = $1
    `;
    const { rows } = await this.pool.query(sql, [referralId]);
    const row = rows[0];
    if (!row) throw new NotFoundException('referral_not_found');
    return row;
  }

  async handleMercadoPagoWebhook(req: any, pid: string) {
    const event = req.body;
    if (event?.type === 'payment' && event?.data?.id) {
      try {
        const resp = await this.payments.get({ id: event.data.id });
        const status = (resp as any)?.status;

        if (status === 'approved') {
          const { rows: [paid] } = await this.pool.query(
            `UPDATE public.payments
             SET status='succeeded'::payment_status, psp_payment_id=$1, updated_at=now()
             WHERE id=$2
             RETURNING *`,
            [String((resp as any)?.id), pid]
          );
          if (!paid) throw new NotFoundException('payment_in_not_found');

          const md = (resp as any)?.metadata || {};
          if (!md?.referralId) return { ok: true };

          const ref = await this._getReferralContext(md.referralId);

          await this.pool.query(
            `UPDATE public.referrals
             SET status='hired'::referral_status, updated_at=now()
             WHERE id=$1`,
            [md.referralId]
          );

          const outExists = await this._existsOutPayment(ref.headhunter_id, ref.job_offer_id, ref.company_id);
          if (!outExists) {
            const refAmount =
              Number((resp as any)?.transaction_amount) * Number(md.referralPercent ?? this.REF_PCT);
            await this.pool.query(
              `INSERT INTO public.payments
               (job_offer_id, headhunter_id, company_id, amount, currency, direction, status)
               VALUES ($1,$2,$3,$4,$5,$6::payment_direction,$7::payment_status)`,
              [
                ref.job_offer_id,
                ref.headhunter_id,
                ref.company_id,
                refAmount,
                (resp as any)?.currency_id || 'COP',
                'out',
                'pending',
              ]
            );
          }
        }
      } catch (e: any) {
        console.error('[MP PAYMENTS.GET ERROR]', {
          message: e?.message, status: e?.status, error: e?.error, cause: e?.cause, name: e?.name,
        });
        throw new BadRequestException(e?.message || 'mercadopago_get_error');
      }
    }
    return { ok: true };
  }

  private async _existsOutPayment(headhunterId: string, jobOfferId: string, companyId: string) {
    const { rows } = await this.pool.query(
      `SELECT 1
       FROM public.payments
       WHERE headhunter_id=$1 AND job_offer_id=$2 AND company_id=$3 AND direction='out'::payment_direction
       LIMIT 1`,
      [headhunterId, jobOfferId, companyId]
    );
    return !!rows[0];
  }
}
