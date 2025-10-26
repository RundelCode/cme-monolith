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
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { StartReferralCheckoutDto } from './dto/start-hire-checkout.dto';
import { PG_POOL } from 'src/common/db/pg.constants';

@Injectable()
export class PaymentServiceService {
  private client: MercadoPagoConfig;
  private preferences: Preference;
  private payments: Payment;

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
    this.payments = new Payment(this.client);
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

  async list(_q: QueryPaymentsDto) {
    // deja aquí tu implementación original
    throw new Error('Implement list() con tu SQL actual');
  }
  async listMine(_opts: any) {
    // deja aquí tu implementación original
    throw new Error('Implement listMine() con tu SQL actual');
  }

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
          // auto_return: 'approved', // actívalo cuando tengas las páginas del front listas
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
