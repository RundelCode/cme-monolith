import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, BadRequestException } from '@nestjs/common';
import { NotificationsService } from './notification-service.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

function normalizeCreateBody(raw: any): CreateNotificationDto {
  const src = raw?.input ?? raw ?? {};
  const dto: CreateNotificationDto = {
    userId: src.userId ?? src.user_id,
    title: src.title,
    message: src.message,
    notificationType: src.notificationType ?? src.notification_type,
    channel: src.channel ?? 'email',
    relatedId: src.relatedId ?? src.related_id ?? undefined,
  } as any;

  // Validación mínima explícita antes del ValidationPipe (mensajes más claros)
  if (!dto.userId || !dto.title || !dto.message || !dto.notificationType) {
    throw new BadRequestException('Missing required fields (userId, title, message, notificationType)');
  }
  return dto;
}

function normalizeQuery(q: any): QueryNotificationsDto {
  // Acepta ?type= además de ?notificationType=
  const out: QueryNotificationsDto = {
    userId: q.userId ?? q.user_id,
    status: q.status,
    notificationType: q.notificationType ?? q.type,
    offset: q.offset ? Number(q.offset) : undefined,
    limit: q.limit ? Number(q.limit) : undefined,
  } as any;
  return out;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) { }

  @Post()
  create(@Body() raw: any) {
    // normalizamos por si llega { input: {...} } o snake_case
    const dto = normalizeCreateBody(raw);
    return this.service.create(dto);
  }

  @Get()
  list(@Query() q: any) {
    const nq = normalizeQuery(q);
    return this.service.list(nq);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/read')
  markRead(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.markRead(id);
  }

  // Forzar envío de una notificación (útil en pruebas)
  @Post(':id/dispatch')
  dispatch(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.dispatchOneById(id);
  }
}
