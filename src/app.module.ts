import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BankrollModule } from './bankroll/bankroll.module';
import { BetsModule } from './bets/bets.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ParlaysModule } from './parlays/parlays.module';
import { HealthController } from './health.controller';
import { User } from './users/entities/user.entity';
import { Bankroll } from './bankroll/entities/bankroll.entity';
import { BankrollMovement } from './bankroll/entities/bankroll-movement.entity';
import { Bet } from './bets/entities/bet.entity';
import { DailySnapshot } from './daily-snapshots/entities/daily-snapshot.entity';
import { Parlay } from './parlays/entities/parlay.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', '127.0.0.1'),
        port: configService.get('DB_PORT', 5432),
        username: configService.get('DB_USER', 'alexander'),
        password: configService.get('DB_PASSWORD', '123456'),
        database: configService.get('DB_NAME', 'betroll'),
        entities: [User, Bankroll, BankrollMovement, Bet, DailySnapshot, Parlay],
        synchronize: configService.get('NODE_ENV') !== 'production',
        ssl: configService.get('NODE_ENV') === 'production' 
          ? { rejectUnauthorized: false } 
          : false,
      }),
    }),
    AuthModule,
    UsersModule,
    BankrollModule,
    BetsModule,
    AnalyticsModule,
    ParlaysModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
