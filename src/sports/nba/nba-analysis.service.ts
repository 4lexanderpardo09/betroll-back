import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ESPNOddsService, NbaMatchFound, NbaMatchOdds } from '../../services/espn-odds.service';
import { ESPNQualitativeService } from '../../services/espn-qualitative.service';
import { ESPNStatsService, ProcessedAthleteStats, ESPNTeamLeader } from '../../services/espn-stats.service';
import { MiniMaxService } from '../../services/minimax.service';
import { DataNormalizer } from '../../services/data-normalizer.service';
import { NbaTeamStatsAggregator, TeamSeasonStats } from '../../services/nba-team-stats-aggregator.service';
import { NbaPromptBuilder, NbaPromptData } from './nba-prompt.builder';

@Injectable()
export class NbaAnalysisService {
  private readonly logger = new Logger(NbaAnalysisService.name);
  private readonly normalizer = new DataNormalizer();

  constructor(
    private readonly espnOddsService: ESPNOddsService,
    private readonly espnQualitativeService: ESPNQualitativeService,
    private readonly espnStatsService: ESPNStatsService,
    private readonly minimaxService: MiniMaxService,
    private readonly nbaPromptBuilder: NbaPromptBuilder,
    private readonly teamStatsAggregator: NbaTeamStatsAggregator,
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

    // ═══════════════════════════════════════════════════════════════
    // LOG 1: Raw odds + team stats from ESPN
    // ═══════════════════════════════════════════════════════════════
    this.logger.log('━━━ [LOG 1] RAW ODDS & TEAM DATA ━━━');
    this.logger.log(`Home Team: ${odds.homeTeam}`);
    this.logger.log(`Away Team: ${odds.awayTeam}`);
    this.logger.log(`Status: ${odds.status}`);
    this.logger.log(`Venue: ${JSON.stringify(odds.venue)}`);
    this.logger.log(`Home Record: ${odds.homeRecord} | Away Record: ${odds.awayRecord}`);
    this.logger.log(`Moneyline — Home: ${odds.moneyline.home} (${(odds.moneyline.homeImplied*100).toFixed(1)}%) | Away: ${odds.moneyline.away} (${(odds.moneyline.awayImplied*100).toFixed(1)}%)`);
    this.logger.log(`Spread: ${JSON.stringify(odds.spread)}`);
    this.logger.log(`Total: ${JSON.stringify(odds.total)}`);
    this.logger.log(`Home Team Stats keys: [${Object.keys(odds.teamStats.home).join(', ')}]`);
    this.logger.log(`Away Team Stats keys: [${Object.keys(odds.teamStats.away).join(', ')}]`);
    this.logger.log(`Home teamStats: ${JSON.stringify(odds.teamStats.home)}`);
    this.logger.log(`Away teamStats: ${JSON.stringify(odds.teamStats.away)}`);
    if (odds.gameBoxscore) {
      this.logger.log(`Game Boxscore available: ${odds.gameBoxscore.home.abbreviation} ${odds.gameBoxscore.home.points} - ${odds.gameBoxscore.away.points} ${odds.gameBoxscore.away.abbreviation}`);
      this.logger.log(`Home players: ${odds.gameBoxscore.home.players.length}`);
      this.logger.log(`Away players: ${odds.gameBoxscore.away.players.length}`);
      odds.gameBoxscore.home.players.slice(0, 3).forEach(p => {
        this.logger.log(`  Home: ${p.name} | MIN: ${p.min} | PTS: ${p.pts} | REB: ${p.reb} | AST: ${p.ast}`);
      });
      odds.gameBoxscore.away.players.slice(0, 3).forEach(p => {
        this.logger.log(`  Away: ${p.name} | MIN: ${p.min} | PTS: ${p.pts} | REB: ${p.reb} | AST: ${p.ast}`);
      });
    } else {
      this.logger.log(`Game Boxscore: NOT AVAILABLE (scheduled/in-progress game)`);
    }

    // ═══════════════════════════════════════════════════════════════
    // LOG 1b: ENRICHED TEAM STATS (from roster + core API)
    // ═══════════════════════════════════════════════════════════════
    this.logger.log('━━━ [LOG 1b] FETCHING ENRICHED TEAM STATS FROM ROSTER ━━━');
    const teamStats = await this.teamStatsAggregator.getMatchTeamStats(
      match.homeTeamId, match.homeTeamName,
      match.awayTeamId, match.awayTeamName,
    );
    if (teamStats) {
      this.logger.log(`Home team (${teamStats.home.teamName}): ${teamStats.home.players.length} players with stats`);
      this.logger.log(`  Totals → PPG: ${teamStats.home.averages.PPG}, RPG: ${teamStats.home.averages.RPG}, APG: ${teamStats.home.averages.APG}`);
      this.logger.log(`  FG%: ${teamStats.home.averages.FG_PCT}, 3P%: ${teamStats.home.averages.THREE_PT_PCT}, FT%: ${teamStats.home.averages.FT_PCT}`);
      this.logger.log(`Away team (${teamStats.away.teamName}): ${teamStats.away.players.length} players with stats`);
      this.logger.log(`  Totals → PPG: ${teamStats.away.averages.PPG}, RPG: ${teamStats.away.averages.RPG}, APG: ${teamStats.away.averages.APG}`);
      this.logger.log(`  FG%: ${teamStats.away.averages.FG_PCT}, 3P%: ${teamStats.away.averages.THREE_PT_PCT}, FT%: ${teamStats.away.averages.FT_PCT}`);
    } else {
      this.logger.warn('Could not build enriched team stats — falling back to scoreboard stats');
    }

    // ═══════════════════════════════════════════════════════════════
    // LOG 2: Leaders from scoreboard
    // ═══════════════════════════════════════════════════════════════
    this.logger.log('━━━ [LOG 2] LEADERS FROM SCOREBOARD ━━━');
    this.logger.log(`Home Leaders count: ${odds.homeLeaders?.length ?? 0}`);
    this.logger.log(`Away Leaders count: ${odds.awayLeaders?.length ?? 0}`);
    this.logger.log(`Home Leaders: ${JSON.stringify(odds.homeLeaders)}`);
    this.logger.log(`Away Leaders: ${JSON.stringify(odds.awayLeaders)}`);

    // 3. Get top athletes IDs from leaders (from scoreboard, already in odds)
    const topAthletesHome = this.extractTopAthletesFromCompetitorLeaders(odds.homeLeaders, 3);
    const topAthletesAway = this.extractTopAthletesFromCompetitorLeaders(odds.awayLeaders, 3);
    const topAthletesIds = [...topAthletesHome, ...topAthletesAway];

    this.logger.log(`Top Athletes IDs extracted — Home: [${topAthletesHome.join(', ')}] | Away: [${topAthletesAway.join(', ')}]`);
    this.logger.log(`All athlete IDs: [${topAthletesIds.join(', ')}]`);

    // 4. Get detailed stats for top athletes
    this.logger.log('━━━ [LOG 3] FETCHING ATHLETE STATS ━━━');
    const athleteStatsResults = await Promise.allSettled(
      topAthletesIds.map((id) => this.espnStatsService.getAthleteStatsComplete(id)),
    );

    const athleteStatsMap: Record<string, ProcessedAthleteStats> = {};
    for (let i = 0; i < topAthletesIds.length; i++) {
      const stats = this.resolve(athleteStatsResults[i]);
      if (stats) {
        athleteStatsMap[topAthletesIds[i]] = stats;
        this.logger.log(`Athlete ${topAthletesIds[i]} (${stats.name}): PPG=${stats.PPG} | RPG=${stats.RPG} | APG=${stats.APG} | FG%=${stats.FG_PCT} | 3P%=${stats.THREE_PT_PCT} | MIN=${stats.MIN}`);
        this.logger.log(`  → Home splits: ${JSON.stringify(stats.splits.home)}`);
        this.logger.log(`  → Away splits: ${JSON.stringify(stats.splits.away)}`);
        this.logger.log(`  → Recent games: ${stats.recentGames.length} games`);
      } else {
        this.logger.warn(`⚠️ Athlete ${topAthletesIds[i]} — NO STATS returned`);
      }
    }
    this.logger.log(`Total athletes with stats: ${Object.keys(athleteStatsMap).length}/${topAthletesIds.length}`);

    // ═══════════════════════════════════════════════════════════════
    // VALIDATION: Check data quality before LLM
    // ═══════════════════════════════════════════════════════════════
    this.logger.log('━━━ [VALIDATION] PRE-LLM DATA CHECK ━━━');

    // Validate athlete stats quality
    const statsWithData = Object.values(athleteStatsMap).filter(
      (s) => s.PPG !== '-' && s.RPG !== '-' && s.APG !== '-',
    );
    const statsMissing = Object.keys(athleteStatsMap).length - statsWithData.length;
    this.logger.log(`Athletes with valid stats: ${statsWithData.length}/${topAthletesIds.length}`);
    if (statsMissing > 0) {
      this.logger.warn(`⚠️ ${statsMissing} athletes have missing stats (will show as "datos no disponibles")`);
    }

    // Detect players with "?" equivalent ('-')
    for (const [id, stats] of Object.entries(athleteStatsMap)) {
      const missing: string[] = [];
      if (stats.PPG === '-') missing.push('PPG');
      if (stats.RPG === '-') missing.push('RPG');
      if (stats.APG === '-') missing.push('APG');
      if (stats.FG_PCT === '-') missing.push('FG%');
      if (missing.length > 0) {
        this.logger.warn(`⚠️ Athlete ${stats.name} (${id}) missing stats: [${missing.join(', ')}]`);
      }
    }

    // Validate boxscore or leaders are present
    const hasBoxscore = !!odds.gameBoxscore;
    const hasLeaders = (odds.homeLeaders?.length ?? 0) > 0 && (odds.awayLeaders?.length ?? 0) > 0;
    const hasTeamStats = Object.keys(odds.teamStats.home).length > 0 || Object.keys(odds.teamStats.away).length > 0;

    this.logger.log(`Data sources available:`);
    this.logger.log(`  - Boxscore: ${hasBoxscore ? '✓' : '✗ (not a past game)'}`);
    this.logger.log(`  - Leaders: ${hasLeaders ? '✓' : '✗'}`);
    this.logger.log(`  - Team stats: ${hasTeamStats ? '✓' : '✗'}`);

    // Build validation summary for pre-LLM log
    const validationSummary = {
      parsedStats: {
        homePlayersParsed: odds.gameBoxscore?.home.players.length ?? 0,
        awayPlayersParsed: odds.gameBoxscore?.away.players.length ?? 0,
        homeLeadersValid: hasLeaders,
        awayLeadersValid: hasLeaders,
        teamStatsComplete: hasTeamStats,
        boxscoreAvailable: hasBoxscore,
      },
      missingFields: [
        ...(statsMissing > 0 ? ['athleteStats'] : []),
        ...(!hasTeamStats ? ['teamStats'] : []),
      ],
      rosterValidated: true, // TODO: integrate roster validation
      readyForLLM: statsWithData.length > 0,
    };
    this.logger.log(this.normalizer.buildPreLLMLogging({
      parsedStats: validationSummary.parsedStats,
      missingFields: validationSummary.missingFields,
      rosterValidated: validationSummary.rosterValidated,
      validationErrors: [],
    }));

    // 5. Get ESPN qualitative context (injuries, news, form)
    this.logger.log('━━━ [LOG 4] ESPN QUALITATIVE CONTEXT ━━━');
    const espnContext = await this.espnQualitativeService.getQualitativeContext(
      'basketball',
      'nba',
      match.eventId,
      match.homeTeamId,
      match.awayTeamId,
    );
    const espnPrompt = this.espnQualitativeService.toAIPrompt(espnContext);
    this.logger.log(`EspnPrompt length: ${espnPrompt.length} chars`);
    this.logger.log(`EspnPrompt preview: ${espnPrompt.substring(0, 500)}...`);

    // 6. Build prompt — use enriched team stats if available, fallback to scoreboard
    const homeAverages = teamStats?.home.averages;
    const awayAverages = teamStats?.away.averages;
    const homePlayers = teamStats?.home.players ?? [];
    const awayPlayers = teamStats?.away.players ?? [];

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
        home: homeAverages ? {
          PPG: String(homeAverages.PPG),
          RPG: String(homeAverages.RPG),
          APG: String(homeAverages.APG),
          FG_PCT: String(homeAverages.FG_PCT),
          THREE_PT_PCT: String(homeAverages.THREE_PT_PCT),
          FT_PCT: String(homeAverages.FT_PCT),
          MPG: String(homeAverages.MPG),
          SPG: String(homeAverages.SPG),
          BPG: String(homeAverages.BPG),
        } : odds.teamStats.home,
        away: awayAverages ? {
          PPG: String(awayAverages.PPG),
          RPG: String(awayAverages.RPG),
          APG: String(awayAverages.APG),
          FG_PCT: String(awayAverages.FG_PCT),
          THREE_PT_PCT: String(awayAverages.THREE_PT_PCT),
          FT_PCT: String(awayAverages.FT_PCT),
          MPG: String(awayAverages.MPG),
          SPG: String(awayAverages.SPG),
          BPG: String(awayAverages.BPG),
        } : odds.teamStats.away,
        homeRecord: odds.homeRecord,
        awayRecord: odds.awayRecord,
        homeLeaders: odds.homeLeaders,
        awayLeaders: odds.awayLeaders,
      },
      athleteStats: athleteStatsMap,
      espnPrompt,
      userBankroll,
      gameBoxscore: odds.gameBoxscore,
      // NEW: enriched team data for deep analysis
      teamSeasonStats: teamStats ? {
        home: teamStats.home,
        away: teamStats.away,
      } : undefined,
    };
    const prompt = this.nbaPromptBuilder.build(promptData);

    // ═══════════════════════════════════════════════════════════════
    // LOG 5: Final prompt being sent to MiniMax
    // ═══════════════════════════════════════════════════════════════
    this.logger.log('━━━ [LOG 5] FINAL PROMPT TO MINIMAX ━━━');
    this.logger.log(`Prompt length: ${prompt.length} chars`);
    this.logger.log('Prompt starts with:');
    this.logger.log(prompt.substring(0, 2000));
    this.logger.log('...');
    this.logger.log('Prompt ends with:');
    this.logger.log(prompt.substring(prompt.length - 500));

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
