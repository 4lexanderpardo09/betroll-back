# ODDSIQ — FASE 1: Foundation (Backend)

> **Fecha:** 10 Abril 2026
> **Estado:** ✅ COMPLETADA
> **Rama:** `feat/fase1-db-migration` → `develop`

---

## 1. OBJETIVO

Corrección de errores críticos e inconsistencias del proyecto BetRoll original antes de migrar a ODDSIQ con scraping e IA.

---

## 2. ERRORES ENCONTRADOS Y CORREGIDOS

### ERROR 1: Base de datos configurada para PostgreSQL pero no había .env

**Problema:**
```typescript
// app.module.ts — configurado para PostgreSQL:
type: 'postgres',
host: '127.0.0.1',
port: 5432,
database: 'betroll',

// package.json — tenía 3 drivers instalados:
"better-sqlite3": "^5.1.7"  // SQLite (archivos .db existían)
"mysql2": "^3.11.0"         // MySQL
"pg": "^8.20.0"               // PostgreSQL

// Alexander envió dump MySQL
// Pero el backend estaba configurado para PostgreSQL
```

**Solución:**
- Creado `.env` con credenciales MySQL (helpdesk/helpdesk123)
- Creado `.env.example` como plantilla
- Actualizado `app.module.ts` para usar MySQL en vez de PostgreSQL

**Archivos modificados:**
- `.env` (NUEVO)
- `.env.example` (NUEVO)
- `src/app.module.ts` (CORREGIDO)

---

### ERROR 2: Tipo de dato jsonb (PostgreSQL) incompatible con MySQL

**Problema:**
```typescript
// parlay.entity.ts
@Column({ name: 'bet_ids', type: 'jsonb' })  // ❌ MySQL no soporta jsonb
```

**Solución:**
```typescript
// parlay.entity.ts
@Column({ name: 'bet_ids', type: 'json' })  // ✅ MySQL usa json
```

**Archivos modificados:**
- `src/parlays/entities/parlay.entity.ts` (CORREGIDO)

---

### ERROR 3: Variables de entorno JWT inconsistentes

**Problema:**
```typescript
// auth.module.ts usaba:
configService.get('JWT_SECRET度假')

// jwt-refresh.strategy.ts usaba:
configService.get('JWT_REFRESH_SECRET')  // ❌ Diferente nombre
```

**Solución:**
```bash
# .env — ambas variables:
JWT_SECRET=betroll_jwt_secret_dev_abc123_change_in_production
JWT_REFRESH_SECRET=betroll_jwt_refresh_secret_dev_xyz789_change_in_production
```

**Archivos modificados:**
- `.env` (AÑADIDO JWT_REFRESH_SECRET)
- `.env.example` (AÑADIDO JWT_REFRESH_SECRET)

---

## 3. MIGRACIÓN DE BASE DE DATOS

### 3.1 Script de migración creado

**Ubicación:** `src/migrations/001_initial_schema.sql`

**Contenido:**
```sql
-- 9 tablas creadas en MySQL:
✅ users
✅ bankrolls
✅ bankroll_movements
✅ bets
✅ parlays
✅ daily_snapshots
✅ analyses (NUEVA para ODDSIQ)
✅ match_cache (NUEVA para ODDSIQ)
✅ refresh_tokens
```

### 3.2 Nuevas tablas para ODDSIQ

**analyses** — Para guardar análisis de IA:
```sql
- id, user_id, sport
- home_team, away_team, tournament, event_date
- user_odds, user_sportsbook
- analysis (LONGTEXT) — el markdown del análisis
- sources (JSON) — datos crudos de APIs
- recommended_selection, recommended_odds, recommended_stake
- confidence (HIGH/MEDIUM/LOW)
- mini_max_model, mini_max_tokens, mini_max_cost
- created_at, updated_at
```

**match_cache** — Para cachear datos de scraping:
```sql
- id, external_id (ID de Sofascore)
- sport, home_team, away_team, tournament, event_date
- sofascore_data (JSON)
- espn_data (JSON)
- odds_data (JSON)
- expires_at
- created_at
```

---

## 4. TESTS REALIZADOS

### Tests de API (usando curl)

| # | Test | Endpoint | Método | Resultado |
|---|------|---------|--------|-----------|
| 1 | Health check | `/api/health` | GET | ✅ OK |
| 2 | Registro usuario | `/api/auth/register` | POST | ✅ OK |
| 3 | Login | `/api/auth/login` | POST | ✅ OK |
| 4 | Crear bankroll | `/api/bankroll` | POST | ✅ OK |
| 5 | Crear apuesta | `/api/bets` | POST | ✅ OK |
| 6 | Lista apuestas | `/api/bets` | GET | ✅ OK |
| 7 | Dashboard | `/api/analytics/summary` | GET | ✅ OK |
| 8 | Resolver apuesta | `/api/bets/:id/resolve` | PATCH | ✅ OK |
| 9 | Dashboard post-win | `/api/analytics/summary` | GET | ✅ Actualizado |
| 10 | Movimientos bankroll | `/api/bankroll/movements` | GET | ✅ OK |

### Flujo completo probado:

```
1. Registro: test@test.com / Test123! → ✅
2. Login → Token JWT obtenido → ✅
3. Crear bankroll: $500,000 → ✅
4. Crear apuesta: Miami Heat -17.5 @ 1.91, $75,000 → ✅
   - Bankroll bajo de $500,000 a $425,000 ✅
5. Resolver como WON → ✅
   - Bankroll subió a $568,250 (+$68,250 profit) ✅
6. Dashboard mostró:
   - ROI: 91%
   - Win rate: 100%
   - Racha: 1
   - Stop-loss: OK
```

---

## 5. ISSUES MENORES ENCONTRADOS

| Issue | Severidad | Notas |
|-------|-----------|-------|
| `SPREAD` no es betType válido | 🟡 Menor | Usar `HANDICAP` para spreads NBA |
| Puerto 3000 ocupado | 🟢 Cosmetic | Matar proceso anterior si da problemas |

---

## 6. COMMITS REALIZADOS

```bash
feat: ampunt and data
FASE 1: Fix DB config + SQLite to MySQL migration
```

---

## 7. RAMAS CREADAS

```
betroll-back/
├── main (producción)
├── develop (testing) ← merge aquí al final
└── feat/fase1-db-migration ✅ (esta fase)
```

---

## 8. PRÓXIMOS PASOS

### Fase 2: Scraping Services (PENDIENTE)
- [ ] Crear `SofascoreService`
- [ ] Crear `ESPNService`
- [ ] Crear `OddsService`
- [ ] Crear `CacheService`
- [ ] Implementar rate limiting

### Fase 3: AI Integration (PENDIENTE)
- [ ] Crear `MiniMaxService`
- [ ] Crear `PromptBuilder`
- [ ] Endpoint `POST /bets/analyze`
- [ ] Guardar análisis en tabla `analyses`

### Fase 4: Frontend (PENDIENTE)
- [ ] Nuevo diseño Match Search
- [ ] Componente Analysis con markdown
- [ ] Input de cuota + cálculo value
- [ ] Botón "Registrar Apuesta"

---

## 9. VARIABLES DE ENTORNO CONFIGURADAS

```bash
# Database (MySQL)
DB_HOST=localhost
DB_PORT=3306
DB_USER=helpdesk
DB_PASSWORD=helpdesk123
DB_NAME=betroll

# JWT
JWT_SECRET=betroll_jwt_secret_dev_abc123_change_in_production
JWT_REFRESH_SECRET=betroll_jwt_refresh_secret_dev_xyz789_change_in_production

# App
PORT=3000
NODE_ENV=development

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# APIs (por configurar)
MINIMAX_API_KEY=
ODDS_API_KEY=
```

---

## 10. NOTAS IMPORTANTES

1. **El backend arranca correctamente** con `npm run start:dev`
2. **MySQL está corriendo** y las 9 tablas están creadas
3. **Auth funciona** con JWT (access token + refresh token)
4. **Bets CRUD funciona** completamente
5. **Analytics/Dashboard funciona** con tracking de P&L
6. **Las nuevas tablas (`analyses`, `match_cache`)** están creadas y listas para usar

---

*Documento creado: 2026-04-10*
*Última actualización: 2026-04-10 22:25 UTC*
