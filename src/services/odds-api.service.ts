import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ─────────────────────────────────────────────
// INTERFACES RAW (respuesta directa de la API)
// ─────────────────────────────────────────────

interface RawOutcome {
  name: string;
  price: number;
  point?: number;
  description?: string; // player props traen el nombre del jugador aquí
}

interface RawMarket {
  key: string;
  last_update?: string;
  outcomes: RawOutcome[];
}

interface RawBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: RawMarket[];
}

interface RawEvent {
  id: string;
  sport_key: string;
  sport_title?: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: RawBookmaker[];
  completed?: boolean;
  scores?: { name: string; score: string }[] | null;
  last_update?: string | null;
}

// ─────────────────────────────────────────────
// INTERFACES PROCESADAS (lo que le pasas al LLM)
// ─────────────────────────────────────────────

export interface BookmakerOdds {
  bookmaker: string;
  bookmakerTitle: string;
  price: number;
}

export interface TeamMarketOdds {
  homeTeam: string;
  awayTeam: string;
  // Moneyline
  moneyline: {
    home: BookmakerOdds[];
    away: BookmakerOdds[];
    consensus: { home: number; away: number }; // mejor cuota de cada lado
    range: { min: number; max: number };        // rango entre casas
    impliedProbHome: number;                    // prob implícita promedio
    impliedProbAway: number;
  };
  // Spread
  spread: {
    line: number;                               // punto más común
    home: BookmakerOdds[];
    away: BookmakerOdds[];
    consensus: { homePrice: number; awayPrice: number };
    openingLine?: number;                       // si hay movimiento
  } | null;
  // Total
  total: {
    line: number;
    over: BookmakerOdds[];
    under: BookmakerOdds[];
    consensus: { overPrice: number; underPrice: number };
    range: { min: number; max: number };        // rango de líneas entre casas
  } | null;
}

export interface PlayerPropLine {
  player: string;
  market: string;          // 'player_points', 'player_rebounds', etc.
  marketLabel: string;     // 'Puntos', 'Rebotes', etc.
  line: number;
  overPrice: number;
  underPrice: number;
  bookmaker: string;
  impliedProbOver: number;
  impliedProbUnder: number;
}

export interface PlayerPropsData {
  homeTeam: string;
  awayTeam: string;
  props: PlayerPropLine[];
  // Agrupado por jugador para fácil acceso
  byPlayer: Record<string, PlayerPropLine[]>;
}

export interface MatchScore {
  id: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  completed: boolean;
  homeScore: string | null;
  awayScore: string | null;
  lastUpdate: string | null;
}

export interface EventInfo {
  id: string;
  sportKey: string;
  sportTitle: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
}

// ─────────────────────────────────────────────
// DATOS COMPLETOS PARA EL LLM (un solo objeto)
// ─────────────────────────────────────────────

export interface CompleteMatchOddsData {
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  teamOdds: TeamMarketOdds;
  playerProps: PlayerPropsData;
  recentScores: MatchScore[];   // forma reciente (últimos 3 días)
  apiUsage: {
    remaining: string | null;
    used: string | null;
    estimatedCostThisCall: number;
  };
}

// ─────────────────────────────────────────────
// HELPERS DE PROBABILIDAD
// ─────────────────────────────────────────────

function americanToDecimal(american: number): number {
  if (american > 0) return american / 100 + 1;
  return 100 / Math.abs(american) + 1;
}

function impliedProbability(american: number): number {
  const decimal = americanToDecimal(american);
  return parseFloat((1 / decimal).toFixed(4));
}

function averagePrice(odds: BookmakerOdds[]): number {
  if (!odds.length) return 0;
  const sum = odds.reduce((acc, o) => acc + o.price, 0);
  return Math.round(sum / odds.length);
}

// ─────────────────────────────────────────────
// SPORT KEY MAP
// ─────────────────────────────────────────────

const SPORT_KEY_MAP: Record<string, string> = {
  NBA: 'basketball_nba',
  NFL: 'americanfootball_nfl',
  MLB: 'baseball_mlb',
  NHL: 'icehockey_nhl',
  EPL: 'soccer_epl',
  MLS: 'soccer_usa_mls',
  TENNIS_ATP: 'tennis_atp',
  TENNIS_WTA: 'tennis_wta',
  MMA: 'mma_mixed_martial_arts',
};

// Mercados de props que usamos para el análisis
const PLAYER_PROP_MARKETS = [
  'player_points',
  'player_rebounds',
  'player_assists',
  'player_threes',
  'player_points_rebounds_assists',
  'player_points_rebounds',
  'player_points_assists',
  'player_blocks',
  'player_steals',
];

const PLAYER_PROP_LABELS: Record<string, string> = {
  player_points: 'Puntos',
  player_rebounds: 'Rebotes',
  player_assists: 'Asistencias',
  player_threes: 'Triples',
  player_points_rebounds_assists: 'PRA',
  player_points_rebounds: 'Puntos+Rebotes',
  player_points_assists: 'Puntos+Asistencias',
  player_blocks: 'Tapones',
  player_steals: 'Robos',
};

// ─────────────────────────────────────────────
// SERVICIO PRINCIPAL
// ─────────────────────────────────────────────

@Injectable()
export class OddsApiService {
  private readonly baseUrl = 'https://api.the-odds-api.com/v4';
  private readonly logger = new Logger(OddsApiService.name);

  // Guardamos el último header de uso para reportarlo
  private lastUsage = { remaining: null as string | null, used: null as string | null };

  constructor(private configService: ConfigService) {}

  private get apiKey(): string {
    const key = this.configService.get<string>('ODDS_API_KEY');
    if (!key) throw new Error('ODDS_API_KEY not configured');
    return key;
  }

  static getSportKey(sport: string): string {
    return SPORT_KEY_MAP[sport.toUpperCase()] ?? 'basketball_nba';
  }

  // ─────────────────────────────────────────────
  // MÉTODO PRINCIPAL — trae todo lo que el LLM necesita
  // ─────────────────────────────────────────────

  /**
   * Orquesta todas las llamadas necesarias para un partido.
   * Retorna un objeto listo para inyectar en el prompt del LLM.
   *
   * Costo estimado: ~10 créditos por partido
   *   - /events:               0
   *   - /odds (3 mercados):    3
   *   - /events/{id}/odds (5 props): 5
   *   - /scores:               2
   */
  async getCompleteMatchData(
    sport: string,
    homeTeam: string,
    awayTeam: string,
    matchDate: string, // ISO: '2026-04-11'
  ): Promise<CompleteMatchOddsData> {
    const sportKey = OddsApiService.getSportKey(sport);

    // 1. Obtener ID del evento (gratis)
    const event = await this.findEvent(sportKey, homeTeam, awayTeam, matchDate);
    if (!event) {
      throw new InternalServerErrorException(
        `Evento no encontrado: ${homeTeam} vs ${awayTeam} en ${matchDate}`,
      );
    }

    this.logger.log(`Evento encontrado: ${event.id} — ${event.homeTeam} vs ${event.awayTeam}`);

    // 2. Cuotas de equipo: ML + spread + total (costo: 3)
    const teamOdds = await this.getTeamMarketOdds(sportKey, event.id, event.homeTeam, event.awayTeam);

    // 3. Props de jugadores (costo: 5)
    const playerProps = await this.getPlayerProps(sportKey, event.id, event.homeTeam, event.awayTeam);

    // 4. Forma reciente — últimos 3 días (costo: 2)
    const recentScores = await this.getRecentScores(sportKey);

    return {
      eventId: event.id,
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
      commenceTime: event.commenceTime,
      teamOdds,
      playerProps,
      recentScores,
      apiUsage: {
        remaining: this.lastUsage.remaining,
        used: this.lastUsage.used,
        estimatedCostThisCall: 10,
      },
    };
  }

  // ─────────────────────────────────────────────
  // PASO 1 — Buscar el evento (gratis)
  // ─────────────────────────────────────────────

  async findEvent(
    sportKey: string,
    homeTeam: string,
    awayTeam: string,
    matchDate: string,
  ): Promise<EventInfo | null> {
    const from = `${matchDate}T00:00:00Z`;
    const to = `${matchDate}T23:59:59Z`;

    const params = new URLSearchParams({
      apiKey: this.apiKey,
      commenceTimeFrom: from,
      commenceTimeTo: to,
    });

    const url = `${this.baseUrl}/sports/${sportKey}/events?${params}`;
    this.logger.debug(`[findEvent] GET ${url}`);

    const res = await this.fetch<RawEvent[]>(url);

    const match = res.find(
      (e) =>
        this.nameMatch(e.home_team, homeTeam) ||
        this.nameMatch(e.away_team, awayTeam) ||
        this.nameMatch(e.home_team, awayTeam) ||  // por si vienen invertidos
        this.nameMatch(e.away_team, homeTeam),
    );

    if (!match) return null;

    return {
      id: match.id,
      sportKey: match.sport_key,
      sportTitle: match.sport_title ?? sportKey,
      commenceTime: match.commence_time,
      homeTeam: match.home_team,
      awayTeam: match.away_team,
    };
  }

  // ─────────────────────────────────────────────
  // PASO 2 — Cuotas de equipo ML + spread + total
  // ─────────────────────────────────────────────

  async getTeamMarketOdds(
    sportKey: string,
    eventId: string,
    homeTeam: string,
    awayTeam: string,
  ): Promise<TeamMarketOdds> {
    const params = new URLSearchParams({
      apiKey: this.apiKey,
      regions: 'us',                         // DraftKings, FanDuel, BetMGM, Caesars — suficiente
      markets: 'h2h,spreads,totals',
      oddsFormat: 'american',
      eventIds: eventId,
    });

    const url = `${this.baseUrl}/sports/${sportKey}/odds?${params}`;
    this.logger.debug(`[getTeamMarketOdds] GET ${url}`);

    const events = await this.fetch<RawEvent[]>(url);
    const event = events.find((e) => e.id === eventId);

    if (!event?.bookmakers?.length) {
      this.logger.warn(`Sin cuotas de equipo para eventId: ${eventId}`);
      return this.emptyTeamOdds(homeTeam, awayTeam);
    }

    return this.parseTeamOdds(event, homeTeam, awayTeam);
  }

  private parseTeamOdds(event: RawEvent, homeTeam: string, awayTeam: string): TeamMarketOdds {
    const bookmakers = event.bookmakers ?? [];

    // ── Moneyline ──
    const homeML: BookmakerOdds[] = [];
    const awayML: BookmakerOdds[] = [];

    for (const bk of bookmakers) {
      const h2h = bk.markets.find((m) => m.key === 'h2h');
      if (!h2h) continue;
      const homeOut = h2h.outcomes.find((o) => this.nameMatch(o.name, event.home_team));
      const awayOut = h2h.outcomes.find((o) => this.nameMatch(o.name, event.away_team));
      if (homeOut) homeML.push({ bookmaker: bk.key, bookmakerTitle: bk.title, price: homeOut.price });
      if (awayOut) awayML.push({ bookmaker: bk.key, bookmakerTitle: bk.title, price: awayOut.price });
    }

    const homeMLPrices = homeML.map((o) => o.price);
    const awayMLPrices = awayML.map((o) => o.price);

    const avgHomeML = averagePrice(homeML);
    const avgAwayML = averagePrice(awayML);

    // ── Spread ──
    let spreadResult: TeamMarketOdds['spread'] = null;
    const homeSpreadOdds: BookmakerOdds[] = [];
    const awaySpreadOdds: BookmakerOdds[] = [];
    const spreadLines: number[] = [];

    for (const bk of bookmakers) {
      const spreadMkt = bk.markets.find((m) => m.key === 'spreads');
      if (!spreadMkt) continue;
      const homeOut = spreadMkt.outcomes.find((o) => this.nameMatch(o.name, event.home_team));
      const awayOut = spreadMkt.outcomes.find((o) => this.nameMatch(o.name, event.away_team));
      if (homeOut) {
        homeSpreadOdds.push({ bookmaker: bk.key, bookmakerTitle: bk.title, price: homeOut.price });
        if (homeOut.point !== undefined) spreadLines.push(homeOut.point);
      }
      if (awayOut) {
        awaySpreadOdds.push({ bookmaker: bk.key, bookmakerTitle: bk.title, price: awayOut.price });
      }
    }

    if (homeSpreadOdds.length) {
      // Línea más frecuente (moda)
      const consensusLine = this.mode(spreadLines) ?? spreadLines[0] ?? 0;
      spreadResult = {
        line: consensusLine,
        home: homeSpreadOdds,
        away: awaySpreadOdds,
        consensus: {
          homePrice: averagePrice(homeSpreadOdds),
          awayPrice: averagePrice(awaySpreadOdds),
        },
      };
    }

    // ── Total ──
    let totalResult: TeamMarketOdds['total'] = null;
    const overOdds: BookmakerOdds[] = [];
    const underOdds: BookmakerOdds[] = [];
    const totalLines: number[] = [];

    for (const bk of bookmakers) {
      const totalMkt = bk.markets.find((m) => m.key === 'totals');
      if (!totalMkt) continue;
      const overOut = totalMkt.outcomes.find((o) => o.name === 'Over');
      const underOut = totalMkt.outcomes.find((o) => o.name === 'Under');
      if (overOut) {
        overOdds.push({ bookmaker: bk.key, bookmakerTitle: bk.title, price: overOut.price });
        if (overOut.point !== undefined) totalLines.push(overOut.point);
      }
      if (underOut) {
        underOdds.push({ bookmaker: bk.key, bookmakerTitle: bk.title, price: underOut.price });
      }
    }

    if (overOdds.length) {
      const consensusLine = this.mode(totalLines) ?? totalLines[0] ?? 0;
      totalResult = {
        line: consensusLine,
        over: overOdds,
        under: underOdds,
        consensus: {
          overPrice: averagePrice(overOdds),
          underPrice: averagePrice(underOdds),
        },
        range: {
          min: Math.min(...totalLines),
          max: Math.max(...totalLines),
        },
      };
    }

    return {
      homeTeam: event.home_team,
      awayTeam: event.away_team,
      moneyline: {
        home: homeML,
        away: awayML,
        consensus: { home: avgHomeML, away: avgAwayML },
        range: {
          min: Math.min(...homeMLPrices, ...awayMLPrices),
          max: Math.max(...homeMLPrices, ...awayMLPrices),
        },
        impliedProbHome: impliedProbability(avgHomeML),
        impliedProbAway: impliedProbability(avgAwayML),
      },
      spread: spreadResult,
      total: totalResult,
    };
  }

  // ─────────────────────────────────────────────
  // PASO 3 — Props de jugadores
  // ─────────────────────────────────────────────

  async getPlayerProps(
    sportKey: string,
    eventId: string,
    homeTeam: string,
    awayTeam: string,
  ): Promise<PlayerPropsData> {
    const params = new URLSearchParams({
      apiKey: this.apiKey,
      regions: 'us',
      markets: PLAYER_PROP_MARKETS.join(','),
      oddsFormat: 'american',
    });

    const url = `${this.baseUrl}/sports/${sportKey}/events/${eventId}/odds?${params}`;
    this.logger.debug(`[getPlayerProps] GET ${url}`);

    const event = await this.fetch<RawEvent>(url);

    if (!event?.bookmakers?.length) {
      this.logger.warn(`Sin props para eventId: ${eventId}`);
      return { homeTeam, awayTeam, props: [], byPlayer: {} };
    }

    const props = this.parsePlayerProps(event);

    // Agrupar por jugador
    const byPlayer: Record<string, PlayerPropLine[]> = {};
    for (const prop of props) {
      if (!byPlayer[prop.player]) byPlayer[prop.player] = [];
      byPlayer[prop.player].push(prop);
    }

    return { homeTeam: event.home_team, awayTeam: event.away_team, props, byPlayer };
  }

  private parsePlayerProps(event: RawEvent): PlayerPropLine[] {
    const result: PlayerPropLine[] = [];

    // Para cada bookmaker y cada mercado de prop
    for (const bk of event.bookmakers ?? []) {
      for (const market of bk.markets) {
        if (!PLAYER_PROP_MARKETS.includes(market.key)) continue;

        // Agrupar outcomes por jugador (description = nombre jugador)
        const byPlayer: Record<string, { over?: RawOutcome; under?: RawOutcome }> = {};

        for (const outcome of market.outcomes) {
          const playerName = outcome.description ?? outcome.name;
          if (!byPlayer[playerName]) byPlayer[playerName] = {};
          if (outcome.name === 'Over') byPlayer[playerName].over = outcome;
          if (outcome.name === 'Under') byPlayer[playerName].under = outcome;
        }

        for (const [player, sides] of Object.entries(byPlayer)) {
          if (!sides.over || !sides.under) continue;

          // Evitar duplicados — usar el primero que aparece por bookmaker
          const existing = result.find(
            (p) => p.player === player && p.market === market.key,
          );
          if (existing) continue;

          const overPrice = sides.over.price;
          const underPrice = sides.under.price;

          result.push({
            player,
            market: market.key,
            marketLabel: PLAYER_PROP_LABELS[market.key] ?? market.key,
            line: sides.over.point ?? 0,
            overPrice,
            underPrice,
            bookmaker: bk.title,
            impliedProbOver: impliedProbability(overPrice),
            impliedProbUnder: impliedProbability(underPrice),
          });
        }
      }
    }

    return result;
  }

  // ─────────────────────────────────────────────
  // PASO 4 — Forma reciente (scores)
  // ─────────────────────────────────────────────

  async getRecentScores(sportKey: string, daysFrom = 3): Promise<MatchScore[]> {
    const params = new URLSearchParams({
      apiKey: this.apiKey,
      daysFrom: daysFrom.toString(),
    });

    const url = `${this.baseUrl}/sports/${sportKey}/scores?${params}`;
    this.logger.debug(`[getRecentScores] GET ${url}`);

    const data = await this.fetch<RawEvent[]>(url);

    return data.map((e) => {
      const homeScore = e.scores?.find((s) => this.nameMatch(s.name, e.home_team))?.score ?? null;
      const awayScore = e.scores?.find((s) => this.nameMatch(s.name, e.away_team))?.score ?? null;

      return {
        id: e.id,
        homeTeam: e.home_team,
        awayTeam: e.away_team,
        commenceTime: e.commence_time,
        completed: e.completed ?? false,
        homeScore,
        awayScore,
        lastUpdate: e.last_update ?? null,
      };
    });
  }

  // ─────────────────────────────────────────────
  // HELPER DE FETCH CON LOGGING DE CUOTA
  // ─────────────────────────────────────────────

  private async fetch<T>(url: string): Promise<T> {
    const response = await globalThis.fetch(url);

    // Guardar headers de uso
    this.lastUsage = {
      remaining: response.headers.get('x-requests-remaining'),
      used: response.headers.get('x-requests-used'),
    };

    const lastCost = response.headers.get('x-requests-last');
    this.logger.debug(
      `API usage → remaining: ${this.lastUsage.remaining} | used: ${this.lastUsage.used} | cost this call: ${lastCost}`,
    );

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Odds API ${response.status}: ${body}`);
      throw new InternalServerErrorException(`Odds API error ${response.status}: ${body}`);
    }

    return response.json() as Promise<T>;
  }

  // ─────────────────────────────────────────────
  // UTILIDADES
  // ─────────────────────────────────────────────

  /** Coincidencia parcial de nombres de equipo (case-insensitive) */
  private nameMatch(a: string, b: string): boolean {
    const normalize = (s: string) => s.toLowerCase().trim();
    return normalize(a).includes(normalize(b)) || normalize(b).includes(normalize(a));
  }

  /** Moda de un array de números */
  private mode(arr: number[]): number | null {
    if (!arr.length) return null;
    const freq: Record<number, number> = {};
    for (const n of arr) freq[n] = (freq[n] ?? 0) + 1;
    return Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
  }

  private emptyTeamOdds(homeTeam: string, awayTeam: string): TeamMarketOdds {
    return {
      homeTeam,
      awayTeam,
      moneyline: {
        home: [], away: [],
        consensus: { home: 0, away: 0 },
        range: { min: 0, max: 0 },
        impliedProbHome: 0,
        impliedProbAway: 0,
      },
      spread: null,
      total: null,
    };
  }

  // ─────────────────────────────────────────────
  // MÉTODO LEGACY — parseMatchOdds (compatibilidad hacia atrás)
  // ─────────────────────────────────────────────

  /** @deprecated Usar getCompleteMatchData() */
  parseMatchOdds(
    oddsData: RawEvent[],
    homeTeam: string,
    awayTeam: string,
  ): TeamMarketOdds | null {
    const match = oddsData.find(
      (o) => this.nameMatch(o.home_team, homeTeam) || this.nameMatch(o.away_team, awayTeam),
    );
    if (!match) return null;
    return this.parseTeamOdds(match, homeTeam, awayTeam);
  }
}