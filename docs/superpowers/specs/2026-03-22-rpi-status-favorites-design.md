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

`GET /api/system-status` — neuer Endpoint, ergänzt den bestehenden `GET /api/dashboard/stats` (kein Ersatz).

Liefert JSON mit:
- `cpuPercent` — CPU-Auslastung in % (zwei `os.cpus()`-Snapshots mit 200ms Abstand, async Handler mit `setTimeout`+Promise)
- `ramUsedMB` / `ramTotalMB` — aus `os.freemem()` / `os.totalmem()`
- `tempCelsius` — aus `/sys/class/thermal/thermal_zone0/temp` (geteilt durch 1000); `null` wenn nicht verfügbar (kein Crash, einfach `null`)
- `diskUsedMB` / `diskTotalMB` — Speicherverzeichnis-Nutzung: `diskUsedMB = storageService.getDiskUsage() / (1024 * 1024)` (getDiskUsage liefert Bytes), `diskTotalMB` via `df -k <storage_path>`. Wenn `df` fehlschlägt: `diskTotalMB: null`, UI zeigt `-`.

**Async-Pattern:** Der Handler muss `async` sein wegen der 200ms CPU-Messung. Fehler werden mit `next(err)` weitergereicht (wie im restlichen Codebase):
```js
router.get('/system-status', requireLogin, async (req, res, next) => {
  try { ... } catch (err) { next(err); }
});
```

Authentifizierung: Session-Middleware (wie alle anderen Routes).

### Disk-Kachel

Die bestehende statische Disk-Kachel (zeigt `storageService.getDiskUsage()` in MB) wird durch das Polling **überschrieben**. Die neue API liefert ebenfalls die Speicherverzeichnis-Größe (gleiche Basis wie bisher), ergänzt um den Gesamtspeicher des Verzeichnis-Dateisystems via `df`.

### Dashboard-Integration

4 neue `stat-card`-Kacheln im `dashboard-grid`, jede mit einem stabilen `id`-Attribut für JS-Zugriff:
- `id="stat-cpu"` — CPU-Auslastung (z.B. `42%`)
- `id="stat-ram"` — RAM (z.B. `612 / 1024 MB`)
- `id="stat-temp"` — Temperatur (z.B. `58°C`) — zeigt `-` wenn `tempCelsius === null`
- `id="stat-disk"` — Disk (ersetzt die bisherige statische Kachel, gleicher `id`)

**Initialwert aller 4 Kacheln:** `…` (Ellipsis) — wird beim ersten Poll-Response (max. ~200ms nach Seitenload) aktualisiert.

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

**Migration:** Beim App-Start per `PRAGMA table_info(recordings)` prüfen ob `is_favorite` bereits existiert. Nur wenn nicht vorhanden: `ALTER TABLE` ausführen. So ist die Migration idempotent und crasht nicht bei wiederholtem Start.

```js
const cols = db.prepare("PRAGMA table_info(recordings)").all();
if (!cols.some(c => c.name === 'is_favorite')) {
  db.prepare("ALTER TABLE recordings ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0").run();
}
```

### API-Endpoint

`PATCH /api/recordings/:id/favorite`

- **Validierung:** `id` muss eine positive Ganzzahl sein (sonst 400). `is_favorite` im Body muss `0` oder `1` sein (sonst 400).
- Body: `{ "is_favorite": 0 | 1 }`
- Response: `{ "id": ..., "is_favorite": ... }`
- Authentifizierung: Session-Middleware.
- Fehler: 404 wenn Recording nicht gefunden.

### Archiv-Änderungen

- **Stern-Button** auf jeder Aufnahme-Kachel (`.recording-card`): `⭐` / `☆` je nach `is_favorite`-Status. Klick sendet PATCH, toggelt Icon ohne Seitenreload.
- **Filter-Button** im Archiv-Header: "★ Nur Favoriten" — setzt/entfernt `?favorites=1` Query-Parameter. Wenn aktiv: Server filtert via `WHERE is_favorite = 1`.
- **Paginierung mit Filter:** Der Controller übergibt der View einen Boolean `favoritesActive` (`true` wenn `?favorites=1` aktiv, sonst `false`). Paginierungs-Links: `/archive?page=N<%= favoritesActive ? '&favorites=1' : '' %>`, damit der Filter beim Blättern erhalten bleibt.

### Video-Seite

Stern-Button im Video-Header (neben Löschen-Button). Gleiche PATCH-Logik.

### Dashboard-Sektion

Neue Sektion unterhalb der Stat-Kacheln. **Verantwortlich: `dashboardService`** (nicht `archiveController`):

```
dashboardService.getStats() → DB WHERE is_favorite=1 ORDER BY created_at DESC LIMIT 6 → favoriteRecordings
dashboardController → übergibt favoriteRecordings an dashboard.ejs
```

- Titel: **Favoriten**
- Max. **6 Thumbnails** im gleichen Kachel-Stil wie die Archiv-Karten
- Jede Kachel: Thumbnail + Dateiname + Datum + Link zur Video-Seite
- Link "Alle Favoriten →" zeigt auf `/archive?favorites=1`
- Sektion nur rendern wenn `favoriteRecordings.length > 0` (server-seitiges Conditional)

### Datenfluss

```
dashboardService → DB WHERE is_favorite=1 LIMIT 6 → dashboard view (Favoriten-Sektion)
archiveController → DB [WHERE is_favorite=1] + Pagination → archive view
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

- CPU-Messung mit 200ms Delay: async Handler, kein Event-Loop-Block
- 10s Polling-Intervall hält API-Last minimal
- Kein Build-Schritt — reines Node.js/EJS, kein Bundler
