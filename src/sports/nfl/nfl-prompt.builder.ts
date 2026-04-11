import { Injectable } from '@nestjs/common';
import {
  CompleteMatchOddsData,
  TeamMarketOdds,
  PlayerPropsData,
  PlayerPropLine,
  MatchScore,
} from '../../services/odds-api.service';

export interface NflPromptData {
  oddsData: CompleteMatchOddsData;
  espnData: {
    homeTeamStats?: any;
    awayTeamStats?: any;
    injuries?: { home: any[]; away: any[] };
  };
  userBankroll: number;
}

// NFL prop labels
const NFL_PROP_LABELS: Record<string, string> = {
  player_pass_tds: 'Pass TDs',
  player_pass_yards: 'Pass Yards',
  player_rush_yards: 'Rush Yards',
  player_receptions: 'Receptions',
  player_reception_yards: 'Rec Yards',
  player_anytime_td: 'Anytime TD',
};

@Injectable()
export class NflPromptBuilder {
  /**
   * Build the NFL analysis prompt
   */
  build(data: NflPromptData): string {
    const { oddsData, espnData, userBankroll } = data;
    const { homeTeam, awayTeam } = oddsData;

    const formattedBankroll = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(userBankroll);

    let prompt = `Actúa como un analista deportivo especializado en NFL con acceso a estadísticas avanzadas, modelos probabilísticos y análisis de rendimiento profesional.

Objetivo: Proporcionar un análisis deportivo completo y objetivo del partido de fútbol americano, evaluando el rendimiento esperado de cada equipo.

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

    // Injuries section (important in NFL)
    if (espnData.injuries) {
      prompt += this.buildInjuriesSection(homeTeam, awayTeam, espnData.injuries);
    }

    // Analysis instructions
    prompt += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 TAREA: GENERA ANÁLISIS DE FÚTBOL AMERICANO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Genera un análisis deportivo completo y profesional con las siguientes secciones:

1️⃣ FORMA RECIENTE — Últimos partidos y tendencias de cada equipo
2️⃣ RENDIMIENTO OFENSIVO — Passing game, rushing game, red zone efficiency
3️⃣ RENDIMIENTO DEFENSIVO — Pass rush, coverage, run defense
4️⃣ MATCHUP DE TRENES — O-Line vs D-Line
5️⃣ JUGADORES CLAVE — ${homeTeam.toUpperCase()}
6️⃣ JUGADORES CLAVE — ${awayTeam.toUpperCase()}
7️⃣ QUARTERBACKS — Comparativa de mariscales
8️⃣ FACTOR ESPECIAL TEAMS — Field goal, punting, kick returns
9️⃣ TENDENCIAS Y MOMENTUM — Cómo llegan ambos equipos
🔟 HISTORIAL H2H — Encuentros recientes
1️⃣1️⃣ FACTOR LOCALÍA — Rendimiento en casa vs fuera
1️⃣2️⃣ LESIONES CRÍTICAS — Impacto en el roster
1️⃣3️⃣ CLIMA Y CONDICIONES — Estadio cubierto/al aire libre
1️⃣4️⃣ PREDICCIÓN DE RESULTADO — Score esperado y margen
1️⃣5️⃣ RESUMEN EJECUTIVO — Conclusión del análisis

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

    section += `RANGO DE CUOTAS:
  ML range: ${moneyline.range.min} a ${moneyline.range.max}

`;

    return section;
  }

  private buildPlayerPropsSection(playerProps: PlayerPropsData): string {
    if (!playerProps.props || playerProps.props.length === 0) {
      return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏈 PROPS DE JUGADORES (NFL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Props no disponibles para este partido.

`;
    }

    let section = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏈 PROPS DE JUGADORES (NFL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

    // Group by market
    const byMarket: Record<string, PlayerPropLine[]> = {};
    for (const prop of playerProps.props) {
      if (!byMarket[prop.market]) byMarket[prop.market] = [];
      byMarket[prop.market].push(prop);
    }

    for (const [market, props] of Object.entries(byMarket)) {
      const label = NFL_PROP_LABELS[market] || market;
      section += `${label}:\n`;

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

  private buildEspnStatsSection(homeTeam: string, awayTeam: string, espnData: NflPromptData['espnData']): string {
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
    if (stats.record) lines.push(`Record: ${stats.record}`);
    if (stats.ppg) lines.push(`PPG: ${stats.ppg}`);
    if (stats.pointsAgainst) lines.push(`Pts Against: ${stats.pointsAgainst}`);

    return lines.length > 0 ? `  ${lines.join(' | ')}` : '  Datos no disponibles';
  }

  private buildInjuriesSection(homeTeam: string, awayTeam: string, injuries: { home: any[]; away: any[] }): string {
    let section = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏥 LESIONES REPORTADAS (CRÍTICAS EN NFL)
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
