import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { OddsApiService, CompleteMatchOddsData } from '../../services/odds-api.service';
import { ESPNService } from '../../services/espn.service';
import { MiniMaxService } from '../../services/minimax.service';
import { NbaPromptBuilder, NbaPromptData } from './nba-prompt.builder';

const NBA_PROP_MARKETS = [
  'player_points',
  'player_rebounds',
  'player_assists',
  'player_threes',
  'player_points_rebounds_assists',
  'player_points_rebounds',
  'player_points_assists',
  'player_blocks',
  'player_steals',
];

const NBA_PROP_LABELS: Record<string, string> = {
  player_points: 'Puntos',
  player_rebounds: 'Rebotes',
  player_assists: 'Asistencias',
  player_threes: 'Triples',
  player_points_rebounds_assists: 'PRA',
  player_points_rebounds: 'Puntos+Rebotes',
  player_points_assists: 'Puntos+Asistencias',
  player_blocks: 'Tapones',
  player_steals: 'Robos',
};

@Injectable()
export class NbaAnalysisService {
  private readonly logger = new Logger(NbaAnalysisService.name);

  constructor(
    private readonly oddsApiService: OddsApiService,
    private readonly espnService: ESPNService,
    private readonly minimaxService: MiniMaxService,
    private readonly nbaPromptBuilder: NbaPromptBuilder,
  ) {}

  /**
   * Analyze an NBA match using OddsApiService + ESPN + MiniMax
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
    oddsData: CompleteMatchOddsData;
  }> {
    this.logger.log(`Analyzing NBA match: ${homeTeam} vs ${awayTeam} on ${matchDate}`);

    // 1. Get complete odds data from The Odds API
    const oddsData = await this.oddsApiService.getCompleteMatchData(
      'basketball_nba',
      homeTeam,
      awayTeam,
      matchDate,
      {
        teamMarkets: ['h2h', 'spreads', 'totals'],
        teamRegions: ['us'],
        propMarkets: NBA_PROP_MARKETS,
        propLabels: NBA_PROP_LABELS,
        scoreDaysFrom: 3,
      },
    );

    this.logger.log(`Odds API usage — remaining: ${oddsData.apiUsage.remaining}, used: ${oddsData.apiUsage.used}`);

    // 2. Get ESPN data in parallel (injuries + scoreboard)
    const [scoreboardResult, injuriesResult] = await Promise.allSettled([
      this.espnService.getScoreboardV2('basketball', 'nba', matchDate),
      this.espnService.getInjuriesV2('basketball', 'nba'),
    ]);

    // Parse ESPN data
    const espnData = this.parseEspnData(
      scoreboardResult.status === 'fulfilled' ? scoreboardResult.value : null,
      injuriesResult.status === 'fulfilled' ? injuriesResult.value : null,
      homeTeam,
      awayTeam,
    );

    // 3. Build the NBA-specific prompt
    const promptData: NbaPromptData = {
      oddsData,
      espnData,
      userBankroll,
    };
    const prompt = this.nbaPromptBuilder.build(promptData);

    // 4. Call MiniMax
    this.logger.log('Calling MiniMax for NBA analysis...');
    const result = await this.minimaxService.chatCompletion(
      [{ role: 'user', content: prompt }],
      { maxTokens: 16000, temperature: 0.7 },
    );

    if (!result.usage) {
      throw new InternalServerErrorException('MiniMax did not return usage information');
    }

    // Estimate cost: ~$0.0015 per 1K tokens for M2.7
    const estimatedCost = (result.usage.totalTokens / 1000) * 0.0015;

    this.logger.log(`MiniMax analysis complete — tokens: ${result.usage.totalTokens}, cost: $${estimatedCost.toFixed(4)}`);

    return {
      analysis: result.content,
      usage: result.usage,
      estimatedCost,
      oddsData,
    };
  }

  private parseEspnData(
    scoreboard: any,
    injuries: any,
    homeTeam: string,
    awayTeam: string,
  ): NbaPromptData['espnData'] {
    const espnData: NbaPromptData['espnData'] = {};

    // Parse scoreboard for team stats
    if (scoreboard && Array.isArray(scoreboard)) {
      const match = scoreboard.find(
        (e: any) =>
          e.name?.toLowerCase().includes(homeTeam.toLowerCase()) ||
          e.name?.toLowerCase().includes(awayTeam.toLowerCase()),
      );

      if (match?.competitions?.[0]) {
        const competition = match.competitions[0];
        const homeCompetitor = competition.competitors?.find((c: any) => c.homeAway === 'home');
        const awayCompetitor = competition.competitors?.find((c: any) => c.homeAway === 'away');

        if (homeCompetitor) {
          espnData.homeTeamStats = {
            record: homeCompetitor.records?.[0]?.summary,
          };
        }
        if (awayCompetitor) {
          espnData.awayTeamStats = {
            record: awayCompetitor.records?.[0]?.summary,
          };
        }
      }
    }

    // Parse injuries
    if (injuries && Array.isArray(injuries)) {
      const homeInjuries: any[] = [];
      const awayInjuries: any[] = [];

      for (const group of injuries) {
        const teamInjuries = group.injuries || [];
        const isHomeTeam = group.displayName?.toLowerCase().includes(homeTeam.split(' ')[0].toLowerCase());
        const isAwayTeam = group.displayName?.toLowerCase().includes(awayTeam.split(' ')[0].toLowerCase());

        for (const inj of teamInjuries) {
          inj.teamDisplayName = group.displayName;
          if (isHomeTeam) homeInjuries.push(inj);
          if (isAwayTeam) awayInjuries.push(inj);
        }
      }

      espnData.injuries = {
        home: homeInjuries,
        away: awayInjuries,
      };
    }

    return espnData;
  }
}
