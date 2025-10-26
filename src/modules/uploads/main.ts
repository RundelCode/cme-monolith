import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { UploadsModule } from './uploads-service.module';

async function bootstrap() {
  const app = await NestFactory.create(UploadsModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: true, credentials: true });

  await app.listen(process.env.PORT || 3015);
}
bootstrap();
