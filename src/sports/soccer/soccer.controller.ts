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
import { SoccerAnalysisService } from './soccer-analysis.service';
import { SoccerAnalyzeDto } from './dto/soccer-analyze.dto';

@Controller('sports/soccer')
@UseGuards(JwtAuthGuard)
export class SoccerController {
  constructor(private readonly soccerAnalysisService: SoccerAnalysisService) {}

  /**
   * POST /sports/soccer/analyze
   * Generate Soccer match analysis
   */
  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  async analyze(@Request() req: any, @Body() dto: SoccerAnalyzeDto) {
    const userBankroll = dto.userBankroll || 500000;
    const league = dto.league || 'eng.1';

    const result = await this.soccerAnalysisService.analyzeMatch(
      dto.homeTeam,
      dto.awayTeam,
      dto.matchDate,
      league,
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
