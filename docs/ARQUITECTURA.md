# BetRoll Backend — Arquitectura Completa

> Rama: `develop` (actualizada desde remoto)
> Última actualización: 23 abril 2026
> Stack: NestJS + TypeORM + MySQL + MiniMax (LLM)

---

## 📁 Estructura General

```
betroll-back/
├── .env                          # Variables de entorno
├── .env.example
├── package.json
├── tsconfig.json
├── betroll.db / betrolldb.db     # SQLite dev (deprecated)
├── src/
│   ├── main.ts                   # Bootstrap, CORS, validation pipe
│   ├── app.module.ts             # Root module — MySQL config
│   ├── health.controller.ts
│   ├── auth/                     # JWT auth + refresh tokens
│   ├── users/                    # User entity + service
│   ├── bankroll/                 # Bankroll + movimientos
│   ├── bets/                     # Apuestas con categorías y stake
│   ├── parlays/                  # Combinaciones de apuestas
│   ├── analytics/                # Dashboard summary + P&L
│   ├── daily-snapshots/         # Tracking diario (stop-loss)
│   ├── analysis/                 # Guardado de análisis MiniMax
│   ├── sports/                   # Módulo NBA / NFL / Soccer
│   │   ├── nba/
│   │   ├── nfl/
│   │   └── soccer/
│   └── services/                 # ESPN API, MiniMax, Cache, Normalizer
```

---

## 🌟 entry point: main.ts

Puerto: `3001`, prefijo: `/api`

```typescript
// CORS habilitado para frontend (localhost:5173 o FRONTEND_URL env)
app.enableCors({
  origin: frontendUrl || 'http://localhost:5173',
  credentials: true,
});

// Validation pipe global (whitelist, transform)
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  transform: true,
}));
```

---

## 🗄️ Base de Datos (MySQL)

**Host:** configurado via env (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`)
**Entidades TypeORM:**

| Entidad | Tabla | Purpose |
|---------|-------|---------|
| `User` | `users` | Auth |
| `Bankroll` | `bankrolls` | Saldo actual + inicio |
| `BankrollMovement` | `bankroll_movements` | Transacciones (depósito/retiro/apuesta/ganancia/pérdida/void/cashout) |
| `Bet` | `bets` | Apuesta individual |
| `Parlay` | `parlays` | Combinación de apuestas |
| `DailySnapshot` | `daily_snapshots` | Tracking diario para stop-loss |
| `Analysis` | `analyses` | Análisis MiniMax guardado |

---

## 🔐 Auth Module

### auth.service.ts — Lógica completa

- **`register(dto)`** → Crea usuario + genera tokens + sanitiza respuesta
- **`login(dto, response)`** → Valida bcrypt, genera tokens, setea `refresh_token` en cookie httpOnly
- **`refresh(response)`** → Verifica refresh token desde cookie, genera nuevo access_token
- **`logout(response)`** → Limpia cookie `refresh_token`
- **`me(userId)`** → Devuelve usuario sanitizado (sin password)

### Tokens

- **Access token:** 15min, header `Authorization: Bearer <token>`
- **Refresh token:** 7 días, cookie `httpOnly`

### JWT Strategy (access)
```typescript
jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
```

### JWT Refresh Strategy
```typescript
jwtFromRequest: ExtractJwt.fromExtractors([req => req?.cookies?.refresh_token])
```

---

## 👥 Users Module

### user.entity.ts

```typescript
@Entity('users')
export class User {
  id: string (uuid)
  email: string (unique)
  password: string (bcrypt, excluded from serialization)
  name: string
  createdAt: Date
  updatedAt: Date
}
```

---

## 💰 Bankroll Module

### bankroll.entity.ts

```typescript
@Entity('bankrolls')
export class Bankroll {
  id: string (uuid)
  userId: string (unique)
  initialAmount: number (int)
  currentAmount: number (int)
  startDate: Date
  createdAt / updatedAt
}
```

### bankroll-movement.entity.ts

```typescript
@Entity('bankroll_movements')
export class BankrollMovement {
  id, bankrollId, userId
  type: enum (DEPOSIT, WITHDRAWAL, WIN, LOSS, VOID, CASHOUT)
  amount: int
  balanceAfter: int (snapshot post-transacción)
  description: string
  betId: uuid (nullable)
  createdAt
}
```

### bankroll.service.ts — Métodos

- `getBankroll(userId)` → Bankroll o null
- `createBankroll(userId, dto)` → Crea bankroll + primer movimiento DEPOSIT (transacción)
- `updateBankroll(userId, dto)` → Solo actualiza initialAmount
- `deposit(userId, amount, description?)` → Transacción: actualiza saldo + movimiento DEPOSIT
- `withdraw(userId, amount, description?)` → Verifica saldo suficiente, transacción
- `getMovements(userId, page, limit)` → Paginación de movimientos

### bankroll.controller.ts — Endpoints

```
GET  /bankroll           → Get bankroll
POST /bankroll           → Create bankroll
PATCH /bankroll          → Update initialAmount
PATCH /bankroll/deposit  → Deposit
PATCH /bankroll/withdraw → Withdraw
GET  /bankroll/movements → List movements (paginated)
```

**Validación:** Todas las operaciones requieren monto mínimo de 1,000 COP.

---

## 🎲 Bets Module

### bet.entity.ts

```typescript
@Entity('bets')
export class Bet {
  id: uuid
  userId: uuid

  sport: enum (FOOTBALL, TENNIS, BASKETBALL, OTHER)
  tournament: string
  homeTeam / awayTeam: string
  eventDate: timestamp

  betType: enum (HOME_WIN, AWAY_WIN, DRAW, DOUBLE_CHANCE_*, BTTS_*, OVER, UNDER, HANDICAP, OTHER)
  selection: string (e.g. "Lakers -3.5" o "Over 220.5")
  odds: decimal(6,2)

  amount: int ( stake en COP )
  category: enum (A|B|C) — auto-calculada
  confidence: smallint (1-5 estrellas)
  reasoning: text (nullable)
  postNotes: text (nullable)

  status: enum (PENDING, WON, LOST, VOID, CASHOUT)
  potentialWin: int (calculado: amount * odds - amount)
  profit: int (0 por default, se actualiza al resolver)
  cashoutAmount: int (nullable)

  parlayId: uuid (nullable)
  resolvedAt: timestamp (nullable)
  createdAt / updatedAt
}
```

**Categorías automáticas:**
- A: odds ≤ 1.50
- B: odds ≤ 2.20
- C: odds > 2.20

**Confidence stars** (basado en percentage):
- 5 estrellas: ≥ 5%
- 4 estrellas: ≥ 4%
- 3 estrellas: ≥ 3%
- 2 estrellas: ≥ 2%
- 1 estrella: < 2%

### bets.service.ts — Lógica completa

#### `createBet(userId, dto)`

1. Verifica bankroll existe
2. **Check stop-loss** (30% daily loss desde opening balance)
3. Verifica saldo suficiente
4. Calcula `category` y `potential_win` (backend)
5. **Transacción:** Crea Bet + deduce amount del bankroll + crea movimiento LOSS + actualiza daily snapshot

#### `resolveBet(betId, userId, dto)`

1. Verifica bet existe y es PENDING
2. Calcula profit según resultado:
   - WON → `profit = amount * odds - amount` → movimiento WIN
   - LOST → `profit = -amount` → movimiento LOSS
   - VOID → `profit = 0` → movimiento VOID (reembolsa)
   - CASHOUT → `profit = cashoutAmount - amount` → movimiento CASHOUT
3. Actualiza saldo bankroll + crea movimiento
4. **Actualiza DailySnapshot** (betsCount, won/lost count, dailyProfit, stopLossHit)

#### `checkStopLoss(userId)`

- Busca snapshot del día actual
- Si no existe, usa currentAmount como opening balance
- Si opening > 0 y pérdida >= 30% → stop-loss activo

#### `getStats(userId)`

```typescript
{
  total, won, lost, pending, void, cashout,
  winRate: won / (won + lost + void) * 100,
  totalProfit, totalStaked
}
```

### bets.controller.ts — Endpoints

```
GET  /bets                          → List (paginated, con filtros)
GET  /bets/pending                  → Pending bets
GET  /bets/stats                    → Stats summary
GET  /bets/:id                      → One bet
POST /bets                          → Create bet
PATCH /bets/:id                     → Update pending bet
PATCH /bets/:id/resolve            → Resolve bet
DELETE /bets/:id                    → Delete (solo PENDING, reembolsa)
```

**Filtros:** `sport`, `status`, `category`, `dateFrom`, `dateTo`

---

## 🔗 Parlays Module

### parlay.entity.ts

```typescript
@Entity('parlays')
export class Parlay {
  id: uuid
  userId: uuid
  betIds: json (array de uuid)
  combinedOdds: decimal(8,4) (producto de odds)
  amount: int ( stake )
  potentialWin: int ( amount * combinedOdds - amount )
  status: enum (PENDING, WON, LOST, VOID)
  profit: int
  resolvedAt: timestamp (nullable)
  postNotes: text (nullable)
  createdAt / updatedAt
}
```

### parlays.service.ts — Lógica

#### `createParlay(userId, dto)`

- Valida mínimo 2 apuestas
- Todas deben ser PENDING
- Calcula `combinedOdds = ∏(odds)` y `potentialWin`

#### `resolveParlay(id, userId, dto)`

- Todas las apuestas deben estar resueltas
- Si alguna es LOST → parlay LOST (profit = -amount)
- Si alguna es VOID → recalcula odds sin esa selección
- Si todas WON → parlay WON (profit = potentialWin)

Usa transacción: actualiza parlay + bankroll + movimiento.

---

## 📊 Analytics Module

### analytics.service.ts — Métodos

#### `getSummary(userId)`

```typescript
{
  bankroll: { currentAmount, initialAmount },
  stats: { totalBets, won, lost, void, pending, winRate, totalProfit, totalStaked, roi },
  streak: { current: number, type: 'WIN'|'LOSS'|'NONE' },
  stopLoss: { hit, openingBalance, currentBalance, dailyLoss },
  recentBets: [] // últimas 5
}
```

#### Streak calculation

Recorre bets resueltos (WON/LOST/VOID) desde el más reciente, cuenta追随直到 cambia el status.

#### `getPnl(userId, period)`

- Daily: agrupa por fecha
- Weekly: agrupa por semana (lunes a domingo)
- Calcula profit, bets count, winRate por período

#### `getBySport(userId)`

Agrega por sport: totalBets, won, lost, profit, roi, avgOdds.

#### `getByType(userId)`

Agrega por `betType`: won, lost, profit, roi.

#### `getByCategory(userId)`

Agrega por categoría A/B/C: won, profit, roi.

#### `getBankrollHistory(userId)`

Últimos 90 días de DailySnapshots: date, opening, closing, profit.

### analytics.controller.ts — Endpoints

```
GET /analytics/summary
GET /analytics/pnl?period=daily|weekly
GET /analytics/by-sport
GET /analytics/by-type
GET /analytics/by-category
GET /analytics/bankroll-history
```

---

## 📅 Daily Snapshots

### daily-snapshot.entity.ts

```typescript
@Entity('daily_snapshots')
export class DailySnapshot {
  id: uuid
  userId: string
  snapshotDate: date (unique con userId)
  openingBalance: int
  closingBalance: int
  betsCount: int
  wonCount: int
  lostCount: int
  dailyProfit: int
  stopLossHit: boolean
  createdAt
}
```

**Índice único:** `idx_snapshots_user_date (userId, snapshotDate)`

**Stop-loss:** Se marca `stopLossHit = true` cuando `openingBalance - currentBalance >= 30%`.

---

## 🧠 Analysis Module

### analysis.entity.ts

Guarda las respuestas completas de MiniMax:

```typescript
{
  id, userId, sport, homeTeam, awayTeam,
  tournament, eventDate,
  userOdds, userSportsbook,
  analysis: longtext (respuesta del LLM)
  sources: json (datos usados)
  recommendedSelection, recommendedOdds, recommendedStake,
  confidence, miniMaxModel, miniMaxTokens, miniMaxCost,
  createdAt, updatedAt
}
```

No tiene endpoint de creación — es solo storage para historial de análisis.

---

## 🏀 Sports Module — NBA (ESPN-Only MVP)

### NBA — Flujo completo

```
analyzeMatch(homeTeam, awayTeam, matchDate, userBankroll)
  │
  ├─1─► ESPNOddsService.findNbaMatchByDate()
  │        → GET /sports/basketball/nba/scoreboard?dates=YYYYMMDD
  │        → Busca equipo por nombre, devuelve eventId + teamIds
  │
  ├─2─► ESPNOddsService.getMatchOdds(eventId, homeTeamId, awayTeamId)
  │        → GET /sports/basketball/nba/summary/{eventId}
  │        → Extrae: moneyline, spread, total, leaders, records, boxscore
  │
  ├─3─► NBATeamStatsAggregator.getMatchTeamStats()
  │        → Combina roster stats (estadísticas enriched)
  │
  ├─4─► Extract athlete IDs from leaders (scoreboard leaders)
  │        → Top 3 pointsPerGame del home + away
  │
  ├─5─► ESPNStatsService.getAthleteStatsComplete(athleteId)
  │        → Promise.allSettled para todos los atletas
  │        → Devuelve: PPG, RPG, APG, FG%, 3P%, splits (home/away), recentGames
  │
  ├─6─► ESPNQualitativeService.getQualitativeContext()
  │        → Injuries + news + team form
  │
  ├─7─► NbaPromptBuilder.build(promptData)
  │        → Arma prompt limpio (sin lenguaje de apuestas)
  │
  ├─8─► MiniMaxService.chatCompletion(prompt)
  │
  └─9─► Return { analysis, usage, estimatedCost, matchData }
```

### nba-analysis.service.ts

**Dependencias inyectadas:**
- `ESPNOddsService`
- `ESPNQualitativeService`
- `ESPNStatsService`
- `MiniMaxService`
- `NbaPromptBuilder`
- `NbaTeamStatsAggregator`

**Prompt building:**
- `teamSeasonStats` (enriched stats) tiene precedencia sobre `odds.teamStats` (scoreboard)
- Si falla `teamStatsAggregator`, cae a scoreboard stats
- Logs detallados en cada paso (LOG 1 a LOG 5)

### nba.controller.ts — Endpoints

```
POST /sports/nba/analyze
Body: { homeTeam, awayTeam, matchDate, userBankroll? }
Response: {
  success, data: {
    analysis, usage, estimatedCost,
    match: { homeTeam, awayTeam, commenceTime, eventId, odds }
  }
}
```

**Limpieza de odds:** El controller filtra valores vacíos/nulos del objeto odds antes de responder.

### nba-prompt.builder.ts — Structure

```
System: "Eres un analista deportivo profesional..."
User: <<ANALYSIS REQUEST>>
  ├── Match Info: teams, date, venue, status
  ├── Odds: moneyline, spread, total, records
  ├── Team Stats: PPG, RPG, APG, FG%, 3P%, FT%, MPG, SPG, BPG
  ├── Leaders: name + stats
  ├── Athlete Stats: (per player) PPG, RPG, APG, FG%, 3P%, splits, recentGames
  ├── ESPN Context: injuries, news, form
  └── Instructions: qué debe contener el análisis (sin betting language)
```

---

## 🏈 Sports Module — NFL

### Estructura

```
sports/nfl/
├── nfl.module.ts
├── nfl.controller.ts
├── nfl-analysis.service.ts
└── nfl-prompt.builder.ts
```

**NFL usa OddsAPI** (no ESPN) para obtener cuotas, igual que Soccer.

---

## ⚽ Sports Module — Soccer

### soccer.module.ts

```
providers: [SoccerAnalysisService, SoccerPromptBuilder]
controllers: [SoccerController]
exports: [SoccerAnalysisService]
```

### soccer-analysis.service.ts

**Fuentes de datos:**
1. **The Odds API** → Cuotas (h2h, totales, spreads)
2. **ESPN Qualitative Service** → Injuries, news, form

**Mapa de ligas:**
```typescript
const SOCCER_LEAGUE_MAP = {
  'eng.1': 'soccer_epl',
  'esp.1': 'soccer_spain_la_liga',
  'ita.1': 'soccer_italy_serie_a',
  'ger.1': 'soccer_germany_bundesliga',
  'fra.1': 'soccer_france_ligue_one',
  'usa.1': 'soccer_usa_mls',
};
```

---

## 🔌 Services Layer

### espn-odds.service.ts

**fetchNbaScoreboard(date)** → `GET /sports/basketball/nba/scoreboard?dates=YYYYMMDD`
- Devuelve `ESBNScoreboardResponse` con eventos del día

**findNbaMatchByDate(homeTeam, awayTeam, date)**
- Itera eventos, busca por nombre (nameMatch: incluye/abreviatura)
- Devuelve: eventId, homeTeamId, awayTeamId, homeTeamName, awayTeamName, commenceTime

**getMatchOdds(eventId, homeTeamId, awayTeamId)**
- `GET /sports/basketball/nba/summary/{eventId}`
- Extrae:
  - `NbaMatchOdds`: moneyline, spread, total, venue, records, leaders, teamStats
  - `gameBoxscore` (solo si es juego pasado/final)
  - Implied probabilities desde odds americanos

### espn-qualitative.service.ts

**getQualitativeContext(sport, league, eventId, homeTeamId, awayTeamId)**
- **Injuries:** `GET /sports/{sport}/{league}/teams/{teamId}/injures`
- **News:** `GET /sports/{sport}/{league}/teams/{teamId}/news`
- **Team Form:**比分data (scoreboard)

**toAIPrompt(context)** → Genera string para incluir en prompt MiniMax

### espn-stats.service.ts

**getAthleteStatsComplete(athleteId)**
- `GET /sports/basketball/nba/athletes/{athleteId}/stats`
- `GET /sports/basketball/nba/athletes/{athleteId}/splits`
- `GET /sports/basketball/nba/athletes/{athleteId}/recent`

Devuelve `ProcessedAthleteStats`:
```typescript
{
  name, position,
  PPG, RPG, APG, FG_PCT, THREE_PT_PCT, FT_PCT, MIN,
  splits: { home: {...}, away: {...} },
  recentGames: { date, opponent, result, min, pts, reb, ast }[]
}
```

### nba-team-stats-aggregator.service.ts

**getMatchTeamStats(homeTeamId, homeTeamName, awayTeamId, awayTeamName)**

Replica la lógica de ESPNStatsService pero:
- Obtiene roster completo (todos los jugadores, no solo leaders)
- Agrega estadísticas de temporada para todo el roster
- Calcula `TeamSeasonStats`: averages (PPG, RPG, APG, FG_PCT, etc.) por equipo

Devuelve:
```typescript
{
  home: { players: PlayerSeasonStat[], averages: SeasonAverages },
  away: { players: PlayerSeasonStat[], averages: SeasonAverages }
}
```

### minimax.service.ts

**chatCompletion(messages, options)**

- Endpoint: `https://api.minimax.chat/v1/text/chatcompletion_v2`
- Model: configurable (default de env)
- Calcula costo estimado: `(totalTokens / 1000) * 0.0015`

### odds-api.service.ts (NFL + Soccer)

Usa The Odds API (`https://api.the-odds-api.com/v4/`)
- API Key: `ODDS_API_KEY` env
- Endpoints: sports/{sport}/events, events/{id}/odds
- Manejo de rate limits y errores

### sofascore.service.ts

Servicio independiente para datos adicionales (no usado en NBA).

### cache.service.ts

```typescript
interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
}

get<T>(key): T | null
set<T>(key, data, ttlMs)
delete(key)
clear()
```

Usado por ESPN services para guardar respuestas (evita repetir llamadas en el mismo día).

### data-normalizer.service.ts

**buildPreLLMLogging(validationData)**

Genera string de log formateado para el estado pre-LLM:
- parsedStats (boxscore players, leaders validity, teamStats)
- missingFields
- validationErrors
- rosterValidated

---

## 📊 Data Flow — NBA Analysis

```
┌─────────────────────────────────────────────────────────────────┐
│                     NBA ANALYSIS FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. ESPNOddsService.findNbaMatchByDate()                        │
│     GET /sports/basketball/nba/scoreboard?dates=               │
│     → eventId, homeTeamId, awayTeamId                          │
│                                                                  │
│  2. ESPNOddsService.getMatchOdds(eventId, homeTeamId, awayTeam)│
│     GET /sports/basketball/nba/summary/{eventId}               │
│     → odds (moneyline, spread, total), leaders, teamStats      │
│                                                                  │
│  3. NBATeamStatsAggregator.getMatchTeamStats()                  │
│     → Enriched roster stats (todos los jugadores)              │
│     → PPG, RPG, APG, FG%, 3P%, FT%, MPG, SPG, BPG por jugador  │
│                                                                  │
│  4. Extract top 3 athlete IDs from scoreboard leaders          │
│                                                                  │
│  5. ESPNStatsService.getAthleteStatsComplete(id) × N           │
│     GET /sports/basketball/nba/athletes/{id}/stats             │
│     GET /sports/basketball/nba/athletes/{id}/splits           │
│     GET /sports/basketball/nba/athletes/{id}/recent            │
│     → PPG, RPG, APG, FG%, 3P%, splits (home/away), recentGames │
│                                                                  │
│  6. ESPNQualitativeService.getQualitativeContext()            │
│     → Injuries, news, form                                       │
│                                                                  │
│  7. NbaPromptBuilder.build()                                    │
│     → Prompt estructurado para MiniMax                          │
│                                                                  │
│  8. MiniMaxService.chatCompletion()                            │
│     → Análisis cualitativo (sin betting language)              │
│                                                                  │
│  9. Response                                                    │
│     { analysis, usage, estimatedCost, matchData }              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Variables de Entorno (.env)

```bash
NODE_ENV=development|production
PORT=3001
FRONTEND_URL=http://localhost:5173

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=helpdesk
DB_PASSWORD=helpdesk123
DB_NAME=betroll

# JWT
JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# MiniMax
MINIMAX_API_KEY=
MINIMAX_GROUP_ID=
MINIMAX_MODEL=

# Odds API (NFL, Soccer)
ODDS_API_KEY=
ODDS_API_HOST=https://api.the-odds-api.com

# ESPN (NBA)
ESPN_API_BASE=https://site.api.espn.com/apis
```

---

## 📝 Notas de Implementación

### Stop-Loss (30% diario)

- Se verifica al crear cada apuesta
- Basado en `DailySnapshot.openingBalance` vs `Bankroll.currentAmount`
- Si se activa → bloquea creación de nuevas apuestas hasta el día siguiente

### Transacciones

Todos los cambios de saldo usan `QueryRunner` con transacciones:
- `createBet`: deduce stake + movimiento LOSS
- `resolveBet`: actualiza profit + movimiento WIN/LOSS/VOID
- `deposit/withdraw`: actualiza saldo + movimiento
- `resolveParlay`: actualiza parlay + bankroll + movimiento

### Sin betting language en prompts

Los prompts de NBA/Soccer/NFL **no contienen** palabras como:
- "apuesta", "stake", "bankroll", "value bet", "ir"
- MiniMax (base model) rechazaría contenido con lenguaje de apuestas
- Los prompts usan: "análisis deportivo", "selección", "cuota", "ganador potencial"

### CORS

`credentials: true` permite cookies de refresh token.
El frontend debe enviar `withCredentials: true` en requests.

---

*Documento generado: 23 abr 2026 | betroll-back @ develop*