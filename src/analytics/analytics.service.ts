import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bet, BetStatus, Sport, BetType, BetCategory } from '../bets/entities/bet.entity';
import { Bankroll } from '../bankroll/entities/bankroll.entity';
import { DailySnapshot } from '../daily-snapshots/entities/daily-snapshot.entity';

export interface DashboardSummary {
  bankroll: { currentAmount: number; initialAmount: number } | null;
  stats: {
    totalBets: number;
    wonBets: number;
    lostBets: number;
    voidBets: number;
    pendingBets: number;
    winRate: number;
    totalProfit: number;
    totalStaked: number;
    roi: number;
  };
  streak: { current: number; type: 'WIN' | 'LOSS' | 'NONE' };
  stopLoss: { hit: boolean; openingBalance: number; currentBalance: number; dailyLoss: number };
  recentBets: Array<{
    id: string;
    sport: string;
    selection: string;
    odds: number;
    amount: number;
    status: string;
    profit: number;
    createdAt: Date;
  }>;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Bet)
    private betRepository: Repository<Bet>,
    @InjectRepository(Bankroll)
    private bankrollRepository: Repository<Bankroll>,
    @InjectRepository(DailySnapshot)
    private snapshotRepository: Repository<DailySnapshot>,
  ) {}

  async getSummary(userId: string): Promise<DashboardSummary> {
    const bankroll = await this.bankrollRepository.findOne({
      where: { userId },
    });

    const bets = await this.betRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const wonBets = bets.filter(b => b.status === BetStatus.WON);
    const lostBets = bets.filter(b => b.status === BetStatus.LOST);
    const voidBets = bets.filter(b => b.status === BetStatus.VOID);
    const pendingBets = bets.filter(b => b.status === BetStatus.PENDING);

    const totalBets = bets.length;
    const resolvedBets = wonBets.length + lostBets.length + voidBets.length;
    const winRate = resolvedBets > 0 ? (wonBets.length / resolvedBets) * 100 : 0;

    const totalProfit = bets.reduce((sum, b) => sum + (b.profit || 0), 0);
    const totalStaked = bets.reduce((sum, b) => sum + b.amount, 0);
    const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;

    const streak = this.calculateStreak(bets);

    const stopLoss = await this.checkStopLoss(userId, bankroll);

    const recentBets = bets.slice(0, 5).map(b => ({
      id: b.id,
      sport: b.sport,
      selection: b.selection,
      odds: b.odds,
      amount: b.amount,
      status: b.status,
      profit: b.profit,
      createdAt: b.createdAt,
    }));

    return {
      bankroll: bankroll
        ? { currentAmount: bankroll.currentAmount, initialAmount: bankroll.initialAmount }
        : null,
      stats: {
        totalBets,
        wonBets: wonBets.length,
        lostBets: lostBets.length,
        voidBets: voidBets.length,
        pendingBets: pendingBets.length,
        winRate,
        totalProfit,
        totalStaked,
        roi,
      },
      streak,
      stopLoss,
      recentBets,
    };
  }

  private calculateStreak(bets: Bet[]): { current: number; type: 'WIN' | 'LOSS' | 'NONE' } {
    const resolvedBets = bets.filter(
      b => b.status === BetStatus.WON || b.status === BetStatus.LOST || b.status === BetStatus.VOID
    );

    if (resolvedBets.length === 0) {
      return { current: 0, type: 'NONE' };
    }

    const mostRecent = resolvedBets[0];
    let streak = 0;

    for (const bet of resolvedBets) {
      if (bet.status === mostRecent.status) {
        streak++;
      } else {
        break;
      }
    }

    const type =
      mostRecent.status === BetStatus.WON
        ? 'WIN'
        : mostRecent.status === BetStatus.LOST
          ? 'LOSS'
          : 'NONE';

    return { current: streak, type };
  }

  private async checkStopLoss(
    userId: string,
    bankroll: Bankroll | null,
  ): Promise<{ hit: boolean; openingBalance: number; currentBalance: number; dailyLoss: number }> {
    if (!bankroll) {
      return { hit: false, openingBalance: 0, currentBalance: 0, dailyLoss: 0 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const snapshot = await this.snapshotRepository.findOne({
      where: {
        userId,
        snapshotDate: today,
      },
    });

    const openingBalance = snapshot?.openingBalance ?? bankroll.currentAmount;
    const currentBalance = bankroll.currentAmount;
    const dailyLoss = currentBalance - openingBalance;
    const lossPercentage = openingBalance > 0 ? dailyLoss / openingBalance : 0;
    const hit = openingBalance > 0 && lossPercentage <= -0.3;

    return { hit, openingBalance, currentBalance, dailyLoss };
  }

  async getPnl(userId: string, period: 'daily' | 'weekly' = 'daily'): Promise<Array<{ date: string; profit: number; bets: number; winRate: number }>> {
    const bets = await this.betRepository.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });

    const resolvedBets = bets.filter(b => 
      b.status === BetStatus.WON || b.status === BetStatus.LOST || b.status === BetStatus.VOID
    );

    const grouped = new Map<string, { profit: number; won: number; total: number }>();

    for (const bet of resolvedBets) {
      let key: string;
      const date = new Date(bet.createdAt);

      if (period === 'daily') {
        key = date.toISOString().split('T')[0];
      } else {
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(date.setDate(diff));
        key = monday.toISOString().split('T')[0];
      }

      const existing = grouped.get(key) || { profit: 0, won: 0, total: 0 };
      existing.profit += bet.profit || 0;
      existing.total += 1;
      if (bet.status === BetStatus.WON) existing.won += 1;
      grouped.set(key, existing);
    }

    return Array.from(grouped.entries()).map(([date, data]) => ({
      date,
      profit: data.profit,
      bets: data.total,
      winRate: data.total > 0 ? (data.won / data.total) * 100 : 0,
    })).sort((a, b) => a.date.localeCompare(b.date));
  }

  async getBySport(userId: string): Promise<Array<{ sport: string; totalBets: number; won: number; lost: number; profit: number; roi: number; avgOdds: number }>> {
    const bets = await this.betRepository.find({
      where: { userId },
    });

    const grouped = new Map<string, Bet[]>();
    for (const bet of bets) {
      const sportBets = grouped.get(bet.sport) || [];
      sportBets.push(bet);
      grouped.set(bet.sport, sportBets);
    }

    return Array.from(grouped.entries()).map(([sport, sportBets]) => {
      const resolved = sportBets.filter(b => b.status !== BetStatus.PENDING);
      const won = sportBets.filter(b => b.status === BetStatus.WON).length;
      const lost = sportBets.filter(b => b.status === BetStatus.LOST).length;
      const profit = sportBets.reduce((sum, b) => sum + (b.profit || 0), 0);
      const totalStaked = sportBets.reduce((sum, b) => sum + b.amount, 0);
      const avgOdds = sportBets.length > 0 
        ? sportBets.reduce((sum, b) => sum + Number(b.odds), 0) / sportBets.length 
        : 0;

      return {
        sport,
        totalBets: sportBets.length,
        won,
        lost,
        profit,
        roi: totalStaked > 0 ? (profit / totalStaked) * 100 : 0,
        avgOdds: Math.round(avgOdds * 100) / 100,
      };
    });
  }

  async getByType(userId: string): Promise<Array<{ betType: string; totalBets: number; won: number; lost: number; profit: number; roi: number }>> {
    const bets = await this.betRepository.find({
      where: { userId },
    });

    const grouped = new Map<string, Bet[]>();
    for (const bet of bets) {
      const typeBets = grouped.get(bet.betType) || [];
      typeBets.push(bet);
      grouped.set(bet.betType, typeBets);
    }

    return Array.from(grouped.entries()).map(([betType, typeBets]) => {
      const won = typeBets.filter(b => b.status === BetStatus.WON).length;
      const lost = typeBets.filter(b => b.status === BetStatus.LOST).length;
      const profit = typeBets.reduce((sum, b) => sum + (b.profit || 0), 0);
      const totalStaked = typeBets.reduce((sum, b) => sum + b.amount, 0);

      return {
        betType,
        totalBets: typeBets.length,
        won,
        lost,
        profit,
        roi: totalStaked > 0 ? (profit / totalStaked) * 100 : 0,
      };
    });
  }

  async getByCategory(userId: string): Promise<Array<{ category: string; totalBets: number; won: number; profit: number; roi: number }>> {
    const bets = await this.betRepository.find({
      where: { userId },
    });

    const grouped = new Map<string, Bet[]>();
    for (const bet of bets) {
      const catBets = grouped.get(bet.category) || [];
      catBets.push(bet);
      grouped.set(bet.category, catBets);
    }

    return Array.from(grouped.entries()).map(([category, catBets]) => {
      const won = catBets.filter(b => b.status === BetStatus.WON).length;
      const profit = catBets.reduce((sum, b) => sum + (b.profit || 0), 0);
      const totalStaked = catBets.reduce((sum, b) => sum + b.amount, 0);

      return {
        category,
        totalBets: catBets.length,
        won,
        profit,
        roi: totalStaked > 0 ? (profit / totalStaked) * 100 : 0,
      };
    });
  }

  async getBankrollHistory(userId: string): Promise<Array<{ date: string; opening: number; closing: number; profit: number }>> {
    const snapshots = await this.snapshotRepository.find({
      where: { userId },
      order: { snapshotDate: 'ASC' },
      take: 90,
    });

    return snapshots.map(s => {
      const date = s.snapshotDate instanceof Date 
        ? s.snapshotDate.toISOString().split('T')[0]
        : new Date(s.snapshotDate).toISOString().split('T')[0];
      return {
        date,
        opening: s.openingBalance,
        closing: s.closingBalance,
        profit: s.dailyProfit,
      };
    });
  }
}
