import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let service: Partial<AuthService>;

  const mockUser = { id: '1', email: 'test@test.com', name: 'Test' };
  const mockTokens = { access_token: 'token', refresh_token: 'refresh' };

  beforeEach(async () => {
    service = {
      register: jest.fn().mockResolvedValue({ ...mockTokens, user: mockUser }),
      login: jest.fn().mockResolvedValue({ ...mockTokens, user: mockUser }),
      refresh: jest.fn().mockResolvedValue({ access_token: 'new_token' }),
      logout: jest.fn().mockResolvedValue({}),
      me: jest.fn().mockResolvedValue(mockUser),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: service }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register a user', async () => {
      const result = await controller.register({ name: 'Test', email: 'test@test.com', password: 'password123' });
      expect(result).toHaveProperty('access_token');
      expect(service.register).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should login a user', async () => {
      const mockResponse = { cookie: jest.fn(), req: { cookies: {} } } as any;
      const result = await controller.login({ email: 'test@test.com', password: 'password123' }, mockResponse);
      expect(result).toHaveProperty('access_token');
      expect(service.login).toHaveBeenCalled();
    });
  });

  describe('me', () => {
    it('should return current user', async () => {
      const mockRequest = { user: { id: '1' } };
      const result = await controller.me(mockRequest);
      expect(result.email).toBe('test@test.com');
    });
  });
});
