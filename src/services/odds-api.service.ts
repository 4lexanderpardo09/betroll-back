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
  // Moneyline — 2-way (NBA, NFL) o 3-way (soccer: home/draw/away)
  moneyline: {
    home: BookmakerOdds[];
    away: BookmakerOdds[];
    draw?: BookmakerOdds[];                  // solo soccer (3-way h2h)
    consensus: { home: number; away: number; draw?: number };
    range: { min: number; max: number };
    impliedProbHome: number;
    impliedProbAway: number;
    impliedProbDraw?: number;
  };
  // Spread — null si el sport no lo usa
  spread: {
    line: number;
    home: BookmakerOdds[];
    away: BookmakerOdds[];
    consensus: { homePrice: number; awayPrice: number };
  } | null;
  // Total — null si el sport no lo usa
  total: {
    line: number;
    over: BookmakerOdds[];
    under: BookmakerOdds[];
    consensus: { overPrice: number; underPrice: number };
    range: { min: number; max: number };
  } | null;
}

export interface PlayerPropLine {
  player: string;
  market: string;
  marketLabel: string;
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
// DATOS COMPLETOS PARA EL LLM
// ─────────────────────────────────────────────

export interface CompleteMatchOddsData {
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  teamOdds: TeamMarketOdds;
  playerProps: PlayerPropsData;
  recentScores: MatchScore[];
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
// SERVICIO 100% GENÉRICO
// ─────────────────────────────────────────────

@Injectable()
export class OddsApiService {
  private readonly baseUrl = 'https://api.the-odds-api.com/v4';
  private readonly logger = new Logger(OddsApiService.name);

  private lastUsage = { remaining: null as string | null, used: null as string | null };

  constructor(private configService: ConfigService) {}

  private get apiKey(): string {
    const key = this.configService.get<string>('ODDS_API_KEY');
    if (!key) throw new Error('ODDS_API_KEY not configured');
    return key;
  }

  // ─────────────────────────────────────────────
  // MÉTODO PRINCIPAL — orquestador genérico
  // Cada sport service decide qué markets/regions pasar
  // ─────────────────────────────────────────────

  async getCompleteMatchData(
    sportKey: string,  // The Odds API sport key directly (e.g. 'basketball_nba', 'americanfootball_nfl')
    homeTeam: string,
    awayTeam: string,
    matchDate: string,
    options?: {
      teamMarkets?: string[];
      teamRegions?: string[];
      propMarkets?: string[];
      propLabels?: Record<string, string>;
      scoreDaysFrom?: number;
    },
  ): Promise<CompleteMatchOddsData> {

    // 1. Buscar evento (gratis)
    const event = await this.findEvent(sportKey, homeTeam, awayTeam, matchDate);
    if (!event) {
      throw new InternalServerErrorException(
        `Evento no encontrado: ${homeTeam} vs ${awayTeam} en ${matchDate}`,
      );
    }
    this.logger.log(`Evento encontrado: ${event.id} — ${event.homeTeam} vs ${event.awayTeam}`);

    // 2. Cuotas de equipo (costo según markets)
    const teamMarkets = options?.teamMarkets ?? ['h2h', 'spreads', 'totals'];
    const teamRegions = options?.teamRegions ?? ['us'];
    const teamOdds = await this.getTeamMarketOdds(
      sportKey,
      event.id,
      event.homeTeam,
      event.awayTeam,
      teamMarkets,
      teamRegions,
    );

    // 3. Props de jugadores (costo según markets)
    let playerProps: PlayerPropsData = { homeTeam, awayTeam, props: [], byPlayer: {} };
    if (options?.propMarkets?.length) {
      playerProps = await this.getPlayerProps(
        sportKey,
        event.id,
        event.homeTeam,
        event.awayTeam,
        options.propMarkets,
        options.propLabels ?? {},
      );
    }

    // 4. Forma reciente (costo fijo de 2 por llamada)
    const scoreDaysFrom = options?.scoreDaysFrom ?? 3;
    const recentScores = await this.getRecentScores(sportKey, scoreDaysFrom);

    // Estimar costo: 1 por team odds (sin importar cuántos markets) + 1 por props + 2 por scores
    const propsCost = options?.propMarkets?.length ? 1 : 0;
    const estimatedCost = 1 + propsCost + 2;

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
        estimatedCostThisCall: estimatedCost,
      },
    };
  }

  // ─────────────────────────────────────────────
  // PASO 1 — Buscar evento por fecha (gratis)
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
        this.nameMatch(e.home_team, awayTeam) ||
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
  // PASO 2 — Cuotas de equipo (ML, spread, total)
  // Markets y regions los decide el sport service
  // ─────────────────────────────────────────────

  async getTeamMarketOdds(
    sportKey: string,
    eventId: string,
    homeTeam: string,
    awayTeam: string,
    markets: string[] = ['h2h', 'spreads', 'totals'],
    regions: string[] = ['us'],
  ): Promise<TeamMarketOdds> {
    const params = new URLSearchParams({
      apiKey: this.apiKey,
      regions: regions.join(','),
      markets: markets.join(','),
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

    return this.parseTeamOdds(event, homeTeam, awayTeam, markets);
  }

  private parseTeamOdds(event: RawEvent, homeTeam: string, awayTeam: string, requestedMarkets: string[]): TeamMarketOdds {
    const bookmakers = event.bookmakers ?? [];

    // ── Moneyline (2-way o 3-way según el sport) ──
    const homeML: BookmakerOdds[] = [];
    const awayML: BookmakerOdds[] = [];
    const drawML: BookmakerOdds[] = [];

    for (const bk of bookmakers) {
      const h2h = bk.markets.find((m) => m.key === 'h2h');
      if (!h2h) continue;

      const homeOut = h2h.outcomes.find((o) => this.nameMatch(o.name, event.home_team));
      const awayOut = h2h.outcomes.find((o) => this.nameMatch(o.name, event.away_team));
      const drawOut = h2h.outcomes.find((o) => this.nameMatch(o.name, 'draw'));

      if (homeOut) homeML.push({ bookmaker: bk.key, bookmakerTitle: bk.title, price: homeOut.price });
      if (awayOut) awayML.push({ bookmaker: bk.key, bookmakerTitle: bk.title, price: awayOut.price });
      if (drawOut) drawML.push({ bookmaker: bk.key, bookmakerTitle: bk.title, price: drawOut.price });
    }

    const homeMLPrices = homeML.map((o) => o.price);
    const awayMLPrices = awayML.map((o) => o.price);
    const avgHomeML = averagePrice(homeML);
    const avgAwayML = averagePrice(awayML);
    const avgDrawML = drawML.length > 0 ? averagePrice(drawML) : undefined;

    // ── Spread (opcional) ──
    let spreadResult: TeamMarketOdds['spread'] = null;
    if (requestedMarkets.includes('spreads')) {
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
    }

    // ── Total (opcional) ──
    let totalResult: TeamMarketOdds['total'] = null;
    if (requestedMarkets.includes('totals')) {
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
    }

    return {
      homeTeam: event.home_team,
      awayTeam: event.away_team,
      moneyline: {
        home: homeML,
        away: awayML,
        draw: drawML.length > 0 ? drawML : undefined,
        consensus: {
          home: avgHomeML,
          away: avgAwayML,
          draw: avgDrawML,
        },
        range: {
          min: Math.min(...homeMLPrices, ...awayMLPrices),
          max: Math.max(...homeMLPrices, ...awayMLPrices),
        },
        impliedProbHome: impliedProbability(avgHomeML),
        impliedProbAway: impliedProbability(avgAwayML),
        impliedProbDraw: avgDrawML !== undefined ? impliedProbability(avgDrawML) : undefined,
      },
      spread: spreadResult,
      total: totalResult,
    };
  }

  // ─────────────────────────────────────────────
  // PASO 3 — Props de jugadores (markets y labels los define el sport service)
  // ─────────────────────────────────────────────

  async getPlayerProps(
    sportKey: string,
    eventId: string,
    homeTeam: string,
    awayTeam: string,
    propMarkets: string[],
    propLabels: Record<string, string>,
  ): Promise<PlayerPropsData> {
    const params = new URLSearchParams({
      apiKey: this.apiKey,
      regions: 'us',
      markets: propMarkets.join(','),
      oddsFormat: 'american',
    });

    const url = `${this.baseUrl}/sports/${sportKey}/events/${eventId}/odds?${params}`;
    this.logger.debug(`[getPlayerProps] GET ${url}`);

    const event = await this.fetch<RawEvent>(url);

    if (!event?.bookmakers?.length) {
      this.logger.warn(`Sin props para eventId: ${eventId}`);
      return { homeTeam, awayTeam, props: [], byPlayer: {} };
    }

    const props = this.parsePlayerProps(event, propMarkets, propLabels);

    const byPlayer: Record<string, PlayerPropLine[]> = {};
    for (const prop of props) {
      if (!byPlayer[prop.player]) byPlayer[prop.player] = [];
      byPlayer[prop.player].push(prop);
    }

    return { homeTeam: event.home_team, awayTeam: event.away_team, props, byPlayer };
  }

  private parsePlayerProps(
    event: RawEvent,
    propMarkets: string[],
    propLabels: Record<string, string>,
  ): PlayerPropLine[] {
    const result: PlayerPropLine[] = [];

    for (const bk of event.bookmakers ?? []) {
      for (const market of bk.markets) {
        if (!propMarkets.includes(market.key)) continue;

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
          const existing = result.find((p) => p.player === player && p.market === market.key);
          if (existing) continue;

          result.push({
            player,
            market: market.key,
            marketLabel: propLabels[market.key] ?? market.key,
            line: sides.over.point ?? 0,
            overPrice: sides.over.price,
            underPrice: sides.under.price,
            bookmaker: bk.title,
            impliedProbOver: impliedProbability(sides.over.price),
            impliedProbUnder: impliedProbability(sides.under.price),
          });
        }
      }
    }

    return result;
  }

  // ─────────────────────────────────────────────
  // PASO 4 — Forma reciente
  // ─────────────────────────────────────────────

  async getRecentScores(
    sportKey: string,
    daysFrom: number = 3,
  ): Promise<MatchScore[]> {
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

    this.lastUsage = {
      remaining: response.headers.get('x-requests-remaining'),
      used: response.headers.get('x-requests-used'),
    };

    const lastCost = response.headers.get('x-requests-last');
    this.logger.debug(
      `API usage → remaining: ${this.lastUsage.remaining} | used: ${this.lastUsage.used} | cost: ${lastCost}`,
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

  private nameMatch(a: string, b: string): boolean {
    const normalize = (s: string) => s.toLowerCase().trim();
    return normalize(a).includes(normalize(b)) || normalize(b).includes(normalize(a));
  }

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
        home: [],
        away: [],
        consensus: { home: 0, away: 0 },
        range: { min: 0, max: 0 },
        impliedProbHome: 0,
        impliedProbAway: 0,
      },
      spread: null,
      total: null,
    };
  }
}
