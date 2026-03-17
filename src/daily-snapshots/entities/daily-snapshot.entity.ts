import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('daily_snapshots')
@Index('idx_snapshots_user_date', ['userId', 'snapshotDate'], { unique: true })
export class DailySnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @Column({ name: 'snapshot_date', type: 'date' })
  snapshotDate: Date;

  @Column({ name: 'opening_balance', type: 'integer' })
  openingBalance: number;

  @Column({ name: 'closing_balance', type: 'integer' })
  closingBalance: number;

  @Column({ name: 'bets_count', type: 'integer', default: 0 })
  betsCount: number;

  @Column({ name: 'won_count', type: 'integer', default: 0 })
  wonCount: number;

  @Column({ name: 'lost_count', type: 'integer', default: 0 })
  lostCount: number;

  @Column({ name: 'daily_profit', type: 'integer', default: 0 })
  dailyProfit: number;

  @Column({ name: 'stop_loss_hit', type: 'boolean', default: false })
  stopLossHit: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
