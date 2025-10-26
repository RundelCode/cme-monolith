import { Injectable, InternalServerErrorException, UnauthorizedException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';

@Injectable()
export class EmailAdapter {
  private readonly logger = new Logger(EmailAdapter.name);
  private readonly apiKey = process.env.RESEND_API_KEY?.trim();
  private readonly from = (process.env.RESEND_FROM || '').trim();

  private redact(key?: string) {
    if (!key) return '<missing>';
    if (key.length < 8) return '<too-short>';
    return `${key.slice(0,3)}…${key.slice(-4)}`;
  }

  async send(to: string, subject: string, html: string, text?: string): Promise<{ id: string }> {
    if (!this.apiKey) throw new InternalServerErrorException('RESEND_API_KEY is missing');
    if (!this.from) throw new InternalServerErrorException('RESEND_FROM is missing');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.from, to, subject, html, text }),
    });

    let payload: any = null;
    try { payload = await res.json(); } catch { /* ignore */ }

    if (!res.ok) {
      const msg = payload?.message || `Resend error ${res.status}`;
      this.logger.error(`Resend fail ${res.status}: ${msg} (key=${this.redact(this.apiKey)}, from=${this.from})`);
      if (res.status === 401) throw new UnauthorizedException('Resend API key invalid or missing');
      if (res.status === 403) throw new ForbiddenException('Resend not authorized (check domain verification / permissions)');
      if (res.status === 422) throw new BadRequestException(`Resend validation failed: ${msg}`); // suele ser FROM/TO inválidos
      throw new InternalServerErrorException(msg);
    }

    return { id: payload?.id ?? '' };
  }
}
