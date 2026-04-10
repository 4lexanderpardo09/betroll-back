import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ParlayStatus {
  PENDING = 'PENDING',
  WON = 'WON',
  LOST = 'LOST',
  VOID = 'VOID',
}

@Entity('parlays')
@Index('idx_parlays_user', ['userId'])
export class Parlay {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'bet_ids', type: 'json' })
  betIds: string[];

  @Column({ name: 'combined_odds', type: 'decimal', precision: 8, scale: 4 })
  combinedOdds: number;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ name: 'potential_win', type: 'integer' })
  potentialWin: number;

  @Column({ type: 'varchar', length: 20, default: ParlayStatus.PENDING })
  status: ParlayStatus;

  @Column({ type: 'integer', default: 0 })
  profit: number;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'post_notes', type: 'text', nullable: true })
  postNotes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
