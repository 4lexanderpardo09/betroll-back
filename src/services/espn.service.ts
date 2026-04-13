import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * ESPNQualitativeService
 *
 * Fuente exclusiva de contexto CUALITATIVO para el modelo de IA.
 * NO maneja estadísticas (eso es Sofascore/RapidAPI) ni cuotas (eso es The Odds API).
 *
 * Qué aporta al modelo:
 *  - Lesiones y estado de jugadores clave
 *  - Noticias recientes del equipo
 *  - Forma actual (racha, posición en tabla)
 *  - Contexto del partido (local/visitante, sede, historial H2H)
 *  - Perfil y disponibilidad de atletas
 */

// ─── CONFIG ────────────────────────────────────────────────────────────────

const ESPN_URLS = {
  site: 'https://site.api.espn.com/apis/site/v2',
  core: 'https://sports.core.api.espn.com/v2',
  web: 'https://site.web.api.espn.com/apis/common/v3',
  cdn: 'https://cdn.espn.com/core',
  now: 'https://now.core.api.espn.com/v1/sports',
} as const;

// ─── SERVICE ───────────────────────────────────────────────────────────────

@Injectable()
export class ESPNService {
  private readonly logger = new Logger(ESPNService.name);

  private readonly headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Accept: 'application/json',
  };

  constructor(private readonly cacheService: CacheService) {}

  // ─── FETCH BASE ──────────────────────────────────────────────────────────

  private async fetch<T>(url: string): Promise<T> {
    this.logger.debug(`ESPN Qualitative → ${url}`);
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) throw new Error(`ESPN ${res.status} — ${url}`);
    return res.json();
  }

  private async safe<T>(url: string, ttlMs: number, cacheKey: string): Promise<T | null> {
    try {
      return await this.cacheService.getOrFetch(
        cacheKey,
        () => this.fetch<T>(url),
        ttlMs,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`ESPN endpoint falló (${url}): ${message}`);
      return null;
    }
  }

  private siteUrl(sport: string, league: string, resource: string): string {
    return `${ESPN_URLS.site}/sports/${sport}/${league}/${resource}`;
  }

  private coreUrl(sport: string, league: string, path: string): string {
    return `${ESPN_URLS.core}/sports/${sport}/leagues/${league}/${path}`;
  }

  // ─── NOTICIAS ────────────────────────────────────────────────────────────

  /**
   * Noticias recientes de la liga — titulares, lesiones reportadas, traspasos.
   * Fuente principal de contexto narrativo para la IA.
   */
  async getLeagueNews(
    sport: string,
    league: string,
    limit = 20,
  ): Promise<ESPNNewsItem[]> {
    const url = `${this.siteUrl(sport, league, 'news')}?limit=${limit}`;
    const data = await this.safe<ESPNNewsResponse>(
      url,
      CacheService.TTL.NEWS,
      CacheService.buildKey('espn', 'news', sport, league),
    );
    return data?.articles ?? [];
  }

  /**
   * Noticias de un equipo específico
   */
  async getTeamNews(
    sport: string,
    league: string,
    teamId: string,
    limit = 10,
  ): Promise<ESPNNewsItem[]> {
    const url = `${this.siteUrl(sport, league, `teams/${teamId}/news`)}?limit=${limit}`;
    const data = await this.safe<ESPNNewsResponse>(
      url,
      CacheService.TTL.NEWS,
      CacheService.buildKey('espn', 'team-news', sport, league, teamId),
    );
    return data?.articles ?? [];
  }

  // ─── LESIONES ────────────────────────────────────────────────────────────

  /**
   * Reporte de lesiones de toda la liga.
   * CRÍTICO para la IA — saber quién no juega cambia completamente el análisis.
   */
  async getInjuries(sport: string, league: string): Promise<ESPNInjury[]> {
    const url = this.siteUrl(sport, league, 'injuries');
    const data = await this.safe<ESPNInjuriesResponse>(
      url,
      CacheService.TTL.INJURIES,
      CacheService.buildKey('espn', 'injuries', sport, league),
    );
    return data?.injuries ?? [];
  }

  /**
   * Lesiones filtradas por equipo
   */
  async getTeamInjuries(
    sport: string,
    league: string,
    teamId: string,
  ): Promise<ESPNInjury[]> {
    const all = await this.getInjuries(sport, league);
    return all.filter((i) => i.player?.team?.id === teamId);
  }

  /**
   * Resumen de lesiones por equipo — formato limpio para prompt de IA
   */
  async getInjurySummaryForAI(
    sport: string,
    league: string,
    teamId: string,
  ): Promise<string> {
    const injuries = await this.getTeamInjuries(sport, league, teamId);
    if (!injuries.length) return 'Sin lesiones reportadas.';

    return injuries
      .map((i) => {
        const player = i.player?.displayName ?? 'Jugador desconocido';
        const pos = i.player?.position?.abbreviation ?? '?';
        const status = i.type?.description ?? i.shortDetail ?? 'Estado desconocido';
        const returnDate = i.returnDate ? ` — Regreso estimado: ${i.returnDate}` : '';
        return `• ${player} (${pos}): ${status}${returnDate}`;
      })
      .join('\n');
  }

  // ─── STANDINGS / FORMA ───────────────────────────────────────────────────

  /**
   * Tabla de posiciones — forma actual del equipo, racha, wins/losses
   */
  async getStandings(sport: string, league: string): Promise<ESPNStandingsEntry[]> {
    const url = this.siteUrl(sport, league, 'standings');
    const data = await this.safe<ESPNStandingsResponse>(
      url,
      CacheService.TTL.STANDINGS,
      CacheService.buildKey('espn', 'standings', sport, league),
    );

    const entries: ESPNStandingsEntry[] = [];
    for (const group of data?.children ?? []) {
      for (const entry of group.standings?.entries ?? []) {
        entries.push(entry);
      }
    }
    return entries;
  }

  /**
   * Forma de un equipo específico — posición, racha, record
   */
  async getTeamForm(
    sport: string,
    league: string,
    teamId: string,
  ): Promise<ESPNTeamFormSummary | null> {
    const standings = await this.getStandings(sport, league);
    const entry = standings.find((e) => e.team.id === teamId);
    if (!entry) return null;

    const stats = Object.fromEntries(
      entry.stats.map((s) => [s.name, s.displayValue]),
    );

    return {
      teamId,
      teamName: entry.team.displayName ?? entry.team.name,
      wins: stats['wins'] ?? '?',
      losses: stats['losses'] ?? '?',
      winPercent: stats['winPercent'] ?? '?',
      streak: stats['streak'] ?? stats['gamesBehind'] ?? '?',
      pointsFor: stats['pointsFor'] ?? stats['avgPointsFor'] ?? null,
      pointsAgainst: stats['pointsAgainst'] ?? stats['avgPointsAgainst'] ?? null,
      raw: stats,
    };
  }

  // ─── ROSTER / PLANTILLA ──────────────────────────────────────────────────

  /**
   * Roster completo del equipo con estado de cada jugador
   */
  async getTeamRoster(
    sport: string,
    league: string,
    teamId: string,
  ): Promise<ESPNRosterResponse | null> {
    const url = this.siteUrl(sport, league, `teams/${teamId}/roster`);
    return this.safe<ESPNRosterResponse>(
      url,
      CacheService.TTL.ROSTER,
      CacheService.buildKey('espn', 'roster', sport, league, teamId),
    );
  }

  /**
   * Lista de jugadores activos (sin lesionados/suspendidos)
   */
  async getActivePlayersForAI(
    sport: string,
    league: string,
    teamId: string,
  ): Promise<string> {
    const roster = await this.getTeamRoster(sport, league, teamId);
    if (!roster?.athletes?.length) return 'Roster no disponible.';

    const active = roster.athletes.filter(
      (a) => !a.status || a.status?.name === 'Active',
    );

    return active
      .map((a) => `${a.fullName} (${a.position?.abbreviation ?? '?'}) #${a.jersey ?? '-'}`)
      .join(', ');
  }

  // ─── CALENDARIO ──────────────────────────────────────────────────────────

  /**
   * Últimos N partidos del equipo — para analizar forma reciente
   */
  async getTeamSchedule(
    sport: string,
    league: string,
    teamId: string,
  ): Promise<ESPNScheduleEvent[]> {
    const url = this.siteUrl(sport, league, `teams/${teamId}/schedule`);
    const data = await this.safe<ESPNScheduleResponse>(
      url,
      CacheService.TTL.SCHEDULE,
      CacheService.buildKey('espn', 'schedule', sport, league, teamId),
    );
    return data?.events ?? [];
  }

  /**
   * Últimos N resultados (partidos ya jugados)
   */
  async getRecentResults(
    sport: string,
    league: string,
    teamId: string,
    limit = 5,
  ): Promise<string> {
    const events = await this.getTeamSchedule(sport, league, teamId);
    const played = events
      .filter((e) => e.competitions?.[0]?.status?.type?.completed)
      .slice(-limit);

    if (!played.length) return 'Sin resultados recientes.';

    return played
      .map((e) => {
        const comp = e.competitions?.[0];
        const home = comp?.competitors?.find((c) => c.homeAway === 'home');
        const away = comp?.competitors?.find((c) => c.homeAway === 'away');
        const date = new Date(e.date).toLocaleDateString('es-MX');
        return `${date} — ${away?.team?.abbreviation} ${away?.score ?? '?'} @ ${home?.team?.abbreviation} ${home?.score ?? '?'}`;
      })
      .join('\n');
  }

  // ─── GAME SUMMARY ────────────────────────────────────────────────────────

  /**
   * Resumen del partido — boxscore, venue, árbitros, historial de la serie
   */
  async getGameSummary(
    sport: string,
    league: string,
    eventId: string,
  ): Promise<ESPNGameSummary | null> {
    const url = `${this.siteUrl(sport, league, 'summary')}?event=${eventId}`;
    return this.safe<ESPNGameSummary>(
      url,
      CacheService.TTL.MATCH_STATS,
      CacheService.buildKey('espn', 'summary', sport, league, eventId),
    );
  }

  // ─── ATLETAS ─────────────────────────────────────────────────────────────

  /**
   * Perfil completo del atleta — stats de temporada, historial
   */
  async getAthleteOverview(
    sport: string,
    league: string,
    athleteId: string,
  ): Promise<ESPNAthleteOverview | null> {
    const url = `${ESPN_URLS.web}/sports/${sport}/${league}/athletes/${athleteId}/overview`;
    return this.safe<ESPNAthleteOverview>(
      url,
      CacheService.TTL.ATHLETE,
      CacheService.buildKey('espn', 'athlete-overview', athleteId),
    );
  }

  /**
   * Game log del atleta — rendimiento en últimos partidos
   */
  async getAthleteGameLog(
    sport: string,
    league: string,
    athleteId: string,
  ): Promise<ESPNAthleteGameLog | null> {
    const url = `${ESPN_URLS.web}/sports/${sport}/${league}/athletes/${athleteId}/gamelog`;
    return this.safe<ESPNAthleteGameLog>(
      url,
      CacheService.TTL.ATHLETE,
      CacheService.buildKey('espn', 'athlete-gamelog', athleteId),
    );
  }

  /**
   * Splits del atleta — rendimiento home vs away, vs rivales, etc.
   */
  async getAthleteSplits(
    sport: string,
    league: string,
    athleteId: string,
  ): Promise<ESPNAthleteSplits | null> {
    const url = `${ESPN_URLS.web}/sports/${sport}/${league}/athletes/${athleteId}/splits`;
    return this.safe<ESPNAthleteSplits>(
      url,
      CacheService.TTL.ATHLETE,
      CacheService.buildKey('espn', 'athlete-splits', athleteId),
    );
  }

  // ─── BÚSQUEDA ────────────────────────────────────────────────────────────

  /**
   * Buscar jugador o equipo por nombre — devuelve IDs para usar en otros endpoints
   */
  async search(query: string, limit = 5): Promise<ESPNSearchResult[]> {
    const url = `${ESPN_URLS.web}/search?query=${encodeURIComponent(query)}&limit=${limit}`;
    const data = await this.safe<ESPNSearchResponse>(
      url,
      CacheService.TTL.SEARCH,
      CacheService.buildKey('espn', 'search', query),
    );
    return data?.results ?? [];
  }

  // ─── MÉTODO PRINCIPAL — CONTEXTO CUALITATIVO PARA LA IA ─────────────────

  /**
   * getQualitativeContext
   *
   * Método principal que compila TODO el contexto cualitativo de un partido.
   * La IA recibe esto junto con los stats (RapidAPI) y las cuotas (The Odds API)
   * para generar la recomendación de apuesta.
   *
   * @param sport   'football' | 'basketball' | 'baseball' | 'hockey' | 'soccer'
   * @param league  'nfl' | 'nba' | 'mlb' | 'nhl' | 'eng.1' | etc.
   * @param eventId ID del partido en ESPN
   * @param homeTeamId ID del equipo local
   * @param awayTeamId ID del equipo visitante
   */
  async getQualitativeContext(
    sport: string,
    league: string,
    eventId: string,
    homeTeamId: string,
    awayTeamId: string,
  ): Promise<QualitativeContext> {
    this.logger.log(`Compilando contexto cualitativo: ${sport}/${league} — evento ${eventId}`);

    const [
      homeSummary,
      awaySummary,
      homeNews,
      awayNews,
      homeInjuries,
      awayInjuries,
      leagueNews,
      gameSummary,
    ] = await Promise.allSettled([
      this.getTeamForm(sport, league, homeTeamId),
      this.getTeamForm(sport, league, awayTeamId),
      this.getTeamNews(sport, league, homeTeamId),
      this.getTeamNews(sport, league, awayTeamId),
      this.getInjurySummaryForAI(sport, league, homeTeamId),
      this.getInjurySummaryForAI(sport, league, awayTeamId),
      this.getLeagueNews(sport, league, 10),
      this.getGameSummary(sport, league, eventId),
    ]);

    const [homeResults, awayResults] = await Promise.all([
      this.getRecentResults(sport, league, homeTeamId, 5),
      this.getRecentResults(sport, league, awayTeamId, 5),
    ]);

    return {
      eventId,
      sport,
      league,
      home: {
        teamId: homeTeamId,
        form: this.resolve(homeSummary),
        recentResults: homeResults,
        injuries: this.resolve(homeInjuries) ?? 'Sin datos',
        news: this.resolve(homeNews)
          ?.slice(0, 3)
          .map((n) => n.headline) ?? [],
      },
      away: {
        teamId: awayTeamId,
        form: this.resolve(awaySummary),
        recentResults: awayResults,
        injuries: this.resolve(awayInjuries) ?? 'Sin datos',
        news: this.resolve(awayNews)
          ?.slice(0, 3)
          .map((n) => n.headline) ?? [],
      },
      leagueHeadlines: this.resolve(leagueNews)
        ?.slice(0, 5)
        .map((n) => n.headline) ?? [],
      gameInfo: {
        venue: this.resolve(gameSummary)?.gameInfo?.venue ?? null,
        series: this.resolve(gameSummary)?.series ?? null,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * toAIPrompt
   *
   * Convierte el contexto cualitativo a texto listo para inyectar al prompt de la IA.
   * Úsalo así:
   *
   *   const context = await espnService.getQualitativeContext(...);
   *   const prompt = espnService.toAIPrompt(context);
   *   // + agrega stats de RapidAPI y cuotas de The Odds API al mismo prompt
   */
  toAIPrompt(ctx: QualitativeContext): string {
    return `
=== CONTEXTO CUALITATIVO (ESPN) ===

PARTIDO: ${ctx.home.form?.teamName ?? ctx.home.teamId} vs ${ctx.away.form?.teamName ?? ctx.away.teamId}
SEDE: ${ctx.gameInfo.venue ? `${ctx.gameInfo.venue.name}, ${ctx.gameInfo.venue.city}` : 'No disponible'}

--- EQUIPO LOCAL: ${ctx.home.form?.teamName ?? ctx.home.teamId} ---
Forma actual: ${ctx.home.form?.wins ?? '?'}W - ${ctx.home.form?.losses ?? '?'}L (${ctx.home.form?.winPercent ?? '?'})
Racha: ${ctx.home.form?.streak ?? '?'}
Últimos 5 partidos:
${ctx.home.recentResults}
Lesiones:
${ctx.home.injuries}
Noticias recientes:
${ctx.home.news.map((h) => `• ${h}`).join('\n') || '• Sin noticias'}

--- EQUIPO VISITANTE: ${ctx.away.form?.teamName ?? ctx.away.teamId} ---
Forma actual: ${ctx.away.form?.wins ?? '?'}W - ${ctx.away.form?.losses ?? '?'}L (${ctx.away.form?.winPercent ?? '?'})
Racha: ${ctx.away.form?.streak ?? '?'}
Últimos 5 partidos:
${ctx.away.recentResults}
Lesiones:
${ctx.away.injuries}
Noticias recientes:
${ctx.away.news.map((h) => `• ${h}`).join('\n') || '• Sin noticias'}

--- TITULARES DE LA LIGA ---
${ctx.leagueHeadlines.map((h) => `• ${h}`).join('\n') || '• Sin titulares'}
${ctx.gameInfo.series ? `\nHISTORIAL DE SERIE: ${ctx.gameInfo.series.summary}` : ''}

=== FIN CONTEXTO CUALITATIVO ===
`.trim();
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────

  private resolve<T>(result: PromiseSettledResult<T>): T | null {
    return result.status === 'fulfilled' ? result.value : null;
  }
}

// ─── TYPES ─────────────────────────────────────────────────────────────────

// --- News ---
export interface ESPNNewsResponse {
  articles: ESPNNewsItem[];
}

export interface ESPNNewsItem {
  id: string;
  headline: string;
  description?: string;
  published?: string;
  lastModified?: string;
  type?: string;
  premium?: boolean;
  links?: { web?: { href: string } };
  categories?: { description: string; type: string }[];
  image?: { name: string; url: string };
}

// --- Injuries ---
export interface ESPNInjuriesResponse {
  injuries: ESPNInjury[];
}

export interface ESPNInjury {
  id: string;
  type: {
    id: string;
    name: string;
    description: string;
  };
  detail: string;
  shortDetail: string;
  longDetail?: string;
  returnDate?: string;
  player?: {
    id: string;
    displayName: string;
    fullName: string;
    position?: { abbreviation: string; name: string };
    team?: { id: string; name: string; abbreviation: string };
    headshot?: { href: string };
    jersey?: string;
    age?: number;
  };
}

// --- Standings ---
export interface ESPNStandingsResponse {
  children: {
    name: string;
    standings: {
      entries: ESPNStandingsEntry[];
    };
  }[];
}

export interface ESPNStandingsEntry {
  team: {
    id: string;
    name: string;
    displayName?: string;
    abbreviation?: string;
    logo?: string;
  };
  stats: {
    name: string;
    displayName: string;
    displayValue: string;
    value?: number;
  }[];
}

// --- Team Form (computed) ---
export interface ESPNTeamFormSummary {
  teamId: string;
  teamName: string;
  wins: string;
  losses: string;
  winPercent: string;
  streak: string;
  pointsFor: string | null;
  pointsAgainst: string | null;
  raw: Record<string, string>;
}

// --- Roster ---
export interface ESPNRosterResponse {
  team: { id: string; name: string; abbreviation: string };
  athletes: {
    id: string;
    fullName: string;
    displayName: string;
    jersey?: string;
    position?: { abbreviation: string; name: string };
    height?: string;
    weight?: string;
    age?: number;
    status?: { id: string; name: string };
    experience?: { years: number };
  }[];
}

// --- Schedule ---
export interface ESPNScheduleResponse {
  events: ESPNScheduleEvent[];
}

export interface ESPNScheduleEvent {
  id: string;
  date: string;
  name: string;
  competitions?: {
    status?: { type?: { completed?: boolean } };
    competitors?: {
      homeAway: 'home' | 'away';
      score?: string;
      team?: { abbreviation: string; displayName: string };
    }[];
  }[];
}

// --- Game Summary ---
export interface ESPNGameSummary {
  header?: { id: string };
  gameInfo?: {
    venue?: { name: string; city: string };
    attendance?: number;
    officials?: { name: string; role: string }[];
  };
  boxScore?: {
    teams?: {
      team: { id: string; name: string };
      statistics: { name: string; displayValue: string }[];
    }[];
  };
  series?: {
    type: string;
    title: string;
    summary: string;
  };
}

// --- Athlete ---
export interface ESPNAthleteOverview {
  athlete: {
    id: string;
    displayName: string;
    position?: { name: string };
    team?: { name: string };
  };
  stats?: {
    name: string;
    displayValue: string;
  }[];
}

export interface ESPNAthleteGameLog {
  athlete: { id: string; displayName: string };
  seasonTypes?: {
    categories?: {
      events?: {
        gameId: string;
        date: string;
        stats: string[];
      }[];
    }[];
  }[];
}

export interface ESPNAthleteSplits {
  athlete: { id: string; displayName: string };
  categories?: {
    name: string;
    displayName: string;
    splits?: {
      name: string;
      displayName: string;
      stats: string[];
    }[];
  }[];
}

// --- Search ---
export interface ESPNSearchResponse {
  results: ESPNSearchResult[];
}

export interface ESPNSearchResult {
  id: string;
  type: string;
  displayName: string;
  shortDisplayName?: string;
  uid?: string;
  links?: { href: string }[];
}

// --- Qualitative Context (output principal) ---
export interface QualitativeContext {
  eventId: string;
  sport: string;
  league: string;
  home: TeamQualitativeData;
  away: TeamQualitativeData;
  leagueHeadlines: string[];
  gameInfo: {
    venue: { name: string; city: string } | null;
    series: { type: string; title: string; summary: string } | null;
  };
  generatedAt: string;
}

export interface TeamQualitativeData {
  teamId: string;
  form: ESPNTeamFormSummary | null;
  recentResults: string;
  injuries: string;
  news: string[];
}