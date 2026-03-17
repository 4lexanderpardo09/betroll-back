import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Parlay, ParlayStatus } from './entities/parlay.entity';
import { Bet, BetStatus } from '../bets/entities/bet.entity';
import { Bankroll } from '../bankroll/entities/bankroll.entity';
import { BankrollMovement, BankrollMovementType } from '../bankroll/entities/bankroll-movement.entity';

export interface CreateParlayDto {
  betIds: string[];
  amount: number;
}

export interface ResolveParlayDto {
  status: ParlayStatus;
}

@Injectable()
export class ParlaysService {
  constructor(
    @InjectRepository(Parlay)
    private parlayRepository: Repository<Parlay>,
    @InjectRepository(Bet)
    private betRepository: Repository<Bet>,
    @InjectRepository(Bankroll)
    private bankrollRepository: Repository<Bankroll>,
    @InjectRepository(BankrollMovement)
    private movementRepository: Repository<BankrollMovement>,
    private dataSource: DataSource,
  ) {}

  async createParlay(userId: string, dto: CreateParlayDto): Promise<Parlay> {
    if (dto.betIds.length < 2) {
      throw new BadRequestException('Un parlay debe tener al menos 2 selecciones');
    }

    const bets = await this.betRepository.find({
      where: dto.betIds.map(id => ({ id, userId })),
    });

    if (bets.length !== dto.betIds.length) {
      throw new BadRequestException('Una o más apuestas no fueron encontradas');
    }

    const pendingBets = bets.filter(b => b.status === BetStatus.PENDING);
    if (pendingBets.length !== dto.betIds.length) {
      throw new BadRequestException('Solo puedes combinar apuestas pendientes');
    }

    const combinedOdds = bets.reduce((product, bet) => product * Number(bet.odds), 1);
    const potentialWin = Math.round(dto.amount * combinedOdds - dto.amount);

    const parlay = this.parlayRepository.create({
      userId,
      betIds: dto.betIds,
      combinedOdds,
      amount: dto.amount,
      potentialWin,
      status: ParlayStatus.PENDING,
      profit: 0,
    });

    return this.parlayRepository.save(parlay);
  }

  async findAll(userId: string): Promise<Parlay[]> {
    return this.parlayRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Parlay> {
    const parlay = await this.parlayRepository.findOne({
      where: { id, userId },
    });

    if (!parlay) {
      throw new NotFoundException('Parlay no encontrado');
    }

    return parlay;
  }

  async findOneWithBets(id: string, userId: string) {
    const parlay = await this.findOne(id, userId);
    const bets = await this.betRepository.findByIds(parlay.betIds);

    return { parlay, bets };
  }

  async getPendingBets(userId: string): Promise<Bet[]> {
    return this.betRepository.find({
      where: { userId, status: BetStatus.PENDING as any },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  async resolveParlay(id: string, userId: string, dto: ResolveParlayDto): Promise<Parlay> {
    const parlay = await this.findOne(id, userId);

    if (parlay.status !== ParlayStatus.PENDING) {
      throw new BadRequestException('El parlay ya está resuelto');
    }

    const bets = await this.betRepository.findByIds(parlay.betIds);
    const allResolved = bets.every(b => b.status !== BetStatus.PENDING);

    if (!allResolved) {
      throw new BadRequestException('Todas las selecciones deben estar resueltas');
    }

    const allWon = bets.every(b => b.status === BetStatus.WON);
    const anyVoid = bets.some(b => b.status === BetStatus.VOID);
    const anyLost = bets.some(b => b.status === BetStatus.LOST);

    let profit = 0;
    let status = ParlayStatus.PENDING;

    if (anyLost) {
      status = ParlayStatus.LOST;
      profit = -parlay.amount;
    } else if (anyVoid) {
      status = ParlayStatus.VOID;
      profit = 0;
    } else if (allWon) {
      status = ParlayStatus.WON;
      profit = parlay.potentialWin;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(Parlay, id, {
        status,
        profit,
        resolvedAt: new Date(),
      });

      const bankroll = await queryRunner.manager.findOne(Bankroll, {
        where: { userId },
      });

      if (bankroll && profit !== 0) {
        const newBalance = bankroll.currentAmount + profit;
        await queryRunner.manager.update(Bankroll, bankroll.id, {
          currentAmount: newBalance,
        });

        const movement = queryRunner.manager.create(BankrollMovement, {
          bankrollId: bankroll.id,
          userId,
          type: profit > 0 ? BankrollMovementType.WIN : BankrollMovementType.LOSS,
          amount: parlay.amount,
          balanceAfter: newBalance,
          description: `Parlay #${id.slice(0, 8)} - ${status}`,
        });

        await queryRunner.manager.save(BankrollMovement, movement);
      }

      await queryRunner.commitTransaction();

      return { ...parlay, status, profit };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    const parlay = await this.findOne(id, userId);

    if (parlay.status !== ParlayStatus.PENDING) {
      throw new BadRequestException('Solo puedes eliminar parlays pendientes');
    }

    await this.parlayRepository.remove(parlay);
  }
}
