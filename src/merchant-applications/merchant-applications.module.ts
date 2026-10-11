import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';
import { MerchantApplication } from './entities/merchant-application.entity';
import { MerchantApplicationsController } from './controllers/merchant-applications.controller';
import { MerchantApplicationsService } from './services/merchant-applications.service';
import { RISK_KYB_QUEUE } from './risk-kyb.queue';
import { RiskKybProcessor } from './risk-kyb.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([MerchantApplication]),
    BullModule.registerQueue({ name: RISK_KYB_QUEUE }),
    BullBoardModule.forFeature({
      name: RISK_KYB_QUEUE,
      adapter: BullMQAdapter,
    }),
    UsersModule,
    AuditModule,
  ],
  controllers: [MerchantApplicationsController],
  providers: [MerchantApplicationsService, RiskKybProcessor],
  exports: [MerchantApplicationsService],
})
export class MerchantApplicationsModule {}
