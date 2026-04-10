# ODDSIQ — FASE 2: Scraping Services

> **Fecha:** 10 Abril 2026
> **Estado:** ✅ COMPLETADA
> **Rama:** `feat/fase2-scraping`

---

## 1. OBJETIVO

Implementar servicios de scraping para obtener datos de sports de fuentes externas:
- Sofascore (stats de partidos, forma de equipos)
- ESPN (injuries, news)
- The Odds API (cuotas de sportsbooks)

---

## 2. SERVICIOS CREADOS

### 2.1 CacheService

**Ubicación:** `src/services/cache.service.ts`

Sistema de cache en memoria para evitar requests repetidos.

```typescript
// TTL predefinidos
static readonly TTL = {
  MATCH_STATS: 60 * 60 * 1000,      // 1 hora
  MATCH_PREVIOUS: 7 * 24 * 60 * 60 * 1000, // 7 días
  STANDINGS: 24 * 60 * 60 * 1000,   // 24 horas
  INJURIES: 6 * 60 * 60 * 1000,      // 6 horas
  NEWS: 2 * 60 * 60 * 1000,          // 2 horas
  ODDS_PRE_MATCH: 15 * 60 * 1000,    // 15 minutos
  ODDS_LIVE: 60 * 1000,              // 1 minuto
  TEAM_FORM: 6 * 60 * 60 * 1000,     // 6 horas
  SCHEDULE: 60 * 60 * 1000,          // 1 hora
};
```

**Métodos principales:**
- `get<T>(key)` — Obtener del cache
- `set<T>(key, data, ttlMs)` — Guardar en cache
- `getOrFetch<T>(key, fetcher, ttlMs)` — Get or fetch con cache
- `invalidate(key)` — Invalidar una key
- `getStats()` — Estadísticas de cache (hits/misses)

---

### 2.2 SofascoreService

**Ubicación:** `src/services/sofascore.service.ts`

Scraping de estadísticas deportivas desde Sofascore.

**Base URL:** `https://api.sofascore.com/api/v1`

**AUTH:** No requiere API key. Solo headers especiales para evadir WAF.

```typescript
// Headers necesarios
private readonly headers = {
  'User-Agent': 'Mozilla/5.0...Chrome/120...',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};
```

**Rate limiting:** 1 request/segundo

#### Endpoints implementados:

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `getScheduledEvents(sport, date)` | `/sport/{sport}/scheduled-events/{date}` | Partidos del día |
| `getEventDetails(eventId)` | `/event/{eventId}` | Detalles del partido |
| `getEventStatistics(eventId)` | `/event/{eventId}/statistics` | Stats (FG%, rebotes, etc.) |
| `getEventLineups(eventId)` | `/event/{eventId}/lineups` | Quintetos |
| `getTeam(teamId)` | `/team/{teamId}` | Info del equipo |
| `getTeamPlayers(teamId)` | `/team/{teamId}/players` | Roster completo |
| `getTeamPerformance(teamId)` | `/team/{teamId}/performance` | Forma recent + racha |
| `getPlayerStats(playerId)` | `/player/{playerId}/statistics/seasons` | Stats históricos |
| `getUniqueTournaments(sport)` | `/sport/{sport}/unique-tournaments` | Lista torneos |
| `getStandings(tournamentId, seasonId)` | `/tournament/{id}/season/{id}/standings/total` | Clasificación |

**Método principal:**
```typescript
// Obtiene todos los datos de un partido
async getMatchData(eventId: string): Promise<CompiledMatchData>
```

---

### 2.3 ESPNService

**Ubicación:** `src/services/espn.service.ts`

Scraping de injuries y news desde ESPN.

**Base URL:** `https://api.espn.com/v3`

**AUTH:** No requiere API key.

#### Endpoints implementados:

| Método | Descripción |
|--------|-------------|
| `getInjuries(sport, league)` | Injury report completo |
| `getTeamInjuries(sport, league, teamId)` | Injuries de un equipo |
| `getNews(sport, league, limit)` | News recientes |
| `getScoreboard(sport, league, dates)` | Scoreboard |
| `getStandings(sport, league)` | Clasificación |
| `getTeams(sport, league)` | Lista de equipos |

**Sports keys soportados:**
- `basketball/nba`
- `basketball/wnba`
- `football/nfl`
- `baseball/mlb`
- `hockey/nhl`
- `soccer/eng.1` (Premier League)

---

### 2.4 OddsService

**Ubicación:** `src/services/odds.service.ts`

Integración con The Odds API para cuotas de sportsbooks.

**Base URL:** `https://api.the-odds-api.com/v4`

**AUTH:** Requiere API key (gratis en the-odds-api.com)

```typescript
// Config en .env
ODDS_API_KEY=tu_api_key
```

#### Endpoints implementados:

| Método | Descripción |
|--------|-------------|
| `getSports()` | Lista de sports disponibles (GRATIS) |
| `getOdds(sportKey, regions, markets)` | Odds de un sport |
| `getEventOdds(sportKey, eventId, regions, markets)` | Odds de 1 evento |
| `getBestOdds(bookmakers, selection, market)` | Mejor odds para selección |
| `getMatchOddsComparison(bookmakers, home, away, market)` | Comparación H2H |

#### Métodos utility:

```typescript
// Conversiones
americanToDecimal(odds: number): number
decimalToAmerican(odds: number): number

// Cálculos
calculateImpliedProbability(odds: number, format): number
calculateEV(estimatedProbability: number, odds: number, format): number
hasValue(estimatedProbability: number, odds: number, format): { hasValue: boolean, edge: number }
```

#### Sport Keys:

```typescript
SPORYS = {
  BASKETBALL_NBA: 'basketball_nba',
  FOOTBALL_NFL: 'americanfootball_nfl',
  SOCCER_EPL: 'soccer_epl',
  TENNIS_ATP: 'tennis_atp',
  // ... más
}
```

#### Regions:

- `us` — US sportsbooks (DraftKings, FanDuel, BetMGM)
- `uk` — UK bookmakers (William Hill, Ladbrokes)
- `eu` — European (1xBet, Pinnacle)
- `au` — Australian (Sportsbet, TAB)

#### Markets:

- `h2h` — Moneyline (ganador)
- `spreads` — Handicaps
- `totals` — Over/Under
- `player_props` — Player props

---

## 3. MÓDULO CREADO

### DataServicesModule

**Ubicación:** `src/services/data-services.module.ts`

```typescript
@Global()
@Module({
  providers: [CacheService, SofascoreService, ESPNService, OddsService],
  exports: [CacheService, SofascoreService, ESPNService, OddsService],
})
export class DataServicesModule {}
```

Este módulo es GLOBAL para que cualquier módulo pueda injectar los servicios.

---

## 4. USO EN OTROS MÓDULOS

```typescript
// Ejemplo en BetsModule
import { SofascoreService, ESPNService, OddsService, CacheService } from '../services';

constructor(
  private readonly sofascoreService: SofascoreService,
  private readonly espnService: ESPNService,
  private readonly oddsService: OddsService,
  private readonly cacheService: CacheService,
) {}
```

---

## 5. PRÓXIMOS PASOS

### Fase 3: AI Integration (PENDIENTE)

- [ ] Crear `MiniMaxService`
- [ ] Crear `PromptBuilder` (integrar con basketballPrompts.ts del frontend)
- [ ] Endpoint `POST /bets/analyze`
- [ ] Guardar análisis en tabla `analyses`

### Fase 4: Frontend (PENDIENTE)

- [ ] Nuevo diseño Match Search
- [ ] Componente Analysis con markdown render
- [ ] Input de cuota + cálculo de value
- [ ] Botón "Registrar Apuesta"

---

## 6. VARIABLES DE ENTORNO NECESARIAS

```bash
# The Odds API (para cuotas)
ODDS_API_KEY=your_odds_api_key

# MiniMax API (para análisis IA) — se añadirá en Fase 3
MINIMAX_API_KEY=your_minimax_api_key
```

---

## 7. NOTAS IMPORTANTES

1. **Sofascore y ESPN NO requieren API key** — funcionan out of the box
2. **The Odds API requiere API key** — registrarse gratis en the-odds-api.com
3. **Rate limiting de Sofascore:** 1 req/segundo — el servicio ya maneja esto
4. **Cache inteligente:** Los datos se cachean automáticamente según el TTL

---

## 8. TESTING

### Probar servicios manualmente:

```bash
# Arrancar el servidor
npm run start:dev

# Test en otra terminal:
# (los servicios se injectan automáticamente en otros módulos)
```

### Ejemplo de uso en código:

```typescript
// Obtener datos de un partido
const matchData = await this.sofascoreService.getMatchData('11550211');

// Obtener injuries
const injuries = await this.espnService.getTeamInjuries('basketball', 'nba', '588');

// Obtener cuotas
const odds = await this.oddsService.getOdds('basketball_nba', ['us'], ['h2h', 'spreads']);
```

---

*Documento creado: 2026-04-10*
*Última actualización: 2026-04-10 22:35 UTC*
