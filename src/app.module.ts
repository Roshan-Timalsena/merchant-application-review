import { ExpressAdapter } from '@bull-board/express';
import { BullBoardModule } from '@bull-board/nestjs';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { MerchantApplicationsModule } from './merchant-applications/merchant-applications.module';
import { QueuesModule } from './queues/queues.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { LoggerModule } from './logger/logger.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.getOrThrow<string>('database.host'),
        port: configService.getOrThrow<number>('database.port'),
        username: configService.getOrThrow<string>('database.username'),
        password: configService.getOrThrow<string>('database.password'),
        database: configService.getOrThrow<string>('database.name'),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    LoggerModule,
    AuthorizationModule,
    UsersModule,
    AuthModule,
    AuditModule,
    QueuesModule,
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter,
    }),
    MerchantApplicationsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
