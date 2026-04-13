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

    // 2. Get ESPN qualitative context
    const espnContext = await this.espnService.getQualitativeContext(
      'basketball',
      'nba',
      oddsData.eventId,
      oddsData.homeTeam,
      oddsData.awayTeam,
    );
    const espnPrompt = this.espnService.toAIPrompt(espnContext);

    // 3. Build the NBA-specific prompt
    const promptData: NbaPromptData = {
      oddsData,
      espnPrompt,
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
}
