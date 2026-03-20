import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Bet, BetCategory, BetStatus } from './entities/bet.entity';
import { CreateBetDto, UpdateBetDto } from './dto/create-bet.dto';
import { ResolveBetDto } from './dto/resolve-bet.dto';
import { Bankroll } from '../bankroll/entities/bankroll.entity';
import { BankrollMovement, BankrollMovementType } from '../bankroll/entities/bankroll-movement.entity';
import { DailySnapshot } from '../daily-snapshots/entities/daily-snapshot.entity';

@Injectable()
export class BetsService {
  constructor(
    @InjectRepository(Bet)
    private betRepository: Repository<Bet>,
    @InjectRepository(Bankroll)
    private bankrollRepository: Repository<Bankroll>,
    @InjectRepository(BankrollMovement)
    private movementRepository: Repository<BankrollMovement>,
    @InjectRepository(DailySnapshot)
    private snapshotRepository: Repository<DailySnapshot>,
    private dataSource: DataSource,
  ) {}

  /**
   * Calculate category based on odds
   * A: odds <= 1.50
   * B: odds <= 2.20
   * C: odds > 2.20
   */
  calculateCategory(odds: number): BetCategory {
    if (odds <= 1.50) return BetCategory.A;
    if (odds <= 2.20) return BetCategory.B;
    return BetCategory.C;
  }

  /**
   * Calculate potential win
   * potential_win = (amount * odds) - amount
   */
  calculatePotentialWin(amount: number, odds: number): number {
    return Math.round((amount * odds) - amount);
  }

  /**
   * Check if stop-loss is hit (30% daily loss from opening balance)
   * Uses daily_snapshots table
   */
  async checkStopLoss(userId: string): Promise<{ hit: boolean; openingBalance: number; currentBalance: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Try to find today's snapshot
    let snapshot = await this.snapshotRepository.findOne({
      where: {
        userId,
        snapshotDate: today,
      },
    });

    // If no snapshot exists, get current bankroll and use it as opening
    const bankroll = await this.bankrollRepository.findOne({
      where: { userId },
    });

    if (!bankroll) {
      return { hit: false, openingBalance: 0, currentBalance: 0 };
    }

    const openingBalance = snapshot?.openingBalance ?? bankroll.currentAmount;
    const currentBalance = bankroll.currentAmount;

    // Create snapshot if doesn't exist
    if (!snapshot) {
      snapshot = await this.snapshotRepository.save({
        userId,
        snapshotDate: today,
        openingBalance,
        closingBalance: currentBalance,
        betsCount: 0,
        wonCount: 0,
        lostCount: 0,
        dailyProfit: 0,
        stopLossHit: false,
      });
    }

    // Calculate loss percentage
    const lossPercentage = (openingBalance - currentBalance) / openingBalance;
    const hit = openingBalance > 0 && lossPercentage >= 0.30;

    return { hit, openingBalance, currentBalance };
  }

  /**
   * Create a new bet
   * - Verifies bankroll exists
   * - Verifies stop-loss not active
   * - Calculates category and potential_win in backend
   * - Deducts amount from bankroll with transaction
   * - Creates LOSS movement
   */
  async createBet(userId: string, dto: CreateBetDto): Promise<Bet> {
    // 1. Verify bankroll exists
    const bankroll = await this.bankrollRepository.findOne({
      where: { userId },
    });

    if (!bankroll) {
      throw new BadRequestException('No tienes un bankroll creado. Crea uno primero.');
    }

    // Save bankroll data before transaction
    const bankrollId = bankroll.id;
    const currentAmount = bankroll.currentAmount;

    // 2. Verify stop-loss not active
    const stopLoss = await this.checkStopLoss(userId);
    if (stopLoss.hit) {
      throw new BadRequestException(
        `Stop-loss activo. Has perdido el 30% del bankroll hoy. Opening: $${stopLoss.openingBalance}, Actual: $${stopLoss.currentBalance}`,
      );
    }

    // 3. Verify sufficient balance
    if (currentAmount < dto.amount) {
      throw new BadRequestException(
        `Saldo insuficiente. Disponible: $${currentAmount}, solicitado: $${dto.amount}`,
      );
    }

    // 4. Calculate category and potential_win
    const category = this.calculateCategory(dto.odds);
    const potentialWin = this.calculatePotentialWin(dto.amount, dto.odds);

    // 5. Calculate confidence based on percentage
    let confidence = dto.confidence ?? 2;
    if (dto.percentage !== undefined) {
      if (dto.percentage >= 5) confidence = 5;
      else if (dto.percentage >= 3) confidence = 4;
      else if (dto.percentage >= 1.5) confidence = 3;
      else confidence = 2;
    }

    // 5. Execute transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create bet
      const bet = queryRunner.manager.create(Bet, {
        userId,
        sport: dto.sport,
        tournament: dto.tournament,
        homeTeam: dto.homeTeam,
        awayTeam: dto.awayTeam,
        eventDate: new Date(dto.eventDate),
        betType: dto.betType,
        selection: dto.selection,
        odds: dto.odds,
        amount: dto.amount,
        category,
        confidence,
        reasoning: dto.reasoning ?? null,
        status: BetStatus.PENDING,
        potentialWin,
        profit: 0,
      });

      const savedBet = await queryRunner.manager.save(Bet, bet);

      // Deduct from bankroll
      const newBalance = currentAmount - dto.amount;
      await queryRunner.manager.update(Bankroll, bankrollId, {
        currentAmount: newBalance,
      });

      // Create LOSS movement
      const movement = queryRunner.manager.create(BankrollMovement, {
        bankrollId: bankrollId,
        userId: bankroll.userId,
        type: BankrollMovementType.LOSS,
        amount: dto.amount,
        balanceAfter: newBalance,
        description: `Apuesta #${savedBet.id.slice(0, 8)} - ${dto.selection} @ ${dto.odds}`,
        betId: savedBet.id,
      });

      await queryRunner.manager.save(BankrollMovement, movement);

      // Update daily snapshot bets count
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const snapshot = await this.snapshotRepository.findOne({
        where: { userId, snapshotDate: today },
      });

      if (snapshot) {
        await queryRunner.manager.update(DailySnapshot, snapshot.id, {
          betsCount: snapshot.betsCount + 1,
          closingBalance: newBalance,
        });
      }

      await queryRunner.commitTransaction();

      return savedBet;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Resolve a bet with atomic transaction
   * - Updates bet status, profit, resolvedAt
   * - Updates bankroll (add/subtract)
   * - Creates movement
   * - Updates daily snapshot
   */
  async resolveBet(betId: string, userId: string, dto: ResolveBetDto): Promise<Bet> {
    // Find bet
    const bet = await this.betRepository.findOne({
      where: { id: betId, userId },
    });

    if (!bet) {
      throw new NotFoundException('Apuesta no encontrada');
    }

    if (bet.status !== BetStatus.PENDING) {
      throw new BadRequestException('Esta apuesta ya está resuelta');
    }

    // Calculate profit based on status
    let profit = 0;
    let movementType: BankrollMovementType;
    let movementAmount = 0;

    switch (dto.status) {
      case BetStatus.WON:
        profit = bet.potentialWin;
        movementType = BankrollMovementType.WIN;
        movementAmount = bet.amount + bet.potentialWin; // Return stake + profit
        break;
      case BetStatus.LOST:
        profit = -bet.amount;
        movementType = BankrollMovementType.LOSS;
        movementAmount = 0; // Already deducted when bet was created
        break;
      case BetStatus.VOID:
        profit = 0;
        movementType = BankrollMovementType.VOID;
        movementAmount = bet.amount; // Return the amount
        break;
      case BetStatus.CASHOUT:
        profit = (dto.cashoutAmount ?? 0) - bet.amount;
        movementType = BankrollMovementType.CASHOUT;
        movementAmount = dto.cashoutAmount ?? 0;
        break;
      default:
        throw new BadRequestException('Estado inválido');
    }

    // Get bankroll
    const bankroll = await this.bankrollRepository.findOne({
      where: { userId },
    });

    if (!bankroll) {
      throw new BadRequestException('No tienes un bankroll');
    }

    // Execute atomic transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Update bet
      const updateData: Partial<Bet> = {
        status: dto.status,
        profit,
        resolvedAt: new Date(),
      };

      if (dto.status === BetStatus.CASHOUT && dto.cashoutAmount) {
        updateData.cashoutAmount = dto.cashoutAmount;
      }

      if (dto.postNotes) {
        updateData.postNotes = dto.postNotes;
      }

      await queryRunner.manager.update(Bet, betId, updateData);

      // 2. Update bankroll (for VOID and CASHOUT, we need to add back or add cashout)
      let newBalance = bankroll.currentAmount;
      
      if (dto.status === BetStatus.VOID) {
        // Return the amount that was deducted
        newBalance = bankroll.currentAmount + bet.amount;
      } else if (dto.status === BetStatus.CASHOUT && dto.cashoutAmount) {
        // Add cashout amount
        newBalance = bankroll.currentAmount + dto.cashoutAmount;
      } else if (dto.status === BetStatus.WON) {
        // Add amount + potential win (return stake + profit)
        newBalance = bankroll.currentAmount + bet.amount + bet.potentialWin;
      }
      // For LOST, balance is already reduced

      await queryRunner.manager.update(Bankroll, bankroll.id, {
        currentAmount: newBalance,
      });

      // 3. Create movement (only for WON, VOID, CASHOUT - LOSS was already created)
      if (dto.status !== BetStatus.LOST) {
        const movement = queryRunner.manager.create(BankrollMovement, {
          bankrollId: bankroll.id,
          userId,
          type: movementType,
          amount: movementAmount,
          balanceAfter: newBalance,
          description: `Resolución #${betId.slice(0, 8)} - ${dto.status}: ${bet.selection} @ ${bet.odds}`,
          betId,
        });

        await queryRunner.manager.save(BankrollMovement, movement);
      }

      // 4. Update daily snapshot
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let snapshot = await this.snapshotRepository.findOne({
        where: { userId, snapshotDate: today },
      });

      if (!snapshot) {
        // Create new snapshot if doesn't exist
        const openingBalance = bankroll.currentAmount;
        const lossPercentage = openingBalance > 0 ? (openingBalance - newBalance) / openingBalance : 0;
        const stopLossHit = lossPercentage >= 0.3;

        snapshot = await this.snapshotRepository.save({
          userId,
          snapshotDate: today,
          openingBalance,
          closingBalance: newBalance,
          betsCount: 1,
          wonCount: dto.status === BetStatus.WON ? 1 : 0,
          lostCount: dto.status === BetStatus.LOST ? 1 : 0,
          dailyProfit: profit,
          stopLossHit,
        });
      } else {
        // Update existing snapshot
        const openingBalance = snapshot.openingBalance;
        const newDailyProfit = snapshot.dailyProfit + profit;
        const lossPercentage = openingBalance > 0 ? (openingBalance - newBalance) / openingBalance : 0;
        const stopLossHit = lossPercentage >= 0.3;

        await queryRunner.manager.update(DailySnapshot, snapshot.id, {
          closingBalance: newBalance,
          betsCount: snapshot.betsCount + 1,
          wonCount: snapshot.wonCount + (dto.status === BetStatus.WON ? 1 : 0),
          lostCount: snapshot.lostCount + (dto.status === BetStatus.LOST ? 1 : 0),
          dailyProfit: newDailyProfit,
          stopLossHit,
        });
      }

      await queryRunner.commitTransaction();

      // Return updated bet
      return {
        ...bet,
        ...updateData,
      } as Bet;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Find all bets with filters
   */
  async findAll(
    userId: string,
    page: number = 1,
    limit: number = 20,
    filters?: {
      sport?: string;
      status?: string;
      category?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<{ data: Bet[]; total: number; page: number; limit: number }> {
    const queryBuilder = this.betRepository
      .createQueryBuilder('bet')
      .where('bet.userId = :userId', { userId });

    if (filters?.sport) {
      queryBuilder.andWhere('bet.sport = :sport', { sport: filters.sport });
    }

    if (filters?.status) {
      queryBuilder.andWhere('bet.status = :status', { status: filters.status });
    }

    if (filters?.category) {
      queryBuilder.andWhere('bet.category = :category', { category: filters.category });
    }

    if (filters?.dateFrom) {
      queryBuilder.andWhere('DATE(bet.createdAt) >= :dateFrom', { dateFrom: filters.dateFrom });
    }

    if (filters?.dateTo) {
      queryBuilder.andWhere('DATE(bet.createdAt) <= :dateTo', { dateTo: filters.dateTo });
    }

    queryBuilder.orderBy('bet.createdAt', 'DESC');
    queryBuilder.skip((page - 1) * limit).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total, page, limit };
  }

  /**
   * Find pending bets
   */
  async findPending(userId: string): Promise<Bet[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.betRepository.find({
      where: {
        userId,
        status: BetStatus.PENDING,
      },
      order: { eventDate: 'ASC' },
    });
  }

  /**
   * Find one bet by ID
   */
  async findOne(betId: string, userId: string): Promise<Bet> {
    const bet = await this.betRepository.findOne({
      where: { id: betId, userId },
    });

    if (!bet) {
      throw new NotFoundException('Apuesta no encontrada');
    }

    return bet;
  }

  /**
   * Delete a bet (only if PENDING)
   */
  async remove(betId: string, userId: string): Promise<void> {
    const bet = await this.betRepository.findOne({
      where: { id: betId, userId },
    });

    if (!bet) {
      throw new NotFoundException('Apuesta no encontrada');
    }

    if (bet.status !== BetStatus.PENDING) {
      throw new BadRequestException('Solo puedes eliminar apuestas pendientes');
    }

    // Refund the amount to bankroll
    const bankroll = await this.bankrollRepository.findOne({
      where: { userId },
    });

    if (bankroll) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const newBalance = bankroll.currentAmount + bet.amount;

        // Update bankroll
        await queryRunner.manager.update(Bankroll, bankroll.id, {
          currentAmount: newBalance,
        });

        // Create refund movement
        const movement = queryRunner.manager.create(BankrollMovement, {
          bankrollId: bankroll.id,
          userId,
          type: BankrollMovementType.VOID,
          amount: bet.amount,
          balanceAfter: newBalance,
          description: `Eliminación de apuesta #${betId.slice(0, 8)}`,
          betId,
        });

        await queryRunner.manager.save(BankrollMovement, movement);

        // Delete bet
        await queryRunner.manager.delete(Bet, betId);

        await queryRunner.commitTransaction();
      } catch (error) {
        console.error('[remove] Error:', error.message, error.stack);
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } else {
      await this.betRepository.delete(betId);
    }
  }

  /**
   * Update a pending bet
   */
  async updateBet(betId: string, userId: string, dto: UpdateBetDto): Promise<Bet> {
    const bet = await this.betRepository.findOne({
      where: { id: betId, userId },
    });

    if (!bet) {
      throw new NotFoundException('Apuesta no encontrada');
    }

    if (bet.status !== BetStatus.PENDING) {
      throw new BadRequestException('Solo puedes editar apuestas pendientes');
    }

    const updateData: Partial<Bet> = {};
    
    if (dto.tournament !== undefined) updateData.tournament = dto.tournament;
    if (dto.homeTeam !== undefined) updateData.homeTeam = dto.homeTeam;
    if (dto.awayTeam !== undefined) updateData.awayTeam = dto.awayTeam;
    if (dto.eventDate !== undefined) updateData.eventDate = new Date(dto.eventDate);
    if (dto.betType !== undefined) updateData.betType = dto.betType;
    if (dto.selection !== undefined) updateData.selection = dto.selection;
    if (dto.odds !== undefined) updateData.odds = dto.odds;
    if (dto.amount !== undefined) updateData.amount = dto.amount;
    if (dto.reasoning !== undefined) updateData.reasoning = dto.reasoning;

    // Recalculate potential win if odds or amount changed
    if (dto.odds !== undefined || dto.amount !== undefined) {
      const odds = dto.odds ?? bet.odds;
      const amount = dto.amount ?? bet.amount;
      updateData.potentialWin = Math.round(amount * odds - amount);
    }

    await this.betRepository.update(betId, updateData);

    const updatedBet = await this.betRepository.findOne({ where: { id: betId } });
    if (!updatedBet) {
      throw new NotFoundException('Apuesta no encontrada después de actualizar');
    }
    return updatedBet;
  }

  /**
   * Get bet statistics
   */
  async getStats(userId: string): Promise<{
    total: number;
    won: number;
    lost: number;
    pending: number;
    void: number;
    cashout: number;
    winRate: number;
    totalProfit: number;
    totalStaked: number;
  }> {
    const bets = await this.betRepository.find({
      where: { userId },
    });

    const stats = {
      total: bets.length,
      won: bets.filter((b) => b.status === BetStatus.WON).length,
      lost: bets.filter((b) => b.status === BetStatus.LOST).length,
      pending: bets.filter((b) => b.status === BetStatus.PENDING).length,
      void: bets.filter((b) => b.status === BetStatus.VOID).length,
      cashout: bets.filter((b) => b.status === BetStatus.CASHOUT).length,
      winRate: 0,
      totalProfit: 0,
      totalStaked: 0,
    };

    // Calculate win rate (won / (won + lost + void))
    const resolvedCount = stats.won + stats.lost + stats.void;
    if (resolvedCount > 0) {
      stats.winRate = Math.round((stats.won / resolvedCount) * 100);
    }

    // Calculate total profit
    stats.totalProfit = bets.reduce((sum, b) => sum + b.profit, 0);

    // Calculate total staked
    stats.totalStaked = bets.reduce((sum, b) => sum + b.amount, 0);

    return stats;
  }
}
