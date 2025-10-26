import {
  BadRequestException,
  Injectable,
  Inject,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Pool } from 'pg';
import { PG_POOL } from './db/db.module';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { EmailAdapter } from './email.adapter';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly email: EmailAdapter,
  ) { }

  // CRUD básico ---------------------------------------------------------------

  async create(input: CreateNotificationDto) {

    const initialStatus = input.channel === 'system' ? 'sent' : 'queued';
    const sql = `
    INSERT INTO public.notifications
      (user_id, title, message, notification_type, channel, status, related_id)
    VALUES ($1, $2, $3, $4::notification_type, $5::notification_channel, $6::notification_status, $7)
    RETURNING id, user_id, title, message, notification_type, channel, status, related_id, read_at, created_at, updated_at
  `;
    const params = [
      input.userId,
      input.title,
      input.message,
      input.notificationType,
      input.channel,
      initialStatus,
      input.relatedId ?? null,
    ];
    try {
      const { rows } = await this.pool.query(sql, params);
      return rows[0];
    } catch (err: any) {
      if (err.code === '22P02') throw new BadRequestException('Invalid enum or data type');
      if (err.code === '23503') throw new BadRequestException(`Invalid reference: ${err.detail}`);
      throw new InternalServerErrorException('Unexpected error creating notification');
    }
  }

  async list(q: QueryNotificationsDto) {
    const where: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (q.userId) { where.push(`user_id = $${i++}`); params.push(q.userId); }
    if (q.status) { where.push(`status = $${i++}`); params.push(q.status); }
    if (q.notificationType) { where.push(`notification_type = $${i++}`); params.push(q.notificationType); }

    const limit = q.limit ?? 50;
    const offset = q.offset ?? 0;

    const sql = `
      SELECT id, user_id, title, message, notification_type, channel, status, related_id, read_at, created_at, updated_at
      FROM public.notifications
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY created_at DESC
      LIMIT $${i++} OFFSET $${i++}
    `;
    params.push(limit, offset);

    try {
      const { rows } = await this.pool.query(sql, params);
      return rows;
    } catch {
      throw new InternalServerErrorException('Unexpected error listing notifications');
    }
  }

  async findOne(id: string) {
    try {
      const { rows } = await this.pool.query(`SELECT * FROM public.notifications WHERE id = $1`, [id]);
      if (!rows[0]) throw new NotFoundException('notification_not_found');
      return rows[0];
    } catch (err: any) {
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Unexpected error finding notification');
    }
  }

  async markRead(id: string) {
    try {
      const { rows } = await this.pool.query(
        `UPDATE public.notifications SET read_at = now(), updated_at = now() WHERE id = $1 RETURNING id, read_at`,
        [id],
      );
      if (!rows[0]) throw new NotFoundException('notification_not_found');
      return rows[0];
    } catch (err: any) {
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Unexpected error marking as read');
    }
  }

  // Dispatch / Worker ---------------------------------------------------------

  // cron cada minuto: procesa hasta N notifs en cola
  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchQueued() {
    const batchSize = Number(process.env.NOTIF_BATCH_SIZE || 20);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // lock filas para evitar doble procesamiento en despliegues con réplicas
      const { rows } = await client.query(
        `
        SELECT id, user_id, title, message, notification_type, channel
        FROM public.notifications
        WHERE status = 'queued'
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $1
        `,
        [batchSize],
      );

      for (const n of rows) {
        try {
          await this.dispatchOne(client, n);
        } catch (e) {
          this.logger.error(`Dispatch failed for notification ${n.id}: ${e instanceof Error ? e.message : e}`);
          await client.query(
            `UPDATE public.notifications SET status = 'failed', updated_at = now() WHERE id = $1`,
            [n.id],
          );
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error(`dispatchQueued error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      client.release();
    }
  }

  // también sirve para forzar un envío manual desde el controller
  async dispatchOneById(id: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT id, user_id, title, message, notification_type, channel FROM public.notifications WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (!rows[0]) throw new NotFoundException('notification_not_found');
      await this.dispatchOne(client, rows[0]);
      await client.query('COMMIT');
      return { ok: true };
    } catch (err) {
      await client.query('ROLLBACK');
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Unexpected error dispatching notification');
    } finally {
      client.release();
    }
  }

  private async dispatchOne(client: any, n: any) {
    if (n.channel !== 'email') {
      // Por ahora solo email; si llega otro canal, fallamos “blando”
      await client.query(
        `UPDATE public.notifications SET status = 'failed', updated_at = now() WHERE id = $1`,
        [n.id],
      );
      return;
    }

    // Necesitamos el correo del usuario => profiles.email
    const { rows: urows } = await client.query(
      `SELECT email, full_name FROM public.profiles WHERE id = $1`,
      [n.user_id],
    );
    const userEmail = urows[0]?.email;
    const fullName = urows[0]?.full_name || 'Usuario';
    if (!userEmail) throw new BadRequestException('User email not found');

    // Render simple (puedes sustituir por plantilla)
    const subject = n.title;
    const html = `
      <div style="font-family:Inter,Arial,sans-serif">
        <h2>${n.title}</h2>
        <p>${n.message}</p>
        <hr/>
        <small>Hola ${fullName}, esta es una notificación de CME.</small>
      </div>
    `;

    // Enviar con Resend
    await this.email.send(userEmail, subject, html, n.message);

    // OK → marcar sent
    await client.query(
      `UPDATE public.notifications SET status = 'sent', updated_at = now() WHERE id = $1`,
      [n.id],
    );
  }
}
