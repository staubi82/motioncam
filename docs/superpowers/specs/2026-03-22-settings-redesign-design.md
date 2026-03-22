# Settings Redesign + Test-Bewegung + Video-Overlay

**Datum:** 2026-03-22
**Status:** Approved

## Überblick

Drei zusammenhängende Verbesserungen:
1. **Settings-UI Redesign** – Slider, Dropdowns, Beschreibungstexte, responsive Layout
2. **Test-Bewegung** – Manuell eine Testaufnahme auslösen
3. **Video-Overlay** – Datum/Uhrzeit, Auflösung, Raumname einblenden (Live-CSS + FFmpeg ins Video)

---

## 1. Settings-UI Redesign

### Slider (range input)

| Feld | Min | Max | Schritt |
|---|---|---|---|
| Empfindlichkeit | 1 | 100 | 1 |
| Mindestfläche | 0 | 2000 | 50 |
| Nachlaufzeit | 5 | 120 | 5 |

Jeder Slider zeigt den aktuellen Wert dynamisch daneben (via JS `oninput`).

### Dropdowns (select)

| Feld | Optionen |
|---|---|
| Auflösung | 640×480, 1280×720 (HD), 1920×1080 (Full HD) |
| FPS | 5, 10, 15, 20, 25, 30 |
| Video-Bitrate | 500k, 1000k, 2000k, 4000k |
| Audio-Bitrate | 64k, 128k, 192k, 256k |
| Event-Cooldown | 15s, 30s, 60s, 120s, 300s |
| Mail-Cooldown | 60s, 120s, 300s, 600s, 1800s |

### Beschreibungstexte

Jedes Feld erhält einen `<p class="field-hint">` direkt darunter:

- Empfindlichkeit: *Höher = mehr Bewegungen erkannt, erhöht aber auch Fehlalarme.*
- Mindestfläche: *Kleinere Bewegungen (z.B. Insekten) werden ignoriert.*
- Nachlaufzeit: *Wie lange nach der letzten Bewegung weiter aufgenommen wird (= auch Dauer der Testaufnahme).*
- FPS: *Mehr Bilder pro Sekunde = flüssiger, aber größere Dateien.*
- Auflösung: *Höhere Auflösung = besseres Bild, mehr Speicherbedarf.*
- Event-Cooldown: *Mindestpause zwischen zwei Aufnahme-Ereignissen.*
- Mail-Cooldown: *Mindestpause zwischen zwei Benachrichtigungs-E-Mails.*

### Felder die als Textfeld bleiben

- Kamera-Gerät, Audio-Gerät
- SMTP-Host, SMTP-User, SMTP-Passwort, Absender, Empfänger
- Speicherpfade (`storage_path`, `thumbnail_path`, `snapshot_path`)

### Responsive Layout

- **Mobile** (< 640px): Einspaltiger Stack, volle Breite
- **Desktop** (≥ 640px): 2-spaltiges Grid innerhalb Sektionen wo sinnvoll
- Via CSS Grid: `grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))`

---

## 2. Test-Bewegung

### UI

Eigener Abschnitt "Test" in `settings.ejs`, außerhalb des Haupt-`<form>`:

```
[ ] auch E-Mail senden   ← nur sichtbar wenn smtp_host gesetzt
[ Bewegung simulieren ]
<p id="test-motion-status"></p>
```

Status-Text:
- Während Request: "Aufnahme läuft..."
- Erfolg: "Fertig ✓ – Aufnahme gestartet"
- Fehler: Fehlermeldung (z.B. "Aufnahme läuft bereits")
- Nach 4s zurücksetzen

### Backend

**Route:** `POST /settings/test-motion` (requireLogin)

**Änderung an `recordingService.startRecording(skipCooldown = false)`:**

Die Funktion erhält einen optionalen Parameter `skipCooldown`. Wenn `true`, wird der Cooldown-Check (Zeilen 30–37) übersprungen. Alle anderen Guards (isRecording, recording_enabled) bleiben aktiv.

**Controller `testMotion`:**

```
1. Prüfe Vorbedingungen (vor startRecording, da startRecording nur silent-return macht):
   - ffmpegService.isRecording()      → 409 "Aufnahme läuft bereits"
   - recording_enabled === false      → 409 "Aufnahme ist deaktiviert"
   (Cooldown wird via skipCooldown=true ignoriert)

2. recordingService.startRecording(true)  ← skipCooldown=true
   (kein weiteres Argument)

3. recordingService.scheduleStop()
   (nutzt recording_nachlaufzeit_seconds aus Settings)

4. Wenn sendMail === true im Body:
   - Prüfe ob smtp_host, smtp_from UND mail_recipient nicht leer sind
   - Wenn nicht vollständig konfiguriert → { ok: true, mailError: 'SMTP nicht vollständig konfiguriert' }
   - mailService.sendTestMail()  ← ignoriert mail_enabled + Cooldown
   - Bei Fehler → { ok: true, mailError: err.message }

5. res.json({ ok: true, message: 'Testaufnahme gestartet' })
6. Gesamter Flow in try/catch → res.status(500).json({ error: ... })
```

### Frontend (settings.js)

- POST `/settings/test-motion` mit `{ sendMail: checkbox.checked }`
- Button + Checkbox während Request deaktivieren
- Status in `#test-motion-status` anzeigen, nach 4s leeren
- Mail-Checkbox via EJS nur rendern wenn `settings.smtp_host` nicht leer

---

## 3. Video-Overlay

### Neue Settings-Keys (DB-Seeds via INSERT OR IGNORE)

| Key | Default |
|---|---|
| `overlay_enabled` | `false` |
| `overlay_show_datetime` | `true` |
| `overlay_show_resolution` | `true` |
| `overlay_show_location` | `true` |
| `overlay_location_name` | `''` |
| `overlay_position` | `top-left` |

Gültige Werte für `overlay_position`: `top-left`, `top-right`, `bottom-left`, `bottom-right`. Ungültige Werte fallen auf `top-left` zurück (in `buildOverlayFilter` und Live-JS).

### Settings-Controller Ergänzungen

`EDITABLE_KEYS` in `settingsController.js` erhält die 6 neuen Keys.
Die 4 boolean Keys (`overlay_enabled`, `overlay_show_datetime`, `overlay_show_resolution`, `overlay_show_location`) werden zur Checkbox-Falsy-Liste hinzugefügt (gleiche Pattern wie `detection_enabled`).

### UI (settings.ejs – neue Sektion "Video-Overlay")

- Checkbox: Overlay aktiv
- Checkboxen: Datum & Uhrzeit / Auflösung / Ort anzeigen
- Textfeld: Raumname
- Positionsauswahl: 4-er Grid mit klickbaren Kacheln (top-left, top-right, bottom-left, bottom-right)
  → setzt hidden input `overlay_position` per JS onclick

### Live-Overlay (CSS/JS)

`liveController.showLive` liest die 6 `overlay_*` Keys via `settingsService.getAll()` und übergibt sie als `overlayConfig` an die View.

`live.ejs` rendert bei `overlayConfig.overlay_enabled === 'true'`:

```html
<div id="live-overlay" class="live-overlay live-overlay--<%= overlayConfig.overlay_position || 'top-left' %>">
  <% if (overlayConfig.overlay_show_datetime === 'true') { %><span id="ov-datetime"></span><% } %>
  <% if (overlayConfig.overlay_show_resolution === 'true') { %><span id="ov-resolution"><%= settings.video_resolution %></span><% } %>
  <% if (overlayConfig.overlay_show_location === 'true' && overlayConfig.overlay_location_name) { %><span id="ov-location"><%= overlayConfig.overlay_location_name %></span><% } %>
</div>
```

`live.js` aktualisiert `#ov-datetime` jede Sekunde mit `new Date()` (formatiert als `DD.MM.YYYY HH:MM:SS`).

CSS `.live-overlay`: `position:absolute`, halbtransparentes dunkles Hintergrundfeld (`background: rgba(0,0,0,0.55)`), Monospace-Font, weiße Schrift, `line-height:1.6`, `padding:6px 10px`.

Position-Klassen:
- `--top-left`: `top:10px; left:10px`
- `--top-right`: `top:10px; right:10px`
- `--bottom-left`: `bottom:10px; left:10px`
- `--bottom-right`: `bottom:10px; right:10px`

### Recordings-Overlay (FFmpeg drawtext)

**`buildOverlayFilter(settings)` in `ffmpegService.js`:**

Gibt `null` zurück wenn `overlay_enabled !== 'true'`.

Escaping für FFmpeg drawtext (auf `overlay_location_name` anwenden):
```js
function escapeDrawtext(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:').replace(/%/g, '\\%');
}
```

Text-Teile (kombiniert durch `\n`):
- `overlay_show_datetime === 'true'` → `%{localtime\\:%d.%m.%Y %H\\:%M\\:%S}`
- `overlay_show_resolution === 'true'` → `escapeDrawtext(video_resolution)`
- `overlay_show_location === 'true'` && `overlay_location_name` nicht leer → `escapeDrawtext(overlay_location_name)`

Wenn kein Text-Teil aktiv → `null` zurückgeben.

Font-Check **einmalig beim Modulstart** (nicht pro Recording):
```js
const DEJAVU_FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf';
const FONT_ARG = fs.existsSync(DEJAVU_FONT) ? `:fontfile=${DEJAVU_FONT}` : '';
```

Position-Mapping:

| Setting | x | y |
|---|---|---|
| top-left | `10` | `10` |
| top-right | `w-tw-10` | `10` |
| bottom-left | `10` | `h-th-10` |
| bottom-right | `w-tw-10` | `h-th-10` |

**Integration in `spawn()`:**

Wenn `buildOverlayFilter()` nicht null:
- `-s` Argument **entfernen** aus der Arg-Liste
- `-vf "scale=<w>:<h>,<drawtext-filter>"` hinzufügen (vor `outputPath`)
  - Auflösung kommt aus `video_resolution` Setting (z.B. `1280x720` → `scale=1280:720`)

Wenn kein Overlay: `-s` bleibt wie bisher.

---

## 4. Dateien die geändert werden

| Datei | Änderung |
|---|---|
| `src/views/settings.ejs` | Redesign: Slider, Dropdowns, Hints, Test-Sektion, Overlay-Sektion |
| `src/views/live.ejs` | Live-Overlay div + overlayConfig via EJS |
| `src/routes/settings.js` | Neue Route `POST /test-motion` |
| `src/controllers/settingsController.js` | `testMotion` Funktion; 6 overlay Keys in `EDITABLE_KEYS` + checkbox-falsy Liste |
| `src/controllers/liveController.js` | `showLive` übergibt `overlayConfig` (aus settingsService) an View |
| `src/services/ffmpegService.js` | `buildOverlayFilter()`, `escapeDrawtext()`, Font-Check beim Start, `-vf`/`-s` Logik in `spawn()` |
| `src/services/recordingService.js` | `startRecording(skipCooldown = false)` Parameter |
| `src/db/seeds.js` | 6 neue `overlay_*` Keys |
| `public/js/settings.js` | Slider live, Test-Motion Handler, Positions-Kacheln |
| `public/js/live.js` | Overlay-Uhrzeit jede Sekunde aktualisieren |
| `public/css/settings.css` | `.field-hint`, `.field-row`, `.slider-wrapper`, Positions-Grid |
| `public/css/live.css` | `.live-overlay` + Positionsklassen |

---

## 5. Out of Scope

- `mail_snapshot_attach` Backend-Implementierung
- Overlay-Farbe/Schriftgröße konfigurierbar
- Overlay in Thumbnails
