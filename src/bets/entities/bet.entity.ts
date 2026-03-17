import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum Sport {
  FOOTBALL = 'FOOTBALL',
  TENNIS = 'TENNIS',
  BASKETBALL = 'BASKETBALL',
  OTHER = 'OTHER',
}

export enum BetType {
  HOME_WIN = 'HOME_WIN',
  AWAY_WIN = 'AWAY_WIN',
  DRAW = 'DRAW',
  DOUBLE_CHANCE_HOME = 'DOUBLE_CHANCE_HOME',
  DOUBLE_CHANCE_AWAY = 'DOUBLE_CHANCE_AWAY',
  BTTS_YES = 'BTTS_YES',
  BTTS_NO = 'BTTS_NO',
  OVER = 'OVER',
  UNDER = 'UNDER',
  HANDICAP = 'HANDICAP',
  OTHER = 'OTHER',
}

export enum BetStatus {
  PENDING = 'PENDING',
  WON = 'WON',
  LOST = 'LOST',
  VOID = 'VOID',
  CASHOUT = 'CASHOUT',
}

export enum BetCategory {
  A = 'A',
  B = 'B',
  C = 'C',
}

@Entity('bets')
@Index('idx_bets_user', ['userId'])
export class Bet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 200 })
  sport: Sport;

  @Column({ type: 'varchar', length: 200 })
  tournament: string;

  @Column({ name: 'home_team', type: 'varchar', length: 200 })
  homeTeam: string;

  @Column({ name: 'away_team', type: 'varchar', length: 200 })
  awayTeam: string;

  @Column({ name: 'event_date', type: 'timestamp' })
  eventDate: Date;

  @Column({ name: 'bet_type', type: 'varchar', length: 50 })
  betType: BetType;

  @Column({ type: 'varchar', length: 300 })
  selection: string;

  @Column({ type: 'decimal', precision: 6, scale: 2 })
  odds: number;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'varchar', length: 1 })
  category: BetCategory;

  @Column({ type: 'smallint', default: 2 })
  confidence: number;

  @Column({ type: 'text', nullable: true })
  reasoning: string | null;

  @Column({ type: 'varchar', length: 20, default: BetStatus.PENDING })
  status: BetStatus;

  @Column({ name: 'potential_win', type: 'integer' })
  potentialWin: number;

  @Column({ type: 'integer', default: 0 })
  profit: number;

  @Column({ name: 'cashout_amount', type: 'integer', nullable: true })
  cashoutAmount: number | null;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'post_notes', type: 'text', nullable: true })
  postNotes: string | null;

  @Column({ name: 'parlay_id', type: 'uuid', nullable: true })
  parlayId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
