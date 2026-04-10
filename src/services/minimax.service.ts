import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface MiniMaxMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface MiniMaxResponse {
  id: string;
  model: string;
  choices: {
    index: number;
    finish_reason: string;
    messages: MiniMaxMessage[];
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

@Injectable()
export class MiniMaxService {
  private readonly baseUrl = 'https://api.minimax.io/v1';
  private readonly model = 'MiniMax-M2.7';
  private readonly maxTokens = 16000;
  private readonly temperature = 0.7;
  private readonly logger = new Logger(MiniMaxService.name);

  constructor(private readonly configService: ConfigService) {}

  private get apiKey(): string {
    const key = this.configService.get<string>('MINIMAX_API_KEY');
    if (!key) {
      throw new Error('MINIMAX_API_KEY not configured');
    }
    return key;
  }

  /**
   * Send a chat completion request to MiniMax
   */
  async chatCompletion(
    messages: MiniMaxMessage[],
    options?: {
      maxTokens?: number;
      temperature?: number;
      model?: string;
    },
  ): Promise<{
    content: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }> {
    const url = `${this.baseUrl}/text/chatcompletion_v2`;

    const body = {
      model: options?.model || this.model,
      max_tokens: options?.maxTokens || this.maxTokens,
      temperature: options?.temperature ?? this.temperature,
      messages,
    };

    this.logger.debug(`MiniMax API request to ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`MiniMax API error: ${response.status} - ${errorText}`);
      throw new InternalServerErrorException(
        `MiniMax API error: ${response.status} - ${errorText}`,
      );
    }

    const data: MiniMaxResponse = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new InternalServerErrorException('MiniMax returned no choices');
    }

    const choice = data.choices[0];

    return {
      content: choice.messages[choice.messages.length - 1]?.content || '',
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  /**
   * Generate a simple completion (single prompt)
   */
  async complete(
    prompt: string,
    options?: {
      maxTokens?: number;
      temperature?: number;
      model?: string;
    },
  ): Promise<{
    content: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }> {
    return this.chatCompletion(
      [{ role: 'user', content: prompt }],
      options,
    );
  }

  /**
   * Generate basketball analysis using the prompt builder
   */
  async generateBasketballAnalysis(
    matchData: {
      homeTeam: string;
      awayTeam: string;
      homeTeamStats?: any;
      awayTeamStats?: any;
      homeTeamForm?: string;
      awayTeamForm?: string;
      injuries?: {
        home: any[];
        away: any[];
      };
      odds?: {
        spread?: { line: number; price: number };
        total?: { line: number; price: number };
        moneyline?: { home: number; away: number };
      };
      h2h?: string[];
    },
    userBankroll: number,
  ): Promise<{
    analysis: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    estimatedCost: number;
  }> {
    const prompt = this.buildBasketballPrompt(matchData, userBankroll);

    const result = await this.complete(prompt, {
      maxTokens: 16000,
      temperature: 0.7,
    });

    if (!result.usage) {
      throw new Error('MiniMax did not return usage information');
    }

    // Estimate cost: ~$0.0015 per 1K tokens for M2.7
    const estimatedCost = (result.usage.totalTokens / 1000) * 0.0015;

    return {
      analysis: result.content,
      usage: result.usage,
      estimatedCost,
    };
  }

  /**
   * Build the basketball analysis prompt
   */
  private buildBasketballPrompt(
    matchData: {
      homeTeam: string;
      awayTeam: string;
      homeTeamStats?: any;
      awayTeamStats?: any;
      homeTeamForm?: string;
      awayTeamForm?: string;
      injuries?: {
        home: any[];
        away: any[];
      };
      odds?: {
        spread?: { line: number; price: number };
        total?: { line: number; price: number };
        moneyline?: { home: number; away: number };
      };
      h2h?: string[];
    },
    userBankroll: number,
  ): string {
    // Format bankroll in COP
    const formattedBankroll = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(userBankroll);

    let prompt = `Actúa como un analista cuantitativo especializado en NBA con acceso a estadísticas avanzadas, modelos probabilísticos y análisis de mercado profesional.

Tu objetivo es encontrar VALUE BETS reales con ventaja matemática sobre las casas.
Busca información actualizada en internet ANTES de responder. Usa fuentes como Basketball-Reference, NBA.com/stats, ESPN, Rotowire y The Athletic.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATOS DEL PARTIDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EQUIPO LOCAL: ${matchData.homeTeam}
EQUIPO VISITANTE: ${matchData.awayTeam}
BANKROLL: ${formattedBankroll}

`;

    // Add stats if available
    if (matchData.homeTeamStats && matchData.awayTeamStats) {
      prompt += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 ESTADÍSTICAS COMPARADAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${matchData.homeTeam} (LOCAL):
${this.formatTeamStats(matchData.homeTeamStats)}

${matchData.awayTeam} (VISITANTE):
${this.formatTeamStats(matchData.awayTeamStats)}
`;
    }

    // Add form if available
    if (matchData.homeTeamForm && matchData.awayTeamForm) {
      prompt += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 FORMA RECIENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${matchData.homeTeam}: ${matchData.homeTeamForm}
${matchData.awayTeam}: ${matchData.awayTeamForm}
`;
    }

    // Add injuries if available
    if (matchData.injuries) {
      prompt += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏥 LESIONES REPORTADAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${matchData.homeTeam}:
${this.formatInjuries(matchData.injuries.home)}

${matchData.awayTeam}:
${this.formatInjuries(matchData.injuries.away)}
`;
    }

    // Add odds if available
    if (matchData.odds) {
      prompt += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 CUOTAS DEL MERCADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
      if (matchData.odds.spread) {
        prompt += `Spread: ${matchData.homeTeam} ${matchData.odds.spread.line > 0 ? '+' : ''}${matchData.odds.spread.line} @ ${matchData.odds.spread.price}\n`;
      }
      if (matchData.odds.total) {
        prompt += `Total: O/U ${matchData.odds.total.line} @ ${matchData.odds.total.price}\n`;
      }
      if (matchData.odds.moneyline) {
        prompt += `Moneyline: ${matchData.homeTeam} ${matchData.odds.moneyline.home} | ${matchData.awayTeam} ${matchData.odds.moneyline.away}\n`;
      }
    }

    // Add H2H if available
    if (matchData.h2h && matchData.h2h.length > 0) {
      prompt += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 HISTORIAL H2H (últimos partidos)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${matchData.h2h.slice(0, 5).join('\n')}
`;
    }

    // Add analysis instructions
    prompt += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 TAREA: GENERA ANÁLISIS COMPLETO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Genera un análisis completo con las siguientes secciones:

1️⃣ FORMA RECIENTE
2️⃣ ESTADÍSTICAS AVANZADAS DEL EQUIPO
3️⃣ EFICIENCIA OFENSIVA DETALLADA
4️⃣ ESTADÍSTICAS DEFENSIVAS
5️⃣ ANÁLISIS DE JUGADORES CLAVE — ${matchData.homeTeam.toUpperCase()}
6️⃣ ANÁLISIS DE JUGADORES CLAVE — ${matchData.awayTeam.toUpperCase()}
7️⃣ MATCHUPS INDIVIDUALES CRÍTICOS
8️⃣ REBOTES Y POSESIONES EXTRA
9️⃣ PROPS DE JUGADORES — LÍNEAS DEL MERCADO
🔟 ENFRENTAMIENTOS DIRECTOS H2H
1️⃣1️⃣ LOCALÍA Y VISITA
1️⃣2️⃣ FATIGA Y CALENDARIO
1️⃣3️⃣ LESIONES Y ROTACIONES
1️⃣4️⃣ ESTILO DE JUEGO Y MATCHUP TÁCTICO
1️⃣5️⃣ ANÁLISIS DE CUOTAS DE MERCADO
1️⃣6️⃣ MOVIMIENTO DE MERCADO
1️⃣7️⃣ MODELO DE PROBABILIDAD REAL
1️⃣8️⃣ DETECTAR VALUE BETS
1️⃣9️⃣ PREDICCIÓN FINAL
2️⃣0️⃣ TOP APUESTAS CON VALOR
2️⃣1️⃣ GESTIÓN DE BANKROLL
2️⃣2️⃣ RESUMEN EJECUTIVO FINAL

IMPORTANTE:
- Usa los datos proporcionados arriba
- Si falta información, indica "Datos no disponibles"
- Calcula el VALUE de cada apuesta
- Sugiere stake basado en el bankroll de ${formattedBankroll}
- Formato de stake: categoría A (5%), B (3%), C (1.5%), Props (0.5%)

`;

    return prompt;
  }

  private formatTeamStats(stats: any): string {
    if (!stats) return 'Datos no disponibles';

    const lines: string[] = [];
    if (stats.ppg) lines.push(`PPG: ${stats.ppg}`);
    if (stats.fg) lines.push(`FG%: ${stats.fg}`);
    if (stats.reb) lines.push(`REB: ${stats.reb}`);
    if (stats.ast) lines.push(`AST: ${stats.ast}`);
    if (stats.record) lines.push(`Record: ${stats.record}`);

    return lines.length > 0 ? lines.join(' | ') : 'Datos no disponibles';
  }

  private formatInjuries(injuries: any[]): string {
    if (!injuries || injuries.length === 0) return 'Sin lesiones reportadas';

    return injuries
      .map((inj) => {
        const player = inj.player?.fullName || 'Desconocido';
        const detail = inj.shortDetail || inj.type?.description || 'N/A';
        const returnDate = inj.returnDate || 'N/A';
        return `- ${player}: ${detail} (Return: ${returnDate})`;
      })
      .join('\n');
  }
}
