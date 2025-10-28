import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, ParseUUIDPipe
} from '@nestjs/common';
import { PaymentServiceService } from './payment-service.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';
import { StartReferralCheckoutDto } from './dto/start-hire-checkout.dto';
import { AuthUser } from '../../common/auth/auth-user.decorator';
import { Public } from '../../common/auth/public.decorator';

@Controller('payments')
export class PaymentServiceController {
  constructor(private readonly service: PaymentServiceService) { }

  @Post()
  create(@Body() dto: CreatePaymentDto) {
    return this.service.create(dto);
  }

  @Get()
  async list(@Query() q: QueryPaymentsDto, @AuthUser() user: any) {
    // Normalizamos paginación
    const limit = Math.max(1, Math.min(100, Number(q.limit ?? 20)));
    const offset = Math.max(0, Number(q.offset ?? 0));
    const query: QueryPaymentsDto = { ...q, limit, offset };

    const mineFlag =
      (typeof q.mine === 'string' ? q.mine === 'true' : !!q.mine) ||
      (!q.companyId && !q.headhunterId);

    if (mineFlag) {
      const meId = user?.id ?? null;

      return this.service.listMine({
        meCompanyId: user?.companyId ?? null,
        meHeadhunterId: meId,
        query,
        tryResolveCompanyFromAdmin: true,
      });
    }

    return this.service.list(query);
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
  async mpWebhook(@Body() req: any, @Query('pid') pid: string) {
    return this.service.handleMercadoPagoWebhook(req, pid);
  }
}
