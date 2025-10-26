import { NestFactory } from '@nestjs/core';
import { ReferralServiceModule } from './referral-service.module';

async function bootstrap() {
  const app = await NestFactory.create(ReferralServiceModule);
  await app.listen(process.env.PORT || 3008);
}
bootstrap();
