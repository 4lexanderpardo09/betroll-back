# 🏈 ESPN Public API — Documentación Completa

> **⚠️ Disclaimer:** Esta es documentación para la API pública no oficial de ESPN. No hay afiliación con ESPN. Úsala responsablemente y respeta sus términos de servicio. Los endpoints pueden cambiar sin previo aviso.

---

## 📚 Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Base URLs](#2-base-urls)
3. [Parámetros Comunes](#3-parámetros-comunes)
4. [NFL — Fútbol Americano](#4-nfl--fútbol-americano)
5. [NBA — Baloncesto](#5-nba--baloncesto)
6. [MLB — Béisbol](#6-mlb--béisbol)
7. [NHL — Hockey sobre Hielo](#7-nhl--hockey-sobre-hielo)
8. [College Football](#8-college-football)
9. [College Basketball](#9-college-basketball)
10. [WNBA](#10-wnba)
11. [Soccer / Fútbol](#11-soccer--fútbol)
12. [UFC / MMA](#12-ufc--mma)
13. [Golf](#13-golf)
14. [Racing / Automovilismo](#14-racing--automovilismo)
15. [Tennis](#15-tennis)
16. [Otros Deportes](#16-otros-deportes)
17. [Core API — Datos Avanzados](#17-core-api--datos-avanzados)
18. [Athlete Endpoints — Datos de Atletas](#18-athlete-endpoints--datos-de-atletas)
19. [CDN Endpoints — Datos en Vivo](#19-cdn-endpoints--datos-en-vivo)
20. [Búsqueda Global](#20-búsqueda-global)
21. [Betting & Odds — Apuestas](#21-betting--odds--apuestas)
22. [Fantasy Sports API](#22-fantasy-sports-api)
23. [Ejemplos Copy-Paste Listos para Usar](#23-ejemplos-copy-paste-listos-para-usar)

---

## 1. Visión General

ESPN expone APIs internas que alimentan su sitio web y apps móviles. Devuelven JSON con información de:

- Marcadores y resultados en tiempo real
- Equipos, jugadores y estadísticas
- Standings / clasificaciones
- Noticias deportivas
- Cuotas y apuestas
- Fantasy Sports
- Datos históricos y de temporada

### Características clave

| Característica | Detalle |
|---|---|
| Autenticación | ❌ No requerida (mayoría de endpoints) |
| Formato | JSON |
| Rate Limiting | Sin límites oficiales — sé responsable |
| Recomendación | Implementar caché y manejo de errores |
| Estabilidad | Endpoints no oficiales, pueden cambiar |

---

## 2. Base URLs

| Dominio | Propósito |
|---|---|
| `site.api.espn.com` | Scores, noticias, equipos, standings |
| `sports.core.api.espn.com` | Atletas, estadísticas, odds, datos detallados |
| `site.web.api.espn.com` | Búsqueda, perfiles de atletas |
| `cdn.espn.com` | Datos en vivo optimizados por CDN |
| `fantasy.espn.com` | Ligas de Fantasy Sports |
| `now.core.api.espn.com` | Feeds de noticias en tiempo real |

### Patrón General de URL

```
https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/{resource}
```

---

## 3. Parámetros Comunes

Estos parámetros se pueden agregar a casi cualquier endpoint:

| Parámetro | Descripción | Ejemplo |
|---|---|---|
| `dates` | Filtrar por fecha | `20241215` o rango `20241201-20241231` |
| `week` | Número de semana | `1` al `18` |
| `seasontype` | Tipo de temporada | `1`=pretemporada, `2`=regular, `3`=playoffs, `4`=off-season |
| `season` | Año de temporada | `2024` |
| `limit` | Límite de resultados | `100`, `1000` |
| `groups` | ID de conferencia (college) | `8` (SEC) |
| `enable` | Incluir datos extra | `roster,stats,projection` |
| `xhr` | Flag para CDN | `1` |

---

## 4. NFL — Fútbol Americano

### Endpoints disponibles

| Recurso | URL | Para qué sirve |
|---|---|---|
| Scoreboard | `site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard` | Resultados y partidos del día |
| Teams | `site.api.espn.com/apis/site/v2/sports/football/nfl/teams` | Lista de todos los equipos NFL |
| Team Detail | `site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{id}` | Detalle de un equipo específico |
| Team Roster | `site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{id}/roster` | Plantel de jugadores de un equipo |
| Team Schedule | `site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{id}/schedule` | Calendario de partidos del equipo |
| Standings | `site.api.espn.com/apis/site/v2/sports/football/nfl/standings` | Tabla de posiciones por división |
| News | `site.api.espn.com/apis/site/v2/sports/football/nfl/news` | Noticias recientes de la NFL |
| Game Summary | `site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={id}` | Resumen completo de un partido |
| Leaders | `site.api.espn.com/apis/site/v3/sports/football/nfl/leaders` | Líderes estadísticos de la temporada |

### Campos del Response — Scoreboard

```json
{
  "leagues": [...],           // Info de la liga
  "season": {
    "type": 2,                // Tipo de temporada
    "year": 2024
  },
  "week": {
    "number": 15              // Semana actual
  },
  "events": [
    {
      "id": "401671803",
      "date": "2024-12-15T18:00Z",
      "name": "Dallas Cowboys at Philadelphia Eagles",
      "shortName": "DAL @ PHI",
      "status": {
        "clock": 0.0,
        "displayClock": "0:00",
        "period": 4,
        "type": {
          "id": "3",
          "name": "STATUS_FINAL",
          "description": "Final",
          "completed": true
        }
      },
      "competitions": [
        {
          "competitors": [
            {
              "id": "21",
              "team": { "id": "21", "name": "Eagles", "abbreviation": "PHI" },
              "score": "34",
              "homeAway": "home"
            },
            {
              "id": "6",
              "team": { "id": "6", "name": "Cowboys", "abbreviation": "DAL" },
              "score": "7",
              "homeAway": "away"
            }
          ],
          "odds": [{ "details": "PHI -14", "overUnder": 47.5 }],
          "venue": {
            "id": "3858",
            "fullName": "Lincoln Financial Field",
            "city": "Philadelphia",
            "state": "PA"
          }
        }
      ]
    }
  ]
}
```

### Campos del Response — Team Roster

```json
{
  "team": { "id": "12", "name": "Kansas City Chiefs" },
  "athletes": [
    {
      "id": "3139477",
      "fullName": "Patrick Mahomes",
      "jersey": "15",
      "position": { "name": "Quarterback", "abbreviation": "QB" },
      "age": 28,
      "weight": 230,
      "height": 74,
      "college": { "name": "Texas Tech" },
      "status": { "name": "Active" }
    }
  ]
}
```

### Ejemplos de uso con parámetros

```bash
# Semana específica de la temporada regular
GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=20241215&week=15&seasontype=2

# Equipo con roster y stats incluidos
GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/12?enable=roster,stats

# Playoffs
GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=3
```

---

## 5. NBA — Baloncesto

### Endpoints disponibles

| Recurso | URL | Para qué sirve |
|---|---|---|
| Scoreboard | `site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard` | Partidos del día con scores |
| Teams | `site.api.espn.com/apis/site/v2/sports/basketball/nba/teams` | Todos los equipos NBA |
| Team Detail | `site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/{id}` | Info detallada de un equipo |
| Standings | `site.api.espn.com/apis/site/v2/sports/basketball/nba/standings` | Clasificación por conferencia |
| News | `site.api.espn.com/apis/site/v2/sports/basketball/nba/news` | Últimas noticias NBA |
| Players | `site.api.espn.com/apis/site/v2/sports/basketball/nba/players` | Listado de jugadores |

### Campos del Response — Teams

```json
{
  "sports": [
    {
      "leagues": [
        {
          "teams": [
            {
              "team": {
                "id": "13",
                "uid": "s:40~l:46~t:13",
                "slug": "los-angeles-lakers",
                "abbreviation": "LAL",
                "displayName": "Los Angeles Lakers",
                "shortDisplayName": "Lakers",
                "name": "Lakers",
                "nickname": "Lakers",
                "location": "Los Angeles",
                "color": "552583",
                "alternateColor": "FDB927",
                "isActive": true,
                "logos": [
                  { "href": "https://a.espncdn.com/i/teamlogos/nba/500/lal.png", "width": 500, "height": 500 }
                ],
                "record": { "items": [{ "summary": "25-15" }] },
                "links": [...]
              }
            }
          ]
        }
      ]
    }
  ]
}
```

### Campos del Response — Standings

```json
{
  "children": [
    {
      "name": "Eastern Conference",
      "standings": {
        "entries": [
          {
            "team": { "id": "2", "name": "Boston Celtics" },
            "stats": [
              { "name": "wins", "displayValue": "30" },
              { "name": "losses", "displayValue": "10" },
              { "name": "winPercent", "displayValue": ".750" },
              { "name": "gamesBehind", "displayValue": "-" },
              { "name": "streak", "displayValue": "W3" }
            ]
          }
        ]
      }
    }
  ]
}
```

---

## 6. MLB — Béisbol

### Endpoints disponibles

| Recurso | URL | Para qué sirve |
|---|---|---|
| Scoreboard | `site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard` | Juegos del día con marcadores |
| Teams | `site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams` | Todos los equipos MLB |
| Standings | `site.api.espn.com/apis/site/v2/sports/baseball/mlb/standings` | Clasificación por división |
| News | `site.api.espn.com/apis/site/v2/sports/baseball/mlb/news` | Noticias y rumores |

### Campos del Response — Scoreboard (béisbol)

```json
{
  "events": [
    {
      "id": "401569678",
      "name": "New York Yankees at Boston Red Sox",
      "status": {
        "type": { "description": "Final" }
      },
      "competitions": [
        {
          "competitors": [
            { "team": { "name": "Red Sox" }, "score": "5", "homeAway": "home" },
            { "team": { "name": "Yankees" }, "score": "3", "homeAway": "away" }
          ],
          "situation": {
            "balls": 0,
            "strikes": 0,
            "outs": 3,
            "onFirst": false,
            "onSecond": false,
            "onThird": false,
            "inning": 9,
            "inningHalf": "Bottom"
          }
        }
      ]
    }
  ]
}
```

### Filtrar por fecha

```bash
# Juegos del 15 de diciembre de 2024
GET https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=20241215
```

---

## 7. NHL — Hockey sobre Hielo

### Endpoints disponibles

| Recurso | URL | Para qué sirve |
|---|---|---|
| Scoreboard | `site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard` | Partidos del día |
| Teams | `site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams` | Todos los equipos NHL |
| Standings | `site.api.espn.com/apis/site/v2/sports/hockey/nhl/standings` | Tabla de posiciones |
| News | `site.api.espn.com/apis/site/v2/sports/hockey/nhl/news` | Noticias NHL |

### Campos del Response — News

```json
{
  "articles": [
    {
      "dataSourceIdentifier": "abc123",
      "headline": "Connor McDavid scores twice in Oilers win",
      "description": "Edmonton's captain had two goals...",
      "published": "2024-12-15T22:00:00Z",
      "lastModified": "2024-12-15T23:00:00Z",
      "premium": false,
      "type": "Story",
      "images": [
        { "url": "https://a.espncdn.com/photo/2024/...", "width": 1296, "height": 729 }
      ],
      "categories": [
        { "type": "team", "id": 11 },
        { "type": "athlete", "id": 3895 }
      ],
      "links": {
        "web": { "href": "https://www.espn.com/nhl/story/_/id/..." }
      }
    }
  ]
}
```

---

## 8. College Football

### Endpoints disponibles

| Recurso | URL | Para qué sirve |
|---|---|---|
| Scoreboard | `site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard` | Partidos universitarios |
| Rankings | `site.api.espn.com/apis/site/v2/sports/football/college-football/rankings` | Rankings AP, Coaches Poll |
| Teams | `site.api.espn.com/apis/site/v2/sports/football/college-football/teams` | Equipos universitarios |
| News | `site.api.espn.com/apis/site/v2/sports/football/college-football/news` | Noticias del fútbol universitario |

### IDs de Conferencias (parámetro `groups`)

| Conferencia | ID |
|---|---|
| SEC | `8` |
| Big Ten | `5` |
| ACC | `1` |
| Big 12 | `4` |
| Pac-12 | `9` |
| American (AAC) | `151` |
| Mountain West | `17` |
| MAC | `15` |
| Sun Belt | `37` |
| Top 25 | `80` |

### Filtrar por conferencia

```bash
# Solo juegos de la SEC
GET https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=8

# Top 25 teams
GET https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80
```

### Campos del Response — Rankings

```json
{
  "rankings": [
    {
      "name": "AP Top 25",
      "shortName": "AP",
      "type": "AP",
      "occurrence": { "number": 15, "type": "week" },
      "ranks": [
        {
          "current": 1,
          "previous": 1,
          "points": 1550,
          "firstPlaceVotes": 62,
          "trend": "0",
          "team": {
            "id": "333",
            "name": "Alabama",
            "abbreviation": "ALA",
            "location": "Alabama"
          }
        }
      ]
    }
  ]
}
```

---

## 9. College Basketball

### Endpoints disponibles

| Recurso | URL | Para qué sirve |
|---|---|---|
| Men's Scoreboard | `site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard` | Marcadores masculinos |
| Men's Rankings | `site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/rankings` | Rankings NCAA masculino |
| Women's Scoreboard | `site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/scoreboard` | Marcadores femeninos |

---

## 10. WNBA

### Endpoints disponibles

| Recurso | URL | Para qué sirve |
|---|---|---|
| Scoreboard | `site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard` | Partidos de la WNBA |
| Teams | `site.api.espn.com/apis/site/v2/sports/basketball/wnba/teams` | Equipos de la WNBA |

---

## 11. Soccer / Fútbol

### Patrón de URL

```
https://site.api.espn.com/apis/site/v2/sports/soccer/{league_code}/{resource}
```

### Endpoints disponibles

| Recurso | Path | Para qué sirve |
|---|---|---|
| Scoreboard | `/scoreboard` | Partidos del día |
| Teams | `/teams` | Equipos de la liga |
| Standings | `/standings` | Tabla de posiciones |

### Códigos de Liga

| Liga | Código |
|---|---|
| Premier League | `eng.1` |
| Championship (Segunda inglesa) | `eng.2` |
| La Liga | `esp.1` |
| Bundesliga | `ger.1` |
| Serie A | `ita.1` |
| Ligue 1 | `fra.1` |
| MLS | `usa.1` |
| NWSL | `usa.nwsl` |
| Champions League | `uefa.champions` |
| Europa League | `uefa.europa` |
| World Cup | `fifa.world` |
| Liga MX | `mex.1` |
| Eredivisie | `ned.1` |
| Primeira Liga (Portugal) | `por.1` |
| Scottish Premiership | `sco.1` |
| Brasileirão | `bra.1` |
| Copa Libertadores | `conmebol.libertadores` |

### Ejemplos

```bash
# Premier League hoy
GET https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard

# Tabla de posiciones La Liga
GET https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/standings

# Champions League
GET https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard
```

### Campos del Response — Standings (Soccer)

```json
{
  "standings": {
    "entries": [
      {
        "team": {
          "id": "382",
          "name": "Manchester City",
          "abbreviation": "MCI"
        },
        "stats": [
          { "name": "gamesPlayed",     "displayValue": "20" },
          { "name": "wins",            "displayValue": "15" },
          { "name": "draws",           "displayValue": "3" },
          { "name": "losses",          "displayValue": "2" },
          { "name": "pointsFor",       "displayValue": "52" },
          { "name": "pointsAgainst",   "displayValue": "20" },
          { "name": "points",          "displayValue": "48" },
          { "name": "rank",            "displayValue": "1" }
        ]
      }
    ]
  }
}
```

---

## 12. UFC / MMA

### Endpoints disponibles

| Recurso | URL | Para qué sirve |
|---|---|---|
| Scoreboard | `site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard` | Eventos y resultados de peleas |
| Rankings | `site.api.espn.com/apis/site/v2/sports/mma/ufc/rankings` | Rankings por categoría de peso |
| Athletes | `site.api.espn.com/apis/site/v2/sports/mma/ufc/athletes` | Luchadores |
| News | `site.api.espn.com/apis/site/v2/sports/mma/ufc/news` | Noticias UFC |

### Campos del Response — Rankings (MMA)

```json
{
  "rankings": [
    {
      "name": "Heavyweight",
      "ranks": [
        {
          "current": 1,
          "athlete": {
            "id": "4569212",
            "fullName": "Jon Jones",
            "nationality": "American"
          }
        }
      ]
    }
  ]
}
```

---

## 13. Golf

### Endpoints disponibles

| Recurso | URL | Para qué sirve |
|---|---|---|
| PGA Scoreboard | `site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard` | Torneo PGA en curso |
| PGA Leaderboard | `site.api.espn.com/apis/site/v2/sports/golf/pga/leaderboard` | Tabla de líderes con scores |
| LPGA Scoreboard | `site.api.espn.com/apis/site/v2/sports/golf/lpga/scoreboard` | Torneo LPGA en curso |

**Tours disponibles:** `pga`, `lpga`, `eur`, `champions-tour`

### Campos del Response — Leaderboard

```json
{
  "events": [
    {
      "name": "The Masters",
      "status": { "type": { "description": "In Progress" } },
      "competitions": [
        {
          "competitors": [
            {
              "athlete": { "fullName": "Scottie Scheffler" },
              "score": { "displayValue": "-18" },
              "status": "active",
              "statistics": [
                { "name": "holesPlayed", "displayValue": "54" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 14. Racing / Automovilismo

### Endpoints disponibles

| Recurso | URL | Para qué sirve |
|---|---|---|
| F1 Scoreboard | `site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard` | Resultados de carrera F1 |
| F1 Standings | `site.api.espn.com/apis/site/v2/sports/racing/f1/standings` | Campeonato de pilotos y constructores |
| NASCAR Cup | `site.api.espn.com/apis/site/v2/sports/racing/nascar-premier/scoreboard` | Carrera NASCAR Cup Series |
| IndyCar | `site.api.espn.com/apis/site/v2/sports/racing/irl/scoreboard` | Carrera IndyCar |

---

## 15. Tennis

### Endpoints disponibles

| Recurso | URL | Para qué sirve |
|---|---|---|
| ATP Scoreboard | `site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard` | Torneos ATP en curso |
| WTA Scoreboard | `site.api.espn.com/apis/site/v2/sports/tennis/wta/scoreboard` | Torneos WTA en curso |
| ATP Rankings | `site.api.espn.com/apis/site/v2/sports/tennis/atp/rankings` | Ranking mundial masculino |

### Campos del Response — Scoreboard (Tennis)

```json
{
  "events": [
    {
      "name": "Australian Open",
      "competitions": [
        {
          "competitors": [
            {
              "athlete": { "fullName": "Novak Djokovic", "nationality": "Serbian" },
              "score": "3",
              "sets": [
                { "number": 1, "value": "6" },
                { "number": 2, "value": "4" },
                { "number": 3, "value": "6" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 16. Otros Deportes

| Deporte | URL Base |
|---|---|
| Rugby | `site.api.espn.com/apis/site/v2/sports/rugby/rugby-union/scoreboard` |
| Cricket | `site.api.espn.com/apis/site/v2/sports/cricket/scoreboard` |
| Lacrosse (PLL) | `site.api.espn.com/apis/site/v2/sports/lacrosse/pll/scoreboard` |
| Boxing | `site.api.espn.com/apis/site/v2/sports/boxing/scoreboard` |

---

## 17. Core API — Datos Avanzados

Base URL: `https://sports.core.api.espn.com/v2/sports/{sport}/leagues/{league}`

> Esta API entrega datos más granulares y detallados que la API estándar.

### Endpoints principales

| Recurso | Path | Para qué sirve |
|---|---|---|
| Athletes | `/athletes?limit=1000` | Todos los atletas de la liga |
| Seasons | `/seasons` | Temporadas disponibles |
| Teams (por temporada) | `/seasons/{year}/teams` | Equipos en una temporada específica |
| Draft | `/seasons/{year}/draft` | Datos del Draft |
| Events | `/events?dates=2024` | Todos los eventos del año |
| Venues | `/venues?limit=500` | Estadios y venues |
| Franchises | `/franchises` | Historia de franquicias |
| Positions | `/positions` | Posiciones disponibles en la liga |
| Plays (jugadas) | `/events/{id}/competitions/{id}/plays?limit=400` | Play-by-play de un partido |

### Ejemplos

```bash
# Todos los jugadores activos de la NFL
GET https://sports.core.api.espn.com/v3/sports/football/nfl/athletes?limit=1000&active=true

# Play-by-play de un partido NFL
GET https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/{eventId}/competitions/{eventId}/plays?limit=400

# Draft NFL 2024
GET https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2024/draft
```

### Campos del Response — Athletes (Core)

```json
{
  "count": 1700,
  "pageIndex": 1,
  "pageSize": 1000,
  "items": [
    {
      "$ref": "http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2024/athletes/3139477",
      "id": "3139477",
      "uid": "s:20~l:28~a:3139477",
      "firstName": "Patrick",
      "lastName": "Mahomes",
      "fullName": "Patrick Mahomes",
      "jersey": "15",
      "dateOfBirth": "1995-09-17",
      "debutYear": 2017,
      "weight": 230,
      "height": 74,
      "active": true,
      "status": { "name": "Active" },
      "position": { "name": "Quarterback", "abbreviation": "QB" },
      "college": { "name": "Texas Tech" },
      "team": {
        "$ref": "http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/teams/12"
      },
      "headshot": { "href": "https://a.espncdn.com/i/headshots/nfl/players/full/3139477.png" }
    }
  ]
}
```

---

## 18. Athlete Endpoints — Datos de Atletas

Base URL: `https://site.web.api.espn.com/apis/common/v3/sports/{sport}/{league}/athletes/{id}`

| Recurso | Path | Para qué sirve |
|---|---|---|
| Overview | `/overview` | Perfil completo del jugador |
| Game Log | `/gamelog` | Estadísticas partido a partido |
| Splits | `/splits` | Splits estadísticos (local/visitante, etc.) |
| Stats | `/stats` | Estadísticas de temporada |

### Campos del Response — Overview

```json
{
  "athlete": {
    "id": "3139477",
    "fullName": "Patrick Mahomes",
    "displayName": "Patrick Mahomes",
    "shortName": "P. Mahomes",
    "weight": 230,
    "height": 74,
    "age": 29,
    "dateOfBirth": "1995-09-17T00:00Z",
    "birthPlace": { "city": "Tyler", "state": "TX", "country": "USA" },
    "college": { "name": "Texas Tech" },
    "jersey": "15",
    "position": { "name": "Quarterback", "abbreviation": "QB" },
    "status": { "name": "Active" },
    "headshot": { "href": "https://a.espncdn.com/i/headshots/nfl/players/full/3139477.png" }
  },
  "statistics": {
    "splits": {
      "categories": [
        {
          "name": "passing",
          "stats": [
            { "name": "completions",    "displayValue": "372" },
            { "name": "passingAttempts","displayValue": "549" },
            { "name": "passingYards",   "displayValue": "4183" },
            { "name": "passingTouchdowns","displayValue": "27" },
            { "name": "interceptions",  "displayValue": "11" },
            { "name": "QBRating",       "displayValue": "92.6" }
          ]
        }
      ]
    }
  }
}
```

### Campos del Response — Game Log

```json
{
  "seasonTypes": [
    {
      "categories": [
        {
          "events": [
            {
              "gameId": "401671803",
              "week": 15,
              "opponent": { "displayName": "Dallas Cowboys" },
              "homeAway": "home",
              "stats": ["372", "549", "4183", "27", "11", "92.6"]
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 19. CDN Endpoints — Datos en Vivo

Base URL: `https://cdn.espn.com/core/{league}/`

> Optimizados para velocidad — ideales para polling de datos en tiempo real.

| Recurso | URL | Para qué sirve |
|---|---|---|
| Scoreboard | `cdn.espn.com/core/{league}/scoreboard?xhr=1` | Scoreboard en vivo ultrarrápido |
| Boxscore | `cdn.espn.com/core/{league}/boxscore?xhr=1&gameId={id}` | Boxscore detallado del partido |
| Play-by-Play | `cdn.espn.com/core/{league}/playbyplay?xhr=1&gameId={id}` | Jugadas en tiempo real |
| Schedule | `cdn.espn.com/core/{league}/schedule?xhr=1` | Calendario de la liga |
| Standings | `cdn.espn.com/core/{league}/standings?xhr=1` | Tabla de posiciones CDN |

### Ejemplos

```bash
# NFL Scoreboard en vivo
GET https://cdn.espn.com/core/nfl/scoreboard?xhr=1

# Boxscore de un partido NBA
GET https://cdn.espn.com/core/nba/boxscore?xhr=1&gameId=401585858

# Jugadas en tiempo real de partido NFL
GET https://cdn.espn.com/core/nfl/playbyplay?xhr=1&gameId=401671803
```

### Campos del Response — Boxscore

```json
{
  "gamepackageJSON": {
    "boxscore": {
      "teams": [
        {
          "team": { "id": "13", "displayName": "Los Angeles Lakers", "abbreviation": "LAL" },
          "statistics": [
            { "name": "fieldGoalsPercentage", "displayValue": ".487" },
            { "name": "threePointsPercentage","displayValue": ".412" },
            { "name": "rebounds",             "displayValue": "45" },
            { "name": "assists",              "displayValue": "27" }
          ]
        }
      ],
      "players": [
        {
          "team": { "id": "13" },
          "statistics": [
            {
              "athletes": [
                {
                  "athlete": { "id": "3202", "fullName": "LeBron James", "jersey": "23" },
                  "stats": ["32", "8", "7", "2", "1", "0", "12-22", ".545"]
                }
              ],
              "labels": ["PTS","REB","AST","STL","BLK","TO","FG","FG%"]
            }
          ]
        }
      ]
    }
  }
}
```

---

## 20. Búsqueda Global

```
GET https://site.web.api.espn.com/apis/common/v3/search?query={término}&limit={n}
```

### Parámetros

| Parámetro | Descripción | Ejemplo |
|---|---|---|
| `query` | Término de búsqueda | `mahomes`, `lakers`, `super bowl` |
| `limit` | Número de resultados | `10` |

### Ejemplo

```bash
GET https://site.web.api.espn.com/apis/common/v3/search?query=mahomes&limit=10
```

### Campos del Response

```json
{
  "results": [
    {
      "type": "player",
      "contents": [
        {
          "id": "3139477",
          "description": "Patrick Mahomes",
          "type": "athlete",
          "sport": "football",
          "league": "nfl",
          "href": "https://www.espn.com/nfl/player/_/id/3139477"
        }
      ]
    },
    {
      "type": "team",
      "contents": [...]
    }
  ]
}
```

---

## 21. Betting & Odds — Apuestas

Base URL: `https://sports.core.api.espn.com/v2/sports/{sport}/leagues/{league}`

| Recurso | Path | Para qué sirve |
|---|---|---|
| Game Odds | `/events/{id}/competitions/{id}/odds` | Líneas y spreads del partido |
| Win Probabilities | `/events/{id}/competitions/{id}/probabilities` | % de probabilidad de ganar |
| Futures | `/seasons/{year}/futures` | Cuotas de campeonato, MVP, etc. |
| ATS Records | `/seasons/{year}/types/{type}/teams/{id}/ats` | Record ATS (against the spread) del equipo |

### IDs de Proveedores de Apuestas

| Proveedor | ID |
|---|---|
| Caesars | `38` |
| Bet365 | `2000` |
| DraftKings | `41` |

### Ejemplos

```bash
# Odds de un partido NFL
GET https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/{eventId}/competitions/{eventId}/odds

# Win probabilities en tiempo real
GET https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/{eventId}/competitions/{eventId}/probabilities

# Futuros NFL 2024 (apuesta al campeón)
GET https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2024/futures
```

### Campos del Response — Odds

```json
{
  "items": [
    {
      "provider": { "id": "41", "name": "DraftKings" },
      "details": "PHI -14",
      "overUnder": 47.5,
      "spread": -14,
      "awayTeamOdds": {
        "team": { "abbreviation": "DAL" },
        "moneyLine": 650,
        "spreadOdds": -110
      },
      "homeTeamOdds": {
        "team": { "abbreviation": "PHI" },
        "moneyLine": -900,
        "spreadOdds": -110,
        "favorite": true
      }
    }
  ]
}
```

### Campos del Response — Win Probabilities

```json
{
  "items": [
    {
      "period": { "number": 4 },
      "time": "2:35",
      "homeWinPercentage": 0.94,
      "awayWinPercentage": 0.06,
      "tiePercentage": 0.00
    }
  ]
}
```

---

## 22. Fantasy Sports API

Base URL: `https://fantasy.espn.com/apis/v3/games/{sport}/seasons/{year}`

### Códigos de Deporte

| Deporte | Código |
|---|---|
| Fútbol Americano | `ffl` |
| Baloncesto | `fba` |
| Béisbol | `flb` |
| Hockey | `fhl` |

### League Endpoints

```bash
# Datos de liga pública
GET /apis/v3/games/ffl/seasons/2024/segments/0/leagues/{league_id}

# Con vistas específicas
GET .../leagues/{id}?view=mTeam
GET .../leagues/{id}?view=mRoster
GET .../leagues/{id}?view=mMatchup
GET .../leagues/{id}?view=mSettings
GET .../leagues/{id}?view=mDraftDetail
```

### Vistas disponibles (`view` parameter)

| Vista | Qué trae |
|---|---|
| `mTeam` | Equipos y puntuaciones de la liga |
| `mRoster` | Rosters actuales de cada equipo |
| `mMatchup` | Enfrentamientos de la semana |
| `mSettings` | Configuración de la liga (scoring, categorías) |
| `mDraftDetail` | Picks del draft |

### Autenticación para Ligas Privadas

Las ligas privadas requieren cookies en el header:

```bash
curl "https://fantasy.espn.com/apis/v3/games/ffl/seasons/2024/segments/0/leagues/{id}?view=mTeam" \
  -H "Cookie: espn_s2=YOUR_ESPN_S2; SWID={YOUR_SWID}"
```

> Las cookies `espn_s2` y `SWID` se obtienen desde las cookies del navegador al iniciar sesión en ESPN.

### X-Fantasy-Filter — Filtrar jugadores

```json
{
  "players": {
    "filterSlotIds": { "value": [0, 1, 2] },
    "sortPercOwned": { "sortAsc": false, "sortPriority": 1 },
    "limit": 50
  }
}
```

```bash
curl "https://fantasy.espn.com/apis/v3/games/ffl/seasons/2024/players?view=players_wl" \
  -H "X-Fantasy-Filter: {\"players\":{\"limit\":50,\"sortPercOwned\":{\"sortAsc\":false,\"sortPriority\":1}}}"
```

---

## 23. Ejemplos Copy-Paste Listos para Usar

### 🏈 NFL

```bash
# Scoreboard hoy
https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard

# Todos los equipos
https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams

# Standings
https://site.api.espn.com/apis/site/v2/sports/football/nfl/standings

# Noticias
https://site.api.espn.com/apis/site/v2/sports/football/nfl/news

# Todos los jugadores activos
https://sports.core.api.espn.com/v3/sports/football/nfl/athletes?limit=1000&active=true
```

### 🏀 NBA

```bash
# Scoreboard hoy
https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard

# Todos los equipos
https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams

# Standings
https://site.api.espn.com/apis/site/v2/sports/basketball/nba/standings
```

### ⚾ MLB

```bash
# Scoreboard (con fecha específica)
https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=20241215

# Todos los equipos
https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams
```

### 🏒 NHL

```bash
https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard
https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams
```

### 🎓 College Football

```bash
https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard
https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings
```

### ⚽ Soccer (Fútbol)

```bash
# Premier League
https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard
https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/standings

# Champions League
https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard

# La Liga
https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard

# Liga MX
https://site.api.espn.com/apis/site/v2/sports/soccer/mex.1/scoreboard
```

### 🥊 UFC

```bash
https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard
https://site.api.espn.com/apis/site/v2/sports/mma/ufc/rankings
```

### 🏎️ F1

```bash
https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard
https://site.api.espn.com/apis/site/v2/sports/racing/f1/standings
```

### 🔴 Datos en Vivo (CDN)

```bash
# NFL live
https://cdn.espn.com/core/nfl/scoreboard?xhr=1

# NBA boxscore
https://cdn.espn.com/core/nba/boxscore?xhr=1&gameId={gameId}

# Odds de un partido NFL
https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/{eventId}/competitions/{eventId}/odds

# Play-by-play
https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/{eventId}/competitions/{eventId}/plays?limit=400
```

---

## 💡 Buenas Prácticas

1. **Implementa caché** — ESPN no publica rate limits pero puede bloquear IPs con demasiadas requests.
2. **Manejo de errores** — Los endpoints pueden cambiar sin aviso. Siempre maneja 404 y 500.
3. **Respeta los TOS** — No usar para aplicaciones comerciales sin revisar los términos de ESPN.
4. **User-Agent** — Algunos endpoints pueden requerir un User-Agent válido de navegador.
5. **CORS** — Estos endpoints no tienen CORS habilitado, úsalos desde backend, no desde browser directamente.

```javascript
// Ejemplo fetch básico con manejo de errores
async function getESPN(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('ESPN API Error:', err);
    return null;
  }
}

// Uso
const scoreboard = await getESPN(
  'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
);
```

---

*Documentación generada en abril 2026 — basada en el repositorio [pseudo-r/Public-ESPN-API](https://github.com/pseudo-r/Public-ESPN-API)*
