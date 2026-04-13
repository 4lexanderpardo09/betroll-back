import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ESPNOddsService, NbaMatchFound, NbaMatchOdds } from '../../services/espn-odds.service';
import { ESPNQualitativeService } from '../../services/espn-qualitative.service';
import { ESPNStatsService, ProcessedAthleteStats, ESPNTeamLeader } from '../../services/espn-stats.service';
import { MiniMaxService } from '../../services/minimax.service';
import { NbaPromptBuilder, NbaPromptData } from './nba-prompt.builder';

@Injectable()
export class NbaAnalysisService {
  private readonly logger = new Logger(NbaAnalysisService.name);

  constructor(
    private readonly espnOddsService: ESPNOddsService,
    private readonly espnQualitativeService: ESPNQualitativeService,
    private readonly espnStatsService: ESPNStatsService,
    private readonly minimaxService: MiniMaxService,
    private readonly nbaPromptBuilder: NbaPromptBuilder,
  ) {}

  /**
   * Analyze an NBA match using ESPN APIs only (MVP)
   */
  async analyzeMatch(
    homeTeam: string,
    awayTeam: string,
    matchDate: string,
    userBankroll: number = 500000,
  ): Promise<{
    analysis: string;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
    estimatedCost: number;
    matchData: NbaMatchFound & { odds: NbaMatchOdds };
  }> {
    this.logger.log(`Analyzing NBA match: ${homeTeam} vs ${awayTeam} on ${matchDate}`);

    // 1. Find match by date using ESPNOddsService
    const match = await this.espnOddsService.findNbaMatchByDate(homeTeam, awayTeam, matchDate);
    if (!match) {
      throw new InternalServerErrorException(
        `No se encontró partido NBA: ${homeTeam} vs ${awayTeam} en ${matchDate}`,
      );
    }
    this.logger.log(`Match found: ${match.eventId} — ${match.homeTeamName} vs ${match.awayTeamName}`);

    // 2. Get odds, stats and leaders from ESPNOddsService (includes leaders from scoreboard)
    const odds = await this.espnOddsService.getMatchOdds(match.eventId, match.homeTeamId, match.awayTeamId);
    if (!odds) {
      throw new InternalServerErrorException(`No se pudieron obtener cuotas para el evento ${match.eventId}`);
    }

    // 3. Get top athletes IDs from leaders (from scoreboard, already in odds)
    const topAthletesHome = this.extractTopAthletesFromCompetitorLeaders(odds.homeLeaders, 3);
    const topAthletesAway = this.extractTopAthletesFromCompetitorLeaders(odds.awayLeaders, 3);
    const topAthletesIds = [...topAthletesHome, ...topAthletesAway];

    // 4. Get detailed stats for top athletes
    const athleteStatsResults = await Promise.allSettled(
      topAthletesIds.map((id) => this.espnStatsService.getAthleteStatsComplete(id)),
    );

    const athleteStatsMap: Record<string, ProcessedAthleteStats> = {};
    for (let i = 0; i < topAthletesIds.length; i++) {
      const stats = this.resolve(athleteStatsResults[i]);
      if (stats) athleteStatsMap[topAthletesIds[i]] = stats;
    }

    // 5. Get ESPN qualitative context (injuries, news, form)
    const espnContext = await this.espnQualitativeService.getQualitativeContext(
      'basketball',
      'nba',
      match.eventId,
      match.homeTeamId,
      match.awayTeamId,
    );
    const espnPrompt = this.espnQualitativeService.toAIPrompt(espnContext);

    // 6. Build prompt
    const promptData: NbaPromptData = {
      match: {
        eventId: match.eventId,
        homeTeam: match.homeTeamName,
        awayTeam: match.awayTeamName,
        commenceTime: match.commenceTime,
        venue: odds.venue,
        status: odds.status,
      },
      odds: {
        moneyline: odds.moneyline,
        spread: odds.spread,
        total: odds.total,
      },
      teamStats: {
        home: odds.teamStats.home,
        away: odds.teamStats.away,
        homeRecord: odds.homeRecord,
        awayRecord: odds.awayRecord,
        homeLeaders: odds.homeLeaders,
        awayLeaders: odds.awayLeaders,
      },
      athleteStats: athleteStatsMap,
      espnPrompt,
      userBankroll,
    };
    const prompt = this.nbaPromptBuilder.build(promptData);

    // 7. Call MiniMax
    this.logger.log('Calling MiniMax for NBA analysis...');
    const result = await this.minimaxService.chatCompletion(
      [{ role: 'user', content: prompt }],
      { maxTokens: 16000, temperature: 0.7 },
    );

    if (!result.usage) {
      throw new InternalServerErrorException('MiniMax did not return usage information');
    }

    const estimatedCost = (result.usage.totalTokens / 1000) * 0.0015;
    this.logger.log(`MiniMax analysis complete — tokens: ${result.usage.totalTokens}, cost: $${estimatedCost.toFixed(4)}`);

    return {
      analysis: result.content,
      usage: result.usage,
      estimatedCost,
      matchData: { ...match, odds },
    };
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────

  /**
   * Extract top athlete IDs from ESPNCompetitorLeader[] (scoreboard format)
   */
  private extractTopAthletesFromCompetitorLeaders(
    leaders: ESPNTeamLeader[],
    limit: number,
  ): string[] {
    if (!leaders || !leaders.length) return [];
    // Find pointsPerGame or points leader
    const ppg = leaders.find((l) => l.name === 'pointsPerGame' || l.name === 'points');
    return ppg?.leaders.slice(0, limit).map((l) => l.athlete.id) ?? [];
  }

  private resolve<T>(result: PromiseSettledResult<T>): T | null {
    return result.status === 'fulfilled' ? result.value : null;
  }
}
