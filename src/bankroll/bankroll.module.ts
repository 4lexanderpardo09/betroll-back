import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankrollService } from './bankroll.service';
import { BankrollController } from './bankroll.controller';
import { Bankroll } from './entities/bankroll.entity';
import { BankrollMovement } from './entities/bankroll-movement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Bankroll, BankrollMovement])],
  controllers: [BankrollController],
  providers: [BankrollService],
  exports: [BankrollService],
})
export class BankrollModule {}
