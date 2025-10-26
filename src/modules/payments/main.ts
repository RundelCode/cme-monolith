import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { PaymentServiceModule } from './payment-service.module';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(PaymentServiceModule);

  app.use(bodyParser.json());

  app.use((req, _res, next) => {
    console.log('[INCOMING]', req.method, req.url);
    next();
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(process.env.PORT || 3005, '0.0.0.0');
  console.log(`Payments API listening on http://localhost:${process.env.PORT || 3005}`);
}
bootstrap();
