import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { OddsApiService, CompleteMatchOddsData } from '../../services/odds-api.service';
import { ESPNService } from '../../services/espn.service';
import { MiniMaxService } from '../../services/minimax.service';
import { NflPromptBuilder, NflPromptData } from './nfl-prompt.builder';

const NFL_PROP_MARKETS = [
  'player_pass_tds',
  'player_pass_yards',
  'player_rush_yards',
  'player_receptions',
  'player_reception_yards',
  'player_anytime_td',
  'player_pass_completions',
  'player_rush_receptions',
];

const NFL_PROP_LABELS: Record<string, string> = {
  player_pass_tds: 'Pass TDs',
  player_pass_yards: 'Pass Yards',
  player_rush_yards: 'Rush Yards',
  player_receptions: 'Recepciones',
  player_reception_yards: 'Rec Yards',
  player_anytime_td: 'Anytime TD',
  player_pass_completions: 'Pass Completions',
  player_rush_receptions: 'Rush+Rec Yards',
};

@Injectable()
export class NflAnalysisService {
  private readonly logger = new Logger(NflAnalysisService.name);

  constructor(
    private readonly oddsApiService: OddsApiService,
    private readonly espnService: ESPNService,
    private readonly minimaxService: MiniMaxService,
    private readonly nflPromptBuilder: NflPromptBuilder,
  ) {}

  /**
   * Analyze an NFL match using OddsApiService + ESPN + MiniMax
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
    this.logger.log(`Analyzing NFL match: ${homeTeam} vs ${awayTeam} on ${matchDate}`);

    // 1. Get complete odds data from The Odds API
    const oddsData = await this.oddsApiService.getCompleteMatchData(
      'americanfootball_nfl',
      homeTeam,
      awayTeam,
      matchDate,
      {
        teamMarkets: ['h2h', 'spreads', 'totals'],
        teamRegions: ['us'],
        propMarkets: NFL_PROP_MARKETS,
        propLabels: NFL_PROP_LABELS,
        scoreDaysFrom: 3,
      },
    );

    this.logger.log(`Odds API usage — remaining: ${oddsData.apiUsage.remaining}, used: ${oddsData.apiUsage.used}`);

    // 2. Get ESPN qualitative context
    const espnContext = await this.espnService.getQualitativeContext(
      'football',
      'nfl',
      oddsData.eventId,
      oddsData.homeTeam,
      oddsData.awayTeam,
    );
    const espnPrompt = this.espnService.toAIPrompt(espnContext);

    // 3. Build the NFL-specific prompt
    const promptData: NflPromptData = {
      oddsData,
      espnPrompt,
      userBankroll,
    };
    const prompt = this.nflPromptBuilder.build(promptData);

    // 4. Call MiniMax
    this.logger.log('Calling MiniMax for NFL analysis...');
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
      oddsData,
    };
  }
}
