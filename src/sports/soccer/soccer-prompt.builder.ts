import { Injectable } from '@nestjs/common';
import {
  CompleteMatchOddsData,
  TeamMarketOdds,
  MatchScore,
} from '../../services/odds-api.service';

export interface SoccerPromptData {
  oddsData: CompleteMatchOddsData;
  espnData: {
    homeTeamStats?: any;
    awayTeamStats?: any;
    injuries?: { home: any[]; away: any[] };
  };
  userBankroll: number;
}

@Injectable()
export class SoccerPromptBuilder {
  /**
   * Build the Soccer analysis prompt
   */
  build(data: SoccerPromptData): string {
    const { oddsData, espnData, userBankroll } = data;
    const { homeTeam, awayTeam } = oddsData;

    const formattedBankroll = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(userBankroll);

    let prompt = `Actúa como un analista deportivo especializado en fútbol soccer con acceso a estadísticas avanzadas, modelos probabilísticos y análisis de rendimiento profesional.

Objetivo: Proporcionar un análisis deportivo completo y objetivo del partido de soccer, evaluando el rendimiento esperado de cada equipo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATOS DEL PARTIDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EQUIPO LOCAL: ${homeTeam}
EQUIPO VISITANTE: ${awayTeam}
FECHA: ${new Date(oddsData.commenceTime).toLocaleDateString('es-CO')}

`;

    // Team odds section
    prompt += this.buildTeamOddsSection(oddsData.teamOdds);

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
🎯 TAREA: GENERA ANÁLISIS DE FÚTBOL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Genera un análisis deportivo completo y profesional con las siguientes secciones:

1️⃣ FORMA RECIENTE — Últimos partidos y rachas
2️⃣ RENDIMIENTO OFENSIVO — Goles marcados, disparos, creación de oportunidades
3️⃣ RENDIMIENTO DEFENSIVO — Goles recibidos, limpio, bloqueos
4️⃣ POSESIÓN Y CONTROL — Porcentaje de posesión, juego en equipo
5️⃣ ESTADÍSTICAS DE JUEGO — Tiros, corners, faltas, tarjetas
6️⃣ HOME vs AWAY — Rendimiento local vs visitante
7️⃣ JUGADORES CLAVE — ${homeTeam.toUpperCase()}
8️⃣ JUGADORES CLAVE — ${awayTeam.toUpperCase()}
9️⃣ TENDENCIAS DE APUESTAS — Line movement y mercado
🔟 HISTORIAL H2H — Encuentros recientes entre ambos
1️⃣1️⃣ FACTOR CAMPO — Ventaja de localía
1️⃣2️⃣ LESIONES Y SUSPENSIONES — Impacto en el once inicial
1️⃣3️⃣ CLIMA — Condiciones del partido
1️⃣4️⃣ PREDICCIÓN DE RESULTADO — Score esperado (marcador exacto y över/under)
1️⃣5️⃣ RESUMEN EJECUTIVO — Conclusión del análisis

IMPORTANTE:
- Analiza los datos proporcionados y da tu mejor evaluación deportiva
- Si falta información, indica "Datos no disponibles"
- Sé específico con números y estadísticas
- Da una predicción clara de resultado y margen
- Considera el mercado de över/under 2.5 goles
- Bankroll del usuario: ${formattedBankroll}

`;

    return prompt;
  }

  private buildTeamOddsSection(teamOdds: TeamMarketOdds): string {
    const { moneyline, spread, total, homeTeam, awayTeam } = teamOdds;

    // Soccer typically has 3-way moneyline (home, draw, away)
    let section = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 CUOTAS DEL MERCADO (Consenso)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MONEYLINE (3-way):
  ${homeTeam} (Local): ${moneyline.consensus.home > 0 ? '+' : ''}${moneyline.consensus.home}
  Empate: +${(100 / (1 - 1/moneyline.consensus.home - 1/moneyline.consensus.away)).toFixed(0) || 'N/A'}
  ${awayTeam} (Visitante): ${moneyline.consensus.away > 0 ? '+' : ''}${moneyline.consensus.away}

`;

    if (total) {
      section += `OVER/UNDER 2.5 GOLES:
  Over 2.5: ${total.consensus.overPrice}
  Under 2.5: ${total.consensus.underPrice}
  Línea: ${total.line}

`;
    }

    if (spread) {
      section += `HANDICAP ASIÁTICO:
  ${homeTeam} ${spread.line > 0 ? '+' : ''}${spread.line} @ ${spread.consensus.homePrice}
  ${awayTeam} ${(-spread.line) > 0 ? '+' : ''}${(-spread.line)} @ ${spread.consensus.awayPrice}

`;
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
    const result = parseInt(teamScore || '0') > parseInt(opponentScore || '0') ? 'W' : parseInt(teamScore || '0') === parseInt(opponentScore || '0') ? 'D' : 'L';
    return `  [${date}] vs ${opponent}: ${teamScore}-${opponentScore} (${result})`;
  }

  private buildEspnStatsSection(homeTeam: string, awayTeam: string, espnData: SoccerPromptData['espnData']): string {
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
    if (stats.form) lines.push(`Forma: ${stats.form}`);

    return lines.length > 0 ? `  ${lines.join(' | ')}` : '  Datos no disponibles';
  }

  private buildInjuriesSection(homeTeam: string, awayTeam: string, injuries: { home: any[]; away: any[] }): string {
    let section = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏥 LESIONES Y SUSPENSIONES
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
