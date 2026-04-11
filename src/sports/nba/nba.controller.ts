import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { NbaAnalysisService } from './nba-analysis.service';
import { NbaAnalyzeDto } from './dto/nba-analyze.dto';

@Controller('sports/nba')
@UseGuards(JwtAuthGuard)
export class NbaController {
  constructor(private readonly nbaAnalysisService: NbaAnalysisService) {}

  /**
   * POST /sports/nba/analyze
   * Generate NBA match analysis
   */
  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  async analyze(@Request() req: any, @Body() dto: NbaAnalyzeDto) {
    const userBankroll = dto.userBankroll || 500000;

    const result = await this.nbaAnalysisService.analyzeMatch(
      dto.homeTeam,
      dto.awayTeam,
      dto.matchDate,
      userBankroll,
    );

    return {
      success: true,
      data: {
        analysis: result.analysis,
        usage: result.usage,
        estimatedCost: result.estimatedCost,
        match: {
          homeTeam: result.oddsData.homeTeam,
          awayTeam: result.oddsData.awayTeam,
          commenceTime: result.oddsData.commenceTime,
        },
        apiUsage: result.oddsData.apiUsage,
      },
    };
  }
}
