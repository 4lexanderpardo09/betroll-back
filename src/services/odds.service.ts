import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';

@Injectable()
export class OddsService {
  private readonly baseUrl = 'https://api.the-odds-api.com/v4';
  private readonly logger = new Logger(OddsService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  private get apiKey(): string {
    return this.configService.get<string>('ODDS_API_KEY') || '';
  }

  private get headers() {
    return {
      Accept: 'application/json',
    };
  }

  /**
   * Get available sports
   * DOES NOT count against quota!
   */
  async getSports(): Promise<OddsSport[]> {
    const cacheKey = CacheService.buildKey('odds', 'sports');
    return this.cacheService.getOrFetch<OddsSport[]>(
      cacheKey,
      () => this.fetch<OddsSport[]>('/sports'),
      CacheService.TTL.STANDINGS, // Cache for 24 hours
    );
  }

  /**
   * Get odds for a specific sport
   * @param sportKey e.g., 'basketball_nba', 'americanfootball_nfl'
   * @param regions Array of regions: 'us', 'uk', 'eu', 'au'
   * @param markets Array of markets: 'h2h', 'spreads', 'totals', 'player_props'
   */
  async getOdds(
    sportKey: string,
    regions: string[] = ['us'],
    markets: string[] = ['h2h', 'spreads', 'totals'],
  ): Promise<OddsResponse[]> {
    if (!this.apiKey) {
      throw new Error('ODDS_API_KEY not configured');
    }

    const params = new URLSearchParams({
      apiKey: this.apiKey,
      regions: regions.join(','),
      markets: markets.join(','),
      oddsFormat: 'american',
    });

    const cacheKey = CacheService.buildKey(
      'odds',
      'odds',
      sportKey,
      regions.join(','),
      markets.join(','),
    );

    const data = await this.cacheService.getOrFetch<OddsResponse[]>(
      cacheKey,
      () => this.fetchWithQuotaCheck<OddsResponse[]>(`/sports/${sportKey}/odds?${params}`),
      CacheService.TTL.ODDS_PRE_MATCH,
    );

    return data;
  }

  /**
   * Get odds for a specific event
   */
  async getEventOdds(
    sportKey: string,
    eventId: string,
    regions: string[] = ['us'],
    markets: string[] = ['h2h', 'spreads', 'totals'],
  ): Promise<OddsResponse | null> {
    if (!this.apiKey) {
      throw new Error('ODDS_API_KEY not configured');
    }

    const params = new URLSearchParams({
      apiKey: this.apiKey,
      regions: regions.join(','),
      markets: markets.join(','),
      oddsFormat: 'american',
    });

    const cacheKey = CacheService.buildKey(
      'odds',
      'event',
      eventId,
      sportKey,
    );

    const data = await this.cacheService.getOrFetch<OddsResponse[]>(
      cacheKey,
      () => this.fetchWithQuotaCheck<OddsResponse[]>(
        `/sports/${sportKey}/events/${eventId}/odds?${params}`,
      ),
      CacheService.TTL.ODDS_PRE_MATCH,
    );

    return data[0] || null;
  }

  /**
   * Find the best odds for a selection across all bookmakers
   */
  getBestOdds(
    bookmakers: OddsBookmaker[],
    selectionName: string,
    market: string,
  ): { price: number; bookmaker: string; point?: number } | null {
    let bestPrice = 0;
    let bestBookmaker = '';
    let bestPoint: number | undefined;

    for (const bookmaker of bookmakers) {
      const marketData = bookmaker.markets.find((m) => m.key === market);
      if (!marketData) continue;

      const outcome = marketData.outcomes.find(
        (o) => o.name.toLowerCase().includes(selectionName.toLowerCase()),
      );

      if (outcome && outcome.price > bestPrice) {
        bestPrice = outcome.price;
        bestBookmaker = bookmaker.title;
        bestPoint = outcome.point;
      }
    }

    if (bestPrice === 0) return null;

    return {
      price: bestPrice,
      bookmaker: bestBookmaker,
      point: bestPoint,
    };
  }

  /**
   * Get comparison of odds for both teams in a match
   */
  getMatchOddsComparison(
    bookmakers: OddsBookmaker[],
    homeTeam: string,
    awayTeam: string,
    market = 'h2h',
  ): {
    home: { price: number; bookmaker: string };
    away: { price: number; bookmaker: string };
    draw?: { price: number; bookmaker: string };
  } | null {
    const homeOdds = this.getBestOdds(bookmakers, homeTeam, market);
    const awayOdds = this.getBestOdds(bookmakers, awayTeam, market);
    const drawOdds = this.getBestOdds(bookmakers, 'draw', market);

    if (!homeOdds || !awayOdds) return null;

    return {
      home: { price: homeOdds.price, bookmaker: homeOdds.bookmaker },
      away: { price: awayOdds.price, bookmaker: awayOdds.bookmaker },
      ...(drawOdds && { draw: { price: drawOdds.price, bookmaker: drawOdds.bookmaker } }),
    };
  }

  /**
   * Convert American odds to Decimal
   */
  americanToDecimal(americanOdds: number): number {
    if (americanOdds > 0) {
      return (americanOdds / 100) + 1;
    } else {
      return (-100 / americanOdds) + 1;
    }
  }

  /**
   * Convert Decimal odds to American
   */
  decimalToAmerican(decimalOdds: number): number {
    if (decimalOdds >= 2) {
      return (decimalOdds - 1) * 100;
    } else {
      return -100 / (decimalOdds - 1);
    }
  }

  /**
   * Calculate implied probability from odds
   */
  calculateImpliedProbability(odds: number, format: 'american' | 'decimal' = 'american'): number {
    let decimalOdds = odds;
    if (format === 'american') {
      decimalOdds = this.americanToDecimal(odds);
    }
    return 1 / decimalOdds;
  }

  /**
   * Calculate expected value
   * @param estimatedProbability True probability (0-1)
   * @param odds Odds offered (american or decimal)
   * @param format Format of odds
   */
  calculateEV(
    estimatedProbability: number,
    odds: number,
    format: 'american' | 'decimal' = 'american',
  ): number {
    const decimalOdds = format === 'american' ? this.americanToDecimal(odds) : odds;
    return estimatedProbability * decimalOdds - 1;
  }

  /**
   * Calculate fair odds from probability
   */
  calculateFairOdds(probability: number, vigorish = 0.05): number {
    // Assuming 5% vigorish, fair odds = probability with juice removed
    const fairDecimal = 1 / probability;
    return Math.round((fairDecimal + (fairDecimal * vigorish)) * 100) / 100;
  }

  /**
   * Check if odds offer value given estimated probability
   */
  hasValue(
    estimatedProbability: number,
    odds: number,
    format: 'american' | 'decimal' = 'american',
  ): { hasValue: boolean; edge: number } {
    const ev = this.calculateEV(estimatedProbability, odds, format);
    return {
      hasValue: ev > 0.05, // 5% minimum edge
      edge: ev,
    };
  }

  // ==================== PRIVATE METHODS ====================

  private async fetch<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    this.logger.debug(`Fetching: ${url}`);

    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`The Odds API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  private async fetchWithQuotaCheck<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    this.logger.debug(`Fetching with quota check: ${endpoint}`);

    const response = await fetch(url, { headers: this.headers });

    // Log quota usage from headers
    const remaining = response.headers.get('x-requests-remaining');
    const used = response.headers.get('x-requests-used');

    if (remaining !== null) {
      this.logger.log(`The Odds API - Used: ${used}, Remaining: ${remaining}`);
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid The Odds API key');
      }
      if (response.status === 429) {
        throw new Error('The Odds API rate limit exceeded');
      }
      const errorText = await response.text();
      throw new Error(`The Odds API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }
}

// ==================== TYPES ====================

export interface OddsSport {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
}

export interface OddsResponse {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
}

export interface OddsBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsMarket[];
}

export interface OddsMarket {
  key: string;
  last_update: string;
  outcomes: OddsOutcome[];
}

export interface OddsOutcome {
  name: string;
  price: number;
  point?: number;
}

// ==================== SPORT KEYS ====================

export const SPORT_KEYS = {
  BASKETBALL_NBA: 'basketball_nba',
  BASKETBALL_WNBA: 'basketball_wnba',
  BASKETBALL_NCAAB: 'basketball_ncaab',
  FOOTBALL_NFL: 'americanfootball_nfl',
  BASEBALL_MLB: 'baseball_mlb',
  HOCKEY_NHL: 'icehockey_nhl',
  SOCCER_EPL: 'soccer_epl',
  SOCCER_LA_LIGA: 'soccer_spain_la_liga',
  SOCCER_SERIE_A: 'soccer_italy_serie_a',
  SOCCER_BUNDESLIGA: 'soccer_germany_bundesliga',
  SOCCER_LIGUE_1: 'soccer_france_ligue_one',
  TENNIS_ATP: 'tennis_atp',
  TENNIS_WTA: 'tennis_wta',
} as const;

export type SportKey = (typeof SPORT_KEYS)[keyof typeof SPORT_KEYS];
