import { NestFactory } from '@nestjs/core';
import { CompanyServiceModule } from './company-service.module';

async function bootstrap() {
  const app = await NestFactory.create(CompanyServiceModule);
  await app.listen(process.env.PORT || 3004);
}
bootstrap();
