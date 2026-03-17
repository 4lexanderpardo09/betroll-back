import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BetsController } from './bets.controller';
import { BetsService } from './bets.service';
import { Bet } from './entities/bet.entity';
import { Bankroll } from '../bankroll/entities/bankroll.entity';
import { BankrollMovement } from '../bankroll/entities/bankroll-movement.entity';
import { DailySnapshot } from '../daily-snapshots/entities/daily-snapshot.entity';
import { BankrollModule } from '../bankroll/bankroll.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bet, Bankroll, BankrollMovement, DailySnapshot]),
  ],
  controllers: [BetsController],
  providers: [BetsService],
  exports: [BetsService],
})
export class BetsModule {}
