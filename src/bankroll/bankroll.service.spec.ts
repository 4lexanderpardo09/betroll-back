import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { BankrollService } from './bankroll.service';
import { Bankroll } from './entities/bankroll.entity';
import { BankrollMovement } from './entities/bankroll-movement.entity';

describe('BankrollService', () => {
  let service: BankrollService;
  let bankrollRepository: jest.Mocked<Repository<Bankroll>>;
  let movementRepository: jest.Mocked<Repository<BankrollMovement>>;
  let dataSource: jest.Mocked<DataSource>;

  const mockUserId = 'user-123';
  const mockBankroll = {
    id: 'bankroll-1',
    userId: mockUserId,
    initialAmount: 100000,
    currentAmount: 100000,
    startDate: new Date('2024-01-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        create: jest.fn().mockImplementation((entity, data) => ({ ...data })),
        save: jest.fn().mockImplementation((entity, data) => Promise.resolve({ id: 'new-id', ...data })),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankrollService,
        {
          provide: getRepositoryToken(Bankroll),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(BankrollMovement),
          useValue: {
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
      ],
    }).compile();

    service = module.get<BankrollService>(BankrollService);
    bankrollRepository = module.get(getRepositoryToken(Bankroll));
    movementRepository = module.get(getRepositoryToken(BankrollMovement));
    dataSource = module.get(DataSource);
  });

  describe('getBankroll', () => {
    it('should return bankroll when exists', async () => {
      bankrollRepository.findOne.mockResolvedValue(mockBankroll as Bankroll);
      const result = await service.getBankroll(mockUserId);
      expect(result).toEqual(mockBankroll);
    });

    it('should return null when bankroll does not exist', async () => {
      bankrollRepository.findOne.mockResolvedValue(null);
      const result = await service.getBankroll(mockUserId);
      expect(result).toBeNull();
    });
  });

  describe('createBankroll', () => {
    it('should create a new bankroll', async () => {
      bankrollRepository.findOne.mockResolvedValue(null);
      
      const result = await service.createBankroll(mockUserId, { initialAmount: 100000 });
      
      expect(result.userId).toBe(mockUserId);
      expect(result.initialAmount).toBe(100000);
      expect(result.currentAmount).toBe(100000);
    });

    it('should throw ConflictException if bankroll already exists', async () => {
      bankrollRepository.findOne.mockResolvedValue(mockBankroll as Bankroll);
      
      await expect(
        service.createBankroll(mockUserId, { initialAmount: 100000 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateBankroll', () => {
    it('should update existing bankroll', async () => {
      bankrollRepository.findOne.mockResolvedValue(mockBankroll as Bankroll);
      bankrollRepository.save.mockResolvedValue({ ...mockBankroll, initialAmount: 200000 });
      
      const result = await service.updateBankroll(mockUserId, { initialAmount: 200000 });
      
      expect(result.initialAmount).toBe(200000);
    });

    it('should throw NotFoundException if bankroll does not exist', async () => {
      bankrollRepository.findOne.mockResolvedValue(null);
      
      await expect(
        service.updateBankroll(mockUserId, { initialAmount: 100000 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deposit', () => {
    it('should deposit funds successfully', async () => {
      bankrollRepository.findOne.mockResolvedValue(mockBankroll as Bankroll);
      
      const result = await service.deposit(mockUserId, 50000, 'Test deposit');
      
      expect(result.currentAmount).toBe(150000);
    });

    it('should throw NotFoundException if bankroll does not exist', async () => {
      bankrollRepository.findOne.mockResolvedValue(null);
      
      await expect(
        service.deposit(mockUserId, 50000),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('withdraw', () => {
    it('should withdraw funds successfully', async () => {
      // Create a mutable mock bankroll
      const currentBankroll = { ...mockBankroll, currentAmount: 100000 };
      bankrollRepository.findOne.mockResolvedValue(currentBankroll as Bankroll);
      
      const result = await service.withdraw(mockUserId, 30000, 'Test withdrawal');
      
      // The result should have the updated balance from the queryRunner
      expect(result.currentAmount).toBe(70000);
    });

    it('should throw BadRequestException if insufficient balance', async () => {
      bankrollRepository.findOne.mockResolvedValue(mockBankroll as Bankroll);
      
      await expect(
        service.withdraw(mockUserId, 200000),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if bankroll does not exist', async () => {
      bankrollRepository.findOne.mockResolvedValue(null);
      
      await expect(
        service.withdraw(mockUserId, 50000),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMovements', () => {
    it('should return paginated movements', async () => {
      const mockMovements = [
        { id: '1', type: 'DEPOSIT', amount: 100000, balanceAfter: 100000 },
      ];
      movementRepository.findAndCount.mockResolvedValue([mockMovements as any, 1]);
      
      const result = await service.getMovements(mockUserId, 1, 20);
      
      expect(result.data).toEqual(mockMovements);
      expect(result.total).toBe(1);
    });
  });
});
