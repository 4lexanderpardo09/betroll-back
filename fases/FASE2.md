# ODDSIQ — FASE 2: Scraping Services

> **Fecha:** 10 Abril 2026
> **Estado:** ✅ COMPLETADA (parcialmente - servicios creados, APIs funcionan diferente a lo esperado)
> **Rama:** `feat/fase2-scraping`

---

## 1. OBJETIVO

Implementar servicios de scraping para obtener datos de sports de fuentes externas:
- Sofascore (stats de partidos, forma de equipos)
- ESPN (injuries, news)
- The Odds API (cuotas de sportsbooks)

---

## 2. SERVICIOS CREADOS

### 2.1 CacheService ✅

**Ubicación:** `src/services/cache.service.ts`

Sistema de cache en memoria para evitar requests repetidos.

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

**Base URL:** `https://api.sofascore.com/api/v1`

**AUTH:** No requiere API key. Solo headers especiales para evadir WAF.

**PROBLEMA ENCONTRADO:** Cloudflare WAF bloquea requests con 403 Forbidden.

**Soluciones potenciales:**
1. Usar `curl_cffi` (librería Python que emulate TLS fingerprinting)
2. Mejorar headers con cookies de sesión
3. Usar proxy rotativo
4. **Alternativa:** Usar ESPN como fuente principal (ver abajo)

---

### 2.3 ESPNService ⚠️

**Ubicación:** `src/services/espn.service.ts`

**PROBLEMA ENCONTRADO:** La API `api.espn.com/v3` (injuries, news) devuelve 401 Unauthorized.

**SOLUCIÓN ENCONTRADA:** `site.api.espn.com` funciona PERFECTO para scoreboard!

**Endpoint que SÍ funciona:**
```
GET https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard
```

**Datos que devuelve:**
- `events[]` — 15 partidos del día
- `competitions[].competitors[]` — Stats (PPG, FG%, rebotes, assists)
- `competitions[].odds[]` — **ODDS DE DRAFTKINGS** (h2h, spreads, totals)
- `competitions[].status` — Estado del partido

**Ejemplo real (10 Abril 2026):**
```json
{
  "events": [{
    "id": "401695582",
    "name": "Detroit Pistons at Charlotte Hornets",
    "competitions": [{
      "competitors": [{
        "team": { "name": "Charlotte Hornets", "abbreviation": "CHA" },
        "records": [{ "summary": "43-37" }],
        "leaders": [{ "stats": [{ "displayValue": "22.3" }] }]
      }],
      "odds": [{
        "provider": { "name": "DraftKings", "id": 21 },
        "details": "CHA -4.5 | O/U 226.5",
        "overTotal": 226.5, "underTotal": 226.5
      }]
    }]
  }]
}
```

---

### 2.4 OddsService ⚠️

**Ubicación:** `src/services/odds.service.ts`

**Base URL:** `https://api.the-odds-api.com/v4`

**AUTH:** Requiere API key (gratis en the-odds-api.com)

**STATUS:** Servicio creado pero NO TESTEADO (necesita API key).

**IMPORTANTE:** Según los tests de ESPN, **ESPN Scoreboard YA incluye odds de DraftKings**. Por lo tanto, para NBA:
- **The Odds API es OPCIONAL** si usamos ESPN Scoreboard
- The Odds API sigue siendo útil para:
  - Más sportsbooks (FanDuel, BetMGM además de DraftKings)
  - Otros sports (Football, Tennis, Soccer)
  - Comparación de líneas entre sportsbooks

---

## 3. INVESTIGACIÓN PROFUNDA DE APIS — CONCLUSIONES

### Free NBA Data APIs

| API | Endpoint | Auth | Status | Datos |
|-----|----------|------|--------|-------|
| ESPN Scoreboard | site.api.espn.com | No | ✅ FUNCIONA | Stats + Odds |
| ESPN Injuries | api.espn.com/v3 | ? | ❌ 401 | No funciona |
| Sofascore | api.sofascore.com | No | ❌ 403 WAF | Bloqueado |
| balldontlie.io | api.balldontlie.io | API Key | ⚠️ | Necesita key |
| api-sports.io | api-sports.io | API Key | ? | Pago |
| The Odds API | the-odds-api.com | API Key | ⚠️ | Funciona con key |

### Descubrimientos clave:

1. **ESPN Scoreboard es MEJOR de lo esperado:**
   - Incluye stats de equipos (PPG, FG%, rebotes, assists)
   - Incluye records (home/away/overall)
   - **Incluye ODDS de DraftKings** (moneyline, spread, totals)
   - **NO NECESITA API KEY**
   - Funciona para NBA inmediatamente

2. **Sofascore está bloqueado por Cloudflare:**
   - No es simple como agregar headers
   - Necesita TLS fingerprinting (curl_cffi) o proxy
   - Probablemente no vale la pena el esfuerzo si ESPN da buenos datos

3. **Injuries son el problema:**
   - ESPN injuries API no funciona
   - Sofascore está bloqueado
   - Alternativa: scraping de páginas simples (Rotowire, etc.)

---

## 4. ESTRATEGIA RECOMENDADA

### Para NBA (inmediato):

```
ESPN Scoreboard API ──────→ Stats + Odds (GRATIS, FUNCIONA)
                           ↓
                    MiniMax para análisis
                           ↓
                    El usuario ingresa injuries manualmente
                    (o busca en Rotowire injury page)
```

### Para Football/Tennis/Otros Sports:

```
The Odds API ──────────────→ Cuotas (requiere API key)
ESPN (si existe) ─────────→ Stats (si funciona)
                           ↓
                    MiniMax para análisis
```

### Para Injuries (futuro):

```
Opciones:
1. Rotowire scraping (fácil, HTML simple)
2. PhysioRoom scraping (fácil)
3. Configurar The Odds API para injuries (si soporta)
4. Usuario ingresa manualmente
```

---

## 5. PLAN DE ACCIÓN

### Inmediato (Fase 3):
1. Crear `ESPNService.getScoreboardV2()` con endpoint que SÍ funciona
2. Integrar con MiniMax para análisis
3. **El usuario busca injuries manualmente** (o scrapeo simple de Rotowire)

### Futuro (después de Fase 3):
1. Configurar The Odds API con API key
2. Implementar scraping de injuries desde Rotowire
3. Opcional: investigar Sofascore con curl_cffi

---

## 6. PRÓXIMOS PASOS

### Fase 3: AI Integration (PENDIENTE)

- [ ] Crear `MiniMaxService`
- [ ] Crear `ESPNService.getScoreboardV2()` (endpoint que funciona)
- [ ] Crear `PromptBuilder` usando datos de ESPN
- [ ] Endpoint `POST /bets/analyze`
- [ ] Guardar análisis en tabla `analyses`

---

## 7. VARIABLES DE ENTORNO

```bash
# The Odds API (OPCIONAL si ESPN Scoreboard tiene buenas cuotas)
ODDS_API_KEY=your_odds_api_key

# MiniMax API (para análisis IA)
MINIMAX_API_KEY=your_minimax_api_key
```

---

## 8. NOTAS IMPORTANTES

1. **ESPN Scoreboard funciona** — usar como fuente principal de stats + odds para NBA
2. **The Odds API es opcional** — ESPN ya tiene cuotas de DraftKings
3. **Sofascore está bloqueado** — no es crítico si ESPN funciona
4. **Injuries son elgap** — buscar alternativa o input manual

---

## 9. TESTING — RESULTADOS COMPLETOS

| Servicio | Status | Notas |
|----------|--------|-------|
| CacheService | ✅ OK | 0 hits, 3 misses |
| SofascoreService | ❌ 403 WAF | Cloudflare bloquea |
| ESPNService (v3) | ❌ 401 | API cambió |
| ESPN Scoreboard | ✅ FUNCIONA | Stats + Odds! |
| OddsService | ⚠️ Sin test | Necesita API key |

---

*Documento creado: 2026-04-10*
*Última actualización: 2026-04-10 22:50 UTC*
