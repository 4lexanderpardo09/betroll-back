import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('analyses')
@Index('idx_analyses_user', ['userId'])
export class Analysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar' })
  userId: string;

  @Column({ type: 'varchar', length: 50 })
  sport: string;

  @Column({ name: 'home_team', type: 'varchar', length: 200 })
  homeTeam: string;

  @Column({ name: 'away_team', type: 'varchar', length: 200 })
  awayTeam: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  tournament: string | null;

  @Column({ name: 'event_date', type: 'datetime', nullable: true })
  eventDate: Date | null;

  @Column({ name: 'user_odds', type: 'decimal', precision: 6, scale: 2, nullable: true })
  userOdds: number | null;

  @Column({ name: 'user_sportsbook', type: 'varchar', length: 100, nullable: true })
  userSportsbook: string | null;

  @Column({ type: 'longtext' })
  analysis: string;

  @Column({ type: 'json', nullable: true })
  sources: object | null;

  @Column({ name: 'recommended_selection', type: 'varchar', length: 300, nullable: true })
  recommendedSelection: string | null;

  @Column({ name: 'recommended_odds', type: 'decimal', precision: 6, scale: 2, nullable: true })
  recommendedOdds: number | null;

  @Column({ name: 'recommended_stake', type: 'int', nullable: true })
  recommendedStake: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  confidence: string | null;

  @Column({ name: 'mini_max_model', type: 'varchar', length: 50, nullable: true })
  miniMaxModel: string | null;

  @Column({ name: 'mini_max_tokens', type: 'int', nullable: true })
  miniMaxTokens: number | null;

  @Column({ name: 'mini_max_cost', type: 'decimal', precision: 10, scale: 4, nullable: true })
  miniMaxCost: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
