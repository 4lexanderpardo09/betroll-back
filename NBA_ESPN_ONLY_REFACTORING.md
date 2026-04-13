# NBA ESPN-Only Refactoring — Documentación de cambios

> Fecha: 2026-04-13
> Estado: ✅ Completado

---

## Context

The Odds API y Sofascore tienen costo por request. ESPN API es gratis y tiene:
- Cuotas en el scoreboard (spread, moneyLine, overUnder)
- Stats de jugadores (overview, gamelog, splits)
- Contexto cualitativo (lesiones, forma, news)

**Objetivo:** Eliminar dependencias de The Odds API y Sofascore para NBA, usando solo ESPN API.

---

## Arquitectura final — 3 servicios ESPN

```
DataServicesModule (Global)
├── CacheService
├── ESPNQualitativeService  ← contexto cualitativo (lesiones, news, forma)
├── ESPNOddsService         ← scoreboard, odds, búsqueda de partidos
├── ESPNStatsService        ← athlete/team stats, leaders
├── OddsApiService          ← DEPRECATED para NBA (solo NFL/Soccer por ahora)
├── SofascoreService        ← DEPRECATED para NBA
└── MiniMaxService
```

---

## Archivos creados

### `backend/src/services/espn-odds.service.ts`

**Responsabilidad:** Cuotas y búsqueda de partidos

**Métodos principales:**
- `getScoreboard(date: string)` → `GET /scoreboard?dates=YYYYMMDD` — partidos del día
- `findNbaMatchByDate(homeTeam, awayTeam, date)` → busca evento por nombre de equipo
- `getMatchOdds(eventId)` → `GET /summary?event={eventId}` — extrae odds + stats

**Tipos exportados:**
```typescript
export interface NbaMatchFound {
  eventId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  commenceTime: string;
}

export interface NbaMatchOdds {
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  status: 'scheduled' | 'in_progress' | 'final';
  venue: { name: string; city: string } | null;
  moneyline: { home: number; away: number; homeImplied: number; awayImplied: number };
  spread: { line: number; homePrice: number; awayPrice: number } | null;
  total: { line: number; overPrice: number; underPrice: number } | null;
  teamStats: { home: Record<string, string>; away: Record<string, string> };
  homeRecord: string;
  awayRecord: string;
  homeLeaders: ESPNCompetitorLeader[];
  awayLeaders: ESPNCompetitorLeader[];
}
```

---

### `backend/src/services/espn-stats.service.ts`

**Responsabilidad:** Stats de jugadores y líderes de equipo

**Métodos principales:**
- `getTeamLeaders(teamId)` → `GET /teams/{teamId}/leaders` — PPG/RPG/APG top
- `getAthleteOverview(athleteId)` → overview del jugador
- `getAthleteSplits(athleteId)` → splits home/away
- `getAthleteGameLog(athleteId)` → últimos partidos
- `getAthleteStatsComplete(athleteId)` → **combinado**: overview + splits + recent games

**Tipos exportados:**
```typescript
export interface ProcessedAthleteStats {
  id: string;
  name: string;
  position: string;
  team: string;
  PPG: string; RPG: string; APG: string;
  FG_PCT: string; THREE_PT_PCT: string; FT_PCT: string;
  MIN: string;
  gamesPlayed?: string;
  splits: { home: Record<string, string>; away: Record<string, string> };
  recentGames: ESPNAthleteGameLogEvent[];
}
```

---

### `backend/src/services/espn-qualitative.service.ts`

**Rename:** `espn.service.ts` → `espn-qualitative.service.ts`

**Responsabilidad:** Contexto narrativo para IA (no cambió funcionalidad)

**Métodos principales:**
- `getQualitativeContext()` — ya existía
- `toAIPrompt()` — ya existía
- `getTeamForm()`, `getInjurySummaryForAI()`, `getTeamNews()`, etc. — ya existían

---

## Archivos modificados

### `backend/src/sports/nba/nba-analysis.service.ts`

**Cambio:** Reescrito para usar solo ESPN (sin OddsApiService)

**Flujo nuevo:**
```
analyzeMatch()
  ├── espnOddsService.findNbaMatchByDate()     → eventId + team IDs
  ├── espnOddsService.getMatchOdds()           → odds + stats
  ├── espnStatsService.getTeamLeaders() × 2    → home/away leaders
  ├── espnStatsService.getAthleteStatsComplete() → stats for top 3 PPG athletes
  ├── espnQualitativeService.getQualitativeContext() → injuries, news, form
  └── nbaPromptBuilder.build() → MiniMax
```

**Respuesta:**
```typescript
{
  analysis: string;
  usage: { promptTokens, completionTokens, totalTokens };
  estimatedCost: number;
  matchData: NbaMatchFound & { odds: NbaMatchOdds };
}
```

---

### `backend/src/sports/nba/nba-prompt.builder.ts`

**Cambio:** Adaptado a nueva estructura de datos ESPN

**Tipos:**
```typescript
export interface NbaMatchInfo {
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  venue: { name: string; city: string } | null;
  status: 'scheduled' | 'in_progress' | 'final';
}

export interface NbaOddsData {
  moneyline: { home: number; away: number; homeImplied: number; awayImplied: number };
  spread: { line: number; homePrice: number; awayPrice: number } | null;
  total: { line: number; overPrice: number; underPrice: number } | null;
}

export interface NbaTeamStatsData {
  home: Record<string, string>;
  away: Record<string, string>;
  homeRecord: string;
  awayRecord: string;
  homeLeaders: ESPNTeamLeader[];
  awayLeaders: ESPNTeamLeader[];
}
```

**Secciones del prompt:**
1. Datos del partido (fecha, sede)
2. Cuotas (ESPN BET — moneyline, spread, total)
3. Estadísticas de equipo (PPG, FG%, 3P%, rebotes, assists)
4. Jugadores clave (top 3 PPG con stats detallados)
5. Forma reciente (del espnPrompt)
6. Contexto cualitativo ESPN (lesiones, news, forma)
7. Instrucciones de análisis (17 secciones)

---

### `backend/src/sports/nba/nba.controller.ts`

**Cambio:** Respuesta ajustada a nueva estructura

```typescript
return {
  success: true,
  data: {
    analysis: result.analysis,
    usage: result.usage,
    estimatedCost: result.estimatedCost,
    match: {
      homeTeam: result.matchData.homeTeamName,
      awayTeam: result.matchData.awayTeamName,
      commenceTime: result.matchData.commenceTime,
    },
  },
};
```

---

### `backend/src/services/data-services.module.ts`

**Cambio:** Registrar los 3 nuevos servicios ESPN

```typescript
providers: [
  CacheService,
  SofascoreService,
  ESPNQualitativeService,  // renamed
  ESPNOddsService,         // NEW
  ESPNStatsService,         // NEW
  OddsApiService,
  MiniMaxService,
]
```

---

### `backend/src/services/index.ts`

**Cambio:** Exports分开 para evitar duplicados de tipos

```typescript
export * from './espn-odds.service';
export * from './espn-stats.service';
export * from './odds-api.service';
export * from './sofascore.service';
export { ESPNQualitativeService } from './espn-qualitative.service';
export type { QualitativeContext, ESPNTeamFormSummary, ... } from './espn-qualitative.service';
```

---

### `backend/src/sports/nfl/nfl-analysis.service.ts` y `soccer-analysis.service.ts`

**Cambio:** Import de `espn.service` → `espn-qualitative.service` y renombró variable `espnService` → `espnQualitativeService`

---

## Flujo completo — NBA MVP

```
POST /sports/nba/analyze
  Body: { homeTeam, awayTeam, matchDate, userBankroll? }

  → NbaController.analyze()
      → NbaAnalysisService.analyzeMatch()
          ├── ESPNOddsService.findNbaMatchByDate()
          │     GET /scoreboard?dates=YYYYMMDD
          │     → { eventId, homeTeamId, awayTeamId, homeTeamName, awayTeamName, commenceTime }
          │
          ├── ESPNOddsService.getMatchOdds(eventId)
          │     GET /summary?event={eventId}
          │     → { moneyline, spread, total, teamStats, homeLeaders, awayLeaders }
          │
          ├── ESPNStatsService.getTeamLeaders(homeId)
          ├── ESPNStatsService.getTeamLeaders(awayId)
          │     → { leaders: [{ name: 'pointsPerGame', leaders: [athlete, ...] }, ...] }
          │
          ├── ESPNStatsService.getAthleteStatsComplete(topAthleteIds)
          │     GET /athletes/{id}/overview + /splits + /gamelog
          │     → ProcessedAthleteStats per player
          │
          ├── ESPNQualitativeService.getQualitativeContext()
          │     → injuries, news, form, recent results
          │
          └── NbaPromptBuilder.build({ match, odds, teamStats, athleteStats, espnPrompt, userBankroll })
                → MiniMaxService.chatCompletion()
                      → { analysis, usage }
```

---

## Verificación

```bash
# Build exitoso
npx --yes @nestjs/cli build  # ✅ Pasa sin errores

# Endpoint de prueba
POST /sports/nba/analyze
{
  "homeTeam": "Lakers",
  "awayTeam": "Celtics",
  "matchDate": "2026-04-13"
}
```

---

## Notas

- **NFL y Soccer** siguen usando OddsApiService por ahora (aún no migrados)
- **Player props** fueron removidos del MVP — ESPN no provee props de jugadores (son de The Odds API)
- **OddsApiService** y **SofascoreService** siguen injectados globalmente para uso futuro en NFL/Soccer
