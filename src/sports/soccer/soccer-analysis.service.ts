import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { OddsApiService, CompleteMatchOddsData } from '../../services/odds-api.service';
import { ESPNQualitativeService } from '../../services/espn-qualitative.service';
import { MiniMaxService } from '../../services/minimax.service';
import { SoccerPromptBuilder, SoccerPromptData } from './soccer-prompt.builder';

// ESPN league → The Odds API sport key
const SOCCER_LEAGUE_MAP: Record<string, string> = {
  'eng.1': 'soccer_epl',
  'esp.1': 'soccer_spain_la_liga',
  'ita.1': 'soccer_italy_serie_a',
  'ger.1': 'soccer_germany_bundesliga',
  'fra.1': 'soccer_france_ligue_one',
  'usa.1': 'soccer_usa_mls',
};

@Injectable()
export class SoccerAnalysisService {
  private readonly logger = new Logger(SoccerAnalysisService.name);

  constructor(
    private readonly oddsApiService: OddsApiService,
    private readonly espnQualitativeService: ESPNQualitativeService,
    private readonly minimaxService: MiniMaxService,
    private readonly soccerPromptBuilder: SoccerPromptBuilder,
  ) {}

  /**
   * Analyze a Soccer match using OddsApiService + ESPN + MiniMax
   */
  async analyzeMatch(
    homeTeam: string,
    awayTeam: string,
    matchDate: string,
    league: string = 'eng.1',
    userBankroll: number = 500000,
  ): Promise<{
    analysis: string;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
    estimatedCost: number;
    oddsData: CompleteMatchOddsData;
  }> {
    this.logger.log(`Analyzing Soccer match: ${homeTeam} vs ${awayTeam} on ${matchDate} (${league})`);

    // 1. Get complete odds data from The Odds API (soccer: h2h 3-way + totals, no spreads)
    const oddsApiSportKey = SOCCER_LEAGUE_MAP[league] ?? 'soccer_epl';
    const oddsData = await this.oddsApiService.getCompleteMatchData(
      oddsApiSportKey,
      homeTeam,
      awayTeam,
      matchDate,
      {
        teamMarkets: ['h2h', 'totals'],
        teamRegions: ['us', 'eu', 'uk'],
        scoreDaysFrom: 7, // soccer forma más larga
      },
    );

    this.logger.log(`Odds API usage — remaining: ${oddsData.apiUsage.remaining}, used: ${oddsData.apiUsage.used}`);

    // 2. Get ESPN qualitative context
    const espnContext = await this.espnQualitativeService.getQualitativeContext(
      'soccer',
      league,
      oddsData.eventId,
      oddsData.homeTeam,
      oddsData.awayTeam,
    );
    const espnPrompt = this.espnQualitativeService.toAIPrompt(espnContext);

    // 3. Build the Soccer-specific prompt
    const promptData: SoccerPromptData = {
      oddsData,
      espnPrompt,
      userBankroll,
    };
    const prompt = this.soccerPromptBuilder.build(promptData);

    // 4. Call MiniMax
    this.logger.log('Calling MiniMax for Soccer analysis...');
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
