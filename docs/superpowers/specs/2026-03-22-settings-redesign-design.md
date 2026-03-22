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
| Mail-Cooldown | 60s, 120s, 300s, 600s, 1800s |
| SMTP-Port | 25, 465, 587, 2525 (free-text bleibt als Fallback) |

### Beschreibungstexte

Jedes Feld/jede Gruppe erhält einen `<p class="field-hint">` direkt darunter. Beispiele:

- Empfindlichkeit: *Höher = mehr Bewegungen erkannt, erhöht aber auch Fehlalarme.*
- Mindestfläche: *Kleinere Bewegungen (z.B. Insekten) werden ignoriert.*
- Nachlaufzeit: *Wie lange nach der letzten Bewegung weiter aufgenommen wird (entspricht auch der Testaufnahme-Dauer).*
- FPS: *Mehr Bilder pro Sekunde = flüssiger, aber größere Dateien.*
- Auflösung: *Höhere Auflösung = besseres Bild, mehr Speicherbedarf.*

### Felder die als Textfeld bleiben

- Kamera-Gerät (`/dev/video0`)
- Audio-Gerät (`hw:1,0`)
- SMTP-Host, SMTP-User, SMTP-Passwort, Absender, Empfänger
- Speicherpfade (`storage_path`, `thumbnail_path`, `snapshot_path`) – bleiben als Textfelder

### Responsive Layout

- **Mobile** (< 640px): Einspaltiger Stack, volle Breite
- **Desktop** (≥ 640px): 2-spaltig innerhalb von Sektionen wo sinnvoll (z.B. Auflösung + FPS nebeneinander)
- Umsetzung via CSS Grid mit `grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))`

---

## 2. Test-Bewegung

### UI

Neuer Abschnitt `<section class="settings-section">` mit Titel "Test" – separat, außerhalb des Haupt-Formulars (kein `<form>`-Submit):

```
[ ] auch E-Mail senden  ← Checkbox (nur aktiv wenn SMTP-Host konfiguriert)
[ Bewegung simulieren ]
```

Status-Text erscheint nach Klick:
- "Aufnahme läuft..." während Request
- "Fertig ✓ – Aufnahme gestartet (Dauer: Nachlaufzeit-Wert s)" bei Erfolg
- Fehlermeldung bei Fehler (z.B. "Aufnahme läuft bereits")

### Backend

**Route:** `POST /settings/test-motion` (requires login)

**Controller-Funktion `testMotion`:**

```
1. Prüfe Vorbedingungen:
   - ffmpegService.isRecording() → 409 "Aufnahme läuft bereits"
   - settings recording_enabled === false → 409 "Aufnahme ist deaktiviert"
   (Cooldown wird für Test-Zwecke ignoriert)

2. Rufe recordingService.startRecording() auf
   (kein Argument – API hat keine event-ID)

3. Rufe recordingService.scheduleStop() auf
   (nutzt recording_nachlaufzeit_seconds aus Settings – kein fixer 5s-Wert)

4. Wenn sendMail === true im Request-Body:
   - Prüfe ob smtp_host nicht leer ist
   - Rufe mailService.sendTestMail() auf
     (sendTestMail() ignoriert mail_enabled und mail_cooldown – wie beim bestehenden Test-Mail-Button)
   - Fehler beim Mailversand: antworte { ok: true, mailError: 'Fehlermeldung' }
     (Aufnahme wurde trotzdem gestartet)

5. Antworte { ok: true, message: 'Testaufnahme gestartet' }

6. Wrap alles in try/catch → res.status(500).json({ error: ... }) bei unerwarteten Fehlern
```

**Bekannte Einschränkung:** `mail_snapshot_attach` hat keine Backend-Implementierung in `mailService`. Die Checkbox bleibt im UI erhalten, sendet aber keinen Anhang. Wird als separate Aufgabe behandelt.

### Frontend (settings.js)

- Button-Click → POST `/settings/test-motion` mit `{ sendMail: checkbox.checked }`
- Button + Checkbox deaktivieren während Request
- Status-Text anzeigen (DOM-Element `#test-motion-status`)
- Nach 4s Status zurücksetzen, Button wieder aktivieren
- Mail-Checkbox nur anzeigen wenn `smtp_host` gesetzt (via EJS-Bedingung im Template)

---

## 3. CSS

Neue Klassen in `settings.css`:

- `.field-hint` – kleine, gedämpfte Beschreibung unter einem Feld
- `.field-row` – 2-spalten-Grid für Desktop, 1-spaltig auf Mobile
- `.slider-wrapper` – flex-container für Slider + Wert-Anzeige
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

- Keine Änderung an Services (recording, mail, ffmpeg)
- Keine neuen Settings-Keys in der DB
- Kein Umbau der anderen Seiten
- `mail_snapshot_attach` Backend-Implementierung
