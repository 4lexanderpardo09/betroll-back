import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';

@Injectable()
export class ESPNService {
  private readonly baseUrl = 'https://api.espn.com/v3';
  private readonly logger = new Logger(ESPNService.name);

  private readonly headers = {
    'User-Agent': 'Mozilla/5.0',
    Accept: 'application/json',
  };

  constructor(private readonly cacheService: CacheService) {}

  private async fetch<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    this.logger.debug(`Fetching: ${url}`);

    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async fetchWithCache<T>(
    key: string,
    endpoint: string,
    ttlMs: number,
  ): Promise<T> {
    return this.cacheService.getOrFetch(
      key,
      () => this.fetch<T>(endpoint),
      ttlMs,
    );
  }

  // ==================== INJURIES ====================

  /**
   * Get injury report for a sport/league
   * @param sport basketball, football, baseball, hockey
   * @param league nba, nfl, mlb, nhl
   */
  async getInjuries(
    sport: string,
    league: string,
  ): Promise<ESPNInjury[]> {
    const cacheKey = CacheService.buildKey('espn', 'injuries', sport, league);
    const data = await this.fetchWithCache<ESPNInjuryResponse>(
      cacheKey,
      `/sports/${sport}/${league}/injuries`,
      CacheService.TTL.INJURIES,
    );
    return data.sports?.[0]?.leagues?.[0]?.athletes || [];
  }

  /**
   * Get injuries for a specific team
   */
  async getTeamInjuries(
    sport: string,
    league: string,
    teamId: string,
  ): Promise<ESPNInjury[]> {
    const allInjuries = await this.getInjuries(sport, league);
    return allInjuries.filter(
      (injury) => injury.athlete?.team?.id?.toString() === teamId,
    );
  }

  // ==================== NEWS ====================

  /**
   * Get recent news for a sport/league
   */
  async getNews(
    sport: string,
    league: string,
    limit = 10,
  ): Promise<ESPNNewsArticle[]> {
    const cacheKey = CacheService.buildKey('espn', 'news', sport, league, limit);
    const data = await this.fetchWithCache<ESPNNewsResponse>(
      cacheKey,
      `/sports/${sport}/${league}/news?limit=${limit}`,
      CacheService.TTL.NEWS,
    );
    return data.articles || [];
  }

  // ==================== SCOREBOARD ====================

  /**
   * Get scoreboard for a specific date
   */
  async getScoreboard(
    sport: string,
    league: string,
    dates?: string,
  ): Promise<ESPNGame[]> {
    const cacheKey = CacheService.buildKey(
      'espn',
      'scoreboard',
      sport,
      league,
      dates || 'today',
    );
    const endpoint = dates
      ? `/sports/${sport}/${league}/scoreboard?dates=${dates}`
      : `/sports/${sport}/${league}/scoreboard`;
    const data = await this.fetchWithCache<ESPNScoreboardResponse>(
      cacheKey,
      endpoint,
      CacheService.TTL.MATCH_STATS,
    );
    return data.sports?.[0]?.leagues?.[0]?.events || [];
  }

  // ==================== STANDINGS ====================

  /**
   * Get standings for a sport/league
   */
  async getStandings(
    sport: string,
    league: string,
  ): Promise<ESPNStandingEntry[]> {
    const cacheKey = CacheService.buildKey('espn', 'standings', sport, league);
    const data = await this.fetchWithCache<ESPNStandingsResponse>(
      cacheKey,
      `/sports/${sport}/${league}/standings`,
      CacheService.TTL.STANDINGS,
    );
    return data.sports?.[0]?.leagues?.[0]?.standings?.[0]?.entries || [];
  }

  // ==================== TEAMS ====================

  /**
   * Get all teams for a sport/league
   */
  async getTeams(
    sport: string,
    league: string,
  ): Promise<ESPNTeamWrapper[]> {
    const cacheKey = CacheService.buildKey('espn', 'teams', sport, league);
    const data = await this.fetchWithCache<ESPNTeamsResponse>(
      cacheKey,
      `/sports/${sport}/${league}/teams`,
      CacheService.TTL.STANDINGS,
    );
    return data.sports?.[0]?.leagues?.[0]?.teams || [];
  }

  // ==================== COMPILED DATA ====================

  /**
   * Get injury data formatted for a match
   */
  async getMatchInjuries(
    homeTeamId: string,
    awayTeamId: string,
    sport: string = 'basketball',
    league: string = 'nba',
  ): Promise<{
    homeInjuries: ESPNInjury[];
    awayInjuries: ESPNInjury[];
    allInjuries: ESPNInjury[];
  }> {
    const allInjuries = await this.getInjuries(sport, league);
    const homeInjuries = allInjuries.filter(
      (i) => i.athlete?.team?.id?.toString() === homeTeamId,
    );
    const awayInjuries = allInjuries.filter(
      (i) => i.athlete?.team?.id?.toString() === awayTeamId,
    );

    return {
      homeInjuries,
      awayInjuries,
      allInjuries,
    };
  }
}

// ==================== TYPES ====================

export interface ESPNInjury {
  athlete?: {
    id?: string;
    fullName?: string;
    position?: string;
    team?: {
      id?: string;
      name?: string;
    };
  };
  injury?: {
    type?: string;
    status?: string;
    description?: string;
  };
  date?: string;
}

export interface ESPNInjuryResponse {
  sports: ESPNInjurySport[];
}

export interface ESPNInjurySport {
  leagues?: ESPNInjuryLeague[];
}

export interface ESPNInjuryLeague {
  athletes?: ESPNInjury[];
}

export interface ESPNNewsArticle {
  headline?: string;
  description?: string;
  published?: string;
  images?: { url: string }[];
  links?: {
    web?: { href?: string };
  };
}

export interface ESPNNewsResponse {
  articles?: ESPNNewsArticle[];
}

export interface ESPNGame {
  id?: string;
  date?: string;
  name?: string;
  competitions?: ESPNCompetition[];
}

export interface ESPNCompetition {
  homeTeam?: {
    team?: {
      id?: string;
      name?: string;
    };
    score?: string;
  };
  awayTeam?: {
    team?: {
      id?: string;
      name?: string;
    };
    score?: string;
  };
  status?: {
    displayClock?: string;
    period?: number;
  };
}

export interface ESPNScoreboardResponse {
  sports?: ESPNScoreboardSport[];
}

export interface ESPNScoreboardSport {
  leagues?: ESPNScoreboardLeague[];
}

export interface ESPNScoreboardLeague {
  events?: ESPNGame[];
}

export interface ESPNStandingEntry {
  team?: {
    id?: string;
    name?: string;
    abbreviation?: string;
  };
  stats?: { value?: number; name?: string }[];
}

export interface ESPNStandingGroup {
  name?: string;
  entries?: ESPNStandingEntry[];
}

export interface ESPNStandingsResponse {
  sports?: ESPNStandingsSport[];
}

export interface ESPNStandingsSport {
  leagues?: ESPNStandingsLeague[];
}

export interface ESPNStandingsLeague {
  standings?: ESPNStandingGroup[];
}

export interface ESPNTeam {
  id?: string;
  name?: string;
  abbreviation?: string;
  logos?: { href: string }[];
}

export interface ESPNTeamsResponse {
  sports?: ESPNTeamsSport[];
}

export interface ESPNTeamsSport {
  leagues?: ESPNTeamsLeague[];
}

export interface ESPNTeamsLeague {
  teams?: ESPNTeamWrapper[];
}

export interface ESPNTeamWrapper {
  team?: ESPNTeam;
}
