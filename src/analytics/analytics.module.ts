import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { Bet } from '../bets/entities/bet.entity';
import { Bankroll } from '../bankroll/entities/bankroll.entity';
import { DailySnapshot } from '../daily-snapshots/entities/daily-snapshot.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Bet, Bankroll, DailySnapshot])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
