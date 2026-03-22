# Settings Redesign + Test-Bewegung

**Datum:** 2026-03-22
**Status:** Approved

## Überblick

Die Einstellungsseite wird optisch und funktional verbessert: Slider und Dropdowns ersetzen freie Texteingaben wo sinnvoll, jedes Feld erhält eine kurze Beschreibung, und ein neuer "Test-Bewegung"-Bereich ermöglicht das manuelle Auslösen einer Testaufnahme.

---

## 1. UI-Änderungen

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

### Beschreibungstexte

Jedes Feld/jede Gruppe erhält einen `<p class="field-hint">` direkt darunter. Beispiele:

- Empfindlichkeit: *Höher = mehr Bewegungen erkannt, erhöht aber auch Fehlalarme.*
- Mindestfläche: *Kleinere Bewegungen (z.B. Insekten) werden ignoriert.*
- Nachlaufzeit: *Wie lange nach der letzten Bewegung weiter aufgenommen wird.*
- FPS: *Mehr Bilder pro Sekunde = flüssiger, aber größere Dateien.*
- Auflösung: *Höhere Auflösung = besseres Bild, mehr Speicherbedarf.*

### Responsive Layout

- **Mobile** (< 640px): Einspaltiger Stack, volle Breite
- **Desktop** (≥ 640px): 2-spaltig innerhalb von Sektionen wo sinnvoll (z.B. Auflösung + FPS nebeneinander)
- Umsetzung via CSS Grid mit `grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))`

### Was bleibt als Textfeld

- Kamera-Gerät (`/dev/video0`)
- Audio-Gerät (`hw:1,0`)
- SMTP-Felder (Host, User, Passwort, Absender, Empfänger)

---

## 2. Test-Bewegung

### UI

Neuer Abschnitt `<section class="settings-section">` mit Titel "Test" unterhalb der Aufnahme-Sektion, außerhalb des Haupt-Formulars:

```
[ ] auch E-Mail senden
[ Bewegung simulieren ]
```

Status-Text erscheint nach Klick: "Aufnahme läuft..." → "Fertig ✓" (oder Fehlermeldung).

### Backend

**Route:** `POST /settings/test-motion` (requires login)

**Controller-Logik (`testMotion`):**
1. Liest `sendMail` aus Request-Body (boolean)
2. Ruft `recordingService.start('test-event')` auf
3. Plant nach 5 Sekunden `recordingService.scheduleStop('test-event')`
4. Wenn `sendMail === true` und Mail konfiguriert: ruft `mailService.sendNotification()` auf
5. Antwortet mit `{ ok: true, message: 'Testaufnahme gestartet' }`

**Frontend (settings.js):**
- Button-Click → POST mit `{ sendMail: checkbox.checked }`
- Button deaktivieren während Request
- Status-Text anzeigen, nach 3s zurücksetzen

---

## 3. CSS

Neue Klassen in `settings.css`:

- `.field-hint` – kleine, gedämpfte Beschreibung unter einem Feld
- `.field-row` – 2-spalten-Grid für Desktop, 1-spaltig auf Mobile
- `.slider-value` – inline Wertanzeige neben Slider
- Bestehende Klassen (`.settings-section`, `.form-label`, `.form-input`) bleiben kompatibel

---

## 4. Dateien die geändert werden

| Datei | Änderung |
|---|---|
| `src/views/settings.ejs` | Komplette Überarbeitung (Slider, Dropdowns, Hints, Test-Sektion) |
| `src/routes/settings.js` | Neue Route `POST /test-motion` |
| `src/controllers/settingsController.js` | Neue Funktion `testMotion` |
| `public/js/settings.js` | Slider-Werte live anzeigen, Test-Motion Handler |
| `public/css/settings.css` | Neue Klassen für Hints, Grid, Slider |

---

## 5. Out of Scope

- Keine Änderung an Services (recording, mail)
- Keine neuen Settings-Keys in der DB
- Kein Umbau der anderen Seiten
