import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BetsService } from './bets.service';
import { Bet, BetCategory, BetStatus, Sport, BetType } from './entities/bet.entity';
import { Bankroll } from '../bankroll/entities/bankroll.entity';
import { BankrollMovement } from '../bankroll/entities/bankroll-movement.entity';
import { DailySnapshot } from '../daily-snapshots/entities/daily-snapshot.entity';

describe('BetsService', () => {
  let service: BetsService;
  let betRepository: Repository<Bet>;
  let bankrollRepository: Repository<Bankroll>;
  let movementRepository: Repository<BankrollMovement>;
  let snapshotRepository: Repository<DailySnapshot>;
  let dataSource: DataSource;

  const mockUserId = 'user-123';

  const mockBetRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockBankrollRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockMovementRepository = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockSnapshotRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findOne: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BetsService,
        { provide: getRepositoryToken(Bet), useValue: mockBetRepository },
        { provide: getRepositoryToken(Bankroll), useValue: mockBankrollRepository },
        { provide: getRepositoryToken(BankrollMovement), useValue: mockMovementRepository },
        { provide: getRepositoryToken(DailySnapshot), useValue: mockSnapshotRepository },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<BetsService>(BetsService);
    betRepository = module.get<Repository<Bet>>(getRepositoryToken(Bet));
    bankrollRepository = module.get<Repository<Bankroll>>(getRepositoryToken(Bankroll));
    movementRepository = module.get<Repository<BankrollMovement>>(getRepositoryToken(BankrollMovement));
    snapshotRepository = module.get<Repository<DailySnapshot>>(getRepositoryToken(DailySnapshot));
    dataSource = module.get<DataSource>(DataSource);

    jest.clearAllMocks();
  });

  describe('calculateCategory', () => {
    it('should return category A for odds <= 1.50', () => {
      expect(service.calculateCategory(1.50)).toBe(BetCategory.A);
      expect(service.calculateCategory(1.25)).toBe(BetCategory.A);
      expect(service.calculateCategory(1.00)).toBe(BetCategory.A);
    });

    it('should return category B for odds 1.51-2.20', () => {
      expect(service.calculateCategory(1.51)).toBe(BetCategory.B);
      expect(service.calculateCategory(2.20)).toBe(BetCategory.B);
      expect(service.calculateCategory(1.75)).toBe(BetCategory.B);
    });

    it('should return category C for odds > 2.20', () => {
      expect(service.calculateCategory(2.21)).toBe(BetCategory.C);
      expect(service.calculateCategory(5.00)).toBe(BetCategory.C);
      expect(service.calculateCategory(10.00)).toBe(BetCategory.C);
    });
  });

  describe('calculatePotentialWin', () => {
    it('should calculate potential win correctly', () => {
      expect(service.calculatePotentialWin(10000, 1.85)).toBe(8500);
      expect(service.calculatePotentialWin(10000, 2.00)).toBe(10000);
      expect(service.calculatePotentialWin(5000, 1.50)).toBe(2500);
    });

    it('should return 0 for odds = 1', () => {
      expect(service.calculatePotentialWin(10000, 1)).toBe(0);
    });
  });

  describe('checkStopLoss', () => {
    it('should return hit: false when no bankroll exists', async () => {
      mockBankrollRepository.findOne.mockResolvedValue(null);
      mockSnapshotRepository.findOne.mockResolvedValue(null);

      const result = await service.checkStopLoss(mockUserId);

      expect(result.hit).toBe(false);
      expect(result.openingBalance).toBe(0);
    });

    it('should return hit: false when loss < 30%', async () => {
      const bankroll = { id: 'bankroll-1', userId: mockUserId, currentAmount: 95000 };
      mockBankrollRepository.findOne.mockResolvedValue(bankroll);
      mockSnapshotRepository.findOne.mockResolvedValue(null);

      const result = await service.checkStopLoss(mockUserId);

      expect(result.hit).toBe(false);
      expect(result.openingBalance).toBe(95000);
      expect(result.currentBalance).toBe(95000);
    });

    it('should return hit: true when loss >= 30%', async () => {
      const bankroll = { id: 'bankroll-1', userId: mockUserId, currentAmount: 65000 };
      mockBankrollRepository.findOne.mockResolvedValue(bankroll);
      
      // Create snapshot with opening balance of 100000
      mockSnapshotRepository.findOne.mockResolvedValue({
        openingBalance: 100000,
        currentAmount: 65000,
        stopLossHit: false,
      });

      const result = await service.checkStopLoss(mockUserId);

      expect(result.hit).toBe(true);
      expect(result.openingBalance).toBe(100000);
    });
  });

  describe('createBet', () => {
    const createBetDto = {
      sport: Sport.FOOTBALL,
      tournament: 'La Liga',
      homeTeam: 'Real Madrid',
      awayTeam: 'Barcelona',
      eventDate: new Date(Date.now() + 86400000).toISOString(),
      betType: BetType.HOME_WIN,
      selection: 'Real Madrid',
      odds: 1.85,
      amount: 10000,
      confidence: 4,
      reasoning: 'Team in form',
    };

    it('should throw BadRequestException when no bankroll exists', async () => {
      mockBankrollRepository.findOne.mockResolvedValue(null);

      await expect(service.createBet(mockUserId, createBetDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when stop-loss is hit', async () => {
      const bankroll = { id: 'bankroll-1', userId: mockUserId, currentAmount: 100000 };
      mockBankrollRepository.findOne.mockResolvedValue(bankroll);
      mockSnapshotRepository.findOne.mockResolvedValue({
        openingBalance: 100000,
        stopLossHit: false,
      });

      // Mock checkStopLoss to return hit: true
      jest.spyOn(service, 'checkStopLoss').mockResolvedValue({
        hit: true,
        openingBalance: 100000,
        currentBalance: 65000,
      });

      await expect(service.createBet(mockUserId, createBetDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create bet successfully', async () => {
      const bankroll = { id: 'bankroll-1', userId: mockUserId, currentAmount: 100000 };
      mockBankrollRepository.findOne.mockResolvedValue(bankroll);
      
      jest.spyOn(service, 'checkStopLoss').mockResolvedValue({
        hit: false,
        openingBalance: 100000,
        currentBalance: 100000,
      });

      jest.spyOn(service, 'calculateCategory').mockReturnValue(BetCategory.B);
      jest.spyOn(service, 'calculatePotentialWin').mockReturnValue(8500);

      mockQueryRunner.manager.create.mockImplementation((entity, data) => data);
      mockQueryRunner.manager.save.mockImplementation((entity, data) => ({
        ...data,
        id: 'bet-new-id',
      }));
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      mockSnapshotRepository.save.mockResolvedValue({});

      const result = await service.createBet(mockUserId, createBetDto);

      expect(result).toBeDefined();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('resolveBet', () => {
    const bet = {
      id: 'bet-123',
      userId: mockUserId,
      amount: 10000,
      potentialWin: 8500,
      odds: 1.85,
      selection: 'Real Madrid',
      status: BetStatus.PENDING,
    };

    it('should throw NotFoundException when bet not found', async () => {
      mockBetRepository.findOne.mockResolvedValue(null);

      await expect(
        service.resolveBet('nonexistent', mockUserId, { status: BetStatus.WON }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when bet already resolved', async () => {
      mockBetRepository.findOne.mockResolvedValue({ ...bet, status: BetStatus.WON });

      await expect(
        service.resolveBet(bet.id, mockUserId, { status: BetStatus.WON }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should resolve bet as WON', async () => {
      mockBetRepository.findOne.mockResolvedValue(bet);
      const bankroll = { id: 'bankroll-1', userId: mockUserId, currentAmount: 90000 };
      mockBankrollRepository.findOne.mockResolvedValue(bankroll);

      mockQueryRunner.manager.update.mockResolvedValue({});
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      mockSnapshotRepository.save.mockResolvedValue({});

      const result = await service.resolveBet(bet.id, mockUserId, {
        status: BetStatus.WON,
      });

      expect(result.status).toBe(BetStatus.WON);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should resolve bet as LOST', async () => {
      mockBetRepository.findOne.mockResolvedValue(bet);
      const bankroll = { id: 'bankroll-1', userId: mockUserId, currentAmount: 90000 };
      mockBankrollRepository.findOne.mockResolvedValue(bankroll);

      mockQueryRunner.manager.update.mockResolvedValue({});
      mockSnapshotRepository.findOne.mockResolvedValue(null);

      const result = await service.resolveBet(bet.id, mockUserId, {
        status: BetStatus.LOST,
      });

      expect(result.status).toBe(BetStatus.LOST);
    });

    it('should resolve bet as VOID', async () => {
      mockBetRepository.findOne.mockResolvedValue(bet);
      const bankroll = { id: 'bankroll-1', userId: mockUserId, currentAmount: 90000 };
      mockBankrollRepository.findOne.mockResolvedValue(bankroll);

      mockQueryRunner.manager.update.mockResolvedValue({});
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      mockSnapshotRepository.save.mockResolvedValue({});

      const result = await service.resolveBet(bet.id, mockUserId, {
        status: BetStatus.VOID,
      });

      expect(result.status).toBe(BetStatus.VOID);
    });
  });

  describe('findAll', () => {
    it('should return paginated bets', async () => {
      const mockBets = [
        { id: 'bet-1', userId: mockUserId },
        { id: 'bet-2', userId: mockUserId },
      ];

      mockBetRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockBets, 2]),
      });

      const result = await service.findAll(mockUserId, 1, 20);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException when bet not found', async () => {
      mockBetRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('nonexistent', mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when bet is already resolved', async () => {
      const bet = { id: 'bet-123', status: BetStatus.WON };
      mockBetRepository.findOne.mockResolvedValue(bet);

      await expect(service.remove(bet.id, mockUserId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should delete pending bet and refund', async () => {
      const bet = { id: 'bet-123', status: BetStatus.PENDING, amount: 10000 };
      mockBetRepository.findOne.mockResolvedValue(bet);
      const bankroll = { id: 'bankroll-1', userId: mockUserId, currentAmount: 90000 };
      mockBankrollRepository.findOne.mockResolvedValue(bankroll);

      mockQueryRunner.manager.update.mockResolvedValue({});
      mockQueryRunner.manager.create.mockImplementation((entity, data) => data);
      mockQueryRunner.manager.save.mockResolvedValue({});
      mockQueryRunner.manager.delete.mockResolvedValue({});

      await service.remove(bet.id, mockUserId);

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should calculate stats correctly', async () => {
      const mockBets = [
        { status: BetStatus.WON, profit: 8500, amount: 10000 },
        { status: BetStatus.LOST, profit: -10000, amount: 10000 },
        { status: BetStatus.WON, profit: 5000, amount: 10000 },
        { status: BetStatus.PENDING, profit: 0, amount: 10000 },
      ];

      mockBetRepository.find.mockResolvedValue(mockBets);

      const result = await service.getStats(mockUserId);

      expect(result.total).toBe(4);
      expect(result.won).toBe(2);
      expect(result.lost).toBe(1);
      expect(result.pending).toBe(1);
      expect(result.totalProfit).toBe(3500);
      expect(result.totalStaked).toBe(40000);
      expect(result.winRate).toBe(67); // 2/3 = 66.66%
    });
  });
});
