# Settings Redesign + Test-Bewegung + Video-Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the settings page with sliders/dropdowns/descriptions, add a test-motion button, and implement a configurable video overlay (CSS for live view, FFmpeg drawtext for recordings).

**Architecture:** UI-only changes go through EJS + CSS + JS. New backend features (test-motion, overlay settings) extend existing controller/service pattern. The overlay filter is encapsulated in `buildOverlayFilter()` in ffmpegService; `startRecording()` gets a `skipCooldown` param for test use.

**Tech Stack:** Node.js, Express, EJS, better-sqlite3, FFmpeg (drawtext filter), vanilla JS/CSS

---

### Task 1: Seeds – Add 6 overlay_* keys

**Files:**
- Modify: `src/db/seeds.js`

- [ ] **Step 1: Add overlay keys to DEFAULTS array**

In `src/db/seeds.js`, add after `['mail_recipient', '']`:

```js
['overlay_enabled', 'false'],
['overlay_show_datetime', 'true'],
['overlay_show_resolution', 'true'],
['overlay_show_location', 'true'],
['overlay_location_name', ''],
['overlay_position', 'top-left'],
```

- [ ] **Step 2: Verify seeds still run**

```bash
node -e "
  process.env.DB_PATH = '/tmp/test-seeds.db';
  const { runMigrations } = require('./src/db/migrations');
  const { runSeeds } = require('./src/db/seeds');
  const { getDb } = require('./src/db');
  runMigrations(); runSeeds();
  const db = getDb();
  const rows = db.prepare(\"SELECT key,value FROM settings WHERE key LIKE 'overlay%'\").all();
  console.log(rows);
"
```

Expected output: 6 overlay rows printed.

- [ ] **Step 3: Commit**

```bash
git add src/db/seeds.js
git commit -m "feat: add overlay_* settings keys to seeds"
```

---

### Task 2: recordingService – skipCooldown parameter

**Files:**
- Modify: `src/services/recordingService.js`
- Modify: `tests/services/recordingService.test.js`

- [ ] **Step 1: Write failing test**

Add to `tests/services/recordingService.test.js`:

```js
test('startRecording(skipCooldown=true) bypasses cooldown', async () => {
  ffmpegService.spawn.mockReturnValue({ pid: 1 });

  // Insert a very recent motion_start event to trigger cooldown
  const db = getDb();
  db.prepare("INSERT INTO events (type) VALUES ('motion_start')").run();

  // Without skipCooldown: should be blocked by cooldown
  await recordingService.startRecording();
  expect(ffmpegService.spawn).not.toHaveBeenCalled();

  // With skipCooldown=true: should start despite cooldown
  await recordingService.startRecording(true);
  expect(ffmpegService.spawn).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest tests/services/recordingService.test.js --no-coverage 2>&1 | tail -15
```

Expected: FAIL – `startRecording(true)` doesn't bypass cooldown yet.

- [ ] **Step 3: Update startRecording signature**

In `src/services/recordingService.js`, change line 23:

```js
async function startRecording(skipCooldown = false) {
```

Wrap the cooldown block (lines 30–38) in a condition:

```js
if (!skipCooldown) {
  const cooldown = settingsService.getInt('event_cooldown_seconds');
  const db = getDb();
  const lastEvent = db.prepare(
    "SELECT occurred_at FROM events WHERE type='motion_start' ORDER BY id DESC LIMIT 1"
  ).get();
  if (lastEvent) {
    const lastTime = new Date(lastEvent.occurred_at).getTime();
    if (Date.now() - lastTime < cooldown * 1000) return;
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest tests/services/recordingService.test.js --no-coverage 2>&1 | tail -10
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/recordingService.js tests/services/recordingService.test.js
git commit -m "feat: add skipCooldown param to startRecording"
```

---

### Task 3: ffmpegService – buildOverlayFilter + -vf/-s integration

**Files:**
- Modify: `src/services/ffmpegService.js`
- Modify: `tests/services/ffmpegService.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/services/ffmpegService.test.js`:

```js
const { buildOverlayFilter } = require('../../src/services/ffmpegService');

describe('buildOverlayFilter', () => {
  const base = {
    overlay_enabled: 'true',
    overlay_show_datetime: 'true',
    overlay_show_resolution: 'false',
    overlay_show_location: 'false',
    overlay_location_name: '',
    overlay_position: 'top-left',
    video_resolution: '1280x720',
  };

  test('returns null when overlay disabled', () => {
    expect(buildOverlayFilter({ ...base, overlay_enabled: 'false' })).toBeNull();
  });

  test('returns null when no fields enabled', () => {
    expect(buildOverlayFilter({
      ...base,
      overlay_show_datetime: 'false',
    })).toBeNull();
  });

  test('returns filter string with position top-left', () => {
    const result = buildOverlayFilter(base);
    expect(result).toContain('drawtext=');
    expect(result).toContain('x=10');
    expect(result).toContain('y=10');
    expect(result).toContain('localtime');
  });

  test('returns filter with bottom-right position', () => {
    const result = buildOverlayFilter({ ...base, overlay_position: 'bottom-right' });
    expect(result).toContain('x=w-tw-10');
    expect(result).toContain('y=h-th-10');
  });

  test('includes resolution when enabled', () => {
    const result = buildOverlayFilter({ ...base, overlay_show_resolution: 'true' });
    expect(result).toContain('1280x720');
  });

  test('includes location when enabled and non-empty', () => {
    const result = buildOverlayFilter({
      ...base,
      overlay_show_location: 'true',
      overlay_location_name: 'Eingang',
    });
    expect(result).toContain('Eingang');
  });

  test('escapes special chars in location name', () => {
    const result = buildOverlayFilter({
      ...base,
      overlay_show_location: 'true',
      overlay_location_name: "Eingang: 1's",
    });
    expect(result).toContain("Eingang\\: 1\\'s");
  });

  test('falls back to top-left for invalid position', () => {
    const result = buildOverlayFilter({ ...base, overlay_position: 'center' });
    expect(result).toContain('x=10');
    expect(result).toContain('y=10');
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
npx jest tests/services/ffmpegService.test.js --no-coverage 2>&1 | tail -15
```

Expected: FAIL – `buildOverlayFilter` not exported yet.

- [ ] **Step 3: Implement buildOverlayFilter and escapeDrawtext**

Add to `src/services/ffmpegService.js` after the imports, before `let _proc`:

```js
const fs = require('fs');

const DEJAVU_FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf';
const FONT_ARG = fs.existsSync(DEJAVU_FONT) ? `:fontfile=${DEJAVU_FONT}` : '';

const POSITION_MAP = {
  'top-left':     { x: '10',      y: '10' },
  'top-right':    { x: 'w-tw-10', y: '10' },
  'bottom-left':  { x: '10',      y: 'h-th-10' },
  'bottom-right': { x: 'w-tw-10', y: 'h-th-10' },
};

function escapeDrawtext(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:').replace(/%/g, '\\%');
}

function buildOverlayFilter(settings) {
  if (settings.overlay_enabled !== 'true') return null;

  const parts = [];
  if (settings.overlay_show_datetime === 'true') {
    parts.push('%{localtime\\:%d.%m.%Y %H\\:%M\\:%S}');
  }
  if (settings.overlay_show_resolution === 'true') {
    parts.push(escapeDrawtext(settings.video_resolution || ''));
  }
  if (settings.overlay_show_location === 'true' && settings.overlay_location_name) {
    parts.push(escapeDrawtext(settings.overlay_location_name));
  }

  if (parts.length === 0) return null;

  const pos = POSITION_MAP[settings.overlay_position] || POSITION_MAP['top-left'];
  const text = parts.join('\\n');

  return `drawtext${FONT_ARG}:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.5:boxborderw=4:x=${pos.x}:y=${pos.y}:text='${text}'`;
}
```

- [ ] **Step 4: Update spawn() to use -vf instead of -s when overlay active**

Replace the `-s` push in `spawn()` with:

```js
const overlayFilter = buildOverlayFilter(opts.overlaySettings || {});

args.push(
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-b:v', opts.videoBitrate,
  '-r', String(opts.videoFps),
);

if (overlayFilter) {
  const [w, h] = (opts.videoResolution || '1280x720').split('x');
  args.push('-vf', `scale=${w}:${h},${overlayFilter}`);
} else {
  args.push('-s', opts.videoResolution);
}
```

- [ ] **Step 5: Export buildOverlayFilter**

```js
module.exports = { spawn, stop, isRecording, reset, buildOverlayFilter };
```

- [ ] **Step 6: Run all tests**

```bash
npx jest tests/services/ffmpegService.test.js --no-coverage 2>&1 | tail -15
```

Expected: All PASS.

- [ ] **Step 7: Commit**

```bash
git add src/services/ffmpegService.js tests/services/ffmpegService.test.js
git commit -m "feat: add buildOverlayFilter and -vf/-s logic to ffmpegService"
```

---

### Task 4: recordingService – pass overlaySettings to ffmpegService.spawn

**Files:**
- Modify: `src/services/recordingService.js`

- [ ] **Step 1: Pass overlaySettings in opts**

In `startRecording()`, extend the `opts` object (after line 52 `audioEnabled`):

```js
overlaySettings: {
  overlay_enabled:        settingsService.get('overlay_enabled'),
  overlay_show_datetime:  settingsService.get('overlay_show_datetime'),
  overlay_show_resolution:settingsService.get('overlay_show_resolution'),
  overlay_show_location:  settingsService.get('overlay_show_location'),
  overlay_location_name:  settingsService.get('overlay_location_name'),
  overlay_position:       settingsService.get('overlay_position'),
  video_resolution:       settingsService.get('video_resolution'),
},
```

- [ ] **Step 2: Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -15
```

Expected: All 44+ tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/services/recordingService.js
git commit -m "feat: pass overlaySettings to ffmpegService.spawn"
```

---

### Task 5: settingsController – testMotion + overlay keys

**Files:**
- Modify: `src/controllers/settingsController.js`
- Modify: `src/routes/settings.js`
- Create: `tests/routes/settings.test.js`

- [ ] **Step 1: Write failing test for testMotion**

Create `tests/routes/settings.test.js`:

```js
'use strict';
process.env.DB_PATH = ':memory:';
jest.mock('../../src/services/ffmpegService');
jest.mock('../../src/services/recordingService');
jest.mock('../../src/services/mailService');

const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');
const settingsService = require('../../src/services/settingsService');
const ffmpegService = require('../../src/services/ffmpegService');
const recordingService = require('../../src/services/recordingService');
const mailService = require('../../src/services/mailService');

const request = require('supertest');
const { createApp } = require('../../src/app');

let app;

beforeAll(() => {
  runMigrations();
  runSeeds();
  settingsService.loadAll();
  app = createApp();
});

beforeEach(() => {
  jest.clearAllMocks();
  ffmpegService.isRecording.mockReturnValue(false);
  recordingService.startRecording.mockResolvedValue();
  recordingService.scheduleStop.mockReturnValue();
});

function loginAgent() {
  const agent = request.agent(app);
  // Create a session by posting valid credentials (use test DB user seeded via create-admin)
  // For simplicity, mock requireLogin to skip auth in tests
  return agent;
}

describe('POST /settings/test-motion', () => {
  test('returns 401 when not logged in', async () => {
    const res = await request(app).post('/settings/test-motion').send({});
    expect(res.status).toBe(401);
  });

  test('returns 409 when already recording', async () => {
    ffmpegService.isRecording.mockReturnValue(true);
    // Inject session manually via cookie
    const agent = request.agent(app);
    // Force auth by directly testing the controller logic
    const { testMotion } = require('../../src/controllers/settingsController');
    const req = {
      body: { sendMail: false },
      session: { userId: 1, username: 'admin' },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await testMotion(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('returns ok:true and calls startRecording when idle', async () => {
    const { testMotion } = require('../../src/controllers/settingsController');
    const req = { body: { sendMail: false }, session: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await testMotion(req, res);
    expect(recordingService.startRecording).toHaveBeenCalledWith(true);
    expect(recordingService.scheduleStop).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('includes mailError when smtp not configured', async () => {
    const { testMotion } = require('../../src/controllers/settingsController');
    const req = { body: { sendMail: 'true' }, session: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    // smtp_host is empty by default in seeds
    await testMotion(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mailError: expect.any(String) }));
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
npx jest tests/routes/settings.test.js --no-coverage 2>&1 | tail -15
```

Expected: FAIL – `testMotion` not exported yet.

- [ ] **Step 3: Add testMotion to settingsController**

Add these imports at top of `src/controllers/settingsController.js`:

```js
const ffmpegService = require('../services/ffmpegService');
const recordingService = require('../services/recordingService');
```

Add `testMotion` function before `module.exports`:

```js
async function testMotion(req, res) {
  try {
    if (ffmpegService.isRecording()) {
      return res.status(409).json({ ok: false, message: 'Aufnahme läuft bereits' });
    }
    if (!settingsService.getBool('recording_enabled')) {
      return res.status(409).json({ ok: false, message: 'Aufnahme ist deaktiviert' });
    }

    await recordingService.startRecording(true);
    recordingService.scheduleStop();

    const sendMail = req.body.sendMail === true || req.body.sendMail === 'true';
    if (sendMail) {
      const smtpHost = settingsService.get('smtp_host');
      const smtpFrom = settingsService.get('smtp_from');
      const mailRecipient = settingsService.get('mail_recipient');
      if (!smtpHost || !smtpFrom || !mailRecipient) {
        return res.json({ ok: true, message: 'Testaufnahme gestartet', mailError: 'SMTP nicht vollständig konfiguriert' });
      }
      try {
        await mailService.sendTestMail();
      } catch (err) {
        return res.json({ ok: true, message: 'Testaufnahme gestartet', mailError: err.message });
      }
    }

    res.json({ ok: true, message: 'Testaufnahme gestartet' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
}
```

- [ ] **Step 4: Add overlay keys to EDITABLE_KEYS and checkbox list**

In `EDITABLE_KEYS`, append:
```js
'overlay_enabled', 'overlay_show_datetime', 'overlay_show_resolution',
'overlay_show_location', 'overlay_location_name', 'overlay_position',
```

In the checkbox-falsy list (line 31), append:
```js
'overlay_enabled', 'overlay_show_datetime', 'overlay_show_resolution', 'overlay_show_location'
```

- [ ] **Step 5: Export testMotion and add route**

In `module.exports`:
```js
module.exports = { showSettings, saveSettings, testMail, changePassword, testMotion };
```

In `src/routes/settings.js`, add:
```js
const { showSettings, saveSettings, testMail, changePassword, testMotion } = require('../controllers/settingsController');
// ...
router.post('/test-motion', requireLogin, testMotion);
```

- [ ] **Step 6: Run tests**

```bash
npx jest tests/routes/settings.test.js --no-coverage 2>&1 | tail -15
```

Expected: All PASS.

- [ ] **Step 7: Commit**

```bash
git add src/controllers/settingsController.js src/routes/settings.js tests/routes/settings.test.js
git commit -m "feat: add testMotion controller, overlay keys to EDITABLE_KEYS"
```

---

### Task 6: liveController – pass overlayConfig to view

**Files:**
- Modify: `src/controllers/liveController.js`

- [ ] **Step 1: Update showLive**

Replace `src/controllers/liveController.js` entirely:

```js
'use strict';
const settingsService = require('../services/settingsService');

function showLive(req, res) {
  const all = settingsService.getAll();
  const overlayConfig = {
    overlay_enabled:         all.overlay_enabled,
    overlay_show_datetime:   all.overlay_show_datetime,
    overlay_show_resolution: all.overlay_show_resolution,
    overlay_show_location:   all.overlay_show_location,
    overlay_location_name:   all.overlay_location_name,
    overlay_position:        all.overlay_position || 'top-left',
    video_resolution:        all.video_resolution,
  };
  res.render('live', { username: req.session.username, overlayConfig });
}

module.exports = { showLive };
```

- [ ] **Step 2: Run full test suite (no live controller test needed – render-only)**

```bash
npx jest --no-coverage 2>&1 | tail -10
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add src/controllers/liveController.js
git commit -m "feat: pass overlayConfig to live view"
```

---

### Task 7: CSS – settings.css additions

**Files:**
- Modify: `public/css/settings.css`

- [ ] **Step 1: Add new CSS classes**

Append to `public/css/settings.css`:

```css
.field-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; }
.field-hint { font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem; margin-bottom: 0; }
.slider-wrapper { display: flex; align-items: center; gap: 0.75rem; }
.slider-wrapper input[type=range] { flex: 1; accent-color: var(--accent); }
.slider-value { min-width: 2.5rem; text-align: right; font-variant-numeric: tabular-nums; }
.position-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 0.5rem; }
.position-tile { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); padding: 0.6rem; text-align: center; cursor: pointer; font-size: 0.85rem; color: var(--text-muted); transition: border-color 0.15s, color 0.15s; }
.position-tile.active { border-color: var(--accent); color: var(--accent); }
```

- [ ] **Step 2: Commit**

```bash
git add public/css/settings.css
git commit -m "feat: add field-hint, slider, position-grid CSS classes"
```

---

### Task 8: CSS – live.css overlay styles

**Files:**
- Modify: `public/css/live.css`

- [ ] **Step 1: Add overlay CSS**

Append to `public/css/live.css`:

```css
.stream-wrapper { position: relative; }
.live-overlay { position: absolute; background: rgba(0,0,0,0.55); border-radius: 4px; padding: 6px 10px; font-family: monospace; font-size: 0.8rem; line-height: 1.6; color: #fff; pointer-events: none; }
.live-overlay span { display: block; }
.live-overlay--top-left     { top: 10px; left: 10px; }
.live-overlay--top-right    { top: 10px; right: 10px; }
.live-overlay--bottom-left  { bottom: 10px; left: 10px; }
.live-overlay--bottom-right { bottom: 10px; right: 10px; }
```

- [ ] **Step 2: Commit**

```bash
git add public/css/live.css
git commit -m "feat: add live overlay CSS styles"
```

---

### Task 9: JS – live.js overlay clock

**Files:**
- Modify: `public/js/live.js`

- [ ] **Step 1: Add overlay clock update**

Append to `public/js/live.js`:

```js
// Overlay clock
const ovDatetime = document.getElementById('ov-datetime');
if (ovDatetime) {
  function updateClock() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    ovDatetime.textContent =
      `${pad(now.getDate())}.${pad(now.getMonth()+1)}.${now.getFullYear()} ` +
      `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }
  updateClock();
  setInterval(updateClock, 1000);
}
```

- [ ] **Step 2: Commit**

```bash
git add public/js/live.js
git commit -m "feat: live overlay clock update every second"
```

---

### Task 10: JS – settings.js (sliders, test-motion, position tiles)

**Files:**
- Modify: `public/js/settings.js`

- [ ] **Step 1: Replace settings.js**

```js
'use strict';

// Slider live value display
document.querySelectorAll('input[type=range]').forEach(slider => {
  const display = slider.closest('.slider-wrapper')?.querySelector('.slider-value');
  if (display) {
    const unit = slider.dataset.unit || '';
    display.textContent = slider.value + unit;
    slider.addEventListener('input', () => {
      display.textContent = slider.value + unit;
    });
  }
});

// Position tiles
const positionInput = document.getElementById('overlay_position');
document.querySelectorAll('.position-tile').forEach(tile => {
  tile.addEventListener('click', () => {
    document.querySelectorAll('.position-tile').forEach(t => t.classList.remove('active'));
    tile.classList.add('active');
    if (positionInput) positionInput.value = tile.dataset.position;
  });
});

// Test mail button
document.getElementById('test-mail-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('test-mail-btn');
  btn.disabled = true;
  btn.textContent = 'Sende…';
  try {
    const res = await fetch('/settings/test-mail', { method: 'POST' });
    const data = await res.json();
    alert(data.message);
  } catch {
    alert('Fehler beim Senden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Test-E-Mail senden';
  }
});

// Test motion button
document.getElementById('test-motion-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('test-motion-btn');
  const checkbox = document.getElementById('test-motion-mail');
  const status = document.getElementById('test-motion-status');
  btn.disabled = true;
  if (checkbox) checkbox.disabled = true;
  status.textContent = 'Aufnahme läuft…';
  try {
    const res = await fetch('/settings/test-motion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sendMail: checkbox?.checked || false }),
    });
    const data = await res.json();
    if (data.ok) {
      status.textContent = data.mailError
        ? `Fertig ✓ – Mail-Fehler: ${data.mailError}`
        : 'Fertig ✓ – Aufnahme gestartet';
    } else {
      status.textContent = `Fehler: ${data.message}`;
    }
  } catch {
    status.textContent = 'Verbindungsfehler';
  } finally {
    btn.disabled = false;
    if (checkbox) checkbox.disabled = false;
    setTimeout(() => { status.textContent = ''; }, 4000);
  }
});

// Hamburger menu
document.querySelector('.hamburger')?.addEventListener('click', () => {
  document.querySelector('.main-nav')?.classList.toggle('open');
});
```

- [ ] **Step 2: Commit**

```bash
git add public/js/settings.js
git commit -m "feat: settings.js sliders, test-motion handler, position tiles"
```

---

### Task 11: EJS – live.ejs overlay div

**Files:**
- Modify: `src/views/live.ejs`

- [ ] **Step 1: Add overlay div**

Replace `src/views/live.ejs`:

```ejs
<% title = 'Live'; pageCSS = 'live'; pageJS = 'live'; %>
<div class="live-container">
  <h1>Live-Ansicht</h1>
  <div class="stream-wrapper">
    <img id="live-stream" src="/api/live/stream" alt="Live Stream" class="live-img">
    <img id="snapshot-img" src="/api/live/snapshot" alt="Snapshot" class="live-img live-img--hidden">
    <% if (overlayConfig && overlayConfig.overlay_enabled === 'true') { %>
    <div id="live-overlay" class="live-overlay live-overlay--<%= ['top-left','top-right','bottom-left','bottom-right'].includes(overlayConfig.overlay_position) ? overlayConfig.overlay_position : 'top-left' %>">
      <% if (overlayConfig.overlay_show_datetime === 'true') { %><span id="ov-datetime"></span><% } %>
      <% if (overlayConfig.overlay_show_resolution === 'true') { %><span id="ov-resolution"><%= overlayConfig.video_resolution %></span><% } %>
      <% if (overlayConfig.overlay_show_location === 'true' && overlayConfig.overlay_location_name) { %><span id="ov-location"><%= overlayConfig.overlay_location_name %></span><% } %>
    </div>
    <% } %>
  </div>
  <div id="stream-status" class="stream-status"></div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/live.ejs
git commit -m "feat: live.ejs overlay div"
```

---

### Task 12: EJS – settings.ejs full redesign

**Files:**
- Modify: `src/views/settings.ejs`

- [ ] **Step 1: Rewrite settings.ejs**

Replace the full content of `src/views/settings.ejs`:

```ejs
<% title = 'Einstellungen'; pageCSS = 'settings'; pageJS = 'settings'; %>
<h1>Einstellungen</h1>

<% if (flash) { %>
<div class="alert alert--<%= flash.type %>"><%= flash.message %></div>
<% } %>

<form method="post" action="/settings" class="settings-form">

  <%# ── Erkennung ─────────────────────────────────────── %>
  <section class="settings-section">
    <h2>Erkennung</h2>
    <label class="form-label">
      <input type="checkbox" name="detection_enabled" value="true" <%= settings.detection_enabled === 'true' ? 'checked' : '' %>>
      Bewegungserkennung aktiv
    </label>

    <div class="field-row" style="margin-top:1rem;">
      <div>
        <label class="form-label">Empfindlichkeit
          <div class="slider-wrapper">
            <input type="range" name="detection_sensitivity" min="1" max="100" step="1" value="<%= settings.detection_sensitivity %>" data-unit="">
            <span class="slider-value"><%= settings.detection_sensitivity %></span>
          </div>
        </label>
        <p class="field-hint">Höher = mehr Bewegungen erkannt, erhöht aber auch Fehlalarme.</p>
      </div>
      <div>
        <label class="form-label">Mindestfläche (px)
          <div class="slider-wrapper">
            <input type="range" name="detection_min_area" min="0" max="2000" step="50" value="<%= settings.detection_min_area %>" data-unit=" px">
            <span class="slider-value"><%= settings.detection_min_area %> px</span>
          </div>
        </label>
        <p class="field-hint">Kleinere Bewegungen (z.B. Insekten) werden ignoriert.</p>
      </div>
    </div>

    <div style="margin-top:1rem;">
      <label class="form-label">Event-Cooldown
        <select class="form-input" name="event_cooldown_seconds">
          <% [15,30,60,120,300].forEach(v => { %>
          <option value="<%= v %>" <%= settings.event_cooldown_seconds == v ? 'selected' : '' %>><%= v %> Sekunden</option>
          <% }) %>
        </select>
      </label>
      <p class="field-hint">Mindestpause zwischen zwei Aufnahme-Ereignissen.</p>
    </div>
  </section>

  <%# ── Aufnahme ──────────────────────────────────────── %>
  <section class="settings-section">
    <h2>Aufnahme</h2>
    <label class="form-label">
      <input type="checkbox" name="recording_enabled" value="true" <%= settings.recording_enabled === 'true' ? 'checked' : '' %>>
      Automatisch aufnehmen
    </label>

    <div style="margin-top:1rem;">
      <label class="form-label">Nachlaufzeit
        <div class="slider-wrapper">
          <input type="range" name="recording_nachlaufzeit_seconds" min="5" max="120" step="5" value="<%= settings.recording_nachlaufzeit_seconds %>" data-unit=" s">
          <span class="slider-value"><%= settings.recording_nachlaufzeit_seconds %> s</span>
        </div>
      </label>
      <p class="field-hint">Wie lange nach der letzten Bewegung weiter aufgenommen wird (= auch Dauer der Testaufnahme).</p>
    </div>

    <div class="field-row" style="margin-top:1rem;">
      <div>
        <label class="form-label">Auflösung
          <select class="form-input" name="video_resolution">
            <% [['640x480','640×480 (SD)'],['1280x720','1280×720 (HD)'],['1920x1080','1920×1080 (Full HD)']].forEach(([v,l]) => { %>
            <option value="<%= v %>" <%= settings.video_resolution === v ? 'selected' : '' %>><%= l %></option>
            <% }) %>
          </select>
        </label>
        <p class="field-hint">Höhere Auflösung = besseres Bild, mehr Speicherbedarf.</p>
      </div>
      <div>
        <label class="form-label">Bildrate (FPS)
          <select class="form-input" name="video_fps">
            <% [5,10,15,20,25,30].forEach(v => { %>
            <option value="<%= v %>" <%= settings.video_fps == v ? 'selected' : '' %>><%= v %> fps</option>
            <% }) %>
          </select>
        </label>
        <p class="field-hint">Mehr Bilder pro Sekunde = flüssiger, aber größere Dateien.</p>
      </div>
    </div>

    <div class="field-row" style="margin-top:1rem;">
      <div>
        <label class="form-label">Video-Bitrate
          <select class="form-input" name="video_bitrate">
            <% [['500k','500 kbps'],['1000k','1000 kbps'],['2000k','2000 kbps'],['4000k','4000 kbps']].forEach(([v,l]) => { %>
            <option value="<%= v %>" <%= settings.video_bitrate === v ? 'selected' : '' %>><%= l %></option>
            <% }) %>
          </select>
        </label>
      </div>
      <div>
        <label class="form-label">
          <input type="checkbox" name="audio_enabled" value="true" <%= settings.audio_enabled === 'true' ? 'checked' : '' %>>
          Audio aufnehmen
        </label>
      </div>
    </div>

    <div class="field-row" style="margin-top:1rem;">
      <div>
        <label class="form-label">Audio-Bitrate
          <select class="form-input" name="audio_bitrate">
            <% [['64k','64 kbps'],['128k','128 kbps'],['192k','192 kbps'],['256k','256 kbps']].forEach(([v,l]) => { %>
            <option value="<%= v %>" <%= settings.audio_bitrate === v ? 'selected' : '' %>><%= l %></option>
            <% }) %>
          </select>
        </label>
      </div>
      <div>
        <label class="form-label">Kamera-Gerät<input class="form-input" type="text" name="camera_device" value="<%= settings.camera_device %>"></label>
      </div>
    </div>

    <div style="margin-top:1rem;">
      <label class="form-label">Audio-Gerät<input class="form-input" type="text" name="audio_device" value="<%= settings.audio_device %>"></label>
    </div>
  </section>

  <%# ── Video-Overlay ─────────────────────────────────── %>
  <section class="settings-section">
    <h2>Video-Overlay</h2>
    <label class="form-label">
      <input type="checkbox" name="overlay_enabled" value="true" <%= settings.overlay_enabled === 'true' ? 'checked' : '' %>>
      Overlay aktiv
    </label>
    <p class="field-hint">Blendet Informationen ins Livebild und in Aufnahmen ein.</p>

    <div style="margin-top:1rem;">
      <p class="form-label" style="margin-bottom:0.5rem;">Anzeigen</p>
      <label class="form-label"><input type="checkbox" name="overlay_show_datetime" value="true" <%= settings.overlay_show_datetime === 'true' ? 'checked' : '' %>> Datum & Uhrzeit</label>
      <label class="form-label"><input type="checkbox" name="overlay_show_resolution" value="true" <%= settings.overlay_show_resolution === 'true' ? 'checked' : '' %>> Auflösung</label>
      <label class="form-label"><input type="checkbox" name="overlay_show_location" value="true" <%= settings.overlay_show_location === 'true' ? 'checked' : '' %>> Ort / Raumname</label>
    </div>

    <div style="margin-top:1rem;">
      <label class="form-label">Raumname<input class="form-input" type="text" name="overlay_location_name" value="<%= settings.overlay_location_name %>" placeholder="z.B. Eingang"></label>
    </div>

    <div style="margin-top:1rem;">
      <p class="form-label" style="margin-bottom:0.5rem;">Position</p>
      <input type="hidden" id="overlay_position" name="overlay_position" value="<%= settings.overlay_position || 'top-left' %>">
      <div class="position-grid">
        <% [['top-left','↖ Oben links'],['top-right','↗ Oben rechts'],['bottom-left','↙ Unten links'],['bottom-right','↘ Unten rechts']].forEach(([v,l]) => { %>
        <div class="position-tile <%= (settings.overlay_position || 'top-left') === v ? 'active' : '' %>" data-position="<%= v %>"><%= l %></div>
        <% }) %>
      </div>
    </div>
  </section>

  <%# ── E-Mail ─────────────────────────────────────────── %>
  <section class="settings-section">
    <h2>E-Mail</h2>
    <label class="form-label">
      <input type="checkbox" name="mail_enabled" value="true" <%= settings.mail_enabled === 'true' ? 'checked' : '' %>>
      E-Mail-Benachrichtigungen
    </label>

    <div style="margin-top:1rem;">
      <label class="form-label">Mail-Cooldown
        <select class="form-input" name="mail_cooldown_seconds">
          <% [[60,'1 Minute'],[120,'2 Minuten'],[300,'5 Minuten'],[600,'10 Minuten'],[1800,'30 Minuten']].forEach(([v,l]) => { %>
          <option value="<%= v %>" <%= settings.mail_cooldown_seconds == v ? 'selected' : '' %>><%= l %></option>
          <% }) %>
        </select>
      </label>
      <p class="field-hint">Mindestpause zwischen zwei Benachrichtigungs-E-Mails.</p>
    </div>

    <label class="form-label" style="margin-top:1rem;">
      <input type="checkbox" name="mail_snapshot_attach" value="true" <%= settings.mail_snapshot_attach === 'true' ? 'checked' : '' %>>
      Snapshot anhängen
    </label>

    <div class="field-row" style="margin-top:1rem;">
      <label class="form-label">SMTP-Host<input class="form-input" type="text" name="smtp_host" value="<%= settings.smtp_host %>"></label>
      <label class="form-label">SMTP-Port
        <select class="form-input" name="smtp_port">
          <% [25,465,587,2525].forEach(v => { %>
          <option value="<%= v %>" <%= settings.smtp_port == v ? 'selected' : '' %>><%= v %></option>
          <% }) %>
        </select>
      </label>
    </div>

    <div class="field-row" style="margin-top:1rem;">
      <label class="form-label">SMTP-User<input class="form-input" type="text" name="smtp_user" value="<%= settings.smtp_user %>"></label>
      <label class="form-label">SMTP-Passwort<input class="form-input" type="password" name="smtp_pass" value="<%= settings.smtp_pass %>"></label>
    </div>

    <label class="form-label" style="margin-top:1rem;">
      <input type="checkbox" name="smtp_tls" value="true" <%= settings.smtp_tls === 'true' ? 'checked' : '' %>>
      TLS verwenden
    </label>

    <div class="field-row" style="margin-top:1rem;">
      <label class="form-label">Absender<input class="form-input" type="email" name="smtp_from" value="<%= settings.smtp_from %>"></label>
      <label class="form-label">Empfänger<input class="form-input" type="email" name="mail_recipient" value="<%= settings.mail_recipient %>"></label>
    </div>

    <button type="button" id="test-mail-btn" class="btn btn--secondary" style="margin-top:1rem;">Test-E-Mail senden</button>
  </section>

  <button type="submit" class="btn btn--primary">Speichern</button>
</form>

<%# ── Test-Bewegung ──────────────────────────────────── %>
<section class="settings-section" style="margin-top:1.5rem;max-width:600px;">
  <h2>Test</h2>
  <% if (settings.smtp_host) { %>
  <label class="form-label" style="margin-bottom:1rem;">
    <input type="checkbox" id="test-motion-mail"> auch E-Mail senden
  </label>
  <% } %>
  <button type="button" id="test-motion-btn" class="btn btn--secondary">▶ Bewegung simulieren</button>
  <p class="field-hint">Löst eine Testaufnahme aus (Dauer = Nachlaufzeit-Einstellung).</p>
  <p id="test-motion-status" style="margin-top:0.5rem;font-size:0.85rem;"></p>
</section>

<hr style="margin:2rem 0;">

<%# ── Passwort ───────────────────────────────────────── %>
<section class="settings-section" style="max-width:600px;">
  <h2>Passwort ändern</h2>
  <form method="post" action="/settings/password" class="settings-form">
    <label class="form-label">Aktuelles Passwort<input class="form-input" type="password" name="current" required></label>
    <label class="form-label">Neues Passwort<input class="form-input" type="password" name="newPass" required minlength="8"></label>
    <label class="form-label">Wiederholen<input class="form-input" type="password" name="confirm" required></label>
    <button type="submit" class="btn btn--primary">Passwort ändern</button>
  </form>
</section>
```

- [ ] **Step 2: Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -10
```

Expected: All tests PASS.

- [ ] **Step 3: Manual smoke test**

```bash
node src/server.js &
# Open http://localhost:3000/settings in browser
# Verify: sliders show live values, dropdowns correct, overlay section visible, test-motion button present
kill %1
```

- [ ] **Step 4: Commit**

```bash
git add src/views/settings.ejs
git commit -m "feat: settings.ejs full redesign with sliders, dropdowns, overlay, test-motion"
```

---

### Task 13: Push + deploy

- [ ] **Step 1: Push to remote**

```bash
git push
```

- [ ] **Step 2: Deploy on Pi**

```bash
cd /root/motioncam && git pull && npm rebuild && systemctl restart motioncam
```

- [ ] **Step 3: Verify on Pi**

```bash
systemctl status motioncam
journalctl -u motioncam -n 10 --no-pager
```

Expected: `MotionCam running on port 3000`, no errors.
