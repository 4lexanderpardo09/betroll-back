import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum BankrollMovementType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  WIN = 'WIN',
  LOSS = 'LOSS',
  VOID = 'VOID',
  CASHOUT = 'CASHOUT',
}

@Entity('bankroll_movements')
export class BankrollMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'bankroll_id', type: 'uuid' })
  bankrollId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  type: BankrollMovementType;

  @Column({ type: 'int' })
  amount: number;

  @Column({ name: 'balance_after', type: 'int' })
  balanceAfter: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string;

  @Column({ name: 'bet_id', type: 'uuid', nullable: true })
  betId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
