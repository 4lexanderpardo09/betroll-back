# ODDSIQ — FASE 2: Scraping Services

> **Fecha:** 10 Abril 2026
> **Estado:** ✅ COMPLETADA
> **Rama:** `feat/fase2-scraping`
> **Repo investigación:** https://github.com/pseudo-r/Public-ESPN-API

---

## 1. OBJETIVO

Implementar servicios de scraping para obtener datos deportivos de fuentes externas gratuitas.

---

## 2. SERVICIOS CREADOS

### 2.1 CacheService ✅

**Ubicación:** `src/services/cache.service.ts`

Sistema de cache en memoria con TTL inteligente para evitar requests repetidos.

```typescript
static readonly TTL = {
  MATCH_STATS: 60 * 60 * 1000,      // 1 hora
  MATCH_PREVIOUS: 7 * 24 * 60 * 60 * 1000, // 7 días
  STANDINGS: 24 * 60 * 60 * 1000,   // 24 horas
  INJURIES: 6 * 60 * 60 * 1000,      // 6 horas
  NEWS: 2 * 60 * 60 * 1000,          // 2 horas
  ODDS_PRE_MATCH: 15 * 60 * 1000,    // 15 minutos
  TEAM_FORM: 6 * 60 * 60 * 1000,     // 6 horas
  SCHEDULE: 60 * 60 * 1000,          // 1 hora
};
```

---

### 2.2 SofascoreService ⚠️

**Ubicación:** `src/services/sofascore.service.ts`

**PROBLEMA:** Cloudflare WAF bloquea requests con 403 Forbidden.

**SOLUCIÓN:** No es crítico — ESPN nos da los datos que necesitamos.

---

### 2.3 ESPNService ✅ (ACTUALIZADO CON ENDPOINTS VERIFICADOS)

**Ubicación:** `src/services/espn.service.ts`

**Fuente:** Investigación del repo https://github.com/pseudo-r/Public-ESPN-API

#### ENDPOINTS QUE SÍ FUNCIONAN

**Base URL:** `https://site.api.espn.com/apis/site/v2`

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `getScoreboardV2()` | `/sports/{sport}/{league}/scoreboard` | Games + Stats + **DraftKings odds** |
| `getInjuriesV2()` | `/sports/{sport}/{league}/injuries` | 29 injuries con return dates |
| `getTeamInjuriesV2()` | `/sports/{sport}/{league}/teams/{id}/injuries` | Injuries por equipo |
| `getTeamRoster()` | `/sports/{sport}/{league}/teams/{id}/roster` | Roster completo |
| `getGameSummary()` | `/sports/{sport}/{league}/summary?event={id}` | Game details |
| `getPlayerStats()` | Core API `/athletes/{id}/statistics` | Stats de jugador |

#### Core API URL: `https://sports.core.api.espn.com/v2`

---

### 2.4 OddsService ⚠️

**Ubicación:** `src/services/odds.service.ts`

**STATUS:** Servicio creado pero **OPCIONAL** — ESPN ya tiene DraftKings odds.

---

## 3. INVESTIGACIÓN API — RESULTADOS COMPLETOS

### ESPN Site API v2 — ✅ FUNCIONA

**Base:** `https://site.api.espn.com/apis/site/v2`

#### Scoreboard — Games + Stats + Odds

```bash
GET https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard
```

**Datos que devuelve:**
- 15 partidos del día (NBA)
- Stats de equipos (PPG, FG%, rebotes, assists)
- Records (home/away/overall)
- **ODDS DE DRAFTKINGS** (spread, O/U, moneyline)
- Situación (possession, down/distance para NFL)

**Ejemplo real (10 Abril 2026):**
```json
{
  "events": [{
    "id": "401695582",
    "name": "Detroit Pistons at Charlotte Hornets",
    "status": { "type": { "name": "Scheduled" } },
    "competitions": [{
      "competitors": [{
        "team": { "name": "Charlotte Hornets", "abbreviation": "CHA" },
        "records": [{ "summary": "43-37" }],
        "statistics": [{ "displayValue": "22.3" }]
      }],
      "odds": [{
        "provider": { "name": "DraftKings", "id": 21 },
        "details": "CHA -4.5 | O/U 226.5"
      }]
    }]
  }]
}
```

#### Injuries — 29 injuries con detalles

```bash
GET https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries
```

**Datos que devuelve:**
- 29 injuries activos
- Nombre del jugador
- Posición
- Equipo
- Tipo de lesión (description)
- Status (Out, Day-To-Day)
- Short detail ("Right Ankle - Out")
- Long detail (descripción completa)
- Return date (fecha de retorno esperada)

**Ejemplo real (10 Abril 2026):**
```json
{
  "injuries": [{
    "type": { "description": "Illness" },
    "shortDetail": "Illness - Out",
    "longDetail": "Landale sustained a right high-ankle sprain...",
    "returnDate": "April 20, 2026",
    "player": {
      "fullName": "Jock Landale",
      "position": { "abbreviation": "C" },
      "team": { "displayName": "Charlotte Hornets" }
    }
  }]
}
```

#### Team Roster

```bash
GET https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/588/roster
```

#### Game Summary

```bash
GET https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=401695582
```

---

## 4. PROVEEDORES DE ODDS (DEL SCOREBOARD)

| Provider | ID | Disponible en |
|----------|----|--------------|
| **DraftKings** | 21 | NBA, NFL, MLB, NHL |
| FanDuel | 37 | Todos |
| BetMGM | 58 | Todos |
| Caesars | 38 | Todos |
| PointsBet | 25 | NBA, NFL |

---

## 5. ESTRATEGIA POR SPORT

### NBA (INMEDIATO — GRATIS)

```
ESPN Scoreboard ──→ Stats + Odds DraftKings ✅
ESPN Injuries ─────→ 29 injuries ✅
ESPN Rosters ──────→ Jugadores ✅
ESPN Summary ──────→ Game details ✅
                         ↓
                  MiniMax para análisis
```

### Football (NFL)

```
ESPN Scoreboard ──→ Stats + Odds ✅
ESPN Injuries ─────→ Injuries ✅
                         ↓
                  MiniMax para análisis
```

### Soccer / Tennis / Otros

```
The Odds API ──────→ Cuotas (necesita API key)
ESPN ──────────────→ Stats (si existe)
                         ↓
                  MiniMax para análisis
```

---

## 6. PRÓXIMOS PASOS

### Fase 3: AI Integration (PENDIENTE)

- [ ] Crear `MiniMaxService`
- [ ] Crear `PromptBuilder` (integrando datos de ESPN)
- [ ] Endpoint `POST /bets/analyze`
- [ ] Conectar con ESPN para stats + injuries
- [ ] Integrar odds de DraftKings en el análisis

---

## 7. TESTING — RESULTADOS

| Servicio | Status | Notas |
|----------|--------|-------|
| CacheService | ✅ OK | 0 hits, 3 misses |
| ESPN Scoreboard | ✅ FUNCIONA | 15 games + stats + odds |
| ESPN Injuries | ✅ FUNCIONA | 29 injuries con return dates |
| ESPN Rosters | ✅ FUNCIONA | Estructura verificada |
| Sofascore | ❌ 403 WAF | No crítico |
| OddsService | ⚠️ Optional | Para sports sin ESPN |

---

## 8. FUENTES

- **pseudo-r/Public-ESPN-API:** https://github.com/pseudo-r/Public-ESPN-API
- **pseudo-r/Public-Sofascore-API:** https://github.com/pseudo-r/Public-Sofascore-API

---

## 9. NOTAS IMPORTANTES

1. **ESPN Site API v2 funciona perfecto** — usar como fuente principal
2. **No necesitamos APIs pagadas para NBA** — ESPN + DraftKings cubren todo
3. **The Odds API es opcional** — útil para más sportsbooks o comparación
4. **Sofascore no es crítico** — datos disponibles en ESPN

---

*Documento creado: 2026-04-10*
*Última actualización: 2026-04-10 23:00 UTC*
