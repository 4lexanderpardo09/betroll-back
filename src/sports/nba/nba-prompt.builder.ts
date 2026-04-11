import { Injectable } from '@nestjs/common';
import {
  CompleteMatchOddsData,
  TeamMarketOdds,
  PlayerPropsData,
  PlayerPropLine,
  MatchScore,
} from '../../services/odds-api.service';

export interface NbaPromptData {
  oddsData: CompleteMatchOddsData;
  espnData: {
    homeTeamStats?: any;
    awayTeamStats?: any;
    injuries?: { home: any[]; away: any[] };
  };
  userBankroll: number;
}

@Injectable()
export class NbaPromptBuilder {
  /**
   * Build the NBA analysis prompt
   */
  build(data: NbaPromptData): string {
    const { oddsData, espnData, userBankroll } = data;
    const { homeTeam, awayTeam } = oddsData;

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
FECHA: ${new Date(oddsData.commenceTime).toLocaleDateString('es-CO')}

`;

    // Team odds section
    prompt += this.buildTeamOddsSection(oddsData.teamOdds);

    // Player props section
    prompt += this.buildPlayerPropsSection(oddsData.playerProps);

    // Recent form section
    prompt += this.buildRecentFormSection(oddsData.recentScores, homeTeam, awayTeam);

    // ESPN stats if available
    if (espnData.homeTeamStats || espnData.awayTeamStats) {
      prompt += this.buildEspnStatsSection(homeTeam, awayTeam, espnData);
    }

    // Injuries section
    if (espnData.injuries) {
      prompt += this.buildInjuriesSection(homeTeam, awayTeam, espnData.injuries);
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

  private buildTeamOddsSection(teamOdds: TeamMarketOdds): string {
    const { moneyline, spread, total, homeTeam, awayTeam } = teamOdds;

    let section = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 CUOTAS DEL MERCADO (Consenso)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MONEYLINE:
  ${homeTeam}: ${moneyline.consensus.home > 0 ? '+' : ''}${moneyline.consensus.home} (implied: ${(moneyline.impliedProbHome * 100).toFixed(1)}%)
  ${awayTeam}: ${moneyline.consensus.away > 0 ? '+' : ''}${moneyline.consensus.away} (implied: ${(moneyline.impliedProbAway * 100).toFixed(1)}%)

`;

    if (spread) {
      section += `SPREAD:
  ${homeTeam} ${spread.line > 0 ? '+' : ''}${spread.line} @ ${spread.consensus.homePrice}
  ${awayTeam} ${(-spread.line) > 0 ? '+' : ''}${(-spread.line)} @ ${spread.consensus.awayPrice}

`;
    }

    if (total) {
      section += `TOTAL (O/U):
  ${total.line} — Over: ${total.consensus.overPrice} | Under: ${total.consensus.underPrice}

`;
    }

    // Add bookmaker range info
    section += `RANGO DE CUOTAS:
  ML range: ${moneyline.range.min} a ${moneyline.range.max}
  Bookmakers: ${moneyline.home.map(b => b.bookmakerTitle).join(', ')}

`;

    return section;
  }

  private buildPlayerPropsSection(playerProps: PlayerPropsData): string {
    if (!playerProps.props || playerProps.props.length === 0) {
      return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏀 PROPS DE JUGADORES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Props no disponibles para este partido.

`;
    }

    let section = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏀 PROPS DE JUGADORES (Consenso)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

    // Group by market
    const byMarket: Record<string, PlayerPropLine[]> = {};
    for (const prop of playerProps.props) {
      if (!byMarket[prop.market]) byMarket[prop.market] = [];
      byMarket[prop.market].push(prop);
    }

    // For each market, show the consensus line (average across bookmakers)
    for (const [market, props] of Object.entries(byMarket)) {
      const label = props[0]?.marketLabel || market;
      section += `${label}:\n`;

      // Group by player
      const byPlayer: Record<string, PlayerPropLine[]> = {};
      for (const p of props) {
        if (!byPlayer[p.player]) byPlayer[p.player] = [];
        byPlayer[p.player].push(p);
      }

      for (const [player, lines] of Object.entries(byPlayer)) {
        const avgLine = lines.reduce((sum, p) => sum + p.line, 0) / lines.length;
        const avgOverPrice = lines.reduce((sum, p) => sum + p.overPrice, 0) / lines.length;
        const avgUnderPrice = lines.reduce((sum, p) => sum + p.underPrice, 0) / lines.length;

        section += `  ${player}: O/U ${avgLine.toFixed(1)} | Over: ${avgOverPrice > 0 ? '+' : ''}${avgOverPrice} | Under: ${avgUnderPrice > 0 ? '+' : ''}${avgUnderPrice}\n`;
      }
      section += '\n';
    }

    return section;
  }

  private buildRecentFormSection(recentScores: MatchScore[], homeTeam: string, awayTeam: string): string {
    if (!recentScores || recentScores.length === 0) {
      return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 FORMA RECIENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Datos no disponibles.

`;
    }

    // Find recent matches for each team (last 5)
    const homeRecent = recentScores
      .filter(s => s.completed && (this.nameMatch(s.homeTeam, homeTeam) || this.nameMatch(s.awayTeam, homeTeam)))
      .slice(0, 5);

    const awayRecent = recentScores
      .filter(s => s.completed && (this.nameMatch(s.homeTeam, awayTeam) || this.nameMatch(s.awayTeam, awayTeam)))
      .slice(0, 5);

    let section = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 FORMA RECIENTE (últimos partidos)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${homeTeam}:
${homeRecent.length > 0 ? homeRecent.map(s => this.formatScore(s, homeTeam)).join('\n') : '  Sin partidos recientes'}

${awayTeam}:
${awayRecent.length > 0 ? awayRecent.map(s => this.formatScore(s, awayTeam)).join('\n') : '  Sin partidos recientes'}

`;

    return section;
  }

  private formatScore(match: MatchScore, forTeam: string): string {
    const isHome = this.nameMatch(match.homeTeam, forTeam);
    const teamScore = isHome ? match.homeScore : match.awayScore;
    const opponent = isHome ? match.awayTeam : match.homeTeam;
    const opponentScore = isHome ? match.awayScore : match.homeScore;
    const date = new Date(match.commenceTime).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' });
    const result = parseInt(teamScore || '0') > parseInt(opponentScore || '0') ? 'W' : 'L';
    return `  [${date}] vs ${opponent}: ${teamScore}-${opponentScore} (${result})`;
  }

  private buildEspnStatsSection(homeTeam: string, awayTeam: string, espnData: NbaPromptData['espnData']): string {
    let section = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 ESTADÍSTICAS ESPN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${homeTeam}:
${this.formatEspnStats(espnData.homeTeamStats)}

${awayTeam}:
${this.formatEspnStats(espnData.awayTeamStats)}

`;
    return section;
  }

  private formatEspnStats(stats: any): string {
    if (!stats) return '  Datos no disponibles';

    const lines: string[] = [];
    if (stats.ppg) lines.push(`PPG: ${stats.ppg}`);
    if (stats.fg) lines.push(`FG%: ${stats.fg}`);
    if (stats.reb) lines.push(`REB: ${stats.reb}`);
    if (stats.ast) lines.push(`AST: ${stats.ast}`);
    if (stats.record) lines.push(`Record: ${stats.record}`);

    return lines.length > 0 ? `  ${lines.join(' | ')}` : '  Datos no disponibles';
  }

  private buildInjuriesSection(homeTeam: string, awayTeam: string, injuries: { home: any[]; away: any[] }): string {
    let section = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏥 LESIONES REPORTADAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${homeTeam}:
${this.formatInjuries(injuries.home)}

${awayTeam}:
${this.formatInjuries(injuries.away)}

`;
    return section;
  }

  private formatInjuries(injuries: any[]): string {
    if (!injuries || injuries.length === 0) return '  Sin lesiones reportadas';

    return injuries
      .map((inj) => {
        const player = inj.athlete?.displayName || inj.player?.fullName || inj.displayName || 'Desconocido';
        const detail = inj.shortComment || inj.shortDetail || inj.status || 'N/A';
        return `  - ${player}: ${detail}`;
      })
      .join('\n');
  }

  private nameMatch(a: string, b: string): boolean {
    const normalize = (s: string) => s.toLowerCase().trim();
    return normalize(a).includes(normalize(b)) || normalize(b).includes(normalize(a));
  }
}
