import { Injectable } from '@nestjs/common';
import { NbaMatchOdds } from '../../services/espn-odds.service';
import { ESPNTeamLeader, ProcessedAthleteStats } from '../../services/espn-stats.service';
import { TeamSeasonStats } from '../../services/nba-team-stats-aggregator.service';

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
  /** Boxscore data (for past/final games) */
  gameBoxscore?: NbaMatchOdds['gameBoxscore'];
  /** Enriched team stats from roster aggregation (core API) */
  teamSeasonStats?: {
    home: TeamSeasonStats;
    away: TeamSeasonStats;
  };
}

@Injectable()
export class NbaPromptBuilder {
  /**
   * Build the NBA analysis prompt using ESPN data only
   */
  build(data: NbaPromptData): string {
    const { match, odds, teamStats, athleteStats, espnPrompt, userBankroll, gameBoxscore, teamSeasonStats } = data;
    const { homeTeam, awayTeam } = match;

    const formattedBankroll = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(userBankroll);

    const isFinalGame = match.status === 'final';

    let prompt = `Actúa como un analista deportivo especializado en NBA con acceso a estadísticas avanzadas, modelos probabilísticos y análisis de rendimiento profesional.

Objetivo: Proporcionar un análisis deportivo completo y objetivo del partido, evaluando el rendimiento esperado de cada equipo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 TIPO DE ANÁLISIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${isFinalGame
  ? `⚠️ PARTIDO FINALIZADO — Este partido ya se jugó. Se proporcionan las estadísticas reales del juego para referencia.`
  : `📅 PARTIDO PROGRAMADO — Predice el resultado basándote en tendencias, forma y datos disponibles.`}
FECHA: ${new Date(match.commenceTime).toLocaleDateString('es-CO')}
EQUIPO LOCAL: ${homeTeam}
EQUIPO VISITANTE: ${awayTeam}
SEDE: ${match.venue ? `${match.venue.name}, ${match.venue.city}` : 'No disponible'}

`;

    // Team odds section
    prompt += this.buildOddsSection(match, odds);

    // ENRICHED TEAM STATS — stats calculadas desde roster + core API (si disponibles)
    if (teamSeasonStats) {
      prompt += this.buildEnrichedTeamSection(homeTeam, awayTeam, teamSeasonStats);
    }

    // BOXSCORE — solo si es partido finalizado
    if (gameBoxscore) {
      prompt += this.buildBoxscoreSection(homeTeam, awayTeam, gameBoxscore);
    }

    // Team stats section (temporada — no boxscore)
    prompt += this.buildTeamStatsSection(homeTeam, awayTeam, teamStats);

    // Key players — usa boxscore si disponible, si no athleteStats
    if (gameBoxscore) {
      prompt += this.buildBoxscorePlayersSection(homeTeam, awayTeam, gameBoxscore);
    } else {
      prompt += this.buildKeyPlayersSection(teamStats, athleteStats);
    }

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
1️⃣6️⃣ PREDICCIÓN DE RESULTADO — Score esperado${isFinalGame ? ' (compara con resultado real)' : ''}
1️⃣7️⃣ RESUMEN EJECUTIVO — Conclusión del análisis

IMPORTANTE:
${isFinalGame
  ? `- El partido ya terminó. Compara tu predicción con el resultado real.\n- Identifica qué insights fueron correctos y cuáles no.`
  : `- Predice el resultado basándote en los datos proporcionados.\n- Asigna probabilidades a cada equipo.`}
- Analiza los datos proporcionados y da tu mejor evaluación deportiva
- Si falta información, indica "Datos no disponibles"
- Sé específico con números y estadísticas
- Da una predicción clara de resultado y margen
- Bankroll del usuario: ${formattedBankroll}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 REGLAS ANTIALUCINACIÓN (OBLIGATORIAS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Antes de incluir CUALQUIER estadísticas en el análisis, verifica:
  ✓ El jugador EXISTE en el roster del equipo proporcionado
  ✓ La estadística está explícitamente en los datos de entrada
  ✓ El valor numérico NO es "?" ni "-" ni "N/A"

PROHIBIDO:
  ✗ NUNCA escribas "?" — escribe "Datos no disponibles"
  ✗ NUNCA inventes jugadores que no estén en los datos
  ✗ NUNCA asumas estadísticas sin confirmación explícita
  ✗ NUNCA asignes un jugador a un equipo diferente
  ✗ NUNCA inferencias seeding (NBA solo tiene 15 equipos por conferencia)

SÍ Permitido:
  ✓ Usar "Datos no disponibles" cuando falte información
  ✓ Inferir tendencias basándote en datos parciales
  ✓ Comparar promedios cuando estén disponibles

SI LOS DATOS DE ENTRADA NO CONTIENEN:
  - PPG/RPG/APG de un jugador → no menciones ese jugador
  - Boxscore → usa solo promedios de temporada
  - Roster → no inventes alineaciones

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 FORMATO DE RESPUESTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cada sección debe:
1. Comenzar con el encabezado numérico (1️⃣, 2️⃣, etc.)
2. Contener SOLO datos confirmables de los输入
3. Si una sección no tiene datos → escribir "Datos no disponibles para esta sección"
4. NUNCA dejar una sección vacía con solo "?"

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

    const buildTeam = (leaders: ESPNTeamLeader[]): string => {
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
${buildTeam(homeLeaders)}

VISITANTE:
${buildTeam(awayLeaders)}

`;
  }

  private buildBoxscoreSection(
    homeTeam: string,
    awayTeam: string,
    boxscore: NonNullable<NbaPromptData['gameBoxscore']>,
  ): string {
    const { home, away } = boxscore;

    const getStat = (stats: Record<string, string>, key: string, fallback = '?') =>
      stats[key] ?? fallback;

    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 RESULTADO FINAL DEL PARTIDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏀 ${homeTeam}: ${home.points} pts
   FG: ${getStat(home.stats, 'fieldGoalsMade-fieldGoalsAttempted', 'N/A')} (${getStat(home.stats, 'fieldGoalPct', '?')})
   3P: ${getStat(home.stats, 'threePointFieldGoalsMade-threePointFieldGoalsAttempted', 'N/A')} (${getStat(home.stats, 'threePointFieldGoalPct', '?')})
   FT: ${getStat(home.stats, 'freeThrowsMade-freeThrowsAttempted', 'N/A')} (${getStat(home.stats, 'freeThrowPct', '?')})
   REB: ${getStat(home.stats, 'totalRebounds', '?')} | OREB: ${getStat(home.stats, 'offensiveRebounds', '?')} | DREB: ${getStat(home.stats, 'defensiveRebounds', '?')}
   AST: ${getStat(home.stats, 'assists', '?')} | TO: ${getStat(home.stats, 'turnovers', '?')}
   STL: ${getStat(home.stats, 'steals', '?')} | BLK: ${getStat(home.stats, 'blocks', '?')}
   Pts in Paint: ${getStat(home.stats, 'pointsInPaint', '?')} | Fast Break: ${getStat(home.stats, 'fastBreakPoints', '?')}
   Largest Lead: ${getStat(home.stats, 'largestLead', '?')}

🏀 ${awayTeam}: ${away.points} pts
   FG: ${getStat(away.stats, 'fieldGoalsMade-fieldGoalsAttempted', 'N/A')} (${getStat(away.stats, 'fieldGoalPct', '?')})
   3P: ${getStat(away.stats, 'threePointFieldGoalsMade-threePointFieldGoalsAttempted', 'N/A')} (${getStat(away.stats, 'threePointFieldGoalPct', '?')})
   FT: ${getStat(away.stats, 'freeThrowsMade-freeThrowsAttempted', 'N/A')} (${getStat(away.stats, 'freeThrowPct', '?')})
   REB: ${getStat(away.stats, 'totalRebounds', '?')} | OREB: ${getStat(away.stats, 'offensiveRebounds', '?')} | DREB: ${getStat(away.stats, 'defensiveRebounds', '?')}
   AST: ${getStat(away.stats, 'assists', '?')} | TO: ${getStat(away.stats, 'turnovers', '?')}
   STL: ${getStat(away.stats, 'steals', '?')} | BLK: ${getStat(away.stats, 'blocks', '?')}
   Pts in Paint: ${getStat(away.stats, 'pointsInPaint', '?')} | Fast Break: ${getStat(away.stats, 'fastBreakPoints', '?')}
   Largest Lead: ${getStat(away.stats, 'largestLead', '?')}

`;
  }

  private buildBoxscorePlayersSection(
    homeTeam: string,
    awayTeam: string,
    boxscore: NonNullable<NbaPromptData['gameBoxscore']>,
  ): string {
    const formatPlayerRow = (p: { name: string; position: string; min: string; pts: number; fg: string; threePt: string; ft: string; reb: number; ast: number; to: number; stl: number; blk: number; plusMinus: number }) =>
      `  ${p.name.padEnd(20)} (${p.position}) | MIN: ${p.min} | PTS: ${String(p.pts).padStart(3)} | FG: ${p.fg} | 3P: ${p.threePt} | FT: ${p.ft} | REB: ${String(p.reb).padStart(2)} | AST: ${String(p.ast).padStart(2)} | TO: ${String(p.to).padStart(2)} | STL: ${String(p.stl).padStart(2)} | BLK: ${String(p.blk).padStart(2)} | +/-: ${p.plusMinus > 0 ? '+' : ''}${p.plusMinus}`;

    const topHome = boxscore.home.players.slice(0, 5);
    const topAway = boxscore.away.players.slice(0, 5);

    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏀 ESTADÍSTICAS DE JUGADORES (BOXSCORE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LOCAL — ${homeTeam}:
${topHome.length > 0 ? topHome.map(formatPlayerRow).join('\n') : '  Sin datos disponibles'}

VISITANTE — ${awayTeam}:
${topAway.length > 0 ? topAway.map(formatPlayerRow).join('\n') : '  Sin datos disponibles'}

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

  /**
   * Builds enriched team stats section from roster aggregation.
   * This shows computed team totals/averages from all players in roster.
   */
  private buildEnrichedTeamSection(
    homeTeam: string,
    awayTeam: string,
    teamStats: { home: TeamSeasonStats; away: TeamSeasonStats },
  ): string {
    const { home, away } = teamStats;

    const topHomePlayers = home.players
      .sort((a, b) => b.PPG - a.PPG)
      .slice(0, 5);
    const topAwayPlayers = away.players
      .sort((a, b) => b.PPG - a.PPG)
      .slice(0, 5);

    const buildPlayerRows = (players: typeof topHomePlayers): string => {
      return players
        .map(p => `  ${p.name.padEnd(20)} (${p.position}) | PPG: ${String(p.PPG).padStart(5)} | RPG: ${String(p.RPG).padStart(5)} | APG: ${String(p.APG).padStart(5)} | FG%: ${(p.FG_PCT * 100).toFixed(1).padStart(5)}`)
        .join('\n');
    };

    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 ESTADÍSTICAS DE EQUIPO (Desde Roster Completo)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ NOTA: Estas estadísticas fueron calculadas agregadamente desde el roster completo de cada equipo (core API).

${home.teamName}:
  TEMPORADA COMPLETA | Juegos: ${home.totals.gamesPlayed}
  PPG: ${home.averages.PPG} | RPG: ${home.averages.RPG} | APG: ${home.averages.APG}
  FG%: ${(home.averages.FG_PCT * 100).toFixed(1)}% | 3P%: ${(home.averages.THREE_PT_PCT * 100).toFixed(1)}% | FT%: ${(home.averages.FT_PCT * 100).toFixed(1)}%
  SPG: ${home.averages.SPG} | BPG: ${home.averages.BPG}
  Minutes/Game: ${home.averages.MPG}
  Asistencias Totales: ${home.totals.assists} | Rebotes Totales: ${home.totals.rebounds}
  Tasa A/TO: ${home.advanced.teamAssistTurnoverRatio} | TS%: ${(home.advanced.teamTrueShootingPct * 100).toFixed(1)}%
  TOP 5 JUGADORES:
${buildPlayerRows(topHomePlayers)}

${away.teamName}:
  TEMPORADA COMPLETA | Juegos: ${away.totals.gamesPlayed}
  PPG: ${away.averages.PPG} | RPG: ${away.averages.RPG} | APG: ${away.averages.APG}
  FG%: ${(away.averages.FG_PCT * 100).toFixed(1)}% | 3P%: ${(away.averages.THREE_PT_PCT * 100).toFixed(1)}% | FT%: ${(away.averages.FT_PCT * 100).toFixed(1)}%
  SPG: ${away.averages.SPG} | BPG: ${away.averages.BPG}
  Minutes/Game: ${away.averages.MPG}
  Asistencias Totales: ${away.totals.assists} | Rebotes Totales: ${away.totals.rebounds}
  Tasa A/TO: ${away.advanced.teamAssistTurnoverRatio} | TS%: ${(away.advanced.teamTrueShootingPct * 100).toFixed(1)}%
  TOP 5 JUGADORES:
${buildPlayerRows(topAwayPlayers)}

`;
  }
}
