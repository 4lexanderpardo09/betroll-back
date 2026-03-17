import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs', () => ({
  compare: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue('hashed_password'),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: Partial<UsersService>;
  let jwtService: Partial<JwtService>;

  const mockUser = {
    id: '1',
    email: 'test@test.com',
    name: 'Test',
    password: 'hashed_password',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    usersService = {
      create: jest.fn().mockResolvedValue(mockUser),
      findByEmail: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(mockUser),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('token'),
      verifyAsync: jest.fn().mockResolvedValue({ sub: '1', email: 'test@test.com' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: { get: jest.fn((key: string, defaultValue?: string) => defaultValue) } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const result = await service.register({ name: 'Test', email: 'test@test.com', password: 'password123' });
      expect(usersService.create).toHaveBeenCalled();
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result.user).not.toHaveProperty('password');
    });

    it('should throw ConflictException if email exists', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValueOnce(mockUser);
      (usersService.create as jest.Mock).mockRejectedValueOnce(new ConflictException('Email already exists'));
      
      await expect(
        service.register({ name: 'Test', email: 'test@test.com', password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should login user with valid credentials', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValueOnce(mockUser);
      const mockResponse = {
        cookie: jest.fn(),
        req: { cookies: {} },
      } as any;
      
      const result = await service.login({ email: 'test@test.com', password: 'password123' }, mockResponse);
      expect(result).toHaveProperty('access_token');
      expect(result.user).not.toHaveProperty('password');
    });

    it('should throw UnauthorizedException with invalid credentials', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValueOnce(null);
      const mockResponse = { cookie: jest.fn() } as any;
      
      await expect(
        service.login({ email: 'test@test.com', password: 'wrong' }, mockResponse),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('me', () => {
    it('should return user without password', async () => {
      const result = await service.me('1');
      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe('test@test.com');
    });
  });
});
