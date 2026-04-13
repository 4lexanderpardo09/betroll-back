import {
  Controller,
  Post,
  Body,
  UseGuards,
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
  async analyze(@Body() dto: NbaAnalyzeDto) {
    const userBankroll = dto.userBankroll || 500000;

    const result = await this.nbaAnalysisService.analyzeMatch(
      dto.homeTeam,
      dto.awayTeam,
      dto.matchDate,
      userBankroll,
    );

    // Clean the response — remove null/undefined/empty fields from odds
    const { odds } = result.matchData;

    // Helper: check if value is non-empty for inclusion
    const hasValue = (v: unknown): boolean => {
      if (v === null || v === undefined) return false;
      if (typeof v === 'object') return Object.keys(v as object).length > 0;
      if (typeof v === 'string') return v.trim().length > 0;
      return true;
    };

    const cleanOdds: Record<string, unknown> = {
      homeTeam: odds.homeTeam,
      awayTeam: odds.awayTeam,
      status: odds.status,
      commenceTime: odds.commenceTime,
    };
    if (hasValue(odds.venue)) cleanOdds['venue'] = odds.venue;
    const ml = odds.moneyline;
    if (ml && (ml.home !== 0 || ml.away !== 0)) {
      cleanOdds['moneyline'] = ml;
    }
    cleanOdds['homeRecord'] = odds.homeRecord;
    cleanOdds['awayRecord'] = odds.awayRecord;
    if (odds.spread && !(odds.spread.homePrice === 0 && odds.spread.awayPrice === 0)) {
      cleanOdds['spread'] = odds.spread;
    }
    if (hasValue(odds.total)) cleanOdds['total'] = odds.total;
    if (hasValue(odds.teamStats)) cleanOdds['teamStats'] = odds.teamStats;
    if (hasValue(odds.gameBoxscore)) cleanOdds['gameBoxscore'] = odds.gameBoxscore;

    return {
      success: true,
      data: {
        analysis: result.analysis,
        usage: result.usage,
        estimatedCost: result.estimatedCost,
        match: {
          homeTeam: result.matchData.homeTeamName,
          awayTeam: result.matchData.awayTeamName,
          commenceTime: result.matchData.commenceTime,
          eventId: result.matchData.eventId,
          homeTeamId: result.matchData.homeTeamId,
          awayTeamId: result.matchData.awayTeamId,
          odds: cleanOdds,
        },
      },
    };
  }
}
