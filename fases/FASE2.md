# ODDSIQ — FASE 2: Scraping Services

> **Fecha:** 10 Abril 2026
> **Estado:** ✅ COMPLETADA
> **Rama:** `feat/fase2-scraping`

---

## 1. OBJETIVO

Implementar servicios de scraping para obtener datos de sports de fuentes externas.

---

## 2. SERVICIOS CREADOS

### 2.1 CacheService ✅

**Ubicación:** `src/services/cache.service.ts`

Sistema de cache en memoria con TTL inteligente.

```typescript
static readonly TTL = {
  MATCH_STATS: 60 * 60 * 1000,      // 1 hora
  STANDINGS: 24 * 60 * 60 * 1000,   // 24 horas
  INJURIES: 6 * 60 * 60 * 1000,      // 6 horas
  NEWS: 2 * 60 * 60 * 1000,          // 2 horas
  ODDS_PRE_MATCH: 15 * 60 * 1000,    // 15 minutos
  TEAM_FORM: 6 * 60 * 60 * 1000,     // 6 horas
};
```

---

### 2.2 SofascoreService ⚠️

**Ubicación:** `src/services/sofascore.service.ts`

**PROBLEMA:** Cloudflare WAF bloquea requests con 403.

**NO ES CRÍTICO** porque ESPN nos da los datos que necesitamos.

---

### 2.3 ESPNService ✅ (ACTUALIZADO)

**Ubicación:** `src/services/espn.service.ts`

**DESCUBRIMIENTO CLAVE del repo pseudo-r/Public-ESPN-API:**

La API `site.api.espn.com/apis/site/v2` funciona PERFECTAMENTE y nos da:

1. **Scoreboard con ODDS DE DRAFTKINGS**
2. **Injury reports completos con return dates**
3. **Team rosters**
4. **Game summaries**

**Endpoints que SÍ funcionan:**

| Método | Endpoint | Datos |
|--------|----------|-------|
| `getScoreboardV2()` | `/sports/{sport}/{league}/scoreboard` | Games + Stats + **Odds** |
| `getInjuriesV2()` | `/sports/{sport}/{league}/injuries` | 29 injuries con detalles |
| `getTeamInjuriesV2()` | `/sports/{sport}/{league}/teams/{id}/injuries` | Injuries por equipo |
| `getTeamRoster()` | `/sports/{sport}/{league}/teams/{id}/roster` | Roster completo |
| `getGameSummary()` | `/sports/{sport}/{league}/summary?event={id}` | Game details |
| `getPlayerStats()` | Core API `/athletes/{id}/statistics` | Stats de jugador |

**Ejemplo real (10 Abril 2026):**
- **15 partidos** disponibles en scoreboard
- **29 injuries** con long descriptions y return dates
- **DraftKings odds** disponibles en scoreboard

---

### 2.4 OddsService ⚠️

**Ubicación:** `src/services/odds.service.ts`

**Servicio creado pero OPCIONAL** porque ESPN ya nos da odds de DraftKings.

Útil para:
- Más sportsbooks (FanDuel, BetMGM además de DraftKings)
- Sports diferentes a NBA (Football, Tennis, Soccer)
- Comparación de líneas

---

## 3. ESTRATEGIA FINAL

### Para NBA (INMEDIATO):

```
ESPN Scoreboard ──→ Stats + Odds de DraftKings ✅ GRATIS
ESPN Injuries ─────→ 29 injuries con return dates ✅ GRATIS
                         ↓
                  MiniMax para análisis
                         ↓
                  Usuario tiene todos los datos!
```

### Para Football/Tennis/Otros:

```
The Odds API ──────→ Cuotas (requiere API key)
ESPN ──────────────→ Stats (si existe endpoint)
                         ↓
                  MiniMax para análisis
```

---

## 4. DATOS DISPONIBLES POR API

### ESPN (GRATIS, FUNCIONA)

| Datos | Endpoint | Status |
|-------|----------|--------|
| Partidos del día | `/scoreboard` | ✅ 15 games |
| Stats equipos | `/scoreboard` | ✅ PPG, FG%, rebounds, assists |
| Records | `/scoreboard` | ✅ Home/Away/Overall |
| **Odds DraftKings** | `/scoreboard` | ✅ Spread, O/U, ML |
| **Injuries** | `/injuries` | ✅ 29 injuries con detalles |
| Injury return dates | `/injuries` | ✅ Fechas de retorno |
| Rosters | `/teams/{id}/roster` | ✅ Jugadores completos |
| Game summary | `/summary?event={id}` | ✅ Detalles ricos |

### The Odds API (OPCIONAL)

| Datos | Status |
|-------|--------|
| Odds multi-sportsbooks | ⚠️ Requiere API key |
| Más sports | ⚠️ Requiere API key |

---

## 5. PRÓXIMOS PASOS

### Fase 3: AI Integration (PENDIENTE)

- [ ] Crear `MiniMaxService`
- [ ] Crear `PromptBuilder` (usando datos de ESPN)
- [ ] Endpoint `POST /bets/analyze`
- [ ] Conectar con ESPN para stats + injuries
- [ ] El usuario ingresa manualmente las odds que ve (o usamos ESPN)

---

## 6. NOTAS FINALES

1. **ESPN Scoreboard es nuestra fuente principal** — funciona perfecto
2. **Sofascore no es crítico** — ESPN nos da los stats
3. **The Odds API es opcional** — DraftKings odds ya están en ESPN
4. **Injuries funcionan** — 29 injuries con return dates
5. **Todo es GRATIS** — No necesitamos APIs pagadas para NBA

---

## 7. TESTING RESULTS

| Servicio | Status | Datos |
|----------|--------|-------|
| CacheService | ✅ OK | Funcionando |
| ESPN Scoreboard v2 | ✅ FUNCIONA | 15 games + stats + odds |
| ESPN Injuries v2 | ✅ FUNCIONA | 29 injuries con detalles |
| Sofascore | ❌ 403 WAF | No crítico |
| OddsService | ⚠️ Optional | Para más sportsbooks |

---

## 8. FUENTES

- **pseudo-r/Public-ESPN-API** — GitHub repo con documentación de APIs ESPN
- **site.api.espn.com** — Site API v2 (funciona)
- **sports.core.api.espn.com** — Core API v2 (para stats)

---

*Documento creado: 2026-04-10*
*Última actualización: 2026-04-10 23:00 UTC*
