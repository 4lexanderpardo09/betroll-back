import { Injectable, Logger } from '@nestjs/common';

/**
 * DataNormalizer
 *
 * Normaliza los datos crudos de ESPN a objetos limpios y validados.
 * Nunca pasa "?" al LLM — usa null para datos faltantes.
 */

// ─── TYPES ─────────────────────────────────────────────────────────────────

export interface CleanPlayerStats {
  PPG: number | null;
  APG: number | null;
  RPG: number | null;
  FG_PCT: number | null;
  THREE_PT_PCT: number | null;
  FT_PCT: number | null;
  MIN: number | null;
  gamesPlayed: number | null;
  splits: {
    home: Record<string, number | null>;
    away: Record<string, number | null>;
  };
  recentGames: CleanGameEvent[];
}

export interface CleanGameEvent {
  date: string;
  opponent: string;
  result: 'W' | 'L' | null;
  stats: Record<string, number | null>;
}

export interface GameDataValidation {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  parsedStats: ParsedStatsSummary;
  rosterValidated: boolean;
  missingFields: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'warning';
}

export interface ValidationWarning {
  field: string;
  message: string;
}

export interface ParsedStatsSummary {
  homePlayersParsed: number;
  awayPlayersParsed: number;
  homeLeadersValid: boolean;
  awayLeadersValid: boolean;
  teamStatsComplete: boolean;
  boxscoreAvailable: boolean;
}

// ─── PARSER ────────────────────────────────────────────────────────────────

@Injectable()
export class DataNormalizer {
  private readonly logger = new Logger(DataNormalizer.name);

  /**
   * Convierte raw ESPN stats a objeto limpio con null para faltantes.
   * Nunca retorna "?" — solo números o null.
   */
  parsePlayerStats(raw: Record<string, string>): { clean: CleanPlayerStats; displayStrings: Record<string, string> } {
    // Support both naming conventions: "avgPoints" (core API) and "pointsPerGame" (overview)
    const get = (key: string, alt: string): string | undefined => raw[key] ?? raw[alt];
    const parseNum = (val: string | undefined, decimals = 1): number | null => {
      if (!val || val === '?' || val === '-' || val === '' || val === 'N/A') return null;
      const n = parseFloat(val);
      return isNaN(n) ? null : parseFloat(n.toFixed(decimals));
    };

    const toStr = (v: number | null, decimals = 1): string =>
      v == null ? '-' : v.toFixed(decimals);

    const clean: CleanPlayerStats = {
      PPG: parseNum(get('avgPoints', 'pointsPerGame')),
      APG: parseNum(get('avgAssists', 'assistsPerGame')),
      RPG: parseNum(get('avgRebounds', 'reboundsPerGame')),
      FG_PCT: parseNum(get('fieldGoalPct', 'fieldGoalPct'), 3),
      THREE_PT_PCT: parseNum(get('threePointPct', 'threePointPct'), 3),
      FT_PCT: parseNum(get('freeThrowPct', 'freeThrowPct'), 3),
      MIN: parseNum(get('avgMinutes', 'minutesPerGame')),
      gamesPlayed: parseNum(get('gamesPlayed', 'gamesPlayed'), 0),
      splits: { home: {}, away: {} },
      recentGames: [],
    };

    const displayStrings: Record<string, string> = {
      PPG: toStr(clean.PPG),
      APG: toStr(clean.APG),
      RPG: toStr(clean.RPG),
      FG_PCT: toStr(clean.FG_PCT, 3),
      THREE_PT_PCT: toStr(clean.THREE_PT_PCT, 3),
      FT_PCT: toStr(clean.FT_PCT, 3),
      MIN: toStr(clean.MIN),
    };
    if (clean.gamesPlayed != null) displayStrings['gamesPlayed'] = clean.gamesPlayed.toFixed(0);

    return { clean, displayStrings };
  }

  /**
   * Parse splits: categories → splits → stats
   * El path es: categories[name='homeAway'] → splits[displayName='Home'/'Away'] → stats
   */
  parseSplitsFromCategories(
    categories: { name: string; splits?: { displayName: string; stats: Record<string, string> }[] }[] | undefined,
  ): { home: Record<string, number | null>; away: Record<string, number | null> } {
    const home: Record<string, number | null> = {};
    const away: Record<string, number | null> = {};

    if (!categories) return { home, away };

    const homeAwayCat = categories.find((c) => c.name === 'homeAway');
    if (!homeAwayCat?.splits) return { home, away };

    for (const split of homeAwayCat.splits) {
      const target = split.displayName === 'Home' ? home : split.displayName === 'Away' ? away : null;
      if (!target) continue;
      for (const [key, val] of Object.entries(split.stats)) {
        target[key] = this.parseNumStr(val);
      }
    }

    return { home, away };
  }

  private parseSplitGroup(stats: Record<string, string | number>): Record<string, number | null> {
    const result: Record<string, number | null> = {};
    for (const [key, val] of Object.entries(stats)) {
      result[key] = this.parseNumStr(val);
    }
    return result;
  }

  private parseNumStr(val: string | number | undefined): number | null {
    if (val === undefined || val === null || val === '' || val === '-' || val === '?' || val === 'N/A') return null;
    const n = typeof val === 'number' ? val : parseFloat(val);
    return isNaN(n) ? null : parseFloat(n.toFixed(1));
  }

  /**
   * Normaliza stats de boxscore (labels[] → stats[])
   */
  parseBoxscorePlayerStats(
    labels: string[],
    stats: string[],
  ): Record<string, number | null> {
    const result: Record<string, number | null> = {};
    labels.forEach((label, i) => {
      result[label] = this.parseNumStr(stats[i]);
    });
    return result;
  }

  /**
   * Normaliza array de eventos de juego reciente
   */
  parseGameLogEvents(
    events: { date: string; opponent: { abbreviation: string }; result?: string; stats: string[] }[],
    labelMap: string[],
  ): CleanGameEvent[] {
    return events.slice(0, 5).map((e) => ({
      date: e.date,
      opponent: e.opponent?.abbreviation ?? '?',
      result: e.result === 'W' || e.result === 'L' ? e.result : null,
      stats: this.parseGameStatsArray(e.stats, labelMap),
    }));
  }

  private parseGameStatsArray(stats: string[], labels: string[]): Record<string, number | null> {
    const result: Record<string, number | null> = {};
    labels.forEach((label, i) => {
      result[label] = this.parseNumStr(stats[i]);
    });
    return result;
  }

  // ─── VALIDATOR ───────────────────────────────────────────────────────────

  validateGameData(data: {
    homeTeam: string;
    awayTeam: string;
    homePlayers: { id: string; name: string }[];
    awayPlayers: { id: string; name: string }[];
    homeLeaders: { id: string; name: string }[];
    awayLeaders: { id: string; name: string }[];
    teamStatsComplete: boolean;
    boxscoreAvailable: boolean;
    seeding?: number;
  }): GameDataValidation {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const missingFields: string[] = [];

    // Validate teams exist
    if (!data.homeTeam || data.homeTeam.length < 3) {
      errors.push({ field: 'homeTeam', message: 'Nombre de equipo local inválido', severity: 'critical' });
    }
    if (!data.awayTeam || data.awayTeam.length < 3) {
      errors.push({ field: 'awayTeam', message: 'Nombre de equipo visitante inválido', severity: 'critical' });
    }

    // Validate seeding if present
    if (data.seeding !== undefined) {
      if (data.seeding < 1 || data.seeding > 15) {
        errors.push({
          field: 'seeding',
          message: `Seeding inválido: ${data.seeding}. Rango válido: 1-15`,
          severity: 'critical',
        });
      }
    }

    // Validate players exist
    if (!data.homePlayers?.length) {
      warnings.push({ field: 'homePlayers', message: 'No hay jugadores locales' });
      missingFields.push('homePlayers');
    }
    if (!data.awayPlayers?.length) {
      warnings.push({ field: 'awayPlayers', message: 'No hay jugadores visitantes' });
      missingFields.push('awayPlayers');
    }

    // Validate leaders
    if (!data.homeLeaders?.length) {
      warnings.push({ field: 'homeLeaders', message: 'No hay líderes locales' });
      missingFields.push('homeLeaders');
    }
    if (!data.awayLeaders?.length) {
      warnings.push({ field: 'awayLeaders', message: 'No hay líderes visitantes' });
      missingFields.push('awayLeaders');
    }

    // Check team stats completeness
    if (!data.teamStatsComplete) {
      warnings.push({ field: 'teamStats', message: 'Estadísticas de equipo incompletas' });
      missingFields.push('teamStats');
    }

    const parsedStats: ParsedStatsSummary = {
      homePlayersParsed: data.homePlayers?.length ?? 0,
      awayPlayersParsed: data.awayPlayers?.length ?? 0,
      homeLeadersValid: (data.homeLeaders?.length ?? 0) > 0,
      awayLeadersValid: (data.awayLeaders?.length ?? 0) > 0,
      teamStatsComplete: data.teamStatsComplete,
      boxscoreAvailable: data.boxscoreAvailable,
    };

    return {
      isValid: errors.filter((e) => e.severity === 'critical').length === 0,
      errors,
      warnings,
      parsedStats,
      rosterValidated: data.homePlayers.length > 0 && data.awayPlayers.length > 0,
      missingFields,
    };
  }

  /**
   * Verifica si un jugador pertenece al roster de un equipo
   */
  validatePlayerOnRoster(
    playerId: string,
    roster: { id: string; fullName: string; displayName: string }[],
  ): boolean {
    return roster.some((r) => r.id === playerId);
  }

  /**
   * Valida que los líderes sean del equipo correcto usando roster
   */
  validateLeadersAgainstRoster<T extends { id: string; name: string }>(
    leaders: T[],
    homeRoster: { id: string }[],
    awayRoster: { id: string }[],
  ): { valid: T[]; invalid: T[] } {
    const allRosterIds = [...homeRoster, ...awayRoster].map((r) => r.id);
    const valid: T[] = [];
    const invalid: T[] = [];

    for (const leader of leaders) {
      if (allRosterIds.includes(leader.id)) {
        valid.push(leader);
      } else {
        invalid.push(leader);
        this.logger.warn(`Líder ${leader.name} (${leader.id}) no encontrado en roster`);
      }
    }

    return { valid, invalid };
  }

  // ─── FALLBACK ────────────────────────────────────────────────────────────

  /**
   * Devuelve datos limitados cuando faltan stats
   */
  buildLimitedAnalysisContext(
    availableData: Record<string, unknown>,
    missingFields: string[],
  ): string {
    const context = ['⚠️ ANÁLISIS LIMITADO — Datos no disponibles:'];
    for (const field of missingFields) {
      context.push(`  - ${field}`);
    }
    context.push('');
    context.push('El análisis se basará únicamente en datos confirmados.');
    return context.join('\n');
  }

  /**
   * Pre-LLM validation summary for logging
   */
  buildPreLLMLogging(data: {
    parsedStats: ParsedStatsSummary;
    missingFields: string[];
    rosterValidated: boolean;
    validationErrors: ValidationError[];
  }): string {
    return JSON.stringify({
      preLLMValidation: {
        parsedStats: data.parsedStats,
        missingFields: data.missingFields,
        rosterValidated: data.rosterValidated,
        errorsCount: data.validationErrors.length,
        errors: data.validationErrors,
        readyForLLM: data.parsedStats.homeLeadersValid && data.parsedStats.awayLeadersValid,
      },
    }, null, 2);
  }
}