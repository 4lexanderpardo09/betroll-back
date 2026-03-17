import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParlaysService } from './parlays.service';
import { ParlaysController } from './parlays.controller';
import { Parlay } from './entities/parlay.entity';
import { Bet } from '../bets/entities/bet.entity';
import { Bankroll } from '../bankroll/entities/bankroll.entity';
import { BankrollMovement } from '../bankroll/entities/bankroll-movement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Parlay, Bet, Bankroll, BankrollMovement])],
  controllers: [ParlaysController],
  providers: [ParlaysService],
  exports: [ParlaysService],
})
export class ParlaysModule {}
