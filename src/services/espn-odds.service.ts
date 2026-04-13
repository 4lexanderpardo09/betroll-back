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
  moneyline?: {
    home?: { close?: { odds?: string }; open?: { odds?: string } };
    away?: { close?: { odds?: string }; open?: { odds?: string } };
  };
  pointSpread?: {
    home?: { close?: { line?: string; odds?: string }; open?: { line?: string; odds?: string } };
    away?: { close?: { line?: string; odds?: string }; open?: { line?: string; odds?: string } };
  };
  total?: {
    over?: { close?: { line?: string; odds?: string }; open?: { line?: string; odds?: string } };
    under?: { close?: { line?: string; odds?: string }; open?: { line?: string; odds?: string } };
  };
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
  /** Boxscore stats for the game (only for past/final games) */
  gameBoxscore?: {
    home: NbaGameBoxscoreTeam;
    away: NbaGameBoxscoreTeam;
  };
}

export interface NbaGameBoxscoreTeam {
  abbreviation: string;
  points: number;
  stats: Record<string, string>;
  players: NbaGameBoxscorePlayer[];
}

export interface NbaGameBoxscorePlayer {
  id: string;
  name: string;
  position: string;
  min: string;
  pts: number;
  fg: string;
  threePt: string;
  ft: string;
  reb: number;
  ast: number;
  to: number;
  stl: number;
  blk: number;
  oreb: number;
  dreb: number;
  pf: number;
  plusMinus: number;
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
   * Obtiene un evento específico del scoreboard por eventId y fecha.
   * Útil para obtener venue, teamStats y odds sin llamar a /summary.
   */
  async getScoreboardEvent(eventId: string, date: string): Promise<ESPNEvent | null> {
    const sb = await this.getScoreboard(date);
    return sb?.events.find(e => e.id === eventId) ?? null;
  }

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
   * Combina datos del scoreboard (venue, teamStats, odds) + summary (boxscore).
   */
  async getMatchOdds(eventId: string, _homeTeamId?: string, _awayTeamId?: string): Promise<NbaMatchOdds | null> {
    const cacheKey = CacheService.buildKey('espn', 'match-odds', eventId);
    const url = `${ESPN_SITE}/sports/basketball/nba/summary?event=${eventId}`;
    const data = await this.safe<ESBNSummaryResponse>(url, CacheService.TTL.ODDS_PRE_MATCH, cacheKey);
    if (!data?.header?.competitions?.[0]) return null;

    const comp = data.header.competitions[0];
    const home = comp.competitors!.find((c) => c.homeAway === 'home');
    const away = comp.competitors!.find((c) => c.homeAway === 'away');
    if (!home || !away) return null;

    // Extraer fecha del header (UTC)
    const dateStr = comp.date;
    const dateFormatted = new Date(dateStr).toISOString().split('T')[0].replace(/-/g, '');

    // Obtener evento completo del scoreboard (tiene venue, odds reales, teamStats)
    // El scoreboard usa fecha US Eastern, no UTC
    // Primero intentamos con la fecha UTC, si no encuentraintentamos con -1 día
    let scoreboardEvent = await this.getScoreboardEvent(eventId, dateFormatted);
    if (!scoreboardEvent) {
      // El evento puede estar indexado en la fecha US anterior (partidos de noche US)
      const usDate = new Date(comp.date);
      usDate.setDate(usDate.getDate() - 1);
      const fallbackDate = usDate.toISOString().split('T')[0].replace(/-/g, '');
      scoreboardEvent = await this.getScoreboardEvent(eventId, fallbackDate);
    }
    const sbComp = scoreboardEvent?.competitions?.[0];

    // Odds del scoreboard (provider ESPN BET)
    const sbOdds = sbComp?.odds?.[0];

    // Venue del scoreboard
    const sbVenue = sbComp?.venue;

    // TeamStats del scoreboard (estadísticas de temporada)
    const sbHome = sbComp?.competitors?.find(c => c.homeAway === 'home');
    const sbAway = sbComp?.competitors?.find(c => c.homeAway === 'away');

    // Leaders del scoreboard
    const homeLeaders = sbHome?.leaders ?? home.leaders ?? [];
    const awayLeaders = sbAway?.leaders ?? away.leaders ?? [];

    // Boxscore (solo para partidos pasados/finalizados)
    // API returns "boxscore" (lowercase s), not "boxScore"
    let gameBoxscore: NbaMatchOdds['gameBoxscore'];
    if (data.boxscore?.teams?.length) {
      const homeTeamIdStr = home.team.id;
      const awayTeamIdStr = away.team.id;

      this.logger.debug(`boxScore: looking for homeTeamId=${homeTeamIdStr} awayTeamId=${awayTeamIdStr}`);
      this.logger.debug(`boxScore teams: ${data.boxscore.teams.map((t: any) => `${t.team.id}(${t.team.abbreviation})`).join(', ')}`);

      const homeBoxTeam = data.boxscore.teams.find((t: any) => t.team.id === homeTeamIdStr);
      const awayBoxTeam = data.boxscore.teams.find((t: any) => t.team.id === awayTeamIdStr);

      const buildBoxTeamStats = (team: ESPNBoxscoreTeam): Record<string, string> => {
        const stats: Record<string, string> = {};
        for (const s of team.statistics) {
          stats[s.name] = s.displayValue;
        }
        return stats;
      };

      const parsePlayersFromGroup = (playerGroup: ESPNBoxscorePlayer): NbaGameBoxscorePlayer[] => {
        const result: NbaGameBoxscorePlayer[] = [];
        const statInfo = playerGroup.statistics?.[0];
        if (!statInfo) return result;
        const labels = statInfo.labels ?? [];
        const athletes = statInfo.athletes ?? [];
        for (const athlete of athletes) {
          if (athlete.didNotPlay) continue;
          const stats: Record<string, string> = {};
          labels.forEach((label: string, i: number) => { stats[label] = athlete.stats[i] ?? '0'; });
          result.push({
            id: athlete.athlete.id,
            name: athlete.athlete.displayName,
            position: athlete.athlete.position?.abbreviation ?? '-',
            min: stats['MIN'] ?? '0',
            pts: parseInt(stats['PTS'] ?? '0', 10),
            fg: stats['FG'] ?? '0-0',
            threePt: stats['3PT'] ?? '0-0',
            ft: stats['FT'] ?? '0-0',
            reb: parseInt(stats['REB'] ?? '0', 10),
            ast: parseInt(stats['AST'] ?? '0', 10),
            to: parseInt(stats['TO'] ?? '0', 10),
            stl: parseInt(stats['STL'] ?? '0', 10),
            blk: parseInt(stats['BLK'] ?? '0', 10),
            oreb: parseInt(stats['OREB'] ?? '0', 10),
            dreb: parseInt(stats['DREB'] ?? '0', 10),
            pf: parseInt(stats['PF'] ?? '0', 10),
            plusMinus: parseInt(stats['+/-'] ?? '0', 10),
          });
        }
        return result;
      };

      const homePlayers: NbaGameBoxscorePlayer[] = [];
      const awayPlayers: NbaGameBoxscorePlayer[] = [];

      if (data.boxscore.players) {
        for (const playerGroup of data.boxscore.players) {
          const teamId = playerGroup.team.id;
          const parsed = parsePlayersFromGroup(playerGroup);
          if (teamId === homeTeamIdStr) homePlayers.push(...parsed);
          else if (teamId === awayTeamIdStr) awayPlayers.push(...parsed);
        }
      }

      const homePts = home.score ?? '0';
      const awayPts = away.score ?? '0';

      if (homeBoxTeam || awayBoxTeam) {
        gameBoxscore = {
          home: {
            abbreviation: homeBoxTeam?.team.abbreviation ?? home.team.abbreviation,
            points: parseInt(homePts, 10),
            stats: homeBoxTeam ? buildBoxTeamStats(homeBoxTeam) : {},
            players: homePlayers.sort((a, b) => b.pts - a.pts),
          },
          away: {
            abbreviation: awayBoxTeam?.team.abbreviation ?? away.team.abbreviation,
            points: parseInt(awayPts, 10),
            stats: awayBoxTeam ? buildBoxTeamStats(awayBoxTeam) : {},
            players: awayPlayers.sort((a, b) => b.pts - a.pts),
          },
        };
        this.logger.log(`boxScore extracted: ${gameBoxscore.home.abbreviation} ${gameBoxscore.home.points}-${gameBoxscore.away.points} ${gameBoxscore.away.abbreviation}`);
        this.logger.log(`Home players: ${gameBoxscore.home.players.length}, Away players: ${gameBoxscore.away.players.length}`);
      }
    }

    return {
      eventId,
      homeTeam: `${home.team.location} ${home.team.name}`,
      awayTeam: `${away.team.location} ${away.team.name}`,
      commenceTime: comp.date,
      status: this.mapStatus(data.header.competitions[0].status?.type?.state),
      venue: sbVenue ? { name: sbVenue.fullName, city: sbVenue.address?.city ?? 'Unknown' } : null,
      moneyline: {
        home: parseInt(sbOdds?.moneyline?.home?.close?.odds ?? '0', 10),
        away: parseInt(sbOdds?.moneyline?.away?.close?.odds ?? '0', 10),
        homeImplied: this.impliedProb(parseInt(sbOdds?.moneyline?.home?.close?.odds ?? '0', 10)),
        awayImplied: this.impliedProb(parseInt(sbOdds?.moneyline?.away?.close?.odds ?? '0', 10)),
      },
      spread: sbOdds?.spread != null
        ? {
            line: sbOdds.spread,
            homePrice: parseInt(sbOdds?.pointSpread?.home?.close?.odds ?? '-110', 10),
            awayPrice: parseInt(sbOdds?.pointSpread?.away?.close?.odds ?? '-110', 10),
          }
        : null,
      total: sbOdds?.overUnder != null
        ? {
            line: sbOdds.overUnder,
            overPrice: parseInt(sbOdds?.total?.over?.close?.odds ?? '-110', 10),
            underPrice: parseInt(sbOdds?.total?.under?.close?.odds ?? '-110', 10),
          }
        : null,
      teamStats: {
        home: this.buildTeamStats(sbHome),
        away: this.buildTeamStats(sbAway),
      },
      homeRecord: sbHome?.records?.find((r) => r.name === 'overall')?.summary ?? '0-0',
      awayRecord: sbAway?.records?.find((r) => r.name === 'overall')?.summary ?? '0-0',
      homeLeaders: homeLeaders.length > 0 ? homeLeaders : (sbHome?.leaders ?? []),
      awayLeaders: awayLeaders.length > 0 ? awayLeaders : (sbAway?.leaders ?? []),
      gameBoxscore,
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

  private buildTeamStats(competitor?: ESPNCompetitor): Record<string, string> {
    if (!competitor) return {};
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
  boxscore?: {
    teams?: ESPNBoxscoreTeam[];
    players?: ESPNBoxscorePlayer[];
  };
  leaders?: {
    category: string;
    leaders: {
      athlete: { id: string; displayName: string };
      value: number;
      rank?: number;
    }[];
  }[];
}

export interface ESPNBoxscoreTeam {
  team: { id: string; abbreviation: string; name: string };
  statistics: {
    name: string;
    displayValue: string;
    value?: number;
  }[];
}

export interface ESPNBoxscorePlayer {
  team: { id: string; abbreviation: string };
  statistics: {
    names: string[];
    keys: string[];
    labels: string[];
    descriptions: string[];
    athletes: {
      athlete: {
        id: string;
        displayName: string;
        fullName: string;
        position?: { abbreviation: string };
      };
      stats: string[]; // aligned with labels array
      starter?: boolean;
      didNotPlay?: boolean;
    }[];
    totals?: string[];
  }[];
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
