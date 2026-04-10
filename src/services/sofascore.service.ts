import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';

interface SofascoreHeaders {
  'User-Agent': string;
  Accept: string;
  'Accept-Language': string;
}

@Injectable()
export class SofascoreService {
  private readonly baseUrl = 'https://api.sofascore.com/api/v1';
  private readonly logger = new Logger(SofascoreService.name);

  // Headers to bypass WAF
  private readonly headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  // Rate limiting: 1 request per second
  private lastRequest = 0;
  private readonly MIN_REQUEST_INTERVAL = 1000; // 1 second

  constructor(private readonly cacheService: CacheService) {}

  private async fetchWithDelay<T>(endpoint: string): Promise<T> {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest),
      );
    }
    this.lastRequest = Date.now();

    const url = `${this.baseUrl}${endpoint}`;
    this.logger.debug(`Fetching: ${url}`);

    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error(
          `Sofascore WAF blocked. Status: ${response.status}. Try adding proper headers.`,
        );
      }
      throw new Error(`Sofascore API error: ${response.status} ${response.statusText}`);
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
      () => this.fetchWithDelay<T>(endpoint),
      ttlMs,
    );
  }

  // ==================== SCHEDULE ====================

  /**
   * Get all scheduled events for a sport on a specific date
   * @param sport 'basketball' or 'football' or 'tennis'
   * @param date Format: YYYY-MM-DD
   */
  async getScheduledEvents(
    sport: string,
    date: string,
  ): Promise<SofascoreEvent[]> {
    const cacheKey = CacheService.buildKey('sofascore', 'schedule', sport, date);
    const data = await this.fetchWithCache<{ events: SofascoreEvent[] }>(
      cacheKey,
      `/sport/${sport}/scheduled-events/${date}`,
      CacheService.TTL.SCHEDULE,
    );
    return data.events || [];
  }

  // ==================== EVENT DETAILS ====================

  /**
   * Get detailed information about a specific event
   */
  async getEventDetails(eventId: string): Promise<SofascoreEventDetails> {
    const cacheKey = CacheService.buildKey('sofascore', 'event', eventId);
    return this.fetchWithCache<SofascoreEventDetails>(
      cacheKey,
      `/event/${eventId}`,
      CacheService.TTL.MATCH_STATS,
    );
  }

  // ==================== EVENT STATISTICS ====================

  /**
   * Get statistics for a specific event
   */
  async getEventStatistics(eventId: string): Promise<SofascoreStatistics> {
    const cacheKey = CacheService.buildKey('sofascore', 'stats', eventId);
    return this.fetchWithCache<SofascoreStatistics>(
      cacheKey,
      `/event/${eventId}/statistics`,
      CacheService.TTL.MATCH_STATS,
    );
  }

  // ==================== LINEUPS ====================

  /**
   * Get lineup for a specific event
   */
  async getEventLineups(eventId: string): Promise<SofascoreLineups> {
    const cacheKey = CacheService.buildKey('sofascore', 'lineups', eventId);
    return this.fetchWithCache<SofascoreLineups>(
      cacheKey,
      `/event/${eventId}/lineups`,
      CacheService.TTL.MATCH_STATS,
    );
  }

  // ==================== TEAM ====================

  /**
   * Get team information
   */
  async getTeam(teamId: string): Promise<SofascoreTeam> {
    const cacheKey = CacheService.buildKey('sofascore', 'team', teamId);
    return this.fetchWithCache<SofascoreTeam>(
      cacheKey,
      `/team/${teamId}`,
      CacheService.TTL.TEAM_FORM,
    );
  }

  /**
   * Get all players for a team
   */
  async getTeamPlayers(teamId: string): Promise<SofascorePlayer[]> {
    const cacheKey = CacheService.buildKey('sofascore', 'players', teamId);
    const data = await this.fetchWithCache<{ players: SofascorePlayer[] }>(
      cacheKey,
      `/team/${teamId}/players`,
      CacheService.TTL.TEAM_FORM,
    );
    return data.players || [];
  }

  /**
   * Get team performance/recent form
   */
  async getTeamPerformance(
    teamId: string,
  ): Promise<SofascoreTeamPerformance> {
    const cacheKey = CacheService.buildKey('sofascore', 'performance', teamId);
    return this.fetchWithCache<SofascoreTeamPerformance>(
      cacheKey,
      `/team/${teamId}/performance`,
      CacheService.TTL.TEAM_FORM,
    );
  }

  // ==================== PLAYER ====================

  /**
   * Get player statistics for a season
   */
  async getPlayerStats(
    playerId: string,
  ): Promise<SofascorePlayerStats[]> {
    const cacheKey = CacheService.buildKey('sofascore', 'player', 'stats', playerId);
    const data = await this.fetchWithCache<{ seasons: SofascorePlayerStats[] }>(
      cacheKey,
      `/player/${playerId}/statistics/seasons`,
      CacheService.TTL.TEAM_FORM,
    );
    return data.seasons || [];
  }

  // ==================== TOURNAMENTS ====================

  /**
   * Get all unique tournaments for a sport
   */
  async getUniqueTournaments(sport: string): Promise<SofascoreTournament[]> {
    const cacheKey = CacheService.buildKey('sofascore', 'tournaments', sport);
    const data = await this.fetchWithCache<{ tournaments: SofascoreTournament[] }>(
      cacheKey,
      `/sport/${sport}/unique-tournaments`,
      CacheService.TTL.STANDINGS,
    );
    return data.tournaments || [];
  }

  // ==================== STANDINGS ====================

  /**
   * Get standings for a tournament/season
   */
  async getStandings(
    tournamentId: string,
    seasonId: string,
  ): Promise<SofascoreStandingsRow[]> {
    const cacheKey = CacheService.buildKey(
      'sofascore',
      'standings',
      tournamentId,
      seasonId,
    );
    const data = await this.fetchWithCache<{ overall: { rows: SofascoreStandingsRow[] } }>(
      cacheKey,
      `/tournament/${tournamentId}/season/${seasonId}/standings/total`,
      CacheService.TTL.STANDINGS,
    );
    return data.overall?.rows || [];
  }

  // ==================== COMPILED MATCH DATA ====================

  /**
   * Get all relevant data for a match analysis
   * Combines multiple API calls into one
   */
  async getMatchData(
    eventId: string,
  ): Promise<CompiledMatchData> {
    try {
      const [details, statistics, lineups] = await Promise.all([
        this.getEventDetails(eventId).catch(() => null),
        this.getEventStatistics(eventId).catch(() => null),
        this.getEventLineups(eventId).catch(() => null),
      ]);

      return {
        details,
        statistics,
        lineups,
        homeTeamForm: details?.homeTeam
          ? await this.getTeamPerformance(details.homeTeam.id.toString()).catch(() => null)
          : null,
        awayTeamForm: details?.awayTeam
          ? await this.getTeamPerformance(details.awayTeam.id.toString()).catch(() => null)
          : null,
      };
    } catch (error) {
      this.logger.error(`Error fetching match data for ${eventId}:`, error);
      throw error;
    }
  }
}

// ==================== TYPES ====================

export interface SofascoreEvent {
  id: number;
  startTime: string;
  tournament: SofascoreTournament;
  homeTeam: SofascoreTeam;
  awayTeam: SofascoreTeam;
  status: string;
}

export interface SofascoreEventDetails extends SofascoreEvent {
  homeScore: number;
  awayScore: number;
  winnerId?: number;
}

export interface SofascoreStatistics {
  statistics: SofascoreStatisticGroup[];
}

export interface SofascoreStatisticGroup {
  period: string;
  groups: SofascoreStatisticItemGroup[];
}

export interface SofascoreStatisticItemGroup {
  groupName: string;
  statisticsItems: SofascoreStatisticItem[];
}

export interface SofascoreStatisticItem {
  name: string;
  home: string;
  away: string;
}

export interface SofascoreLineups {
  homeTeam: {
    startingPlayers: SofascorePlayer[];
    benchPlayers: SofascorePlayer[];
  };
  awayTeam: {
    startingPlayers: SofascorePlayer[];
    benchPlayers: SofascorePlayer[];
  };
}

export interface SofascoreTeam {
  id: number;
  name: string;
  shortName: string;
  sportId: number;
}

export interface SofascorePlayer {
  id: number;
  name: string;
  position: string;
  shirtNumber?: number;
}

export interface SofascoreTeamPerformance {
  team: SofascoreTeam;
  lastMatches: SofascoreMatchResult[];
  form: string;
  streak: number;
}

export interface SofascoreMatchResult {
  matchId: number;
  result: 'win' | 'loss' | 'draw';
  score: string;
}

export interface SofascorePlayerStats {
  seasonId: number;
  seasonName: string;
  competitions: SofascoreCompetitionStats[];
}

export interface SofascoreCompetitionStats {
  competitionId: number;
  competitionName: string;
  matches: number;
  minutes: number;
  points?: number;
  rebounds?: number;
  assists?: number;
}

export interface SofascoreTournament {
  id: number;
  name: string;
  slug: string;
  countryId?: number;
  countryName?: string;
}

export interface SofascoreStandingsRow {
  position: number;
  team: SofascoreTeam;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface CompiledMatchData {
  details: SofascoreEventDetails | null;
  statistics: SofascoreStatistics | null;
  lineups: SofascoreLineups | null;
  homeTeamForm: SofascoreTeamPerformance | null;
  awayTeamForm: SofascoreTeamPerformance | null;
}
