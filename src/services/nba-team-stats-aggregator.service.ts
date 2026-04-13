import { Injectable, Logger } from '@nestjs/common';
import { ESPNStatsService, ESPNAthleteSeasonStats } from './espn-stats.service';
import { CacheService } from './cache.service';

/**
 * NbaTeamStatsAggregator
 *
 * Construye estadísticas enriquizadas por equipo desde los datos de ESPN.
 * Objetivo: calcular PPG, FG%, REB, AST del equipo completos desde
 * las estadísticas de cada jugador en roster.
 *
 *Pipeline:
 * 1. Obtener roster de ambos equipos
 * 2. Por cada jugador → obtener stats de temporada (core API)
 * 3. Agregar en team totals/averages/advanced
 * 4. Devolver objeto enriquecido por equipo
 */

// ─── TYPES ─────────────────────────────────────────────────────────────────

export interface PlayerSeasonStats {
  id: string;
  name: string;
  position: string;
  gamesPlayed: number;
  // Totals
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  minutes: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointMade: number;
  threePointAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  turnovers: number;
  // Averages
  PPG: number;
  RPG: number;
  APG: number;
  SPG: number;
  BPG: number;
  MPG: number;
  FG_PCT: number;
  THREE_PT_PCT: number;
  FT_PCT: number;
  // Advanced
  assistTurnoverRatio: number;
  trueShootingPct: number;
  usageRate: number;
  estimatedPossessions: number;
  pointsPerEstimatedPossessions: number;
}

export interface TeamSeasonStats {
  teamId: string;
  teamName: string;
  players: PlayerSeasonStats[];
  totals: {
    points: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    minutes: number;
    fieldGoalsMade: number;
    fieldGoalsAttempted: number;
    threePointMade: number;
    threePointAttempted: number;
    freeThrowsMade: number;
    freeThrowsAttempted: number;
    turnovers: number;
    gamesPlayed: number;
  };
  averages: {
    PPG: number;
    RPG: number;
    APG: number;
    SPG: number;
    BPG: number;
    MPG: number;
    FG_PCT: number;
    THREE_PT_PCT: number;
    FT_PCT: number;
  };
  advanced: {
    teamAssistTurnoverRatio: number;
    teamTrueShootingPct: number;
    teamUsageRate: number;
    teamEstimatedPossessions: number;
  };
}

// ─── SERVICE ───────────────────────────────────────────────────────────────

@Injectable()
export class NbaTeamStatsAggregator {
  private readonly logger = new Logger(NbaTeamStatsAggregator.name);

  constructor(
    private readonly espnStatsService: ESPNStatsService,
  ) {}

  /**
   * Obtiene stats agregados de un equipo desde el roster completo.
   * 1. Obtiene roster del equipo
   * 2. Por cada jugador → stats de temporada (core API)
   * 3. Agrega en totals/averages/advanced
   */
  async getTeamSeasonStats(teamId: string, teamName: string): Promise<TeamSeasonStats | null> {
    const roster = await this.espnStatsService.getTeamRoster(teamId);
    if (!roster?.athletes?.length) {
      this.logger.warn(`No roster found for team ${teamId} (${teamName})`);
      return null;
    }

    this.logger.debug(`Building stats for ${teamName} with ${roster.athletes.length} players from roster`);

    // Fetch stats for all players in roster (up to 20 players)
    const athleteIds = roster.athletes.slice(0, 20).map(a => a.id);
    const results = await Promise.allSettled(
      athleteIds.map(id => this.espnStatsService.getAthleteSeasonStatsCore(id)),
    );

    const players: PlayerSeasonStats[] = [];
    for (let i = 0; i < athleteIds.length; i++) {
      const result = results[i];
      if (result.status !== 'fulfilled' || !result.value) continue;

      const stats = this.parseSeasonStats(result.value, roster.athletes[i]);
      if (stats && stats.gamesPlayed > 0) {
        players.push(stats);
      }
    }

    if (players.length === 0) {
      this.logger.warn(`No player stats extracted for ${teamName}`);
      return null;
    }

    this.logger.debug(`Extracted stats for ${players.length} players in ${teamName}`);

    const totals = this.computeTotals(players);
    const gamesPlayed = totals.gamesPlayed > 0 ? totals.gamesPlayed : 1;
    const averages = this.computeAverages(totals, gamesPlayed);
    const advanced = this.computeAdvanced(totals, players);

    return {
      teamId,
      teamName,
      players,
      totals,
      averages,
      advanced,
    };
  }

  /**
   * Parsea stats de un jugador desde el response del core API.
   * El response tiene categories → stats con name/displayValue/value.
   */
  private parseSeasonStats(
    data: ESPNAthleteSeasonStats,
    athleteInfo: { id: string; displayName: string; fullName: string; position?: { abbreviation: string } },
  ): PlayerSeasonStats | null {
    try {
      const getStat = (name: string, categories: typeof data.splits.categories): number | null => {
        for (const cat of categories) {
          const found = cat.stats.find(s => s.name === name);
          if (found) return found.value;
        }
        return null;
      };

      const cats = data.splits.categories;

      const gamesPlayed = getStat('gamesPlayed', cats) ?? 0;
      if (gamesPlayed === 0) return null;

      const points = getStat('points', cats) ?? 0;
      const rebounds = getStat('rebounds', cats) ?? 0;
      const assists = getStat('assists', cats) ?? 0;
      const steals = getStat('steals', cats) ?? 0;
      const blocks = getStat('blocks', cats) ?? 0;
      const minutes = getStat('minutes', cats) ?? 0;
      const fgm = getStat('fieldGoalsMade', cats) ?? 0;
      const fga = getStat('fieldGoalsAttempted', cats) ?? 0;
      const tpm = getStat('threePointFieldGoalsMade', cats) ?? 0;
      const tpa = getStat('threePointFieldGoalsAttempted', cats) ?? 0;
      const ftm = getStat('freeThrowsMade', cats) ?? 0;
      const fta = getStat('freeThrowsAttempted', cats) ?? 0;
      const turnovers = getStat('turnovers', cats) ?? 0;
      const estimatedPossessions = getStat('estimatedPossessions', cats) ?? 0;

      // Averages (优先用 avgPoints/avgRebounds/avgAssists del API)
      const ppg = getStat('avgPoints', cats) ?? (points / gamesPlayed);
      const rpg = getStat('avgRebounds', cats) ?? (rebounds / gamesPlayed);
      const apg = getStat('avgAssists', cats) ?? (assists / gamesPlayed);
      const spg = getStat('avgSteals', cats) ?? (steals / gamesPlayed);
      const bpg = getStat('avgBlocks', cats) ?? (blocks / gamesPlayed);
      const mpg = getStat('avgMinutes', cats) ?? (minutes / gamesPlayed);

      // Shooting percentages
      const fgPct = getStat('fieldGoalPct', cats) ?? (fgm / fga || 0);
      const threePtPct = getStat('threePointPct', cats) ?? (tpm / tpa || 0);
      const ftPct = getStat('freeThrowPct', cats) ?? (ftm / fta || 0);

      // Advanced
      const astToRatio = getStat('assistTurnoverRatio', cats) ?? (assists / turnovers || 0);
      const tsPct = getStat('trueShootingPct', cats) ?? (this.calcTS(points, fga, ftm) / 1);
      const usage = getStat('usageRate', cats) ?? (estimatedPossessions / (minutes / 48) || 0);

      return {
        id: athleteInfo.id,
        name: athleteInfo.fullName,
        position: athleteInfo.position?.abbreviation ?? '-',
        gamesPlayed,
        points,
        rebounds,
        assists,
        steals,
        blocks,
        minutes,
        fieldGoalsMade: fgm,
        fieldGoalsAttempted: fga,
        threePointMade: tpm,
        threePointAttempted: tpa,
        freeThrowsMade: ftm,
        freeThrowsAttempted: fta,
        turnovers,
        PPG: Math.round(ppg * 10) / 10,
        RPG: Math.round(rpg * 10) / 10,
        APG: Math.round(apg * 10) / 10,
        SPG: Math.round(spg * 10) / 10,
        BPG: Math.round(bpg * 10) / 10,
        MPG: Math.round(mpg * 10) / 10,
        FG_PCT: Math.round(fgPct * 1000) / 1000,
        THREE_PT_PCT: Math.round(threePtPct * 1000) / 1000,
        FT_PCT: Math.round(ftPct * 1000) / 1000,
        assistTurnoverRatio: Math.round(astToRatio * 10) / 10,
        trueShootingPct: Math.round(tsPct * 1000) / 1000,
        usageRate: Math.round(usage * 10) / 10,
        estimatedPossessions: Math.round(estimatedPossessions * 10) / 10,
        pointsPerEstimatedPossessions: Math.round((points / estimatedPossessions) * 100) / 100 || 0,
      };
    } catch (err) {
      this.logger.warn(`Failed to parse stats for ${athleteInfo.id}: ${err}`);
      return null;
    }
  }

  private calcTS(points: number, fga: number, ftm: number): number {
    if (fga === 0) return 0;
    return points / (2 * fga + 0.44 * ftm);
  }

  private computeTotals(players: PlayerSeasonStats[]) {
    const sum = (get: (p: PlayerSeasonStats) => number) =>
      players.reduce((acc, p) => acc + get(p), 0);

    const gamesPlayed = sum(p => p.gamesPlayed);
    const gp = gamesPlayed > 0 ? gamesPlayed : 1;

    return {
      points: Math.round(sum(p => p.points)),
      rebounds: Math.round(sum(p => p.rebounds)),
      assists: Math.round(sum(p => p.assists)),
      steals: Math.round(sum(p => p.steals)),
      blocks: Math.round(sum(p => p.blocks)),
      minutes: Math.round(sum(p => p.minutes)),
      fieldGoalsMade: Math.round(sum(p => p.fieldGoalsMade)),
      fieldGoalsAttempted: Math.round(sum(p => p.fieldGoalsAttempted)),
      threePointMade: Math.round(sum(p => p.threePointMade)),
      threePointAttempted: Math.round(sum(p => p.threePointAttempted)),
      freeThrowsMade: Math.round(sum(p => p.freeThrowsMade)),
      freeThrowsAttempted: Math.round(sum(p => p.freeThrowsAttempted)),
      turnovers: Math.round(sum(p => p.turnovers)),
      gamesPlayed: gp,
    };
  }

  private computeAverages(totals: ReturnType<typeof this.computeTotals>, gp: number) {
    return {
      PPG: Math.round((totals.points / gp) * 10) / 10,
      RPG: Math.round((totals.rebounds / gp) * 10) / 10,
      APG: Math.round((totals.assists / gp) * 10) / 10,
      SPG: Math.round((totals.steals / gp) * 10) / 10,
      BPG: Math.round((totals.blocks / gp) * 10) / 10,
      MPG: Math.round((totals.minutes / gp) * 10) / 10,
      FG_PCT: Math.round((totals.fieldGoalsMade / totals.fieldGoalsAttempted) * 1000) / 1000 || 0,
      THREE_PT_PCT: Math.round((totals.threePointMade / totals.threePointAttempted) * 1000) / 1000 || 0,
      FT_PCT: Math.round((totals.freeThrowsMade / totals.freeThrowsAttempted) * 1000) / 1000 || 0,
    };
  }

  private computeAdvanced(
    totals: ReturnType<typeof this.computeTotals>,
    players: PlayerSeasonStats[],
  ) {
    const ast = totals.assists;
    const to = totals.turnovers;
    const fga = totals.fieldGoalsAttempted;
    const fta = totals.freeThrowsAttempted;
    const pts = totals.points;

    const teamAstToRatio = ast / (to || 1);
    const teamTS = pts > 0 ? pts / (2 * fga + 0.44 * fta) : 0;
    const teamUsage = players.reduce((acc, p) => acc + p.usageRate, 0) / (players.length || 1);
    const teamEstPoss = players.reduce((acc, p) => acc + p.estimatedPossessions, 0);

    return {
      teamAssistTurnoverRatio: Math.round(teamAstToRatio * 10) / 10,
      teamTrueShootingPct: Math.round(teamTS * 1000) / 1000,
      teamUsageRate: Math.round(teamUsage * 10) / 10,
      teamEstimatedPossessions: Math.round(teamEstPoss),
    };
  }

  /**
   * Obtiene stats de ambos equipos y las combina para el análisis.
   */
  async getMatchTeamStats(
    homeTeamId: string, homeTeamName: string,
    awayTeamId: string, awayTeamName: string,
  ): Promise<{ home: TeamSeasonStats; away: TeamSeasonStats } | null> {
    const [homeStats, awayStats] = await Promise.allSettled([
      this.getTeamSeasonStats(homeTeamId, homeTeamName),
      this.getTeamSeasonStats(awayTeamId, awayTeamName),
    ]);

    const home = (homeStats as PromiseFulfilledResult<TeamSeasonStats | null>)?.value;
    const away = (awayStats as PromiseFulfilledResult<TeamSeasonStats | null>)?.value;

    if (!home || !away) {
      this.logger.warn('One or both team stats could not be built');
      return null;
    }

    return { home, away };
  }
}