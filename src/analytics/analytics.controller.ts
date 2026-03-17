import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AnalyticsService } from './analytics.service';

interface AuthRequest {
  user: {
    userId: string;
    email: string;
  };
}

@Controller('analytics')
@UseGuards(AuthGuard('jwt'))
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  async getSummary(@Request() req: AuthRequest) {
    return this.analyticsService.getSummary(req.user.userId);
  }

  @Get('pnl')
  async getPnl(
    @Request() req: AuthRequest,
    @Query('period') period: 'daily' | 'weekly' = 'daily',
  ) {
    return this.analyticsService.getPnl(req.user.userId, period);
  }

  @Get('by-sport')
  async getBySport(@Request() req: AuthRequest) {
    return this.analyticsService.getBySport(req.user.userId);
  }

  @Get('by-type')
  async getByType(@Request() req: AuthRequest) {
    return this.analyticsService.getByType(req.user.userId);
  }

  @Get('by-category')
  async getByCategory(@Request() req: AuthRequest) {
    return this.analyticsService.getByCategory(req.user.userId);
  }

  @Get('bankroll-history')
  async getBankrollHistory(@Request() req: AuthRequest) {
    return this.analyticsService.getBankrollHistory(req.user.userId);
  }
}
