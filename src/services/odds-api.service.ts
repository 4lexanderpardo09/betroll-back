import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface OddsOutcome {
  name: string;
  price: number;
  point?: number;
}

interface OddsMarket {
  key: string;
  outcomes: OddsOutcome[];
}

interface OddsBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsMarket[];
}

export interface OddsResponse {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
}

export interface ParsedOdds {
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  market: string;
  bookmaker: string;
  homeOdds: number;
  awayOdds: number;
  spread?: { home: number; away: number; homePrice: number; awayPrice: number };
  total?: { line: number; overPrice: number; underPrice: number };
}

@Injectable()
export class OddsApiService {
  private readonly baseUrl = 'https://api.the-odds-api.com/v4';
  private readonly logger = new Logger(OddsApiService.name);

  constructor(private configService: ConfigService) {}

  private get apiKey(): string {
    const key = this.configService.get<string>('ODDS_API_KEY');
    if (!key) {
      throw new Error('ODDS_API_KEY not configured');
    }
    return key;
  }

  /**
   * Get sports available
   */
  async getSports(): Promise<any[]> {
    const url = `${this.baseUrl}/sports/?apiKey=${this.apiKey}`;
    this.logger.debug(`Fetching sports from Odds API`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new InternalServerErrorException(`Odds API error: ${response.status}`);
    }

    const data = await response.json();
    this.logger.debug(`Got ${data.length} sports`);
    return data;
  }

  /**
   * Get odds for a specific sport
   */
  async getOdds(
    sport: string,
    options?: {
      regions?: string[];
      markets?: string[];
      eventIds?: string[];
      commenceTimeFrom?: string;
      commenceTimeTo?: string;
    },
  ): Promise<OddsResponse[]> {
    const params = new URLSearchParams({
      apiKey: this.apiKey,
      regions: (options?.regions || ['us']).join(','),
      markets: (options?.markets || ['h2h', 'spreads', 'totals']).join(','),
      oddsFormat: 'american',
    });

    if (options?.eventIds?.length) {
      params.set('eventIds', options.eventIds.join(','));
    }
    if (options?.commenceTimeFrom) {
      params.set('commenceTimeFrom', options.commenceTimeFrom);
    }
    if (options?.commenceTimeTo) {
      params.set('commenceTimeTo', options.commenceTimeTo);
    }

    const url = `${this.baseUrl}/sports/${sport}/odds/?${params.toString()}`;
    this.logger.debug(`Fetching odds: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Odds API error ${response.status}: ${errorText}`);
      throw new InternalServerErrorException(`Odds API error: ${response.status}`);
    }

    // Log usage
    const remaining = response.headers.get('x-requests-remaining');
    const used = response.headers.get('x-requests-used');
    this.logger.debug(`Odds API usage - remaining: ${remaining}, used: ${used}`);

    const data: OddsResponse[] = await response.json();
    this.logger.log(`Got odds for ${data.length} events`);
    return data;
  }

  /**
   * Get odds for a specific event
   */
  async getEventOdds(
    sport: string,
    eventId: string,
    options?: {
      regions?: string[];
      markets?: string[];
    },
  ): Promise<OddsResponse | null> {
    const params = new URLSearchParams({
      apiKey: this.apiKey,
      regions: (options?.regions || ['us']).join(','),
      markets: (options?.markets || ['h2h', 'spreads', 'totals']).join(','),
      oddsFormat: 'american',
    });

    const url = `${this.baseUrl}/sports/${sport}/events/${eventId}/odds/?${params.toString()}`;
    this.logger.debug(`Fetching event odds: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new InternalServerErrorException(`Odds API error: ${response.status}`);
    }

    const data: OddsResponse = await response.json();
    return data;
  }

  /**
   * Parse odds for a specific match
   */
  parseMatchOdds(
    oddsData: OddsResponse[],
    homeTeam: string,
    awayTeam: string,
  ): ParsedOdds | null {
    // Find the matching event (partial name match)
    const match = oddsData.find(
      (o) =>
        o.home_team.toLowerCase().includes(homeTeam.toLowerCase()) ||
        homeTeam.toLowerCase().includes(o.home_team.toLowerCase()) ||
        o.away_team.toLowerCase().includes(awayTeam.toLowerCase()) ||
        awayTeam.toLowerCase().includes(o.away_team.toLowerCase()),
    );

    if (!match) {
      this.logger.warn(`Match not found: ${homeTeam} vs ${awayTeam}`);
      return null;
    }

    // Get best odds from all bookmakers
    const result: ParsedOdds = {
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      startTime: match.commence_time,
      market: 'h2h',
      bookmaker: 'multiple',
      homeOdds: 0,
      awayOdds: 0,
    };

    // Find h2h (moneyline) odds
    const h2hMarkets = match.bookmakers
      .flatMap((b) => b.markets.filter((m) => m.key === 'h2h'))
      .flatMap((m) => m.outcomes);

    const homeOutcome = h2hMarkets.find(
      (o) =>
        o.name.toLowerCase().includes(homeTeam.toLowerCase()) ||
        homeTeam.toLowerCase().includes(o.name.toLowerCase()) ||
        o.name.toLowerCase().includes(match.home_team.toLowerCase()),
    );
    const awayOutcome = h2hMarkets.find(
      (o) =>
        o.name.toLowerCase().includes(awayTeam.toLowerCase()) ||
        awayTeam.toLowerCase().includes(o.name.toLowerCase()) ||
        o.name.toLowerCase().includes(match.away_team.toLowerCase()),
    );

    if (homeOutcome) result.homeOdds = homeOutcome.price;
    if (awayOutcome) result.awayOdds = awayOutcome.price;

    // Find spreads
    const spreadMarkets = match.bookmakers
      .flatMap((b) => b.markets.filter((m) => m.key === 'spreads'))
      .flatMap((m) => m.outcomes);

    const homeSpread = spreadMarkets.find(
      (o) =>
        o.name.toLowerCase().includes(homeTeam.toLowerCase()) ||
        homeTeam.toLowerCase().includes(o.name.toLowerCase()) ||
        o.name.toLowerCase().includes(match.home_team.toLowerCase()),
    );
    const awaySpread = spreadMarkets.find(
      (o) =>
        o.name.toLowerCase().includes(awayTeam.toLowerCase()) ||
        awayTeam.toLowerCase().includes(o.name.toLowerCase()) ||
        o.name.toLowerCase().includes(match.away_team.toLowerCase()),
    );

    if (homeSpread?.point !== undefined && awaySpread?.point !== undefined) {
      result.spread = {
        home: homeSpread.point,
        away: awaySpread.point,
        homePrice: homeSpread.price,
        awayPrice: awaySpread.price,
      };
    }

    // Find totals
    const totalMarkets = match.bookmakers
      .flatMap((b) => b.markets.filter((m) => m.key === 'totals'))
      .flatMap((m) => m.outcomes);

    const overOutcome = totalMarkets.find((o) => o.name === 'Over');
    const underOutcome = totalMarkets.find((o) => o.name === 'Under');

    if (overOutcome && underOutcome) {
      result.total = {
        line: overOutcome.point || 0,
        overPrice: overOutcome.price,
        underPrice: underOutcome.price,
      };
    }

    return result;
  }

  /**
   * Get scores for a sport
   */
  async getScores(
    sport: string,
    options?: {
      daysFrom?: number;
      eventIds?: string[];
    },
  ): Promise<any[]> {
    const params = new URLSearchParams({
      apiKey: this.apiKey,
    });

    if (options?.daysFrom) {
      params.set('daysFrom', options.daysFrom.toString());
    }
    if (options?.eventIds?.length) {
      params.set('eventIds', options.eventIds.join(','));
    }

    const url = `${this.baseUrl}/sports/${sport}/scores/?${params.toString()}`;
    this.logger.debug(`Fetching scores: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new InternalServerErrorException(`Odds API error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * Sport key mapping for The Odds API
   */
  static getSportKey(sport: string): string {
    const map: Record<string, string> = {
      BASKETBALL: 'basketball_nba',
      FOOTBALL: 'americanfootball_nfl',
      SOCCER: 'soccer_epl',
      TENNIS: 'tennis_atp',
      MLB: 'baseball_mlb',
      NHL: 'icehockey_nhl',
    };
    return map[sport] || 'basketball_nba';
  }
}
