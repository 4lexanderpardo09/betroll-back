import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';

@Injectable()
export class ESPNService {
  // Note: ESPN has multiple APIs with different base URLs
  // api.espn.com/v3 - Original API (some endpoints require auth now)
  // site.api.espn.com/apis/site/v2 - Site API (works for scoreboard, injuries)
  // sports.core.api.espn.com/v2 - Core API (stats, splits)

  private readonly siteApiUrl = 'https://site.api.espn.com/apis/site/v2';
  private readonly coreApiUrl = 'https://sports.core.api.espn.com/v2';
  private readonly logger = new Logger(ESPNService.name);

  private readonly headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Accept: 'application/json',
  };

  constructor(private readonly cacheService: CacheService) {}

  private async fetch<T>(url: string): Promise<T> {
    this.logger.debug(`Fetching: ${url}`);

    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async fetchWithCache<T>(
    key: string,
    url: string,
    ttlMs: number,
  ): Promise<T> {
    return this.cacheService.getOrFetch(
      key,
      () => this.fetch<T>(url),
      ttlMs,
    );
  }

  // ==================== SCOREBOARD (SITE API v2) ====================
  // This is the MAIN endpoint for getting games, stats, and odds

  /**
   * Get scoreboard with games, stats, and DRAFTKINGS ODDS
   * This is the PRIMARY endpoint for betting data
   *
   * @param sport basketball, football, baseball
   * @param league nba, nfl, mlb, nhl
   * @param dates YYYY-MM-DD format, or omit for today
   */
  async getScoreboardV2(
    sport: string,
    league: string,
    dates?: string,
  ): Promise<ESPNScoreboardV2Event[]> {
    const cacheKey = CacheService.buildKey('espn', 'scoreboardv2', sport, league, dates || 'today');
    const url = dates
      ? `${this.siteApiUrl}/sports/${sport}/${league}/scoreboard?dates=${dates}`
      : `${this.siteApiUrl}/sports/${sport}/${league}/scoreboard`;

    const data = await this.fetchWithCache<ESPNScoreboardV2Response>(
      cacheKey,
      url,
      CacheService.TTL.MATCH_STATS,
    );

    return data.events || [];
  }

  // ==================== INJURIES (SITE API v2) ====================
  // Works! Returns detailed injury info with return dates

  /**
   * Get injury report for a league
   * Returns ~20-30 current injuries with detailed info
   */
  async getInjuriesV2(
    sport: string,
    league: string,
  ): Promise<ESPNInjuryV2[]> {
    const cacheKey = CacheService.buildKey('espn', 'injuriesv2', sport, league);
    const url = `${this.siteApiUrl}/sports/${sport}/${league}/injuries`;

    const data = await this.fetchWithCache<ESPNInjuriesV2Response>(
      cacheKey,
      url,
      CacheService.TTL.INJURIES,
    );

    return data.injuries || [];
  }

  /**
   * Get injuries for a specific team by team ID
   */
  async getTeamInjuriesV2(
    sport: string,
    league: string,
    teamId: string,
  ): Promise<ESPNInjuryV2[]> {
    const allInjuries = await this.getInjuriesV2(sport, league);
    return allInjuries.filter(
      (injury) => injury.teamReference?.toString() === teamId,
    );
  }

  // ==================== ROSTER / TEAM DETAILS ====================

  /**
   * Get team roster with player details
   */
  async getTeamRoster(
    sport: string,
    league: string,
    teamId: string,
  ): Promise<ESPNTeamRoster> {
    const cacheKey = CacheService.buildKey('espn', 'roster', sport, league, teamId);
    const url = `${this.siteApiUrl}/sports/${sport}/${league}/teams/${teamId}/roster`;

    return this.fetchWithCache<ESPNTeamRoster>(
      cacheKey,
      url,
      CacheService.TTL.TEAM_FORM,
    );
  }

  // ==================== SUMMARY (ENRICHED GAME DATA) ====================

  /**
   * Get detailed game summary with advanced stats
   */
  async getGameSummary(
    sport: string,
    league: string,
    eventId: string,
  ): Promise<ESPNGameSummary> {
    const cacheKey = CacheService.buildKey('espn', 'summary', sport, league, eventId);
    const url = `${this.siteApiUrl}/sports/${sport}/${league}/summary?event=${eventId}`;

    return this.fetchWithCache<ESPNGameSummary>(
      cacheKey,
      url,
      CacheService.TTL.MATCH_STATS,
    );
  }

  // ==================== PLAYER STATS (CORE API) ====================

  /**
   * Get player statistics from Core API
   */
  async getPlayerStats(
    sport: string,
    league: string,
    athleteId: string,
  ): Promise<ESPNPlayerStats> {
    const cacheKey = CacheService.buildKey('espn', 'playerstats', athleteId);
    const url = `${this.coreApiUrl}/sports/${sport}/leagues/${league}/athletes/${athleteId}/statistics`;

    return this.fetchWithCache<ESPNPlayerStats>(
      cacheKey,
      url,
      CacheService.TTL.TEAM_FORM,
    );
  }

  // ==================== COMPILED MATCH DATA ====================

  /**
   * Get all relevant data for a match from ESPN
   */
  async getMatchData(
    sport: string,
    league: string,
    eventId: string,
  ): Promise<{
    summary: ESPNGameSummary | null;
    injuries: ESPNInjuryV2[];
  }> {
    try {
      const [summary, injuries] = await Promise.all([
        this.getGameSummary(sport, league, eventId).catch(() => null),
        this.getInjuriesV2(sport, league).catch(() => []),
      ]);

      return { summary, injuries };
    } catch (error) {
      this.logger.error(`Error fetching match data:`, error);
      throw error;
    }
  }
}

// ==================== TYPES FOR SITE API v2 ====================

export interface ESPNScoreboardV2Event {
  id: string;
  uid: string;
  date: string;
  name: string;
  competition: string;
  status: {
    period: number;
    displayClock: string;
    type: {
      id: string;
      name: string;
      completed: boolean;
    };
  };
  competitions: ESPNCompetition[];
}

export interface ESPNCompetition {
  id: string;
  uid: string;
  date: string;
  status: ESPNCompetitionStatus;
  attendance?: number;
  venue?: {
    id: string;
    name: string;
    address: {
      city: string;
      state: string;
    };
  };
  competitors: ESPNCompetitor[];
  details?: ESPNCompetitionDetail[];
  odds?: ESPNOdds[];
  leaders?: ESPNLeader[];
  situation?: ESPSituation;
}

export interface ESPNCompetitor {
  id: string;
  uid: string;
  type: string;
  order: number;
  homeAway: 'home' | 'away';
  team: {
    id: string;
    uid: string;
    name: string;
    abbreviation: string;
    displayName: string;
    logo: string;
    links?: { rel: string[]; href: string }[];
  };
  score?: string;
  linescores?: { value: string }[];
  records?: { id: string; summary: string; type: string }[];
  statistics?: ESPNCompetitorStat[];
  leaders?: ESPNLeader[];
}

export interface ESPNCompetitorStat {
  name: string;
  displayName: string;
  shortDisplayName: string;
  value: string;
  displayValue: string;
  rank?: string;
  summary?: string;
}

export interface ESPNCompetitionStatus {
  period: number;
  displayClock: string;
  type: {
    id: string;
    name: string;
    state: string;
    completed: boolean;
  };
}

export interface ESPNCompetitionDetail {
  label: string;
  value: string;
}

export interface ESPNOdds {
  provider: {
    id: number;
    name: string;
    priority: number;
  };
  details?: string;
  overTotal?: number;
  underTotal?: number;
  awayTeamOdds?: {
    price: number;
    differential?: number;
  };
  homeTeamOdds?: {
    price: number;
    differential?: number;
  };
  spread?: {
    awayTeamOdds: number;
    homeTeamOdds: number;
    awayTeamLine: number;
    homeTeamLine: number;
  };
  moneyline?: {
    awayTeamOdds: number;
    homeTeamOdds: number;
  };
}

export interface ESPNLeader {
  leader: {
    id: string;
    fullName: string;
    displayName: string;
    headshot: string;
    team: { id: string; name: string };
  };
  stats: {
    stat: string;
    value: string;
    displayValue: string;
    rank?: string;
  }[];
}

export interface ESPSituation {
  possession?: string;
  downDistanceText?: string;
  possessionArrow?: string;
  lastPlay?: {
    text: string;
    probability: {
      homeWinPercentage: number;
      awayWinPercentage: number;
    };
  };
}

export interface ESPNScoreboardV2Response {
  uid: string;
  id: string;
  status: string;
  season: {
    year: number;
    type: number;
    name: string;
  };
  competitions: ESPNCompetition[];
  events: ESPNScoreboardV2Event[];
}

// ==================== INJURY TYPES ====================

export interface ESPNInjuriesV2Response {
  timestamp: string;
  status: string;
  season: {
    year: number;
    type: number;
    name: string;
  };
  injuries: ESPNInjuryV2[];
}

export interface ESPNInjuryV2 {
  id: string;
  uid: string;
  type: {
    id: string;
    name: string;
    description: string;
  };
  detail: string;
  shortDetail: string;
  longDetail: string;
  returnDate?: string;
  player?: {
    id: string;
    uid: string;
    fullName: string;
    displayName: string;
    headline: string;
    position: {
      id: string;
      name: string;
      abbreviation: string;
    };
    team: {
      id: string;
      uid: string;
      slug: string;
      name: string;
      abbreviation: string;
      displayName: string;
      logo: string;
    };
    headshot: {
      href: string;
      alt: string;
    };
    jersey: string;
    height: string;
    weight: string;
    age: number;
    birthPlace: {
      city: string;
      state: string;
      country: string;
    };
    college?: {
      id: string;
      name: string;
    };
    rookieYear?: number;
  };
  teamReference?: string;
}

// ==================== ROSTER TYPES ====================

export interface ESPNTeamRoster {
  team: {
    id: string;
    name: string;
    abbreviation: string;
    displayName: string;
  };
  athletes: {
    id: string;
    fullName: string;
    displayName: string;
    jersey: string;
    position: {
      abbreviation: string;
    };
    height: string;
    weight: string;
    age: number;
    experience: string;
    college?: string;
    statistics?: Record<string, any>[];
  }[];
}

// ==================== SUMMARY TYPES ====================

export interface ESPNGameSummary {
  header: {
    id: string;
    week: number;
    season: {
      year: number;
      type: number;
    };
    competition: string;
  };
  boxScore?: ESPNBoxScore;
  gameInfo?: ESPNGameInfo;
  series?: ESPNSeries;
}

export interface ESPNBoxScore {
  teams: {
    team: {
      id: string;
      name: string;
      abbreviation: string;
    };
    statistics: {
      name: string;
      displayName: string;
      value: string;
    }[];
    players: {
      athlete: {
        id: string;
        fullName: string;
      };
      statistics: {
        name: string;
        value: string;
      }[];
    }[];
  }[];
}

export interface ESPNGameInfo {
  venue: {
    name: string;
    city: string;
  };
  attendance: number;
  officials: {
    name: string;
    role: string;
  }[];
}

export interface ESPNSeries {
  type: string;
  title: string;
  summary: string;
  events: {
    id: string;
    date: string;
    competition: string;
    winner: {
      id: string;
      name: string;
    };
  }[];
}

// ==================== PLAYER STATS TYPES ====================

export interface ESPNPlayerStats {
  athlete: {
    id: string;
    displayName: string;
  };
  categories: {
    name: string;
    displayName: string;
    stats: {
      name: string;
      displayName: string;
      value: string;
      rank?: string;
    }[];
  }[];
}
