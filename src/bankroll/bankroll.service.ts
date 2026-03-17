import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Bankroll } from './entities/bankroll.entity';
import { BankrollMovement, BankrollMovementType } from './entities/bankroll-movement.entity';
import { CreateBankrollDto } from './dto/create-bankroll.dto';
import { UpdateBankrollDto } from './dto/update-bankroll.dto';

@Injectable()
export class BankrollService {
  constructor(
    @InjectRepository(Bankroll)
    private bankrollRepository: Repository<Bankroll>,
    @InjectRepository(BankrollMovement)
    private movementRepository: Repository<BankrollMovement>,
    private dataSource: DataSource,
  ) {}

  async getBankroll(userId: string): Promise<Bankroll | null> {
    return this.bankrollRepository.findOne({
      where: { userId },
    });
  }

  async createBankroll(userId: string, dto: CreateBankrollDto): Promise<Bankroll> {
    const existing = await this.bankrollRepository.findOne({
      where: { userId },
    });

    if (existing) {
      throw new ConflictException('Ya tienes un bankroll creado. Usa PATCH para actualizarlo.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const bankroll = queryRunner.manager.create(Bankroll, {
        userId,
        initialAmount: dto.initialAmount,
        currentAmount: dto.initialAmount,
        startDate: new Date(),
      });

      const savedBankroll = await queryRunner.manager.save(Bankroll, bankroll);

      const movement = queryRunner.manager.create(BankrollMovement, {
        bankrollId: savedBankroll.id,
        userId,
        type: BankrollMovementType.DEPOSIT,
        amount: dto.initialAmount,
        balanceAfter: dto.initialAmount,
        description: 'Bankroll inicial',
      });

      await queryRunner.manager.save(BankrollMovement, movement);
      await queryRunner.commitTransaction();

      return savedBankroll;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateBankroll(userId: string, dto: UpdateBankrollDto): Promise<Bankroll> {
    const bankroll = await this.bankrollRepository.findOne({
      where: { userId },
    });

    if (!bankroll) {
      throw new NotFoundException('No tienes un bankroll creado. Crea uno primero.');
    }

    bankroll.initialAmount = dto.initialAmount;

    return this.bankrollRepository.save(bankroll);
  }

  async deposit(
    userId: string,
    amount: number,
    description?: string,
  ): Promise<Bankroll> {
    const bankroll = await this.bankrollRepository.findOne({
      where: { userId },
    });

    if (!bankroll) {
      throw new NotFoundException('No tienes un bankroll creado. Crea uno primero.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const newBalance = bankroll.currentAmount + amount;

      await queryRunner.manager.update(Bankroll, bankroll.id, {
        currentAmount: newBalance,
      });

      const movement = queryRunner.manager.create(BankrollMovement, {
        bankrollId: bankroll.id,
        userId,
        type: BankrollMovementType.DEPOSIT,
        amount,
        balanceAfter: newBalance,
        description: description || 'Depósito',
      });

      await queryRunner.manager.save(BankrollMovement, movement);
      await queryRunner.commitTransaction();

      bankroll.currentAmount = newBalance;
      return bankroll;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException('Error al realizar el depósito');
    } finally {
      await queryRunner.release();
    }
  }

  async withdraw(
    userId: string,
    amount: number,
    description?: string,
  ): Promise<Bankroll> {
    const bankroll = await this.bankrollRepository.findOne({
      where: { userId },
    });

    if (!bankroll) {
      throw new NotFoundException('No tienes un bankroll creado. Crea uno primero.');
    }

    if (bankroll.currentAmount < amount) {
      throw new BadRequestException(
        `Saldo insuficiente. Disponible: $${bankroll.currentAmount}, solicitado: $${amount}`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const newBalance = bankroll.currentAmount - amount;

      await queryRunner.manager.update(Bankroll, bankroll.id, {
        currentAmount: newBalance,
      });

      const movement = queryRunner.manager.create(BankrollMovement, {
        bankrollId: bankroll.id,
        userId,
        type: BankrollMovementType.WITHDRAWAL,
        amount,
        balanceAfter: newBalance,
        description: description || 'Retiro',
      });

      await queryRunner.manager.save(BankrollMovement, movement);
      await queryRunner.commitTransaction();

      bankroll.currentAmount = newBalance;
      return bankroll;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException('Error al realizar el retiro');
    } finally {
      await queryRunner.release();
    }
  }

  async getMovements(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: BankrollMovement[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.movementRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }
}
