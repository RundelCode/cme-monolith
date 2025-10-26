import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ApplicationServiceModule } from './application-service.module';

async function bootstrap() {
  const app = await NestFactory.create(ApplicationServiceModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(process.env.PORT || 3006);
}
bootstrap();
