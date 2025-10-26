import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JobServiceModule } from './job-service.module';

async function bootstrap() {
  const app = await NestFactory.create(JobServiceModule);
  await app.listen(process.env.PORT || 3004);
}
bootstrap();
