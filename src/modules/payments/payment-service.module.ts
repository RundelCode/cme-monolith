import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentServiceController } from './payment-service.controller';
import { PaymentServiceService } from './payment-service.service';
import { AuthModule } from 'src/common/auth/auth.module';
import { DbModule } from 'src/common/db/db.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/payment-service/.env', '.env'],
    }),
    AuthModule,
    DbModule,
  ],
  controllers: [PaymentServiceController],
  providers: [PaymentServiceService],
})
export class PaymentServiceModule {}
