import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { OddsApiService, CompleteMatchOddsData } from '../../services/odds-api.service';
import { ESPNService } from '../../services/espn.service';
import { MiniMaxService } from '../../services/minimax.service';
import { SoccerPromptBuilder, SoccerPromptData } from './soccer-prompt.builder';

@Injectable()
export class SoccerAnalysisService {
  private readonly logger = new Logger(SoccerAnalysisService.name);

  constructor(
    private readonly oddsApiService: OddsApiService,
    private readonly espnService: ESPNService,
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

    // 1. Get complete odds data from The Odds API
    const oddsData = await this.oddsApiService.getCompleteMatchData(
      league,
      homeTeam,
      awayTeam,
      matchDate,
    );

    this.logger.log(`Odds API usage — remaining: ${oddsData.apiUsage.remaining}, used: ${oddsData.apiUsage.used}`);

    // 2. Get ESPN data (soccer uses 'soccer' as sport)
    const [scoreboardResult, injuriesResult] = await Promise.allSettled([
      this.espnService.getScoreboardV2('soccer', league, matchDate),
      this.espnService.getInjuriesV2('soccer', league),
    ]);

    const espnData = this.parseEspnData(
      scoreboardResult.status === 'fulfilled' ? scoreboardResult.value : null,
      injuriesResult.status === 'fulfilled' ? injuriesResult.value : null,
      homeTeam,
      awayTeam,
    );

    // 3. Build the Soccer-specific prompt
    const promptData: SoccerPromptData = {
      oddsData,
      espnData,
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

  private parseEspnData(
    scoreboard: any,
    injuries: any,
    homeTeam: string,
    awayTeam: string,
  ): SoccerPromptData['espnData'] {
    const espnData: SoccerPromptData['espnData'] = {};

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
          espnData.homeTeamStats = { record: homeCompetitor.records?.[0]?.summary };
        }
        if (awayCompetitor) {
          espnData.awayTeamStats = { record: awayCompetitor.records?.[0]?.summary };
        }
      }
    }

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

      espnData.injuries = { home: homeInjuries, away: awayInjuries };
    }

    return espnData;
  }
}
