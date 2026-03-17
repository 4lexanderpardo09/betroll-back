import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('bankrolls')
export class Bankroll {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @Column({ name: 'initial_amount', type: 'int' })
  initialAmount: number;

  @Column({ name: 'current_amount', type: 'int' })
  currentAmount: number;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
