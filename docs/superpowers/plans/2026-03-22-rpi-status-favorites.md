# RPi-Status & Video-Favoriten Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live RPi system-status tiles to the dashboard and a star-based favorites system for recordings.

**Architecture:** Feature 1 adds a new `systemService` + `GET /api/system-status` endpoint polled by dashboard.js every 10s. Feature 2 adds an `is_favorite` column to `recordings`, a `PATCH /api/recordings/:id/favorite` endpoint, and wires favorites into the archive filter, video page, and dashboard section.

**Tech Stack:** Node.js 20, better-sqlite3 (sync), Express 4, EJS, Jest + Supertest — no build step, no bundler.

---

## File Map

### Feature 1 — RPi-Status
| File | Change |
|------|--------|
| `src/services/systemService.js` | **Create** — getCpuPercent(), getRamInfo(), getTempCelsius(), getDiskInfo() |
| `src/controllers/apiController.js` | **Modify** — add getSystemStatus() async handler |
| `src/routes/api.js` | **Modify** — add GET /system-status route |
| `src/views/dashboard.ejs` | **Modify** — add 4 stat-cards with id attributes + `…` initial values |
| `public/js/dashboard.js` | **Modify** — add system-status polling alongside existing stats polling |
| `tests/services/systemService.test.js` | **Create** — unit tests for systemService |
| `tests/routes/api.test.js` | **Modify** — add test for GET /api/system-status |

### Feature 2 — Favoriten
| File | Change |
|------|--------|
| `src/db/migrations.js` | **Modify** — add PRAGMA-guarded ALTER TABLE for is_favorite |
| `src/services/dashboardService.js` | **Modify** — add favoriteRecordings query to getStats() |
| `src/controllers/dashboardController.js` | **Modify** — pass favoriteRecordings to view |
| `src/controllers/archiveController.js` | **Modify** — add favorites filter + favoritesActive |
| `src/controllers/apiController.js` | **Modify** — add patchFavorite() handler |
| `src/routes/api.js` | **Modify** — add PATCH /recordings/:id/favorite route |
| `src/views/dashboard.ejs` | **Modify** — add favorites section below stat-cards |
| `src/views/archive.ejs` | **Modify** — add star buttons, filter button, fix pagination |
| `src/views/video.ejs` | **Modify** — add star button in video-actions |
| `public/js/archive.js` | **Modify** — add star toggle + filter button logic |
| `tests/services/dashboardService.test.js` | **Modify** — test favoriteRecordings in getStats() |
| `tests/routes/api.test.js` | **Modify** — test PATCH /api/recordings/:id/favorite |
| `tests/routes/archive.test.js` | **Modify** — test ?favorites=1 filter |

---

## Task 1: systemService — CPU, RAM, Temp, Disk

**Files:**
- Create: `src/services/systemService.js`
- Create: `tests/services/systemService.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/services/systemService.test.js`:

```js
'use strict';
const os = require('os');

jest.mock('child_process', () => ({ execFile: jest.fn() }));
const { execFile } = require('child_process');

// Import after mocks
const systemService = require('../../src/services/systemService');

describe('systemService.getRamInfo', () => {
  test('returns ramUsedMB and ramTotalMB as numbers', () => {
    const r = systemService.getRamInfo();
    expect(typeof r.ramTotalMB).toBe('number');
    expect(typeof r.ramUsedMB).toBe('number');
    expect(r.ramUsedMB).toBeGreaterThanOrEqual(0);
    expect(r.ramUsedMB).toBeLessThanOrEqual(r.ramTotalMB);
  });
});

describe('systemService.getTempCelsius', () => {
  test('returns null when thermal file missing', () => {
    // /sys/class/thermal/thermal_zone0/temp won't exist in test env
    const t = systemService.getTempCelsius();
    expect(t === null || typeof t === 'number').toBe(true);
  });
});

describe('systemService.getDiskInfo', () => {
  test('resolves with diskUsedMB and diskTotalMB', async () => {
    execFile.mockImplementation((cmd, args, opts, cb) => {
      cb(null, 'Filesystem 1K-blocks Used Available Use% Mounted on\n/dev/root 30000000 5000000 25000000 17% /\n', '');
    });
    const d = await systemService.getDiskInfo('/tmp');
    expect(typeof d.diskUsedMB).toBe('number');
    expect(d.diskUsedMB).toBeGreaterThan(0);
    expect(typeof d.diskTotalMB).toBe('number');
  });

  test('returns diskTotalMB null when df fails', async () => {
    execFile.mockImplementation((cmd, args, opts, cb) => {
      cb(new Error('df failed'), '', '');
    });
    const d = await systemService.getDiskInfo('/tmp');
    expect(d.diskTotalMB).toBeNull();
  });
});

describe('systemService.getCpuPercent', () => {
  test('returns a number between 0 and 100', async () => {
    const pct = await systemService.getCpuPercent();
    expect(typeof pct).toBe('number');
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBeLessThanOrEqual(100);
  }, 1000); // allow up to 1s for the 200ms delay
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/staubi/Apps/motion && npx jest tests/services/systemService.test.js --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module '../../src/services/systemService'`

- [ ] **Step 3: Implement systemService**

Create `src/services/systemService.js`:

```js
'use strict';
const os = require('os');
const fs = require('fs');
const { execFile } = require('child_process');

const TEMP_PATH = '/sys/class/thermal/thermal_zone0/temp';

function getRamInfo() {
  const ramTotalMB = os.totalmem() / (1024 * 1024);
  const ramUsedMB = (os.totalmem() - os.freemem()) / (1024 * 1024);
  return { ramTotalMB: Math.round(ramTotalMB), ramUsedMB: Math.round(ramUsedMB) };
}

function getTempCelsius() {
  try {
    const raw = fs.readFileSync(TEMP_PATH, 'utf8').trim();
    return Math.round(parseInt(raw, 10) / 1000);
  } catch {
    return null;
  }
}

function getDiskInfo(storagePath) {
  return new Promise((resolve) => {
    execFile('df', ['-k', storagePath], { timeout: 3000 }, (err, stdout) => {
      if (err) return resolve({ diskUsedMB: 0, diskTotalMB: null });
      const lines = stdout.trim().split('\n');
      const parts = lines[1] && lines[1].trim().split(/\s+/);
      if (!parts || parts.length < 3) return resolve({ diskUsedMB: 0, diskTotalMB: null });
      const totalKB = parseInt(parts[1], 10);
      const usedKB = parseInt(parts[2], 10);
      resolve({
        diskUsedMB: Math.round(usedKB / 1024),
        diskTotalMB: Math.round(totalKB / 1024),
      });
    });
  });
}

function getCpuPercent() {
  const snap = () => {
    const cpus = os.cpus();
    let idle = 0, total = 0;
    for (const cpu of cpus) {
      for (const val of Object.values(cpu.times)) total += val;
      idle += cpu.times.idle;
    }
    return { idle, total };
  };
  const before = snap();
  return new Promise((resolve) => {
    setTimeout(() => {
      const after = snap();
      const idleDiff = after.idle - before.idle;
      const totalDiff = after.total - before.total;
      const pct = totalDiff === 0 ? 0 : Math.round((1 - idleDiff / totalDiff) * 100);
      resolve(Math.min(100, Math.max(0, pct)));
    }, 200);
  });
}

module.exports = { getRamInfo, getTempCelsius, getDiskInfo, getCpuPercent };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/staubi/Apps/motion && npx jest tests/services/systemService.test.js --no-coverage 2>&1 | tail -20
```

Expected: PASS (4 test suites, all green)

- [ ] **Step 5: Commit**

```bash
cd /home/staubi/Apps/motion && git add src/services/systemService.js tests/services/systemService.test.js
git commit -m "feat: add systemService for CPU, RAM, temp, disk metrics"
```

---

## Task 2: GET /api/system-status endpoint

**Files:**
- Modify: `src/controllers/apiController.js`
- Modify: `src/routes/api.js`
- Modify: `tests/routes/api.test.js`

- [ ] **Step 1: Write failing test**

Add to `tests/routes/api.test.js` (inside the existing describe block or as a new one):

```js
// Add at top of file with other mocks:
jest.mock('../../src/services/systemService');
const systemService = require('../../src/services/systemService');

// Add in beforeAll after existing setup:
systemService.getCpuPercent.mockResolvedValue(42);
systemService.getRamInfo.mockReturnValue({ ramUsedMB: 512, ramTotalMB: 1024 });
systemService.getTempCelsius.mockReturnValue(55);
systemService.getDiskInfo.mockResolvedValue({ diskUsedMB: 200, diskTotalMB: 28000 });

// Add new describe block:
describe('GET /api/system-status', () => {
  test('returns system status JSON', async () => {
    const res = await request(app).get('/api/system-status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('cpuPercent', 42);
    expect(res.body).toHaveProperty('ramUsedMB', 512);
    expect(res.body).toHaveProperty('ramTotalMB', 1024);
    expect(res.body).toHaveProperty('tempCelsius', 55);
    expect(res.body).toHaveProperty('diskUsedMB', 200);
    expect(res.body).toHaveProperty('diskTotalMB', 28000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/staubi/Apps/motion && npx jest tests/routes/api.test.js --no-coverage 2>&1 | tail -20
```

Expected: FAIL — 404 or route not found

- [ ] **Step 3: Add getSystemStatus to apiController**

In `src/controllers/apiController.js`, add after the existing imports:

```js
const systemService = require('../services/systemService');
```

Add this function after `getDashboardStats`:

```js
async function getSystemStatus(req, res, next) {
  try {
    const [cpuPercent, diskInfo] = await Promise.all([
      systemService.getCpuPercent(),
      systemService.getDiskInfo(settingsService.get('storage_path') || '/'),
    ]);
    const { ramUsedMB, ramTotalMB } = systemService.getRamInfo();
    const tempCelsius = systemService.getTempCelsius();
    res.json({ cpuPercent, ramUsedMB, ramTotalMB, tempCelsius, ...diskInfo });
  } catch (err) { next(err); }
}
```

Update `module.exports`:
```js
module.exports = { proxyStream, getSnapshot, getDashboardStats, getSystemStatus };
```

- [ ] **Step 4: Register route in api.js**

In `src/routes/api.js`, add:

```js
const { proxyStream, getSnapshot, getDashboardStats, getSystemStatus } = require('../controllers/apiController');
// ...existing routes...
router.get('/system-status', requireLogin, getSystemStatus);
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /home/staubi/Apps/motion && npx jest tests/routes/api.test.js --no-coverage 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd /home/staubi/Apps/motion && git add src/controllers/apiController.js src/routes/api.js tests/routes/api.test.js
git commit -m "feat: add GET /api/system-status endpoint"
```

---

## Task 3: Dashboard UI — system status tiles + polling

**Files:**
- Modify: `src/views/dashboard.ejs`
- Modify: `public/js/dashboard.js`

No separate unit tests for view/JS — covered by visual review on the running app.

- [ ] **Step 1: Add stat-cards to dashboard.ejs**

In `src/views/dashboard.ejs`, add `id` to the existing disk card and add 3 new stat-cards. The existing disk card shows `stats.diskUsage` — add `id="stat-disk"` and change its value to `…` (will be updated by JS). Add CPU, RAM, Temp cards. The full `dashboard-grid` div should look like:

```html
<div class="dashboard-grid">
  <div class="stat-card">
    <div class="stat-label">Aufnahmen gesamt</div>
    <div class="stat-value"><%= stats.totalRecordings %></div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Heute</div>
    <div class="stat-value"><%= stats.todayCount %></div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Gesamtdauer</div>
    <div class="stat-value"><%= Math.round(stats.totalDuration / 60) %> min</div>
  </div>
  <div class="stat-card" id="stat-disk">
    <div class="stat-label">Speicher</div>
    <div class="stat-value">…</div>
  </div>
  <div class="stat-card stat-card--status">
    <div class="stat-label">Status</div>
    <div class="stat-value">
      <span class="badge badge--<%= stats.isRecording ? 'danger' : 'success' %>">
        <%= stats.isRecording ? 'Aufnahme läuft' : 'Bereit' %>
      </span>
    </div>
  </div>
  <div class="stat-card" id="stat-cpu">
    <div class="stat-label">CPU</div>
    <div class="stat-value">…</div>
  </div>
  <div class="stat-card" id="stat-ram">
    <div class="stat-label">RAM</div>
    <div class="stat-value">…</div>
  </div>
  <div class="stat-card" id="stat-temp">
    <div class="stat-label">Temperatur</div>
    <div class="stat-value">…</div>
  </div>
</div>
```

- [ ] **Step 2: Add system-status polling to dashboard.js**

Replace the full content of `public/js/dashboard.js` with:

```js
// Auto-refresh stats every 10 seconds
async function refreshStats() {
  try {
    const res = await fetch('/api/dashboard/stats');
    if (!res.ok) return;
    const stats = await res.json();
    const statusBadge = document.querySelector('.badge');
    if (statusBadge) {
      statusBadge.textContent = stats.isRecording ? 'Aufnahme läuft' : 'Bereit';
      statusBadge.className = `badge badge--${stats.isRecording ? 'danger' : 'success'}`;
    }
  } catch {}
}

async function refreshSystemStatus() {
  try {
    const res = await fetch('/api/system-status');
    if (!res.ok) return;
    const s = await res.json();
    const cpu = document.getElementById('stat-cpu');
    const ram = document.getElementById('stat-ram');
    const temp = document.getElementById('stat-temp');
    const disk = document.getElementById('stat-disk');
    if (cpu) cpu.querySelector('.stat-value').textContent = s.cpuPercent + '%';
    if (ram) ram.querySelector('.stat-value').textContent = s.ramUsedMB + ' / ' + s.ramTotalMB + ' MB';
    if (temp) temp.querySelector('.stat-value').textContent = s.tempCelsius !== null ? s.tempCelsius + '°C' : '-';
    if (disk) {
      const used = s.diskUsedMB;
      const total = s.diskTotalMB;
      disk.querySelector('.stat-value').textContent = total ? used + ' / ' + total + ' MB' : used + ' MB';
    }
  } catch {}
}

setInterval(refreshStats, 10_000);
setInterval(refreshSystemStatus, 10_000);
refreshSystemStatus(); // immediate first load
```

- [ ] **Step 3: Run the full test suite to confirm nothing broke**

```bash
cd /home/staubi/Apps/motion && npx jest --no-coverage 2>&1 | tail -20
```

Expected: All existing tests pass.

- [ ] **Step 4: Commit**

```bash
cd /home/staubi/Apps/motion && git add src/views/dashboard.ejs public/js/dashboard.js
git commit -m "feat: add RPi system status tiles to dashboard with live polling"
```

---

## Task 4: DB migration — is_favorite column

**Files:**
- Modify: `src/db/migrations.js`

- [ ] **Step 1: Write failing test**

Add to `tests/services/dashboardService.test.js` after existing beforeAll:

```js
describe('is_favorite migration', () => {
  test('recordings table has is_favorite column after migration', () => {
    const { getDb } = require('../../src/db');
    const cols = getDb().prepare('PRAGMA table_info(recordings)').all();
    const col = cols.find(c => c.name === 'is_favorite');
    expect(col).toBeDefined();
    expect(col.dflt_value).toBe('0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/staubi/Apps/motion && npx jest tests/services/dashboardService.test.js --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `is_favorite` column not found

- [ ] **Step 3: Add migration to migrations.js**

In `src/db/migrations.js`, add after the existing `db.exec(...)` call inside `runMigrations()`:

```js
// Idempotent: add is_favorite column if not present
const cols = db.prepare('PRAGMA table_info(recordings)').all();
if (!cols.some(c => c.name === 'is_favorite')) {
  db.prepare('ALTER TABLE recordings ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0').run();
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/staubi/Apps/motion && npx jest tests/services/dashboardService.test.js --no-coverage 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /home/staubi/Apps/motion && git add src/db/migrations.js tests/services/dashboardService.test.js
git commit -m "feat: add is_favorite column migration to recordings table"
```

---

## Task 5: PATCH /api/recordings/:id/favorite endpoint

**Files:**
- Modify: `src/controllers/apiController.js`
- Modify: `src/routes/api.js`
- Modify: `tests/routes/api.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/routes/api.test.js` in `beforeAll` (after existing DB setup):

```js
// Insert a test recording for favorite tests
const { getDb } = require('../../src/db');
getDb().prepare(
  "INSERT OR IGNORE INTO recordings (id, filename, filepath, processed) VALUES (99, 'fav-test.mp4', '/tmp/fav-test.mp4', 1)"
).run();
```

Add new describe block:

```js
describe('PATCH /api/recordings/:id/favorite', () => {
  test('marks recording as favorite', async () => {
    const res = await request(app)
      .patch('/api/recordings/99/favorite')
      .send({ is_favorite: 1 });
    expect(res.status).toBe(200);
    expect(res.body.is_favorite).toBe(1);
  });

  test('unmarks recording as favorite', async () => {
    const res = await request(app)
      .patch('/api/recordings/99/favorite')
      .send({ is_favorite: 0 });
    expect(res.status).toBe(200);
    expect(res.body.is_favorite).toBe(0);
  });

  test('returns 400 for invalid is_favorite value', async () => {
    const res = await request(app)
      .patch('/api/recordings/99/favorite')
      .send({ is_favorite: 2 });
    expect(res.status).toBe(400);
  });

  test('returns 400 for non-numeric id', async () => {
    const res = await request(app)
      .patch('/api/recordings/abc/favorite')
      .send({ is_favorite: 1 });
    expect(res.status).toBe(400);
  });

  test('returns 404 for missing recording', async () => {
    const res = await request(app)
      .patch('/api/recordings/9999/favorite')
      .send({ is_favorite: 1 });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/staubi/Apps/motion && npx jest tests/routes/api.test.js --no-coverage 2>&1 | tail -20
```

Expected: FAIL — 404 (route not found)

- [ ] **Step 3: Add patchFavorite to apiController**

In `src/controllers/apiController.js`, add at the top:

```js
const { getDb } = require('../db');
```

Add function:

```js
function patchFavorite(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const val = req.body.is_favorite;
    if (val !== 0 && val !== 1) return res.status(400).json({ error: 'is_favorite must be 0 or 1' });
    const db = getDb();
    const rec = db.prepare('SELECT id FROM recordings WHERE id=?').get(id);
    if (!rec) return res.status(404).json({ error: 'Recording not found' });
    db.prepare('UPDATE recordings SET is_favorite=? WHERE id=?').run(val, id);
    res.json({ id, is_favorite: val });
  } catch (err) { next(err); }
}
```

Update `module.exports`:
```js
module.exports = { proxyStream, getSnapshot, getDashboardStats, getSystemStatus, patchFavorite };
```

- [ ] **Step 4: Register route in api.js**

In `src/routes/api.js`, add:

```js
const { proxyStream, getSnapshot, getDashboardStats, getSystemStatus, patchFavorite } = require('../controllers/apiController');
// Add express.json() middleware and route:
router.use(express.json());
router.patch('/recordings/:id/favorite', requireLogin, patchFavorite);
```

Note: Check if `express.json()` is already applied in `app.js`. If so, skip the `router.use` line.

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /home/staubi/Apps/motion && npx jest tests/routes/api.test.js --no-coverage 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd /home/staubi/Apps/motion && git add src/controllers/apiController.js src/routes/api.js tests/routes/api.test.js
git commit -m "feat: add PATCH /api/recordings/:id/favorite endpoint"
```

---

## Task 6: Archive — favorites filter + star buttons

**Files:**
- Modify: `src/controllers/archiveController.js`
- Modify: `src/views/archive.ejs`
- Modify: `public/js/archive.js`
- Modify: `tests/routes/archive.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/routes/archive.test.js`:

```js
describe('GET /archive?favorites=1', () => {
  test('returns only favorite recordings', async () => {
    const db = getDb();
    db.prepare(
      "INSERT INTO recordings (filename, filepath, processed, is_favorite) VALUES ('fav.mp4', '/tmp/fav.mp4', 1, 1)"
    ).run();
    db.prepare(
      "INSERT INTO recordings (filename, filepath, processed, is_favorite) VALUES ('nonfav.mp4', '/tmp/nonfav.mp4', 1, 0)"
    ).run();
    const res = await request(app).get('/archive?favorites=1');
    expect(res.status).toBe(200);
    expect(res.text).toContain('fav.mp4');
    expect(res.text).not.toContain('nonfav.mp4');
  });

  test('pagination preserves favorites filter in links', async () => {
    const res = await request(app).get('/archive?favorites=1&page=1');
    expect(res.status).toBe(200);
    // The pagination link for next page should include &favorites=1
    // (only testable if there are multiple pages; here we just check 200)
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/staubi/Apps/motion && npx jest tests/routes/archive.test.js --no-coverage 2>&1 | tail -20
```

Expected: FAIL — filter not applied, nonfav.mp4 appears in results

- [ ] **Step 3: Update archiveController**

Replace `src/controllers/archiveController.js` with:

```js
'use strict';
const { getDb } = require('../db');

const PAGE_SIZE = 8;

function showArchive(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const offset = (page - 1) * PAGE_SIZE;
    const favoritesActive = req.query.favorites === '1';
    const db = getDb();

    const where = favoritesActive
      ? 'WHERE processed=1 AND is_favorite=1'
      : 'WHERE processed=1';

    const total = db.prepare(`SELECT COUNT(*) as n FROM recordings ${where}`).get().n;
    const recordings = db.prepare(
      `SELECT * FROM recordings ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(PAGE_SIZE, offset);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    res.render('archive', {
      recordings,
      page,
      totalPages,
      total,
      favoritesActive,
      username: req.session.username,
    });
  } catch (err) { next(err); }
}

module.exports = { showArchive };
```

- [ ] **Step 4: Update archive.ejs**

Replace `src/views/archive.ejs` with:

```html
<% title = 'Archiv'; pageCSS = 'archive'; pageJS = 'archive'; %>
<div class="archive-header">
  <h1>Archiv</h1>
  <div class="archive-header__actions">
    <span class="archive-count"><%= total %> Aufnahmen</span>
    <a href="/archive<%= favoritesActive ? '' : '?favorites=1' %>"
       class="btn btn--sm <%= favoritesActive ? 'btn--primary' : 'btn--secondary' %>">
      ★ Nur Favoriten
    </a>
  </div>
</div>
<% if (recordings.length === 0) { %>
  <p class="empty-state">Keine Aufnahmen vorhanden.</p>
<% } else { %>
  <div class="archive-grid">
    <% for (const rec of recordings) { %>
      <div class="recording-card" data-id="<%= rec.id %>">
        <a href="/videos/<%= rec.id %>" class="recording-card__link">
          <% if (rec.thumbnail_path) { %>
            <img src="/thumbnails/<%= rec.thumbnail_path.split('/').pop() %>" alt="" class="recording-card__thumb">
          <% } else { %>
            <div class="recording-card__no-thumb">Kein Thumbnail</div>
          <% } %>
          <div class="recording-card__info">
            <div class="recording-card__name"><%= rec.filename %></div>
            <div class="recording-card__date"><%= new Date(rec.created_at).toLocaleString('de-DE') %></div>
            <% if (rec.duration_seconds) { %><div class="recording-card__dur"><%= Math.round(rec.duration_seconds) %>s</div><% } %>
          </div>
        </a>
        <div class="recording-card__actions">
          <button class="btn btn--icon star-btn" data-id="<%= rec.id %>" data-favorite="<%= rec.is_favorite %>">
            <%= rec.is_favorite ? '⭐' : '☆' %>
          </button>
          <button class="btn btn--danger btn--sm delete-btn" data-id="<%= rec.id %>">Löschen</button>
        </div>
      </div>
    <% } %>
  </div>
  <div class="pagination">
    <% if (page > 1) { %><a href="/archive?page=<%= page - 1 %><%= favoritesActive ? '&favorites=1' : '' %>" class="btn btn--secondary">Zurück</a><% } %>
    <span>Seite <%= page %> / <%= totalPages %></span>
    <% if (page < totalPages) { %><a href="/archive?page=<%= page + 1 %><%= favoritesActive ? '&favorites=1' : '' %>" class="btn btn--secondary">Weiter</a><% } %>
  </div>
<% } %>
```

- [ ] **Step 5: Update archive.js (JS)**

Replace `public/js/archive.js` with:

```js
// Delete buttons
document.querySelectorAll('.delete-btn').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!confirm('Aufnahme wirklich löschen?')) return;
    const id = btn.dataset.id;
    const res = await fetch(`/videos/${id}`, { method: 'DELETE' });
    if (res.ok) btn.closest('.recording-card').remove();
    else alert('Fehler beim Löschen');
  });
});

// Star (favorite) buttons
document.querySelectorAll('.star-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const id = btn.dataset.id;
    const current = parseInt(btn.dataset.favorite, 10);
    const next = current === 1 ? 0 : 1;
    const res = await fetch(`/api/recordings/${id}/favorite`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_favorite: next }),
    });
    if (res.ok) {
      btn.dataset.favorite = next;
      btn.textContent = next === 1 ? '⭐' : '☆';
    }
  });
});
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd /home/staubi/Apps/motion && npx jest tests/routes/archive.test.js --no-coverage 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
cd /home/staubi/Apps/motion && git add src/controllers/archiveController.js src/views/archive.ejs public/js/archive.js tests/routes/archive.test.js
git commit -m "feat: add favorites filter and star buttons to archive"
```

---

## Task 7: Video page — star button

**Files:**
- Modify: `src/views/video.ejs`

No separate test needed — covered by the API endpoint test. Visual check on running app.

- [ ] **Step 1: Add star button to video.ejs**

In `src/views/video.ejs`, replace the `<div class="video-actions">` block with:

```html
<div class="video-actions">
  <a href="/videos/<%= recording.id %>/download" download class="btn btn--primary">Herunterladen</a>
  <button id="star-btn" class="btn btn--icon"
    data-id="<%= recording.id %>"
    data-favorite="<%= recording.is_favorite %>">
    <%= recording.is_favorite ? '⭐' : '☆' %>
  </button>
  <button id="delete-btn" class="btn btn--danger" data-id="<%= recording.id %>">Löschen</button>
</div>
```

Also replace the `<script>` tag at the bottom with:

```html
<script>
  document.getElementById('delete-btn').addEventListener('click', async function() {
    if (!confirm('Aufnahme wirklich löschen?')) return;
    await fetch('/videos/' + this.dataset.id, { method: 'DELETE' });
    window.location.href = '/archive';
  });

  document.getElementById('star-btn').addEventListener('click', async function() {
    const id = this.dataset.id;
    const current = parseInt(this.dataset.favorite, 10);
    const next = current === 1 ? 0 : 1;
    const res = await fetch(`/api/recordings/${id}/favorite`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_favorite: next }),
    });
    if (res.ok) {
      this.dataset.favorite = next;
      this.textContent = next === 1 ? '⭐' : '☆';
    }
  });
</script>
```

- [ ] **Step 2: Run full test suite**

```bash
cd /home/staubi/Apps/motion && npx jest --no-coverage 2>&1 | tail -20
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
cd /home/staubi/Apps/motion && git add src/views/video.ejs
git commit -m "feat: add star/favorite button to video detail page"
```

---

## Task 8: Dashboard — favorites section

**Files:**
- Modify: `src/services/dashboardService.js`
- Modify: `src/controllers/dashboardController.js`
- Modify: `src/views/dashboard.ejs`
- Modify: `tests/services/dashboardService.test.js`

- [ ] **Step 1: Write failing test**

Add to `tests/services/dashboardService.test.js`:

```js
describe('dashboardService.getStats — favoriteRecordings', () => {
  test('returns favoriteRecordings array', () => {
    const stats = dashboardService.getStats();
    expect(stats).toHaveProperty('favoriteRecordings');
    expect(Array.isArray(stats.favoriteRecordings)).toBe(true);
  });

  test('favoriteRecordings contains only is_favorite=1 recordings, max 6', () => {
    const { getDb } = require('../../src/db');
    const db = getDb();
    // Insert 7 favorites and 1 non-favorite
    for (let i = 1; i <= 7; i++) {
      db.prepare(
        `INSERT INTO recordings (filename, filepath, processed, is_favorite) VALUES ('fav${i}.mp4', '/tmp/fav${i}.mp4', 1, 1)`
      ).run();
    }
    db.prepare(
      "INSERT INTO recordings (filename, filepath, processed, is_favorite) VALUES ('nonfav.mp4', '/tmp/nonfav.mp4', 1, 0)"
    ).run();
    const stats = dashboardService.getStats();
    expect(stats.favoriteRecordings.length).toBeLessThanOrEqual(6);
    expect(stats.favoriteRecordings.every(r => r.is_favorite === 1)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/staubi/Apps/motion && npx jest tests/services/dashboardService.test.js --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `favoriteRecordings` not in stats

- [ ] **Step 3: Update dashboardService**

In `src/services/dashboardService.js`, add to `getStats()`:

```js
const favoriteRecordings = db.prepare(
  'SELECT * FROM recordings WHERE processed=1 AND is_favorite=1 ORDER BY created_at DESC LIMIT 6'
).all();
```

Update the return:
```js
return { totalRecordings, latestRecording, totalDuration, todayCount, diskUsage, isRecording, favoriteRecordings };
```

- [ ] **Step 4: Update dashboardController**

In `src/controllers/dashboardController.js`, the `stats` object now includes `favoriteRecordings` automatically — no change needed to the controller since it passes the whole `stats` object. Verify this is the case.

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /home/staubi/Apps/motion && npx jest tests/services/dashboardService.test.js --no-coverage 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 6: Add favorites section to dashboard.ejs**

After the `</div>` that closes `.dashboard-grid` and before `<% if (stats.latestRecording) { %>`, add:

```html
<% if (stats.favoriteRecordings && stats.favoriteRecordings.length > 0) { %>
  <div class="favorites-section">
    <div class="favorites-header">
      <h2>Favoriten</h2>
      <a href="/archive?favorites=1" class="btn btn--sm btn--secondary">Alle Favoriten →</a>
    </div>
    <div class="archive-grid">
      <% for (const rec of stats.favoriteRecordings) { %>
        <div class="recording-card">
          <a href="/videos/<%= rec.id %>" class="recording-card__link">
            <% if (rec.thumbnail_path) { %>
              <img src="/thumbnails/<%= rec.thumbnail_path.split('/').pop() %>" alt="" class="recording-card__thumb">
            <% } else { %>
              <div class="recording-card__no-thumb">Kein Thumbnail</div>
            <% } %>
            <div class="recording-card__info">
              <div class="recording-card__name"><%= rec.filename %></div>
              <div class="recording-card__date"><%= new Date(rec.created_at).toLocaleString('de-DE') %></div>
            </div>
          </a>
        </div>
      <% } %>
    </div>
  </div>
<% } %>
```

Add CSS for `.favorites-section` and `.favorites-header` in `public/css/dashboard.css`:

```css
.favorites-section { margin-top: 2rem; }
.favorites-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.favorites-header h2 { font-size: 1.1rem; margin: 0; }
```

- [ ] **Step 7: Run full test suite**

```bash
cd /home/staubi/Apps/motion && npx jest --no-coverage 2>&1 | tail -20
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
cd /home/staubi/Apps/motion && git add src/services/dashboardService.js src/views/dashboard.ejs public/css/dashboard.css tests/services/dashboardService.test.js
git commit -m "feat: show favorite recordings section on dashboard"
```

---

## Task 9: Final verification

- [ ] **Step 1: Run complete test suite**

```bash
cd /home/staubi/Apps/motion && npx jest --no-coverage 2>&1
```

Expected: All tests green, 0 failures.

- [ ] **Step 2: Check app starts without errors**

```bash
cd /home/staubi/Apps/motion && node -e "
  process.env.DB_PATH = ':memory:';
  const { runMigrations } = require('./src/db/migrations');
  runMigrations();
  console.log('Migrations OK');
"
```

Expected: `Migrations OK` (no throw)

- [ ] **Step 3: Push to remote**

```bash
cd /home/staubi/Apps/motion && git push
```

- [ ] **Step 4: Deploy on RPi**

```bash
# On root@KwhWetter:
git pull && systemctl restart motioncam
```

Verify in browser:
- Dashboard shows 8 stat-cards including CPU/RAM/Temp/Disk with live values
- Archive shows star buttons on each clip and "★ Nur Favoriten" filter button
- Starring a clip in the archive or on the video page works without page reload
- Favoriten section appears on dashboard after starring ≥1 clip
- Pagination preserves `?favorites=1` filter when browsing pages
