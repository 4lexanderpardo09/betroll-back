import { Injectable } from '@nestjs/common';
import { NbaMatchOdds } from '../../services/espn-odds.service';
import { ESPNTeamLeader, ProcessedAthleteStats } from '../../services/espn-stats.service';

// ─── NEW PROMPT DATA ────────────────────────────────────────────────────────

export interface NbaMatchInfo {
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  venue: { name: string; city: string } | null;
  status: 'scheduled' | 'in_progress' | 'final';
}

export interface NbaOddsData {
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
}

export interface NbaTeamStatsData {
  home: Record<string, string>;
  away: Record<string, string>;
  homeRecord: string;
  awayRecord: string;
  homeLeaders: ESPNTeamLeader[];
  awayLeaders: ESPNTeamLeader[];
}

export interface NbaPromptData {
  match: NbaMatchInfo;
  odds: NbaOddsData;
  teamStats: NbaTeamStatsData;
  athleteStats: Record<string, ProcessedAthleteStats>;
  espnPrompt: string;
  userBankroll: number;
}

@Injectable()
export class NbaPromptBuilder {
  /**
   * Build the NBA analysis prompt using ESPN data only
   */
  build(data: NbaPromptData): string {
    const { match, odds, teamStats, athleteStats, espnPrompt, userBankroll } = data;
    const { homeTeam, awayTeam } = match;

    const formattedBankroll = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(userBankroll);

    let prompt = `Actúa como un analista deportivo especializado en NBA con acceso a estadísticas avanzadas, modelos probabilísticos y análisis de rendimiento profesional.

Objetivo: Proporcionar un análisis deportivo completo y objetivo del partido, evaluando el rendimiento esperado de cada equipo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATOS DEL PARTIDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EQUIPO LOCAL: ${homeTeam}
EQUIPO VISITANTE: ${awayTeam}
FECHA: ${new Date(match.commenceTime).toLocaleDateString('es-CO')}
SEDE: ${match.venue ? `${match.venue.name}, ${match.venue.city}` : 'No disponible'}

`;

    // Team odds section
    prompt += this.buildOddsSection(match, odds);

    // Team stats section
    prompt += this.buildTeamStatsSection(homeTeam, awayTeam, teamStats);

    // Key players section
    prompt += this.buildKeyPlayersSection(teamStats, athleteStats);

    // Recent form (from recent results in espnPrompt)
    prompt += this.buildRecentFormSection(espnPrompt);

    // ESPN qualitative context
    if (espnPrompt) {
      prompt += `\n${espnPrompt}\n`;
    }

    // Analysis instructions
    prompt += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 TAREA: GENERA ANÁLISIS DEPORTIVO COMPLETO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Genera un análisis deportivo completo y profesional con las siguientes secciones:

1️⃣ FORMA RECIENTE — Últimos partidos y tendencias
2️⃣ ESTADÍSTICAS AVANZADAS DEL EQUIPO — PPG, FG%, eficiencia
3️⃣ EFICIENCIA OFENSIVA — Puntos por posesión, rating ofensivo
4️⃣ ESTADÍSTICAS DEFENSIVAS — Puntos permitidos, rating defensivo
5️⃣ JUGADORES CLAVE — ${homeTeam.toUpperCase()}
6️⃣ JUGADORES CLAVE — ${awayTeam.toUpperCase()}
7️⃣ MATCHUPS CRÍTICOS — Ventajas individuales
8️⃣ REBOTES Y POSESIONES — Control del tablero
9️⃣ TENDENCIAS DEL PARTIDO — Momentum y forma reciente
🔟 HISTORIAL H2H — Encuentros recientes
1️⃣1️⃣ FACTOR LOCALÍA — Rendimiento en casa vs fuera
1️⃣2️⃣ FATIGA Y CALENDARIO — Descanso entre partidos
1️⃣3️⃣ LESIONES Y ROTACIONES — Impacto en el roster
1️⃣4️⃣ ESTILO DE JUEGO — Pace, matchup táctico
1️⃣5️⃣ COMPARACIÓN ESTADÍSTICA — Cómo proyectan los modelos
1️⃣6️⃣ PREDICCIÓN DE RESULTADO — Score esperado
1️⃣7️⃣ RESUMEN EJECUTIVO — Conclusión del análisis

IMPORTANTE:
- Analiza los datos proporcionados y da tu mejor evaluación deportiva
- Si falta información, indica "Datos no disponibles"
- Sé específico con números y estadísticas
- Da una predicción clara de resultado y margen
- Bankroll del usuario: ${formattedBankroll}

`;

    return prompt;
  }

  // ─── SECTIONS ───────────────────────────────────────────────────────────

  private buildOddsSection(match: NbaMatchInfo, odds: NbaOddsData): string {
    const { homeTeam, awayTeam } = match;
    const { moneyline, spread, total } = odds;

    const formatAmerican = (val: number) => (val > 0 ? `+${val}` : `${val}`);
    const formatImplied = (val: number) => `${(val * 100).toFixed(1)}%`;

    let section = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 CUOTAS (ESPN BET)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MONEYLINE:
  ${homeTeam}: ${formatAmerican(moneyline.home)} (implied: ${formatImplied(moneyline.homeImplied)})
  ${awayTeam}: ${formatAmerican(moneyline.away)} (implied: ${formatImplied(moneyline.awayImplied)})

`;

    if (spread) {
      section += `SPREAD:
  ${homeTeam} ${spread.line > 0 ? '+' : ''}${spread.line} @ ${spread.homePrice}
  ${awayTeam} ${-spread.line > 0 ? '+' : ''}${(-spread.line)} @ ${spread.awayPrice}

`;
    }

    if (total) {
      section += `TOTAL (O/U):
  ${total.line} — Over: ${total.overPrice} | Under: ${total.underPrice}

`;
    }

    return section;
  }

  private buildTeamStatsSection(
    homeTeam: string,
    awayTeam: string,
    teamStats: NbaTeamStatsData,
  ): string {
    const { home, away, homeRecord, awayRecord } = teamStats;

    const getStat = (stats: Record<string, string>, key: string, fallback = '?') =>
      stats[key] ?? fallback;

    const homePPG = getStat(home, 'avgPoints', '?');
    const awayPPG = getStat(away, 'avgPoints', '?');

    let section = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 ESTADÍSTICAS DE EQUIPO (Temporada)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${homeTeam} (${homeRecord}):
  PPG: ${homePPG} | FG%: ${getStat(home, 'fieldGoalPct')} | 3P%: ${getStat(home, 'threePointPct')}
  Rebotes: ${getStat(home, 'avgRebounds')} | Asistencias: ${getStat(home, 'avgAssists')}

${awayTeam} (${awayRecord}):
  PPG: ${awayPPG} | FG%: ${getStat(away, 'fieldGoalPct')} | 3P%: ${getStat(away, 'threePointPct')}
  Rebotes: ${getStat(away, 'avgRebounds')} | Asistencias: ${getStat(away, 'avgAssists')}

`;

    return section;
  }

  private buildKeyPlayersSection(
    teamStats: NbaTeamStatsData,
    athleteStats: Record<string, ProcessedAthleteStats>,
  ): string {
    const { homeLeaders, awayLeaders } = teamStats;

    const buildTeam = (leaders: ESPNTeamLeader[], prefix: string): string => {
      let result = '';
      for (const leader of leaders) {
        if (['pointsPerGame', 'reboundsPerGame', 'assistsPerGame'].includes(leader.name)) {
          for (const l of leader.leaders) {
            const stats = athleteStats[l.athlete.id];
            const label = leader.abbreviation;
            const value = l.displayValue;
            if (stats) {
              result += `  ${l.athlete.fullName}: ${label} ${value} | FG%: ${stats.FG_PCT} | MIN: ${stats.MIN}\n`;
            } else {
              result += `  ${l.athlete.fullName}: ${label} ${value}\n`;
            }
          }
        }
      }
      return result || '  Sin datos disponibles\n';
    };

    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏀 JUGADORES CLAVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LOCAL (${homeLeaders[0]?.leaders[0]?.athlete.displayName ?? '?'}):
${buildTeam(homeLeaders, 'home')}

VISITANTE:
${buildTeam(awayLeaders, 'away')}

`;
  }

  private buildRecentFormSection(espnPrompt: string): string {
    // Extract recent form from espnPrompt if present
    const recentFormMatch = espnPrompt.match(/Últimos \d+ partidos:([\s\S]*?)(?=---)/);
    if (!recentFormMatch) return '';
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 FORMA RECIENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${recentFormMatch[1].trim()}

`;
  }
}
