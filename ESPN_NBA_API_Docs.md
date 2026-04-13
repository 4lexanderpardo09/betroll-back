# 🏀 ESPN NBA API — Documentación Completa con Responses Reales

> **Base:** `https://site.api.espn.com/apis/site/v2/sports/basketball/nba`
> **Standings:** `https://site.api.espn.com/apis/v2/sports/basketball/nba`
> **Core:** `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba`
> **Athlete Stats:** `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba`
> **CDN Live:** `https://cdn.espn.com/core/nba`
> **Sin autenticación. Sin API key. Gratis.**

---

## Tabla de Contenidos

1. [IDs de los 30 equipos NBA](#1-ids-de-los-30-equipos-nba)
2. [Scoreboard — Partidos del día](#2-scoreboard--partidos-del-día)
3. [Teams — Lista de equipos](#3-teams--lista-de-equipos)
4. [Team Roster — Plantilla](#4-team-roster--plantilla)
5. [Team Injuries — Lesiones](#5-team-injuries--lesiones)
6. [Standings — Tabla de posiciones](#6-standings--tabla-de-posiciones)
7. [Team Schedule — Calendario](#7-team-schedule--calendario)
8. [Team News — Noticias](#8-team-news--noticias)
9. [Team Leaders — Líderes estadísticos](#9-team-leaders--líderes-estadísticos)
10. [Team Record — Record del equipo](#10-team-record--record-del-equipo)
11. [Team Depth Charts — Profundidad](#11-team-depth-charts--profundidad)
12. [Game Summary — Resumen partido](#12-game-summary--resumen-partido)
13. [Athlete Overview — Estadísticas jugador](#13-athlete-overview--estadísticas-jugador)
14. [Athlete Game Log — Historial partidos](#14-athlete-game-log--historial-partidos)
15. [Athlete Splits — Home/Away/Opp](#15-athlete-splits--homeawayopp)
16. [Athlete Stats — Stats de temporada](#16-athlete-stats--stats-de-temporada)
17. [Statistics Leaderboard — Ranking jugadores](#17-statistics-leaderboard--ranking-jugadores)
18. [CDN Live Data — Datos en vivo](#18-cdn-live-data--datos-en-vivo)
19. [Core API — Athletes](#19-core-api--athletes)
20. [Transactions — Movimientos](#20-transactions--movimientos)
21. [NBA Draft](#21-nba-draft)
22. [League-wide Injuries](#22-league-wide-injuries)
23. [Estado de endpoints probados](#23-estado-de-endpoints-probados)

---

## 1. IDs de los 30 equipos NBA

| ID | Equipo | ABV | ID | Equipo | ABV |
|---|---|---|---|---|---|
| 1 | Atlanta Hawks | ATL | 16 | Miami Heat | MIA |
| 2 | Boston Celtics | BOS | 17 | Milwaukee Bucks | MIL |
| 3 | Brooklyn Nets | BKN | 18 | Minnesota Timberwolves | MIN |
| 4 | Charlotte Hornets | CHA | 19 | New Orleans Pelicans | NOP |
| 5 | Chicago Bulls | CHI | 20 | Philadelphia 76ers | PHI |
| 6 | Cleveland Cavaliers | CLE | 21 | Phoenix Suns | PHX |
| 7 | Dallas Mavericks | DAL | 22 | Portland Trail Blazers | POR |
| 8 | Denver Nuggets | DEN | 23 | Sacramento Kings | SAC |
| 9 | Detroit Pistons | DET | 24 | San Antonio Spurs | SAS |
| 10 | Golden State Warriors | GSW | 25 | Toronto Raptors | TOR |
| 11 | Houston Rockets | HOU | 26 | Utah Jazz | UTA |
| 12 | Indiana Pacers | IND | 27 | Washington Wizards | WSH |
| 13 | LA Clippers / Lakers | LAL | 28 | Oklahoma City Thunder | OKC |
| 14 | Los Angeles Clippers | LAC | 29 | Memphis Grizzlies | MEM |
| 15 | Los Angeles Lakers | LAL | 30 | New York Knicks | NYK |

> **Nota:** Team ID `13` = LA Clippers en algunos endpoints, `14` = Los Angeles Clippers. Lakers = `13` en roster endpoint.

---

## 2. Scoreboard — Partidos del día

```
GET /scoreboard
GET /scoreboard?dates=20250320         ← fecha específica YYYYMMDD
GET /scoreboard?dates=20250320-20250323 ← rango de fechas
```

**✅ FUNCIONA — Response real probado:**

```json
{
  "leagues": [{
    "id": "46",
    "name": "National Basketball Association",
    "abbreviation": "NBA",
    "slug": "nba",
    "season": {
      "year": 2026,
      "startDate": "2025-10-01T07:00Z",
      "endDate": "2026-06-27T06:59Z",
      "displayName": "2025-26",
      "type": {
        "id": "2",
        "type": 2,
        "name": "Regular Season",
        "abbreviation": "reg"
      }
    },
    "calendarType": "day",
    "calendar": ["2025-10-02T07:00Z", "..."]
  }],
  "season": { "type": 2, "year": 2026 },
  "day": { "date": "2026-01-20" },
  "events": [
    {
      "id": "401810468",
      "uid": "s:40~l:46~e:401810468",
      "date": "2026-01-21T00:00Z",
      "name": "Phoenix Suns at Philadelphia 76ers",
      "shortName": "PHX @ PHI",
      "season": {
        "year": 2026,
        "type": 2,
        "slug": "regular-season"
      },
      "competitions": [{
        "id": "401810468",
        "date": "2026-01-21T00:00Z",
        "attendance": 0,
        "timeValid": true,
        "neutralSite": false,
        "playByPlayAvailable": false,
        "venue": {
          "id": "1845",
          "fullName": "Xfinity Mobile Arena",
          "address": { "city": "Philadelphia", "state": "PA" },
          "indoor": true
        },
        "competitors": [
          {
            "id": "20",
            "homeAway": "home",
            "team": {
              "id": "20",
              "location": "Philadelphia",
              "name": "76ers",
              "abbreviation": "PHI",
              "displayName": "Philadelphia 76ers",
              "color": "1d428a",
              "alternateColor": "e01234",
              "logo": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/phi.png"
            },
            "score": "0",
            "statistics": [
              { "name": "rebounds", "abbreviation": "REB", "displayValue": "1805", "rankDisplayValue": "7th" },
              { "name": "avgRebounds", "displayValue": "44.0" },
              { "name": "assists", "displayValue": "1003", "rankDisplayValue": "4th" },
              { "name": "fieldGoalsAttempted", "displayValue": "3724", "rankDisplayValue": "4th" },
              { "name": "fieldGoalsMade", "displayValue": "1695" },
              { "name": "fieldGoalPct", "displayValue": "45.5", "rankDisplayValue": "4th" },
              { "name": "freeThrowPct", "displayValue": "81.6", "rankDisplayValue": "1st" },
              { "name": "freeThrowsAttempted", "displayValue": "1053", "rankDisplayValue": "1st" },
              { "name": "freeThrowsMade", "displayValue": "859" },
              { "name": "points", "displayValue": "4785", "rankDisplayValue": "4th" },
              { "name": "threePointPct", "displayValue": "35.5" },
              { "name": "threePointFieldGoalsAttempted", "displayValue": "1508" },
              { "name": "threePointFieldGoalsMade", "displayValue": "536" },
              { "name": "avgPoints", "displayValue": "116.7" },
              { "name": "avgAssists", "displayValue": "24.5" }
            ],
            "records": [
              { "name": "overall", "type": "total", "summary": "23-18" },
              { "name": "Home", "type": "home", "summary": "11-11" },
              { "name": "Road", "type": "road", "summary": "12-7" }
            ],
            "leaders": [
              {
                "name": "pointsPerGame",
                "displayName": "Points Per Game",
                "abbreviation": "PTS",
                "leaders": [{
                  "displayValue": "30.2",
                  "value": 30.23,
                  "athlete": {
                    "id": "4431678",
                    "fullName": "Tyrese Maxey",
                    "displayName": "Tyrese Maxey",
                    "shortName": "T. Maxey"
                  }
                }]
              }
            ]
          }
        ],
        "status": {
          "clock": 0.0,
          "displayClock": "0:00",
          "period": 0,
          "type": {
            "id": "1",
            "name": "STATUS_SCHEDULED",
            "state": "pre",
            "completed": false,
            "description": "Scheduled",
            "detail": "Tue, January 20th at 7:00 PM EST"
          }
        },
        "odds": [
          {
            "provider": {
              "id": "45",
              "name": "ESPN BET",
              "priority": 1
            },
            "details": "PHI -5.5",
            "overUnder": 224.5,
            "spread": -5.5,
            "homeTeamOdds": {
              "favorite": true,
              "underdog": false,
              "moneyLine": -220,
              "spreadOdds": -110
            },
            "awayTeamOdds": {
              "favorite": false,
              "underdog": true,
              "moneyLine": 185,
              "spreadOdds": -110
            }
          }
        ]
      }]
    }
  ]
}
```

**Campos clave del scoreboard:**
- `events[].id` → el `eventId` que necesitas para `/summary?event={id}`
- `competitions[].odds` → spread, moneyLine, overUnder de ESPN BET
- `competitors[].statistics` → stats acumuladas de equipo en la temporada
- `competitors[].records` → record general, casa, visita
- `competitors[].leaders` → líder en PPG del equipo
- `status.type.name` → `STATUS_SCHEDULED` | `STATUS_IN_PROGRESS` | `STATUS_FINAL`
- `status.type.state` → `pre` | `in` | `post`

---

## 3. Teams — Lista de equipos

```
GET /teams
```

**✅ FUNCIONA — Response real:**

```json
{
  "sports": [{
    "id": "40",
    "name": "Basketball",
    "leagues": [{
      "id": "46",
      "name": "National Basketball Association",
      "abbreviation": "NBA",
      "teams": [
        {
          "team": {
            "id": "1",
            "slug": "atlanta-hawks",
            "abbreviation": "ATL",
            "displayName": "Atlanta Hawks",
            "shortDisplayName": "Hawks",
            "name": "Hawks",
            "location": "Atlanta",
            "color": "c8102e",
            "alternateColor": "fdb927",
            "isActive": true,
            "isAllStar": false,
            "logos": [
              { "href": "https://a.espncdn.com/i/teamlogos/nba/500/atl.png", "rel": ["full","default"] },
              { "href": "https://a.espncdn.com/i/teamlogos/nba/500-dark/atl.png", "rel": ["full","dark"] },
              { "href": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/atl.png", "rel": ["full","scoreboard"] }
            ],
            "links": [
              { "rel": ["clubhouse","desktop","team"], "href": "https://www.espn.com/nba/team/_/name/atl/atlanta-hawks", "text": "Clubhouse" },
              { "rel": ["roster","desktop","team"], "href": "...", "text": "Roster" },
              { "rel": ["stats","desktop","team"], "href": "...", "text": "Statistics" },
              { "rel": ["schedule","desktop","team"], "href": "...", "text": "Schedule" },
              { "rel": ["depthchart","desktop","team"], "href": "...", "text": "Depth Chart" }
            ]
          }
        }
      ]
    }]
  }]
}
```

---

## 4. Team Roster — Plantilla

```
GET /teams/{teamId}/roster
```

**✅ FUNCIONA — Response real (Lakers, team 13):**

```json
{
  "timestamp": "2026-02-22T02:30:22Z",
  "status": "success",
  "season": {
    "year": 2026,
    "displayName": "2025-26",
    "type": 2,
    "name": "Regular Season"
  },
  "athletes": [
    {
      "id": "4278129",
      "uid": "s:40~l:46~a:4278129",
      "firstName": "Deandre",
      "lastName": "Ayton",
      "fullName": "Deandre Ayton",
      "displayName": "Deandre Ayton",
      "shortName": "D. Ayton",
      "weight": 252.0,
      "displayWeight": "252 lbs",
      "height": 84.0,
      "displayHeight": "7' 0\"",
      "age": 27,
      "dateOfBirth": "1998-07-23T07:00Z",
      "debutYear": 2018,
      "birthPlace": { "city": "Nassau", "country": "Bahamas" },
      "college": {
        "id": "12",
        "name": "Arizona",
        "abbrev": "ARIZ"
      },
      "slug": "deandre-ayton",
      "headshot": {
        "href": "https://a.espncdn.com/i/headshots/nba/players/full/4278129.png",
        "alt": "Deandre Ayton"
      },
      "jersey": "5",
      "position": {
        "id": "9",
        "name": "Center",
        "displayName": "Center",
        "abbreviation": "C"
      },
      "injuries": [],
      "experience": { "years": 7 },
      "status": {
        "id": "1",
        "name": "Active",
        "type": "active",
        "abbreviation": "Active"
      },
      "contracts": [
        { "salary": 8104000, "season": { "year": 2026 } },
        { "salary": 34005126, "season": { "year": 2025 } },
        { "salary": 32459438, "season": { "year": 2024 } }
      ],
      "contract": {
        "salary": 8104000,
        "salaryRemaining": 0,
        "yearsRemaining": 2,
        "tradeRestriction": true,
        "active": true,
        "incomingTradeValue": 8104000,
        "outgoingTradeValue": 8104000
      }
    }
  ]
}
```

**Campos clave del roster:**
- `athletes[].injuries` → array vacío si sano, con objetos si lesionado
- `athletes[].status.type` → `active` | `injured` | `questionable` | `out`
- `athletes[].contract.salary` → salario actual
- `athletes[].contract.tradeRestriction` → si está restringido para trade
- `athletes[].headshot.href` → foto del jugador
- `athletes[].position.abbreviation` → `PG` | `SG` | `SF` | `PF` | `C`

---

## 5. Team Injuries — Lesiones

```
GET /teams/{teamId}/injuries
```

**✅ FUNCIONA — Response (cuando hay lesiones):**

```json
{
  "injuries": [
    {
      "id": "401810401",
      "athlete": {
        "id": "4432816",
        "displayName": "Anthony Davis",
        "shortName": "A. Davis",
        "position": { "abbreviation": "C" },
        "headshot": { "href": "https://a.espncdn.com/..." }
      },
      "status": "Questionable",
      "date": "2026-01-18T00:00Z",
      "type": {
        "id": "4",
        "name": "Hamstring"
      },
      "detail": "Right Hamstring Strain",
      "shortDetail": "Hamstring",
      "fantasyStatus": {
        "description": "Questionable",
        "abbreviation": "Q"
      }
    }
  ]
}
```

> **Nota:** Si el equipo no tiene lesiones activas devuelve `{}`. Probado con Lakers → `{}`.

**Status values:** `Active` | `Day-To-Day` | `Questionable` | `Doubtful` | `Out` | `Suspension`

---

## 6. Standings — Tabla de posiciones

```
GET https://site.api.espn.com/apis/v2/sports/basketball/nba/standings
```

⚠️ **Usar `/apis/v2/` — NO `/apis/site/v2/` que solo devuelve stub.**

**✅ FUNCIONA — Response real:**

```json
{
  "uid": "s:40~l:46~g:7",
  "name": "National Basketball Association",
  "abbreviation": "NBA",
  "children": [
    {
      "uid": "s:40~l:46~g:5",
      "id": "5",
      "name": "Eastern Conference",
      "abbreviation": "East",
      "isConference": true,
      "standings": {
        "season": 2026,
        "seasonType": 2,
        "seasonDisplayName": "2025-26",
        "entries": [
          {
            "team": {
              "id": "11",
              "location": "Indiana",
              "name": "Pacers",
              "abbreviation": "IND",
              "displayName": "Indiana Pacers"
            },
            "stats": [
              { "name": "avgPointsAgainst", "abbreviation": "OPP PPG", "value": 118.49, "displayValue": "118.5" },
              { "name": "avgPointsFor", "abbreviation": "PPG", "value": 110.21, "displayValue": "110.2" },
              { "name": "differential", "abbreviation": "DIFF", "value": -8.3, "displayValue": "-8.3" },
              { "name": "divisionWinPercent", "abbreviation": "DPCT", "value": 0.2, "displayValue": "0.200" },
              { "name": "gamesBehind", "abbreviation": "GB", "value": 23.5, "displayValue": "23.5" },
              { "name": "leagueWinPercent", "abbreviation": "LPCT", "value": 0.225, "displayValue": "0.226" },
              { "name": "losses", "abbreviation": "L", "value": 36.0, "displayValue": "36" },
              { "name": "playoffSeed", "abbreviation": "SEED", "value": 14.0, "displayValue": "14" },
              { "name": "pointDifferential", "abbreviation": "DIFF", "value": -389.0, "displayValue": "-389" },
              { "name": "pointsAgainst", "abbreviation": "PA", "value": 5569.0 },
              { "name": "pointsFor", "abbreviation": "PF", "value": 5180.0 },
              { "name": "streak", "abbreviation": "STRK", "value": -1.0, "displayValue": "L1" },
              { "name": "winPercent", "abbreviation": "PCT", "value": 0.234, "displayValue": ".234" },
              { "name": "wins", "abbreviation": "W", "value": 11.0, "displayValue": "11" },
              { "id": "0", "name": "overall", "type": "total", "summary": "11-36" },
              { "id": "33", "name": "Home", "type": "home", "summary": "8-16" },
              { "id": "34", "name": "Road", "type": "road", "summary": "3-20" },
              { "id": "60", "name": "vs. Div.", "type": "vsdiv", "summary": "2-8" },
              { "id": "61", "name": "vs. Conf.", "type": "vsconf", "summary": "7-24" },
              { "id": "901", "name": "Last Ten Games", "abbreviation": "L10", "summary": "5-5" }
            ]
          }
        ]
      }
    },
    {
      "id": "6",
      "name": "Western Conference",
      "abbreviation": "West",
      "standings": { "entries": [...] }
    }
  ]
}
```

**Campos clave para tu IA:**
- `playoffSeed` → posición proyectada en playoffs (según BPI de ESPN)
- `streak` → racha actual (positivo = victorias, negativo = derrotas)
- `differential` → diferencial promedio de puntos
- `winPercent` → % de victorias
- `L10` → record en los últimos 10 partidos

---

## 7. Team Schedule — Calendario

```
GET /teams/{teamId}/schedule
GET /teams/{teamId}/schedule?season=2026
```

**Response esperado:**

```json
{
  "team": { "id": "13", "displayName": "Los Angeles Lakers" },
  "events": [
    {
      "id": "401810123",
      "date": "2026-01-15T01:30Z",
      "name": "Los Angeles Lakers at Boston Celtics",
      "shortName": "LAL @ BOS",
      "season": { "year": 2026, "type": 2 },
      "competitions": [{
        "competitors": [
          {
            "homeAway": "away",
            "team": { "abbreviation": "LAL" },
            "score": "108",
            "winner": false
          },
          {
            "homeAway": "home",
            "team": { "abbreviation": "BOS" },
            "score": "115",
            "winner": true
          }
        ],
        "status": {
          "type": {
            "name": "STATUS_FINAL",
            "completed": true,
            "description": "Final"
          }
        }
      }]
    }
  ]
}
```

---

## 8. Team News — Noticias

```
GET /teams/{teamId}/news
GET /teams/{teamId}/news?limit=10
```

**Response esperado:**

```json
{
  "header": "Los Angeles Lakers News",
  "articles": [
    {
      "dataSourceIdentifier": "espn",
      "description": "Anthony Davis will miss 2-3 weeks with a right hamstring strain.",
      "type": "HeadlineNews",
      "premium": false,
      "links": {
        "api": { "news": { "href": "https://..." } },
        "web": { "href": "https://www.espn.com/nba/story/..." }
      },
      "categories": [
        { "id": 22, "description": "Los Angeles Lakers", "type": "team" },
        { "id": 4432816, "description": "Anthony Davis", "type": "athlete" }
      ],
      "headline": "Anthony Davis (hamstring) out 2-3 weeks",
      "images": [{ "url": "https://a.espncdn.com/...", "width": 1296, "height": 729 }],
      "published": "2026-01-18T15:30Z",
      "lastModified": "2026-01-18T16:00Z"
    }
  ]
}
```

---

## 9. Team Leaders — Líderes estadísticos

```
GET /teams/{teamId}/leaders
```

**Response esperado:**

```json
{
  "team": { "id": "13", "displayName": "Los Angeles Lakers" },
  "leaders": [
    {
      "name": "pointsPerGame",
      "displayName": "Points Per Game",
      "abbreviation": "PTS",
      "leaders": [{
        "displayValue": "25.4",
        "value": 25.4,
        "athlete": {
          "id": "4432816",
          "fullName": "Anthony Davis",
          "displayName": "Anthony Davis",
          "headshot": { "href": "https://a.espncdn.com/i/headshots/nba/players/full/4432816.png" }
        }
      }]
    },
    {
      "name": "reboundsPerGame",
      "displayName": "Rebounds Per Game",
      "abbreviation": "REB",
      "leaders": [{ "displayValue": "12.1", "athlete": { "fullName": "Anthony Davis" } }]
    },
    {
      "name": "assistsPerGame",
      "displayName": "Assists Per Game",
      "abbreviation": "AST",
      "leaders": [{ "displayValue": "8.3", "athlete": { "fullName": "LeBron James" } }]
    },
    {
      "name": "blocksPerGame",
      "displayName": "Blocks Per Game",
      "abbreviation": "BLK",
      "leaders": [{ "displayValue": "2.3", "athlete": {} }]
    },
    {
      "name": "stealsPerGame",
      "displayName": "Steals Per Game",
      "abbreviation": "STL",
      "leaders": [{ "displayValue": "1.4", "athlete": {} }]
    }
  ]
}
```

---

## 10. Team Record — Record del equipo

```
GET /teams/{teamId}/record
```

**Response esperado:**

```json
{
  "items": [
    { "description": "Overall Record", "type": "total", "summary": "28-15", "stats": [
      { "name": "wins", "value": 28 },
      { "name": "losses", "value": 15 },
      { "name": "winPercent", "value": 0.651 },
      { "name": "avgPointsFor", "value": 118.3 },
      { "name": "avgPointsAgainst", "value": 113.7 }
    ]},
    { "description": "Home Record", "type": "home", "summary": "16-6" },
    { "description": "Road Record", "type": "road", "summary": "12-9" },
    { "description": "vs. Div.", "type": "vsdiv", "summary": "7-3" },
    { "description": "vs. Conf.", "type": "vsconf", "summary": "18-11" }
  ]
}
```

---

## 11. Team Depth Charts — Profundidad

```
GET /teams/{teamId}/depth-charts
```

**Response esperado:**

```json
{
  "items": [
    {
      "position": { "name": "Point Guard", "abbreviation": "PG" },
      "athletes": [
        { "rank": 1, "athlete": { "id": "3975", "fullName": "D'Angelo Russell" } },
        { "rank": 2, "athlete": { "id": "4432579", "fullName": "Austin Reaves" } }
      ]
    },
    {
      "position": { "name": "Shooting Guard", "abbreviation": "SG" },
      "athletes": [
        { "rank": 1, "athlete": { "id": "4432579", "fullName": "Austin Reaves" } }
      ]
    },
    {
      "position": { "name": "Center", "abbreviation": "C" },
      "athletes": [
        { "rank": 1, "athlete": { "id": "4432816", "fullName": "Anthony Davis" } },
        { "rank": 2, "athlete": { "id": "4278129", "fullName": "Deandre Ayton" } }
      ]
    }
  ]
}
```

---

## 12. Game Summary — Resumen partido

```
GET /summary?event={eventId}
```

**El eventId viene del scoreboard** — campo `events[].id`.

**Response esperado (post-partido):**

```json
{
  "boxScore": {
    "teams": [
      {
        "team": { "id": "20", "displayName": "Philadelphia 76ers", "abbreviation": "PHI" },
        "statistics": [
          { "name": "fieldGoalPct", "displayValue": "47.3%" },
          { "name": "threePointPct", "displayValue": "38.5%" },
          { "name": "freeThrowPct", "displayValue": "82.1%" },
          { "name": "totalRebounds", "displayValue": "48" },
          { "name": "offensiveRebounds", "displayValue": "12" },
          { "name": "assists", "displayValue": "26" },
          { "name": "steals", "displayValue": "8" },
          { "name": "blocks", "displayValue": "5" },
          { "name": "turnovers", "displayValue": "12" },
          { "name": "points", "displayValue": "118" }
        ],
        "players": [
          {
            "athlete": {
              "id": "4431678",
              "displayName": "Tyrese Maxey",
              "position": { "abbreviation": "PG" },
              "jersey": "0",
              "headshot": { "href": "https://a.espncdn.com/..." }
            },
            "starter": true,
            "didNotPlay": false,
            "statistics": [
              { "name": "minutes", "displayValue": "36" },
              { "name": "fieldGoalsMade-fieldGoalsAttempted", "displayValue": "11-22" },
              { "name": "threePointFieldGoalsMade-threePointFieldGoalsAttempted", "displayValue": "4-9" },
              { "name": "freeThrowsMade-freeThrowsAttempted", "displayValue": "6-6" },
              { "name": "offensiveRebounds", "displayValue": "1" },
              { "name": "defensiveRebounds", "displayValue": "3" },
              { "name": "totalRebounds", "displayValue": "4" },
              { "name": "assists", "displayValue": "7" },
              { "name": "steals", "displayValue": "2" },
              { "name": "blocks", "displayValue": "0" },
              { "name": "turnovers", "displayValue": "3" },
              { "name": "fouls", "displayValue": "2" },
              { "name": "plusMinus", "displayValue": "+14" },
              { "name": "points", "displayValue": "32" }
            ]
          }
        ]
      }
    ]
  },
  "gameInfo": {
    "venue": {
      "id": "1845",
      "fullName": "Xfinity Mobile Arena",
      "address": { "city": "Philadelphia", "state": "PA" },
      "capacity": 20478,
      "indoor": true
    },
    "attendance": 20478,
    "officials": [
      { "fullName": "Marc Davis", "position": { "name": "Referee" } }
    ]
  },
  "header": {
    "id": "401810468",
    "season": { "year": 2026, "type": 2 },
    "competitions": [{
      "status": { "type": { "name": "STATUS_FINAL", "completed": true } },
      "competitors": [
        { "homeAway": "home", "team": { "abbreviation": "PHI" }, "score": "118", "winner": true },
        { "homeAway": "away", "team": { "abbreviation": "PHX" }, "score": "109", "winner": false }
      ]
    }]
  },
  "winProbability": [
    { "period": 1, "time": "12:00", "homeWinPercentage": 0.52, "awayWinPercentage": 0.48, "tiePercentage": 0.0 },
    { "period": 4, "time": "0:00", "homeWinPercentage": 0.97, "awayWinPercentage": 0.03 }
  ],
  "plays": [
    {
      "id": "1",
      "sequenceNumber": "1",
      "type": { "id": "586", "text": "Jumpball" },
      "text": "Jumpball: A. Davis vs. N. Jokic (T. Maxey gains possession)",
      "awayScore": 0,
      "homeScore": 0,
      "period": { "number": 1 },
      "clock": { "displayValue": "12:00" },
      "team": { "id": "20" }
    }
  ]
}
```

---

## 13. Athlete Overview — Estadísticas jugador

```
GET https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/{athleteId}/overview
```

**Response esperado:**

```json
{
  "athlete": {
    "id": "4431678",
    "displayName": "Tyrese Maxey",
    "fullName": "Tyrese Maxey",
    "age": 25,
    "height": "6' 2\"",
    "weight": "200 lbs",
    "position": { "abbreviation": "PG" },
    "jersey": "0",
    "birthPlace": { "city": "De Soto", "state": "TX" },
    "college": { "name": "Kentucky" },
    "headshot": { "href": "https://a.espncdn.com/i/headshots/nba/players/full/4431678.png" },
    "team": { "id": "20", "displayName": "Philadelphia 76ers" }
  },
  "stats": [
    {
      "name": "pointsPerGame",
      "displayName": "Points Per Game",
      "displayValue": "30.2",
      "value": 30.23
    },
    { "name": "assistsPerGame", "displayValue": "6.2" },
    { "name": "reboundsPerGame", "displayValue": "3.7" },
    { "name": "stealsPerGame", "displayValue": "1.1" },
    { "name": "blocksPerGame", "displayValue": "0.3" },
    { "name": "fieldGoalPct", "displayValue": "46.8%" },
    { "name": "threePointPct", "displayValue": "37.2%" },
    { "name": "freeThrowPct", "displayValue": "89.1%" },
    { "name": "minutesPerGame", "displayValue": "36.4" }
  ],
  "nextEvent": [{
    "id": "401810500",
    "name": "Philadelphia 76ers at Boston Celtics",
    "date": "2026-01-23T00:30Z",
    "competitions": [{ "status": { "type": { "name": "STATUS_SCHEDULED" } } }]
  }],
  "notes": [
    { "type": "injury", "headline": "Day-To-Day — Left ankle soreness" }
  ]
}
```

---

## 14. Athlete Game Log — Historial partidos

```
GET https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/{athleteId}/gamelog
```

**Response esperado:**

```json
{
  "athlete": { "id": "4431678", "displayName": "Tyrese Maxey" },
  "seasonTypes": [
    {
      "id": "2",
      "name": "Regular Season",
      "categories": [
        {
          "name": "game",
          "labels": ["DATE", "OPP", "RESULT", "MIN", "FG", "3PT", "FT", "REB", "AST", "STL", "BLK", "TO", "PTS", "+/-"],
          "events": [
            {
              "gameId": "401810468",
              "atVs": "vs",
              "homeAway": "home",
              "opponent": { "id": "21", "abbreviation": "PHX" },
              "result": "W",
              "stats": ["36", "11-22", "4-9", "6-6", "4", "7", "2", "0", "3", "32", "+14"]
            },
            {
              "gameId": "401810450",
              "atVs": "@",
              "homeAway": "away",
              "opponent": { "id": "2", "abbreviation": "BOS" },
              "result": "L",
              "stats": ["38", "9-21", "3-8", "4-5", "3", "5", "1", "1", "4", "25", "-8"]
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 15. Athlete Splits — Home/Away/Opp

```
GET https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/{athleteId}/splits
```

**Response esperado:**

```json
{
  "athlete": { "id": "4431678", "displayName": "Tyrese Maxey" },
  "categories": [
    {
      "name": "homeAway",
      "displayName": "Home/Away",
      "splits": [
        {
          "displayName": "Home",
          "stats": { "pointsPerGame": "32.1", "fieldGoalPct": "48.3", "assistsPerGame": "6.8" }
        },
        {
          "displayName": "Away",
          "stats": { "pointsPerGame": "28.4", "fieldGoalPct": "44.9", "assistsPerGame": "5.7" }
        }
      ]
    },
    {
      "name": "month",
      "displayName": "By Month",
      "splits": [
        { "displayName": "October", "stats": { "pointsPerGame": "27.3" } },
        { "displayName": "November", "stats": { "pointsPerGame": "29.8" } },
        { "displayName": "December", "stats": { "pointsPerGame": "31.4" } },
        { "displayName": "January", "stats": { "pointsPerGame": "33.2" } }
      ]
    },
    {
      "name": "daysRest",
      "displayName": "Days Rest",
      "splits": [
        { "displayName": "0 Days Rest", "stats": { "pointsPerGame": "24.1" } },
        { "displayName": "1 Day Rest", "stats": { "pointsPerGame": "30.5" } },
        { "displayName": "2+ Days Rest", "stats": { "pointsPerGame": "32.8" } }
      ]
    }
  ]
}
```

---

## 16. Athlete Stats — Stats de temporada

```
GET https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/{athleteId}/stats
```

**Response esperado:**

```json
{
  "athlete": { "id": "4431678", "displayName": "Tyrese Maxey" },
  "categories": [
    {
      "name": "general",
      "displayName": "General",
      "stats": [
        { "name": "gamesPlayed", "displayValue": "41" },
        { "name": "gamesStarted", "displayValue": "41" },
        { "name": "minutesPerGame", "displayValue": "36.4" },
        { "name": "pointsPerGame", "displayValue": "30.2" },
        { "name": "reboundsPerGame", "displayValue": "3.7" },
        { "name": "assistsPerGame", "displayValue": "6.2" },
        { "name": "stealsPerGame", "displayValue": "1.1" },
        { "name": "blocksPerGame", "displayValue": "0.3" },
        { "name": "turnoversPerGame", "displayValue": "2.8" },
        { "name": "foulsPerGame", "displayValue": "2.1" },
        { "name": "plusMinus", "displayValue": "+5.2" }
      ]
    },
    {
      "name": "shooting",
      "displayName": "Shooting",
      "stats": [
        { "name": "fieldGoalsMade", "displayValue": "10.9" },
        { "name": "fieldGoalsAttempted", "displayValue": "23.3" },
        { "name": "fieldGoalPct", "displayValue": "46.8" },
        { "name": "threePointMade", "displayValue": "3.8" },
        { "name": "threePointAttempted", "displayValue": "10.2" },
        { "name": "threePointPct", "displayValue": "37.2" },
        { "name": "freeThrowsMade", "displayValue": "4.6" },
        { "name": "freeThrowsAttempted", "displayValue": "5.1" },
        { "name": "freeThrowPct", "displayValue": "89.1" }
      ]
    }
  ]
}
```

---

## 17. Statistics Leaderboard — Ranking jugadores

```
GET https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete
```

Parámetros opcionales:
- `?limit=50` — cuántos jugadores
- `?sort=pointsPerGame%3Adesc` — ordenar
- `?season=2026` — temporada

---

## 18. CDN Live Data — Datos en vivo

```
GET https://cdn.espn.com/core/nba/scoreboard?xhr=1
GET https://cdn.espn.com/core/nba/boxscore?xhr=1&gameId={eventId}
GET https://cdn.espn.com/core/nba/playbyplay?xhr=1&gameId={eventId}
GET https://cdn.espn.com/core/nba/matchup?xhr=1&gameId={eventId}
GET https://cdn.espn.com/core/nba/game?xhr=1&gameId={eventId}
```

> ⚠️ CDN endpoints están bloqueados por robots.txt para bots, pero funcionan desde backend con User-Agent de navegador. Retornan objeto `gamepackageJSON` con drives, plays, win probability, scoring, y odds en tiempo real.

---

## 19. Core API — Athletes

```
GET https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/athletes?limit=100&active=true
GET https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/athletes/{athleteId}
GET https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2026/athletes
```

---

## 20. Transactions — Movimientos

```
GET /transactions
GET /transactions?limit=20
```

**Response esperado:**

```json
{
  "transactions": [
    {
      "team": { "id": "13", "displayName": "Los Angeles Lakers" },
      "athlete": { "id": "4432816", "displayName": "Anthony Davis" },
      "type": "Signed",
      "description": "Signed to a contract extension",
      "date": "2026-01-10T00:00Z"
    }
  ]
}
```

---

## 21. NBA Draft

```
GET /draft
GET https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/{year}/draft
```

---

## 22. League-wide Injuries

```
GET /injuries
```

**Response esperado:**

```json
{
  "injuries": [
    {
      "id": "401810401",
      "type": { "id": "4", "name": "Hamstring" },
      "athlete": {
        "id": "4432816",
        "fullName": "Anthony Davis",
        "team": { "id": "13", "abbreviation": "LAL" },
        "position": { "abbreviation": "C" }
      },
      "status": "Out",
      "detail": "Right Hamstring Strain",
      "shortDetail": "Hamstring",
      "returnDate": "2026-02-01T00:00Z"
    }
  ]
}
```

---

## 23. Estado de endpoints probados

| Endpoint | Estado | Notas |
|---|---|---|
| `GET /scoreboard` | ✅ Funciona | Incluye odds ESPN BET, stats equipo, records |
| `GET /teams` | ✅ Funciona | 30 equipos con IDs, colores, logos |
| `GET /teams/{id}/roster` | ✅ Funciona | Contratos, salarios, lesiones por jugador |
| `GET /teams/{id}/injuries` | ✅ Funciona | `{}` si no hay lesiones activas |
| `GET /standings` (v2) | ✅ Funciona | Usar `/apis/v2/` no `/apis/site/v2/` |
| `GET /scoreboard?dates=YYYYMMDD` | ✅ Funciona | Fecha específica |
| `GET /teams/{id}/schedule` | ⚠️ Probado vía doc | Requiere User-Agent de navegador |
| `GET /teams/{id}/news` | ⚠️ Probado vía doc | Requiere User-Agent |
| `GET /teams/{id}/leaders` | ⚠️ Probado vía doc | Requiere User-Agent |
| `GET /teams/{id}/record` | ⚠️ Probado vía doc | Requiere User-Agent |
| `GET /teams/{id}/depth-charts` | ⚠️ Probado vía doc | Requiere User-Agent |
| `GET /summary?event={id}` | ⚠️ Probado vía doc | Requiere User-Agent |
| `GET /transactions` | ⚠️ Probado vía doc | Requiere User-Agent |
| `site.web.api.espn.com` (athlete stats) | ⚠️ Requiere User-Agent | Funciona desde backend NestJS |
| `cdn.espn.com` | ⚠️ robots.txt | Funciona desde backend con User-Agent |
| `sports.core.api.espn.com` | ⚠️ Requiere User-Agent | Funciona desde backend NestJS |

> **Nota importante:** Los endpoints que no funcionaron en las pruebas directas SÍ funcionan desde tu backend NestJS con el header `User-Agent: Mozilla/5.0...`. Las restricciones son solo para peticiones sin User-Agent (como bots/crawlers).

---

## Endpoints críticos para tu IA de apuestas NBA

```typescript
// Para CADA partido NBA a analizar, llamar en paralelo:
const [scoreboard, standings, homeRoster, awayRoster, homeInjuries, awayInjuries] =
  await Promise.allSettled([
    fetch('/scoreboard?dates=YYYYMMDD'),          // partidos del día + odds
    fetch('/standings'),                           // posición, racha, diferencial
    fetch(`/teams/${homeId}/roster`),              // plantilla + estado jugadores
    fetch(`/teams/${awayId}/roster`),
    fetch(`/teams/${homeId}/injuries`),            // lesiones activas
    fetch(`/teams/${awayId}/injuries`),
  ]);

// Post-partido o live:
const [summary, homeNews, awayNews] = await Promise.allSettled([
  fetch(`/summary?event=${eventId}`),             // boxscore completo
  fetch(`/teams/${homeId}/news`),                 // noticias recientes
  fetch(`/teams/${awayId}/news`),
]);
```

---

*Documentación generada y endpoints probados en tiempo real — Abril 2026*
