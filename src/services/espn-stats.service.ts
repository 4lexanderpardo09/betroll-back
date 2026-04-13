import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';
import { DataNormalizer, CleanPlayerStats, CleanGameEvent } from './data-normalizer.service';

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
const ESPN_CORE = 'https://sports.core.api.espn.com/v2';

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

export interface ESPNAthleteGameLog {
  athlete: { id: string; displayName: string };
  filters?: string[];
  labels?: string[];
  names?: string[];
  displayNames?: string[];
  seasonTypes?: {
    id: string;
    name: string;
    events?: ESPNAthleteGameLogEvent[];
    categories?: {
      name: string;
      labels: string[];
      events: ESPNAthleteGameLogEvent[];
    }[];
  }[];
}

export interface ESPNAthleteGameLogEvent {
  eventId: string;
  date: string;
  atVs: string;
  homeAway: 'home' | 'away';
  opponent: { id: string; abbreviation: string };
  result: 'W' | 'L';
  stats: string[];
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

// New: Season stats from core API (the proper working endpoint)
export interface ESPNAthleteSeasonStats {
  athlete: { id: string; displayName: string; fullName: string };
  splits: {
    categories: {
      name: string;
      stats: { name: string; displayValue: string; value: number }[];
    }[];
  };
}

// ─── PROCESSED ──────────────────────────────────────────────────────────────

export interface ProcessedAthleteStats {
  id: string;
  name: string;
  position: string;
  team: string;
  PPG: string; // display string, '-' if null
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
  recentGames: CleanGameEvent[];
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

  // ─── ATHLETE SEASON STATS (core API) ──────────────────────────────────

  /**
   *获取球员赛季统计数据
   * URL: /v2/sports/basketball/leagues/nba/seasons/2026/types/2/athletes/{id}/statistics/0
   */
  async getAthleteSeasonStatsCore(athleteId: string, season = 2026): Promise<ESPNAthleteSeasonStats | null> {
    const cacheKey = CacheService.buildKey('espn', 'athlete-season-stats', athleteId, String(season));
    const url = `${ESPN_CORE}/sports/basketball/leagues/nba/seasons/${season}/types/2/athletes/${athleteId}/statistics/0`;
    return this.safe<ESPNAthleteSeasonStats>(url, CacheService.TTL.ATHLETE, cacheKey);
  }

  // ─── COMBINED ATHLETE STATS ─────────────────────────────────────────────

  private readonly normalizer = new DataNormalizer();

  /**
   * Consigue un atleta stats completos (overview + core stats + splits + recent games)
   * Priority: core API (always works) > overview (future games only)
   */
  async getAthleteStatsComplete(athleteId: string): Promise<ProcessedAthleteStats | null> {
    // Fetch all sources in parallel
    const [overview, seasonStats, gamelog] = await Promise.allSettled([
      this.getAthleteOverview(athleteId),
      this.getAthleteSeasonStatsCore(athleteId),
      this.getAthleteGameLog(athleteId),
    ]);

    const ov = this.resolve(overview);
    const core = this.resolve(seasonStats);

    // Build statsMap from core API (always works)
    // Fallback to overview if core doesn't have the stats we need
    const statsMap: Record<string, string> = {};

    if (core?.splits?.categories) {
      for (const cat of core.splits.categories) {
        for (const stat of cat.stats) {
          statsMap[stat.name] = stat.displayValue;
        }
      }
    }

    // If overview has stats not in core, merge them
    if (ov?.stats) {
      for (const s of ov.stats) {
        if (!statsMap[s.name]) {
          statsMap[s.name] = s.displayValue;
        }
      }
    }

    this.logger.debug(`[Athlete ${athleteId}] statsMap keys: [${Object.keys(statsMap).join(', ')}]`);
    this.logger.debug(`[Athlete ${athleteId}] statsMap PPG: ${statsMap['avgPoints'] || statsMap['pointsPerGame'] || 'N/A'}, RPG: ${statsMap['avgRebounds'] || statsMap['reboundsPerGame'] || 'N/A'}, APG: ${statsMap['avgAssists'] || statsMap['assistsPerGame'] || 'N/A'}`);

    // Extract player name from overview or core
    const playerName = ov?.athlete?.fullName
      ?? core?.athlete?.fullName
      ?? 'Unknown';
    const playerPosition = ov?.athlete?.position?.abbreviation
      ?? (ov?.athlete?.position?.name ? ov.athlete.position.name.substring(0,2) : '-');
    const playerTeam = ov?.athlete?.team?.name ?? '-';

    // Parse recent games
    const recentGames: CleanGameEvent[] = [];
    const gl = this.resolve(gamelog);
    // Gamelog structure: seasonTypes[0].events (direct), labels at root level
    if (gl?.seasonTypes?.[0]?.events) {
      const events = gl.seasonTypes[0].events;
      const labels = gl.labels ?? [];
      recentGames.push(...this.normalizer.parseGameLogEvents(events, labels));
    }
    this.logger.debug(`[Athlete ${athleteId}] recentGames: ${recentGames.length}`);

    // Normalizar stats con null en vez de "?"
    const { displayStrings } = this.normalizer.parsePlayerStats(statsMap);

    return {
      id: athleteId,
      name: playerName,
      position: playerPosition,
      team: playerTeam,
      PPG: displayStrings['PPG'] ?? displayStrings['avgPoints'] ?? '-',
      RPG: displayStrings['RPG'] ?? displayStrings['avgRebounds'] ?? '-',
      APG: displayStrings['APG'] ?? displayStrings['avgAssists'] ?? '-',
      FG_PCT: displayStrings['FG_PCT'] ?? displayStrings['fieldGoalPct'] ?? '-',
      THREE_PT_PCT: displayStrings['THREE_PT_PCT'] ?? displayStrings['threePointPct'] ?? '-',
      FT_PCT: displayStrings['FT_PCT'] ?? displayStrings['freeThrowPct'] ?? '-',
      MIN: displayStrings['MIN'] ?? displayStrings['avgMinutes'] ?? '-',
      gamesPlayed: displayStrings['gamesPlayed'] ?? statsMap['gamesPlayed'] ?? undefined,
      splits: { home: {}, away: {} },
      recentGames,
    };
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────

  private resolve<T>(result: PromiseSettledResult<T>): T | null {
    return result.status === 'fulfilled' ? result.value : null;
  }
}
