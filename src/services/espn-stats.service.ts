import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * ESPNStatsService
 *
 * Maneja stats de jugadores y equipos:
 *  - Athlete overview (temporada completa)
 *  - Athlete splits (home/away, monthly, days rest)
 *  - Athlete gamelog (últimos partidos)
 *  - Team leaders (top scorer/rebounder/assister)
 */

const ESPN_WEB = 'https://site.web.api.espn.com/apis/common/v3';
const ESPN_SITE = 'https://site.api.espn.com/apis/site/v2';

// ─── TYPES ─────────────────────────────────────────────────────────────────

export interface ESPNAthleteOverview {
  athlete: {
    id: string;
    displayName: string;
    fullName: string;
    age?: number;
    height?: string;
    weight?: string;
    position?: { abbreviation: string; name: string };
    team?: { id: string; name: string; abbreviation: string };
    headshot?: { href: string };
  };
  stats?: { name: string; displayName: string; displayValue: string; value?: number }[];
  nextEvent?: { id: string; date: string }[];
  notes?: { type: string; headline: string }[];
}

export interface ESPNAthleteStats {
  name: string;
  displayName: string;
  displayValue: string;
  value?: number;
}

export interface ESPNAthleteSplit {
  name: string;
  displayName: string;
  stats: Record<string, string>;
}

export interface ESPNAthleteSplits {
  athlete: { id: string; displayName: string };
  categories?: {
    name: string;
    displayName: string;
    splits?: ESPNAthleteSplit[];
  }[];
}

export interface ESPNAthleteGameLogEvent {
  gameId: string;
  date: string;
  atVs: string;
  homeAway: 'home' | 'away';
  opponent: { id: string; abbreviation: string };
  result: 'W' | 'L';
  stats: string[];
}

export interface ESPNAthleteGameLog {
  athlete: { id: string; displayName: string };
  seasonTypes?: {
    id: string;
    name: string;
    categories?: {
      name: string;
      labels: string[];
      events: ESPNAthleteGameLogEvent[];
    }[];
  }[];
}

export interface ESPNTeamLeader {
  name: string;
  displayName: string;
  abbreviation: string;
  leaders: {
    displayValue: string;
    value: number;
    athlete: {
      id: string;
      fullName: string;
      displayName: string;
      headshot?: { href: string };
    };
  }[];
}

export interface ESPNTeamLeaders {
  team: { id: string; displayName: string };
  leaders: ESPNTeamLeader[];
}

export interface ESPNTeamRoster {
  team: { id: string; name: string; abbreviation: string };
  athletes: {
    id: string;
    fullName: string;
    displayName: string;
    jersey?: string;
    position?: { abbreviation: string; name: string };
    status?: { id: string; name: string; type: string; abbreviation: string };
    experience?: { years: number };
    height?: string;
    weight?: string;
    age?: number;
  }[];
}

// ─── PROCESSED ──────────────────────────────────────────────────────────────

export interface ProcessedAthleteStats {
  id: string;
  name: string;
  position: string;
  team: string;
  PPG: string;
  RPG: string;
  APG: string;
  FG_PCT: string;
  THREE_PT_PCT: string;
  FT_PCT: string;
  MIN: string;
  gamesPlayed?: string;
  splits: {
    home: Record<string, string>;
    away: Record<string, string>;
  };
  recentGames: ESPNAthleteGameLogEvent[];
}

// ─── SERVICE ───────────────────────────────────────────────────────────────

@Injectable()
export class ESPNStatsService {
  private readonly logger = new Logger(ESPNStatsService.name);

  private readonly headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Accept: 'application/json',
  };

  constructor(private readonly cacheService: CacheService) {}

  // ─── FETCH ──────────────────────────────────────────────────────────────

  private async fetch<T>(url: string): Promise<T> {
    this.logger.debug(`ESPN Stats → ${url}`);
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) throw new Error(`ESPN Stats ${res.status} — ${url}`);
    return res.json();
  }

  private async safe<T>(url: string, ttlMs: number, cacheKey: string): Promise<T | null> {
    try {
      return await this.cacheService.getOrFetch(cacheKey, () => this.fetch<T>(url), ttlMs);
    } catch (err) {
      this.logger.warn(`ESPN Stats falló (${url}): ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  // ─── TEAM LEADERS ────────────────────────────────────────────────────────

  /**
   * Líderes estadísticos de un equipo (PPG, RPG, APG top de cada categoría).
   */
  async getTeamLeaders(teamId: string): Promise<ESPNTeamLeaders | null> {
    const cacheKey = CacheService.buildKey('espn', 'team-leaders', teamId);
    const url = `${ESPN_SITE}/sports/basketball/nba/teams/${teamId}/leaders`;
    return this.safe<ESPNTeamLeaders>(url, CacheService.TTL.TEAM_FORM, cacheKey);
  }

  // ─── ATHLETE OVERVIEW ───────────────────────────────────────────────────

  async getAthleteOverview(athleteId: string): Promise<ESPNAthleteOverview | null> {
    const cacheKey = CacheService.buildKey('espn', 'athlete-overview', athleteId);
    const url = `${ESPN_WEB}/sports/basketball/nba/athletes/${athleteId}/overview`;
    return this.safe<ESPNAthleteOverview>(url, CacheService.TTL.ATHLETE, cacheKey);
  }

  // ─── ATHLETE SPLITS ──────────────────────────────────────────────────────

  async getAthleteSplits(athleteId: string): Promise<ESPNAthleteSplits | null> {
    const cacheKey = CacheService.buildKey('espn', 'athlete-splits', athleteId);
    const url = `${ESPN_WEB}/sports/basketball/nba/athletes/${athleteId}/splits`;
    return this.safe<ESPNAthleteSplits>(url, CacheService.TTL.ATHLETE, cacheKey);
  }

  // ─── ATHLETE GAMELOG ────────────────────────────────────────────────────

  async getAthleteGameLog(athleteId: string): Promise<ESPNAthleteGameLog | null> {
    const cacheKey = CacheService.buildKey('espn', 'athlete-gamelog', athleteId);
    const url = `${ESPN_WEB}/sports/basketball/nba/athletes/${athleteId}/gamelog`;
    return this.safe<ESPNAthleteGameLog>(url, CacheService.TTL.ATHLETE, cacheKey);
  }

  // ─── TEAM ROSTER ───────────────────────────────────────────────────────

  async getTeamRoster(teamId: string): Promise<ESPNTeamRoster | null> {
    const cacheKey = CacheService.buildKey('espn', 'roster', teamId);
    const url = `${ESPN_SITE}/sports/basketball/nba/teams/${teamId}/roster`;
    return this.safe<ESPNTeamRoster>(url, CacheService.TTL.ROSTER, cacheKey);
  }

  // ─── COMBINED ATHLETE STATS ─────────────────────────────────────────────

  /**
   *获取一个球员的完整统计数据（overview + splits + recent games）
   */
  async getAthleteStatsComplete(athleteId: string): Promise<ProcessedAthleteStats | null> {
    const [overview, splits, gamelog] = await Promise.allSettled([
      this.getAthleteOverview(athleteId),
      this.getAthleteSplits(athleteId),
      this.getAthleteGameLog(athleteId),
    ]);

    const ov = this.resolve(overview);
    if (!ov) return null;

    const statsMap: Record<string, string> = {};
    for (const s of ov.stats ?? []) {
      statsMap[s.name] = s.displayValue;
    }

    // Parse splits
    const splitsData = this.resolve(splits);
    const homeSplits: Record<string, string> = {};
    const awaySplits: Record<string, string> = {};
    if (splitsData?.categories) {
      for (const cat of splitsData.categories) {
        if (cat.name === 'homeAway') {
          for (const split of cat.splits ?? []) {
            if (split.displayName === 'Home') {
              Object.assign(homeSplits, split.stats);
            } else if (split.displayName === 'Away') {
              Object.assign(awaySplits, split.stats);
            }
          }
        }
      }
    }

    // Parse recent games
    const recentGames: ESPNAthleteGameLogEvent[] = [];
    const gl = this.resolve(gamelog);
    if (gl?.seasonTypes?.[0]?.categories?.[0]?.events) {
      recentGames.push(...gl.seasonTypes[0].categories[0].events.slice(0, 5));
    }

    return {
      id: athleteId,
      name: ov.athlete.fullName,
      position: ov.athlete.position?.abbreviation ?? '?',
      team: ov.athlete.team?.name ?? '?',
      PPG: statsMap['pointsPerGame'] ?? '?',
      RPG: statsMap['reboundsPerGame'] ?? '?',
      APG: statsMap['assistsPerGame'] ?? '?',
      FG_PCT: statsMap['fieldGoalPct'] ?? '?',
      THREE_PT_PCT: statsMap['threePointPct'] ?? '?',
      FT_PCT: statsMap['freeThrowPct'] ?? '?',
      MIN: statsMap['minutesPerGame'] ?? '?',
      gamesPlayed: statsMap['gamesPlayed'],
      splits: { home: homeSplits, away: awaySplits },
      recentGames,
    };
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────

  private resolve<T>(result: PromiseSettledResult<T>): T | null {
    return result.status === 'fulfilled' ? result.value : null;
  }
}
