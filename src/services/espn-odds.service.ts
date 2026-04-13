import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * ESPNOddsService
 *
 * Maneja todo lo relacionado con:
 *  - Scoreboard (partidos del día)
 *  - Odds de partido (spread, moneyLine, overUnder de ESPN BET)
 *  - Búsqueda de partidos por fecha y equipo
 */

const ESPN_SITE = 'https://site.api.espn.com/apis/site/v2';

// ─── TYPES ─────────────────────────────────────────────────────────────────

export interface ESPNTeam {
  id: string;
  abbreviation: string;
  displayName: string;
  name: string;
  location: string;
  color?: string;
  alternateColor?: string;
}

export interface ESBNOddsProvider {
  id: string;
  name: string;
  priority: number;
}

export interface ESPNTeamOdds {
  favorite: boolean;
  underdog: boolean;
  moneyLine: number;
  spreadOdds: number;
}

export interface ESBNOdds {
  provider: ESBNOddsProvider;
  details: string;
  overUnder: number;
  spread: number;
  homeTeamOdds: ESPNTeamOdds;
  awayTeamOdds: ESPNTeamOdds;
}

export interface ESPNCompetitorStats {
  name: string;
  abbreviation: string;
  displayValue: string;
  rankDisplayValue?: string;
}

export interface ESPNCompetitor {
  id: string;
  homeAway: 'home' | 'away';
  team: ESPNTeam;
  score: string;
  statistics: ESPNCompetitorStats[];
  leaders?: ESPNCompetitorLeader[];
  records?: { name: string; type: string; summary: string }[];
}

export interface ESPNCompetitorLeader {
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
      shortName: string;
    };
  }[];
}

export interface ESPNCompetition {
  id: string;
  date: string;
  attendance?: number;
  timeValid?: boolean;
  neutralSite?: boolean;
  venue?: {
    id: string;
    fullName: string;
    address?: { city: string; state: string };
    indoor?: boolean;
  };
  competitors: ESPNCompetitor[];
  odds?: ESBNOdds[];
  status?: {
    clock: number;
    displayClock: string;
    period: number;
    type: {
      id: string;
      name: string;
      state: 'pre' | 'in' | 'post';
      completed: boolean;
      description: string;
      detail: string;
    };
  };
}

export interface ESPNEvent {
  id: string;
  uid: string;
  date: string;
  name: string;
  shortName: string;
  season: { year: number; type: number; slug: string };
  competitions: ESPNCompetition[];
  status?: {
    clock: number;
    displayClock: string;
    period: number;
    type: {
      id: string;
      name: string;
      state: 'pre' | 'in' | 'post';
      completed: boolean;
      description: string;
      detail: string;
    };
  };
}

export interface ESBNScoreboardResponse {
  leagues: {
    id: string;
    name: string;
    abbreviation: string;
    slug: string;
    season: { year: number; startDate: string; endDate: string; displayName: string };
    calendarType: string;
    calendar: string[];
  }[];
  season: { type: number; year: number };
  day: { date: string };
  events: ESPNEvent[];
}

// ─── PROCESSED DATA ────────────────────────────────────────────────────────

export interface NbaMatchOdds {
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  status: 'scheduled' | 'in_progress' | 'final';
  venue: { name: string; city: string } | null;
  moneyline: {
    home: number;
    away: number;
    homeImplied: number;
    awayImplied: number;
  };
  spread: {
    line: number;
    homePrice: number;
    awayPrice: number;
  } | null;
  total: {
    line: number;
    overPrice: number;
    underPrice: number;
  } | null;
  teamStats: {
    home: Record<string, string>;
    away: Record<string, string>;
  };
  homeRecord: string;
  awayRecord: string;
  homeLeaders: ESPNCompetitorLeader[];
  awayLeaders: ESPNCompetitorLeader[];
}

export interface NbaMatchFound {
  eventId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  commenceTime: string;
}

// ─── SERVICE ───────────────────────────────────────────────────────────────

@Injectable()
export class ESPNOddsService {
  private readonly logger = new Logger(ESPNOddsService.name);

  private readonly headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Accept: 'application/json',
  };

  constructor(private readonly cacheService: CacheService) {}

  // ─── FETCH ──────────────────────────────────────────────────────────────

  private async fetch<T>(url: string): Promise<T> {
    this.logger.debug(`ESPN Odds → ${url}`);
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) throw new Error(`ESPN Odds ${res.status} — ${url}`);
    return res.json();
  }

  private async safe<T>(url: string, ttlMs: number, cacheKey: string): Promise<T | null> {
    try {
      return await this.cacheService.getOrFetch(cacheKey, () => this.fetch<T>(url), ttlMs);
    } catch (err) {
      this.logger.warn(`ESPN Odds falló (${url}): ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  // ─── SCOREBOARD ──────────────────────────────────────────────────────────

  /**
   * Obtiene todos los partidos NBA de un día específico.
   */
  async getScoreboard(date: string): Promise<ESBNScoreboardResponse | null> {
    // date format: YYYYMMDD (convert from YYYY-MM-DD if needed)
    const dateFormatted = date.replace(/-/g, '');
    const cacheKey = CacheService.buildKey('espn', 'scoreboard', 'nba', dateFormatted);
    const url = `${ESPN_SITE}/sports/basketball/nba/scoreboard?dates=${dateFormatted}`;
    return this.safe<ESBNScoreboardResponse>(url, CacheService.TTL.ODDS_PRE_MATCH, cacheKey);
  }

  // ─── MATCH FINDER ────────────────────────────────────────────────────────

  /**
   * Busca un partido NBA por fecha y nombres de equipo.
   */
  async findNbaMatchByDate(
    homeTeam: string,
    awayTeam: string,
    date: string,
  ): Promise<NbaMatchFound | null> {
    const sb = await this.getScoreboard(date);
    if (!sb?.events?.length) {
      this.logger.warn(`No events found for NBA on ${date}`);
      return null;
    }

    const match = sb.events.find((e) => {
      const comp = e.competitions?.[0];
      if (!comp?.competitors?.length) return false;
      const home = comp.competitors.find((c) => c.homeAway === 'home');
      const away = comp.competitors.find((c) => c.homeAway === 'away');
      if (!home || !away) return false;
      return (
        this.nameMatch(home.team.abbreviation, homeTeam) ||
        this.nameMatch(home.team.location, homeTeam) ||
        this.nameMatch(home.team.name, homeTeam) ||
        this.nameMatch(away.team.abbreviation, awayTeam) ||
        this.nameMatch(away.team.location, awayTeam) ||
        this.nameMatch(away.team.name, awayTeam)
      );
    });

    if (!match) {
      this.logger.warn(`Match not found: ${homeTeam} vs ${awayTeam} on ${date}`);
      return null;
    }

    const comp = match.competitions[0];
    const home = comp.competitors.find((c) => c.homeAway === 'home')!;
    const away = comp.competitors.find((c) => c.homeAway === 'away')!;

    return {
      eventId: match.id,
      homeTeamId: home.team.id,
      awayTeamId: away.team.id,
      homeTeamName: `${home.team.location} ${home.team.name}`,
      awayTeamName: `${away.team.location} ${away.team.name}`,
      commenceTime: comp.date,
    };
  }

  // ─── ODDS EXTRACTOR ─────────────────────────────────────────────────────

  /**
   * Obtiene cuotas y stats de un partido específico.
   */
  async getMatchOdds(eventId: string, homeTeamId?: string, awayTeamId?: string): Promise<NbaMatchOdds | null> {
    const cacheKey = CacheService.buildKey('espn', 'match-odds', eventId);
    const url = `${ESPN_SITE}/sports/basketball/nba/summary?event=${eventId}`;

    const data = await this.safe<ESBNSummaryResponse>(url, CacheService.TTL.ODDS_PRE_MATCH, cacheKey);
    if (!data?.header?.competitions?.[0]) return null;

    const comp = data.header.competitions[0];
    const home = comp.competitors!.find((c) => c.homeAway === 'home');
    const away = comp.competitors!.find((c) => c.homeAway === 'away');
    if (!home || !away) return null;

    const odds = comp.odds?.[0];
    const homeOdds = odds?.homeTeamOdds;
    const awayOdds = odds?.awayTeamOdds;

    // Get leaders from scoreboard if team IDs provided
    let homeLeaders: ESPNCompetitorLeader[] = [];
    let awayLeaders: ESPNCompetitorLeader[] = [];
    if (homeTeamId && awayTeamId) {
      const date = new Date(comp.date).toISOString().split('T')[0].replace(/-/g, '');
      const sb = await this.getScoreboard(date);
      const event = sb?.events.find(e => e.id === eventId);
      if (event) {
        const sbHome = event.competitions?.[0]?.competitors?.find(c => c.homeAway === 'home');
        const sbAway = event.competitions?.[0]?.competitors?.find(c => c.homeAway === 'away');
        homeLeaders = sbHome?.leaders ?? [];
        awayLeaders = sbAway?.leaders ?? [];
      }
    }

    return {
      eventId,
      homeTeam: `${home.team.location} ${home.team.name}`,
      awayTeam: `${away.team.location} ${away.team.name}`,
      commenceTime: comp.date,
      status: this.mapStatus(data.header.competitions[0].status?.type?.state),
      venue: data.gameInfo?.venue
        ? { name: data.gameInfo.venue.name, city: data.gameInfo.venue.city }
        : null,
      moneyline: {
        home: homeOdds?.moneyLine ?? 0,
        away: awayOdds?.moneyLine ?? 0,
        homeImplied: homeOdds?.moneyLine ? this.impliedProb(homeOdds.moneyLine) : 0,
        awayImplied: awayOdds?.moneyLine ? this.impliedProb(awayOdds.moneyLine) : 0,
      },
      spread: odds?.spread != null
        ? {
            line: odds.spread,
            homePrice: homeOdds?.spreadOdds ?? 0,
            awayPrice: awayOdds?.spreadOdds ?? 0,
          }
        : null,
      total: odds?.overUnder != null
        ? {
            line: odds.overUnder,
            overPrice: homeOdds?.spreadOdds ?? -110,
            underPrice: awayOdds?.spreadOdds ?? -110,
          }
        : null,
      teamStats: {
        home: this.buildTeamStats(home),
        away: this.buildTeamStats(away),
      },
      homeRecord: home.records?.find((r) => r.name === 'overall')?.summary ?? '0-0',
      awayRecord: away.records?.find((r) => r.name === 'overall')?.summary ?? '0-0',
      homeLeaders: homeLeaders.length > 0 ? homeLeaders : (home.leaders ?? []),
      awayLeaders: awayLeaders.length > 0 ? awayLeaders : (away.leaders ?? []),
    };
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────

  private nameMatch(a: string, b: string): boolean {
    const na = a.toLowerCase().trim();
    const nb = b.toLowerCase().trim();
    // Handle abbreviations (BOS=Celtics, GS=Warriors, etc.)
    if (na.length <= 3 || nb.length <= 3) return na === nb;
    return na.includes(nb) || nb.includes(na);
  }

  private impliedProb(american: number): number {
    if (american > 0) return 100 / (american + 100);
    return Math.abs(american) / (Math.abs(american) + 100);
  }

  private mapStatus(state?: string): 'scheduled' | 'in_progress' | 'final' {
    if (state === 'in') return 'in_progress';
    if (state === 'post') return 'final';
    return 'scheduled';
  }

  private buildTeamStats(competitor: ESPNCompetitor): Record<string, string> {
    const stats: Record<string, string> = {};
    for (const s of competitor.statistics ?? []) {
      stats[s.name] = s.displayValue;
    }
    return stats;
  }
}

// ─── EXTRA TYPES (summary response) ───────────────────────────────────────

interface ESBNSummaryResponse {
  header?: {
    id: string;
    season?: { year: number; type: number };
    competitions?: ESBNCompetitionSummary[];
  };
  gameInfo?: {
    venue?: { name: string; city: string; address?: { city: string; state: string } };
    attendance?: number;
  };
  boxScore?: {
    teams?: {
      team: { id: string; name: string; abbreviation: string };
      statistics: { name: string; displayValue: string }[];
    }[];
  };
}

interface ESBNCompetitionSummary {
  id: string;
  date: string;
  status?: {
    type?: {
      state?: 'pre' | 'in' | 'post';
      completed?: boolean;
    };
  };
  competitors?: ESPNCompetitor[];
  odds?: ESBNOdds[];
}
