# ODDSIQ — FASE 3: AI Integration

> **Fecha:** 10 Abril 2026
> **Estado:** ✅ COMPLETADA
> **Rama:** `feat/fase3-ai-integration`

---

## 1. OBJETIVO

Integrar MiniMax API para generar análisis automáticos de partidos usando los datos de ESPN.

---

## 2. COMPONENTES CREADOS

### 2.1 MiniMaxService

**Ubicación:** `src/services/minimax.service.ts`

Servicio para comunicarse con la API de MiniMax.

```typescript
// Métodos principales:
async chatCompletion(messages, options?): Promise<{ content, usage }>
async complete(prompt, options?): Promise<{ content, usage }>
async generateBasketballAnalysis(matchData, userBankroll): Promise<{
  analysis: string;
  usage: { promptTokens, completionTokens, totalTokens };
  estimatedCost: number;
}>
```

**Características:**
- Usa modelo `MiniMax-M2.7` con 204K tokens context
- Max tokens: 16,000
- Temperature: 0.7
- Costo estimado: ~$0.0015 por análisis

---

### 2.2 Analysis Entity

**Ubicación:** `src/analysis/entities/analysis.entity.ts`

Tabla en MySQL para guardar análisis generados.

```sql
-- Tabla: analyses
- id (UUID, PK)
- user_id
- sport
- home_team / away_team
- tournament / event_date
- user_odds / user_sportsbook
- analysis (LONGTEXT) -- El markdown del análisis
- sources (JSON) -- Datos crudos de ESPN
- recommended_selection / recommended_odds / recommended_stake
- confidence (HIGH/MEDIUM/LOW)
- mini_max_model / mini_max_tokens / mini_max_cost
- created_at / updated_at
```

---

### 2.3 AnalysisService

**Ubicación:** `src/analysis/analysis.service.ts`

Lógica de negocio para analizar partidos.

```typescript
// Métodos:
async analyzeMatch(userId, homeTeam, awayTeam, sport, options?): Promise<Analysis>
async getAnalysis(userId, analysisId): Promise<Analysis>
async getUserAnalyses(userId, options?): Promise<Analysis[]>
```

**Flujo:**
1. Recibe datos del partido (homeTeam, awayTeam, sport)
2. Obtiene datos de ESPN (scoreboard + injuries)
3. Compila prompt con datos
4. Envía a MiniMax
5. Guarda análisis en DB
6. Devuelve análisis al usuario

---

### 2.4 AnalysisController

**Ubicación:** `src/analysis/analysis.controller.ts`

Endpoints REST.

```typescript
// Endpoints:
POST /api/analysis/analyze    -- Generar análisis
GET /api/analysis/:id         -- Obtener análisis específico
GET /api/analysis             -- Listar análisis del usuario
```

---

### 2.5 AnalysisModule

**Ubicación:** `src/analysis/analysis.module.ts`

Módulo que agrupa todo.

---

## 3. ENDPOINTS

### POST /api/analysis/analyze

Genera un nuevo análisis para un partido.

**Request:**
```json
{
  "homeTeam": "Miami Heat",
  "awayTeam": "Washington Wizards",
  "sport": "BASKETBALL",
  "tournament": "NBA",
  "eventDate": "2026-04-10",
  "userOdds": 1.91,
  "userSportsbook": "DraftKings"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "sport": "BASKETBALL",
    "homeTeam": "Miami Heat",
    "awayTeam": "Washington Wizards",
    "analysis": "# Análisis Completo...\n\n...",
    "recommendedSelection": "Heat -17.5",
    "recommendedOdds": 1.91,
    "recommendedStake": 7500,
    "confidence": "HIGH",
    "miniMaxModel": "MiniMax-M2.7",
    "miniMaxTokens": 8500,
    "miniMaxCost": 0.01275,
    "createdAt": "2026-04-10T..."
  }
}
```

---

### GET /api/analysis

Lista los análisis del usuario.

**Query params:**
- `limit` (default 20)
- `offset` (default 0)

---

### GET /api/analysis/:id

Obtiene un análisis específico por ID.

---

## 4. FLUJO COMPLETO

```
1. USUARIO SELECCIONA PARTIDO
   POST /api/analysis/analyze
   {
     "homeTeam": "Miami Heat",
     "awayTeam": "Washington Wizards",
     "sport": "BASKETBALL"
   }

2. BACKEND OBTIENE DATOS DE ESPN
   ┌─────────────────────────────────────┐
   │  ESPN Scoreboard ──→ Stats + Odds │
   │  ESPN Injuries ─────→ 29 injuries  │
   └─────────────────────────────────────┘

3. COMPILA PROMPT CON DATOS
   - Stats de equipos
   - Injuries
   - Odds de DraftKings
   - Forma reciente
   - H2H

4. ENVÍA A MINIMAX
   POST https://api.minimax.io/v1/text/chatcompletion_v2
   {
     "model": "MiniMax-M2.7",
     "messages": [{ "role": "user", "content": "prompt..." }]
   }

5. GUARDA EN DB
   INSERT INTO analyses (...)

6. DEVUELVE AL USUARIO
   {
     "success": true,
     "data": {
       "analysis": "# 22 secciones...",
       "recommendedSelection": "Heat -17.5",
       "recommendedStake": 7500,
       "confidence": "HIGH"
     }
   }
```

---

## 5. PRÓXIMOS PASOS

### Fase 4: Frontend (PENDIENTE)

- [ ] Nueva página: Match Search
- [ ] Componente: Analysis con markdown render
- [ ] Input de cuota + cálculo de value
- [ ] Botón "Registrar Apuesta"
- [ ] Dashboard de análisis

### Mejoras pendientes:

- [ ] Obtener bankroll real del usuario (actualmente hardcodeado en 500000)
- [ ] Parsear mejor la recomendación del análisis
- [ ] Añadir soporte para Football, Tennis
- [ ] Cachear análisis para no regenerar si ya existe uno reciente

---

## 6. COSTOS

| Concepto | Costo |
|----------|-------|
| Prompt tokens | ~3,000 |
| Response tokens | ~5,500 |
| Total por análisis | ~8,500 tokens |
| Costo por análisis | ~$0.013 |
| 100 análisis/mes | ~$1.30 |
| 1,000 análisis/mes | ~$13 |

---

## 7. CONFIGURACIÓN

### Variables de entorno necesarias:

```bash
# .env
MINIMAX_API_KEY=your_minimax_api_key
```

### Obtener API Key:

1. Ir a https://platform.minimax.io
2. Registrarse / Login
3. Ir a API Keys
4. Crear nueva key
5. Añadir al .env

---

## 8. TESTING

### Probar endpoint:

```bash
# Login primero
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123!"}' \
  | jq -r '.access_token')

# Generar análisis
curl -X POST http://localhost:3000/api/analysis/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "homeTeam": "Miami Heat",
    "awayTeam": "Washington Wizards",
    "sport": "BASKETBALL"
  }'
```

---

## 9. NOTAS

1. **El análisis toma 30-60 segundos** (MiniMax no es el más rápido)
2. **Costo muy bajo** — ~$0.013 por análisis
3. **Los datos de ESPN se obtienen en paralelo** — rápido
4. **El bankroll está hardcodeado** — falta integrate con BankrollService

---

## 10. RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| MiniMax timeout | Baja | Medio | Retry logic |
| API key inválida | Baja | Alto | Validar al startup |
| Costos suben mucho | Baja | Medio | Límite por usuario |
| Análisis de baja calidad | Media | Medio | Iterar prompt engineering |

---

*Documento creado: 2026-04-11*
*Última actualización: 2026-04-11 00:15 UTC*
