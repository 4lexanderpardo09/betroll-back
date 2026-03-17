import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { RegisterDto, LoginDto } from '../auth/dto/auth.dto';
import { User } from '../users/entities/user.entity';
import { Response } from 'express';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(dto);
    const tokens = await this.generateTokens(user);
    return {
      ...tokens,
      user: this.sanitizeUser(user),
    };
  }

  async login(dto: LoginDto, response: Response) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user);
    this.setRefreshTokenCookie(response, tokens.refresh_token);
    
    return {
      ...tokens,
      user: this.sanitizeUser(user),
    };
  }

  async refresh(response: Response) {
    const refreshToken = this.getRefreshTokenFromCookie(response);
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token');
    }

    const payload = await this.jwtService.verifyAsync(refreshToken, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
    });

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const tokens = await this.generateTokens(user);
    this.setRefreshTokenCookie(response, tokens.refresh_token);

    return { access_token: tokens.access_token };
  }

  async me(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.sanitizeUser(user);
  }

  async logout(response: Response) {
    response.clearCookie('refresh_token');
    return {};
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email };
    
    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_ACCESS_EXPIRES', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES', '7d'),
      }),
    ]);

    return { access_token, refresh_token };
  }

  private setRefreshTokenCookie(response: Response, token: string) {
    response.cookie('refresh_token', token, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private getRefreshTokenFromCookie(response: Response): string | undefined {
    return response.req?.cookies?.refresh_token;
  }

  private sanitizeUser(user: User) {
    const { password, ...result } = user;
    return result;
  }
}
