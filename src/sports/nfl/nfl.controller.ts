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
import { NflAnalysisService } from './nfl-analysis.service';
import { NflAnalyzeDto } from './dto/nfl-analyze.dto';

@Controller('sports/nfl')
@UseGuards(JwtAuthGuard)
export class NflController {
  constructor(private readonly nflAnalysisService: NflAnalysisService) {}

  /**
   * POST /sports/nfl/analyze
   * Generate NFL match analysis
   */
  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  async analyze(@Request() req: any, @Body() dto: NflAnalyzeDto) {
    const userBankroll = dto.userBankroll || 500000;

    const result = await this.nflAnalysisService.analyzeMatch(
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
