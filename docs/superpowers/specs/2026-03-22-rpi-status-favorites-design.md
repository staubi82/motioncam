# Design: RPi-Statusanzeige im Dashboard & Video-Favoriten

**Datum:** 2026-03-22
**Branch:** feature/motioncam-impl
**Projekt:** MotionCam (Node.js, EJS, SQLite, Raspberry Pi 4)

---

## Übersicht

Zwei unabhängige Features:

1. **RPi-Statusanzeige im Dashboard** — Live-Kacheln für CPU, RAM, Temperatur und Disk
2. **Video-Favoriten** — Clips mit Stern markieren, im Archiv filtern, im Dashboard anzeigen

---

## Feature 1: RPi-Status im Dashboard

### Ziel

Der Nutzer sieht auf dem Dashboard live die aktuelle System-Auslastung des Raspberry Pi, ohne eine separate Seite aufzurufen.

### API-Endpoint

`GET /api/system-status`

Liefert JSON mit:
- `cpuPercent` — CPU-Auslastung in % (via kurzer `os.cpus()` Messung, zwei Snapshots mit 200ms Abstand)
- `ramUsedMB` / `ramTotalMB` — aus `os.freemem()` / `os.totalmem()`
- `tempCelsius` — aus `/sys/class/thermal/thermal_zone0/temp` (geteilt durch 1000); `null` wenn nicht verfügbar
- `diskUsedMB` / `diskTotalMB` — via `df -k /` Shell-Aufruf (bereits ähnlich im dashboardController vorhanden)

Authentifizierung: Session-Middleware (wie alle anderen Routes).

### Dashboard-Integration

4 neue `stat-card`-Kacheln im bestehenden `dashboard-grid`:
- CPU-Auslastung (z.B. `42%`)
- RAM (z.B. `612 / 1024 MB`)
- Temperatur (z.B. `58°C`) — zeigt `-` wenn nicht verfügbar
- Disk (Live-Wert ersetzt die bestehende statische Disk-Kachel)

Das Dashboard-JS pollt `/api/system-status` alle **10 Sekunden** und aktualisiert die Kacheln ohne Seitenreload.

### Fehlerbehandlung

Polling-Fehler (Netzwerk, 5xx) werden still ignoriert — Kacheln behalten den letzten Wert.

---

## Feature 2: Video-Favoriten

### Ziel

Nutzer kann einzelne Clips als Favorit markieren. Favoriten erscheinen oben im Archiv (filterbar), im Dashboard als eigene Sektion (max. 6) und auf der Einzel-Video-Seite.

### Datenbankänderung

```sql
ALTER TABLE recordings ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;
```

Migration beim App-Start via `db.run(... IF NOT EXISTS ...)`-Pattern (wie bestehende Schema-Inits).

### API-Endpoint

`PATCH /api/recordings/:id/favorite`

Body: `{ "is_favorite": 0 | 1 }`
Response: `{ "id": ..., "is_favorite": ... }`
Authentifizierung: Session-Middleware.

### Archiv-Änderungen

- **Stern-Button** auf jeder Aufnahme-Kachel (`.recording-card`): `⭐` / `☆` je nach Status. Klick sendet PATCH, toggelt Icon ohne Seitenreload.
- **Filter-Button** im Archiv-Header: "★ Nur Favoriten" — setzt/entfernt `?favorites=1` Query-Parameter. Server filtert via `WHERE is_favorite = 1`.
- Paginierung funktioniert zusammen mit dem Filter.

### Video-Seite

Stern-Button im Video-Header (neben Löschen-Button). Gleiche PATCH-Logik.

### Dashboard-Sektion

Neue Sektion unterhalb der Stat-Kacheln:

- Titel: **Favoriten**
- Max. **6 Thumbnails** im gleichen Kachel-Stil wie die Archiv-Karten
- Jede Kachel: Thumbnail + Dateiname + Datum + Link zur Video-Seite
- Link "Alle Favoriten →" zeigt auf `/archive?favorites=1`
- Sektion nur anzeigen wenn mindestens 1 Favorit existiert

### Datenfluss

```
archiveController → DB WHERE is_favorite=1 LIMIT 6 → dashboard view
archiveController → DB WHERE is_favorite=1 (+ Pagination) → archive view
PATCH /api/recordings/:id/favorite → DB UPDATE → JSON response
```

---

## Nicht im Scope

- Favoriten pro User (nur ein User in der App)
- Sortierung der Favoriten (chronologisch absteigend, wie bisher)
- Export/Download von Favoriten
- Favoriten-Zähler im Dashboard

---

## Technische Constraints (RPi)

- CPU-Messung mit 200ms Delay kostet vernachlässigbar wenig
- 10s Polling-Intervall hält API-Last minimal
- Kein Build-Schritt — reines Node.js/EJS, kein Bundler
