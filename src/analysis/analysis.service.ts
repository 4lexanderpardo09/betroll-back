import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MiniMaxService } from '../services/minimax.service';
import { ESPNService } from '../services/espn.service';
import { Analysis } from './entities/analysis.entity';

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  private readonly espnSportMap: Record<string, { sport: string; league: string }> = {
    BASKETBALL: { sport: 'basketball', league: 'nba' },
    FOOTBALL: { sport: 'football', league: 'nfl' },
    SOCCER: { sport: 'soccer', league: 'eng.1' },
    TENNIS: { sport: 'tennis', league: 'atp' },
    OTHER: { sport: 'basketball', league: 'nba' },
  };

  constructor(
    @InjectRepository(Analysis)
    private analysisRepository: Repository<Analysis>,
    private readonly minimaxService: MiniMaxService,
    private readonly espnService: ESPNService,
  ) {}

  async analyzeMatch(
    userId: string,
    homeTeam: string,
    awayTeam: string,
    sport: string,
    options?: {
      tournament?: string;
      eventDate?: string;
      userOdds?: number;
      userSportsbook?: string;
    },
  ): Promise<Analysis> {
    this.logger.log(`Analyzing ${homeTeam} vs ${awayTeam} for user ${userId}`);

    const { sport: espnSport, league } = this.espnSportMap[sport] || this.espnSportMap.OTHER;

    const [scoreboardData, injuriesData] = await Promise.allSettled([
      this.espnService.getScoreboardV2(espnSport, league, options?.eventDate),
      this.espnService.getInjuriesV2(espnSport, league),
    ]);

    const matchData: any = { homeTeam, awayTeam };

    if (scoreboardData.status === 'fulfilled') {
      const events = scoreboardData.value as any[];
      const match = events?.find(
        (e: any) => e.name.includes(homeTeam) && e.name.includes(awayTeam),
      );

      if (match) {
        const competition = match.competitions?.[0];
        if (competition) {
          const draftKingsOdds = competition.odds?.find(
            (o: any) => o.provider?.name === 'DraftKings',
          );

          if (draftKingsOdds) {
            const details = draftKingsOdds.details || '';
            const spreadMatch = details.match(/([+-]?\d+\.?\d*)\s*\|/);
            const totalMatch = details.match(/\|\s*O\/U\s*(\d+\.?\d*)/);

            matchData.odds = {
              spread: spreadMatch
                ? { line: parseFloat(spreadMatch[1]), price: 110 }
                : undefined,
              total: totalMatch
                ? { line: parseFloat(totalMatch[1]), price: 110 }
                : undefined,
            };
          }

          const homeCompetitor = competition.competitors?.find(
            (c: any) => c.homeAway === 'home',
          );
          const awayCompetitor = competition.competitors?.find(
            (c: any) => c.homeAway === 'away',
          );

          if (homeCompetitor) {
            matchData.homeTeamStats = {
              record: homeCompetitor.records?.[0]?.summary,
            };
          }
          if (awayCompetitor) {
            matchData.awayTeamStats = {
              record: awayCompetitor.records?.[0]?.summary,
            };
          }
        }
      }
    }

    if (injuriesData.status === 'fulfilled') {
      // ESPN v2 injuries are grouped by team: [{ displayName: "Team", injuries: [...] }]
      const injuriesGroups = injuriesData.value as any[];
      
      // Flatten all injuries
      const allInjuries: any[] = [];
      for (const group of injuriesGroups || []) {
        const teamInjuries = group.injuries || [];
        for (const inj of teamInjuries) {
          inj.teamDisplayName = group.displayName;
          allInjuries.push(inj);
        }
      }
      
      matchData.injuries = {
        home: allInjuries.filter(
          (inj: any) => inj.teamDisplayName?.includes(homeTeam.split(' ')[0]),
        ),
        away: allInjuries.filter(
          (inj: any) => inj.teamDisplayName?.includes(awayTeam.split(' ')[0]),
        ),
      };
    }

    const userBankroll = 500000;

    this.logger.log('Calling MiniMax for analysis...');
    const analysisResult = await this.minimaxService.generateBasketballAnalysis(
      matchData,
      userBankroll,
    );

    const recommendedSelection = this.extractRecommendation(analysisResult.analysis);
    const recommendedOdds = options?.userOdds || 110;
    const recommendedStake = this.calculateStake(userBankroll, 'C');

    const analysis = new Analysis();
    analysis.userId = userId;
    analysis.sport = sport;
    analysis.homeTeam = homeTeam;
    analysis.awayTeam = awayTeam;
    analysis.tournament = options?.tournament || null;
    analysis.eventDate = options?.eventDate ? new Date(options.eventDate) : null;
    analysis.userOdds = options?.userOdds || null;
    analysis.userSportsbook = options?.userSportsbook || null;
    analysis.analysis = analysisResult.analysis;
    analysis.sources = JSON.parse(JSON.stringify(matchData));
    analysis.recommendedSelection = recommendedSelection;
    analysis.recommendedOdds = recommendedOdds;
    analysis.recommendedStake = recommendedStake;
    analysis.confidence = this.estimateConfidence(analysisResult.analysis);
    analysis.miniMaxModel = 'MiniMax-M2.7';
    analysis.miniMaxTokens = analysisResult.usage.totalTokens;
    analysis.miniMaxCost = analysisResult.estimatedCost;

    const savedAnalysis = await this.analysisRepository.save(analysis);
    this.logger.log(`Analysis saved with ID: ${savedAnalysis.id}`);

    return savedAnalysis;
  }

  async getAnalysis(userId: string, analysisId: string): Promise<Analysis> {
    const analysis = await this.analysisRepository.findOne({
      where: { id: analysisId, userId },
    });

    if (!analysis) {
      throw new NotFoundException(`Analysis ${analysisId} not found`);
    }

    return analysis;
  }

  async getUserAnalyses(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<Analysis[]> {
    return this.analysisRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: options?.limit || 20,
      skip: options?.offset || 0,
    });
  }

  private extractRecommendation(analysis: string): string {
    const match = analysis.match(/\*\*MEJOR APUESTA[:\*\*]*\s*(.+)/i);
    if (match) return match[1].trim();
    return 'Ver análisis completo';
  }

  private calculateStake(bankroll: number, category: 'A' | 'B' | 'C'): number {
    const percentages: Record<string, number> = { A: 0.05, B: 0.03, C: 0.015 };
    return Math.round(bankroll * (percentages[category] || 0.015));
  }

  private estimateConfidence(analysis: string): string {
    const wordCount = analysis.split(/\s+/).length;
    if (wordCount > 5000) return 'HIGH';
    if (wordCount > 2000) return 'MEDIUM';
    return 'LOW';
  }
}
