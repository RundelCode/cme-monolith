// apps/payments/src/payment-service.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, ParseUUIDPipe, UseGuards, Req
} from '@nestjs/common';
import { PaymentServiceService } from './payment-service.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';
import { HttpAuthGuard } from '@app/common/auth/http-auth.guard';
import { AuthUser } from '@app/common/auth/auth-user.decorator';
import { StartReferralCheckoutDto } from './dto/start-hire-checkout.dto';
import { Public } from '../../../libs/common/src/auth/public.decorator';


@Controller('payments')
export class PaymentServiceController {
  constructor(private readonly service: PaymentServiceService) { }

  @Post()
  create(@Body() dto: CreatePaymentDto) {
    return this.service.create(dto);
  }

  @Get()
  async list(@Query() q: QueryPaymentsDto, @AuthUser() user: any) {
    const limit = Math.max(1, Math.min(100, Number(q.limit ?? 20)));
    const offset = Math.max(0, Number(q.offset ?? 0));

    const mineFlag =
      (typeof q.mine === 'string' ? q.mine === 'true' : !!q.mine) ||
      (!q.companyId && !q.headhunterId);

    if (mineFlag) {
      return this.service.listMine({
        meCompanyId: user?.companyId ?? null,
        meHeadhunterId: user?.id ?? null,
        query: { ...q, limit, offset },
      });
    }
    return this.service.list({ ...q, limit, offset });
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/receipt')
  async receipt(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getReceiptData(id);
  }

  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() patch: UpdatePaymentDto) {
    return this.service.update(id, patch);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(id);
  }

  @Post('referral/checkout')
  async startReferralCheckout(@Body() dto: StartReferralCheckoutDto) {
    return this.service.startReferralCheckout(dto);
  }

  @Public()
  @Post('webhook')
  async mpWebhook(@Req() req: any, @Query('pid') pid: string) {
    return this.service.handleMercadoPagoWebhook(req, pid);
  }
}
