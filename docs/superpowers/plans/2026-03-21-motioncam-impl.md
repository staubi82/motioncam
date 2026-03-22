# MotionCam Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build MotionCam — eine self-hosted Surveillance-Web-App für Raspberry Pi 4 mit Motion-Detection, FFmpeg-Recording, Live-Stream, Archiv und E-Mail-Benachrichtigungen.

**Architecture:** Express.js-App empfängt Webhooks vom `motion`-Daemon, startet/stoppt FFmpeg-Aufnahmen, speichert Metadaten in SQLite und serviert eine dark-themed EJS-Web-UI. Alle Einstellungen werden in der DB gespeichert und live geladen.

**Tech Stack:** Node.js 20, Express.js, EJS + express-ejs-layouts, better-sqlite3, express-session + bcrypt + session-file-store, FFmpeg/FFprobe (child_process), Nodemailer, chokidar, Jest + Supertest

---

## File Map

```
src/
  app.js                         # Express-App-Setup, Middleware, Routen-Mounting
  server.js                      # HTTP-Server Entry Point
  config/
    index.js                     # .env laden, Defaults, Export
  db/
    index.js                     # better-sqlite3 Singleton
    migrations.js                # Schema CREATE TABLE Statements
    seeds.js                     # Default Settings seeden
  middleware/
    auth.js                      # requireLogin — redirect to /login if not authenticated
    hookAuth.js                  # X-Hook-Secret Header validieren
    errorHandler.js              # Express Error Handler
  services/
    authService.js               # bcrypt hash/verify, User-Lookup
    settingsService.js           # Key/Value Cache, get/set, reload
    ffmpegService.js             # FFmpeg spawn/stop (child_process)
    thumbnailService.js          # ffprobe Metadaten + ffmpeg Thumbnail
    recordingService.js          # Recording-Lifecycle: start, scheduleStop, complete
    mailService.js               # Nodemailer + Cooldown
    watcherService.js            # chokidar .mp4-Watcher
    storageService.js            # Disk-Usage, Datei-Löschung
    dashboardService.js          # Aggregierte Stats für Dashboard
    motionService.js             # motion.conf rewrite + SIGHUP (called on detection settings save)
  controllers/
    authController.js
    dashboardController.js
    liveController.js
    archiveController.js
    videoController.js
    settingsController.js
    hooksController.js
    apiController.js
  routes/
    auth.js
    dashboard.js
    live.js
    archive.js
    videos.js
    settings.js
    hooks.js
    api.js
  views/
    layouts/main.ejs             # Base Layout
    partials/header.ejs
    partials/footer.ejs
    partials/flash.ejs
    login.ejs
    dashboard.ejs
    live.ejs
    archive.ejs
    video.ejs
    settings.ejs
    error.ejs
public/
  css/
    base.css
    layout.css
    components.css
    dashboard.css
    archive.css
    live.css
    settings.css
    login.css
  js/
    dashboard.js
    live.js
    archive.js
    settings.js
  uploads/                       # MP4-Aufnahmen (gitignored)
  thumbnails/                    # Thumbnails (gitignored)
data/                            # SQLite DB (gitignored)
config/
  motion.conf.example
scripts/
  motioncam.service
tests/
  services/
    authService.test.js
    settingsService.test.js
    ffmpegService.test.js
    thumbnailService.test.js
    recordingService.test.js
    mailService.test.js
  services/
    dashboardService.test.js
    storageService.test.js
    watcherService.test.js
  routes/
    auth.test.js
    hooks.test.js
    archive.test.js
    api.test.js
.env.example
package.json
README.md
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Create: `.gitignore`
- Create: alle Verzeichnisse via Dummy-Files

- [ ] **Step 1: package.json erstellen**

```json
{
  "name": "motioncam",
  "version": "1.0.0",
  "description": "Self-hosted surveillance web app for Raspberry Pi",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "jest --runInBand",
    "test:watch": "jest --watch"
  },
  "dependencies": {
    "bcrypt": "^5.1.1",
    "better-sqlite3": "^9.4.3",
    "chokidar": "^3.6.0",
    "dotenv": "^16.4.5",
    "express": "^4.18.3",
    "express-ejs-layouts": "^2.5.1",
    "express-rate-limit": "^7.2.0",
    "express-session": "^1.18.0",
    "nodemailer": "^6.9.13",
    "session-file-store": "^1.5.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^7.0.0"
  },
  "jest": {
    "testEnvironment": "node"
  }
}
```

- [ ] **Step 2: .env.example erstellen**

```
PORT=3000
SESSION_SECRET=change-me-64-chars-random
DB_PATH=./data/motioncam.db
VIDEO_PATH=./public/uploads
THUMBNAIL_PATH=./public/thumbnails
SNAPSHOT_PATH=/var/lib/motion/lastsnap.jpg
CAMERA_DEVICE=/dev/video0
AUDIO_DEVICE=hw:1,0
MOTION_STREAM_PORT=8081
MOTION_CONF_PATH=/etc/motion/motion.conf
HOOK_SECRET=change-me-32-chars-random
APP_BASE_URL=http://localhost:3000
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

- [ ] **Step 3: .gitignore erstellen**

```
node_modules/
data/
public/uploads/
public/thumbnails/
sessions/
.env
*.db
firebase-debug.log
```

- [ ] **Step 4: Verzeichnisse anlegen und npm install**

```bash
mkdir -p src/{config,db,middleware,services,controllers,routes,views/{layouts,partials}} \
         public/{css,js,uploads,thumbnails} \
         data config scripts tests/{services,routes}
npm install
```

- [ ] **Step 5: Commit**

```bash
git init
git add package.json package-lock.json .env.example .gitignore
git commit -m "chore: project scaffold"
```

---

## Task 2: Config + DB Fundament

**Files:**
- Create: `src/config/index.js`
- Create: `src/db/index.js`
- Create: `src/db/migrations.js`
- Create: `src/db/seeds.js`
- Test: `tests/services/settingsService.test.js` (teilweise — DB-Smoke-Test)

- [ ] **Step 1: Config-Loader schreiben**

`src/config/index.js`:
```js
'use strict';
require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret',
  dbPath: process.env.DB_PATH || './data/motioncam.db',
  videoPath: process.env.VIDEO_PATH || './public/uploads',
  thumbnailPath: process.env.THUMBNAIL_PATH || './public/thumbnails',
  snapshotPath: process.env.SNAPSHOT_PATH || '/tmp/lastsnap.jpg',
  cameraDevice: process.env.CAMERA_DEVICE || '/dev/video0',
  audioDevice: process.env.AUDIO_DEVICE || 'hw:1,0',
  motionStreamPort: parseInt(process.env.MOTION_STREAM_PORT || '8081', 10),
  motionConfPath: process.env.MOTION_CONF_PATH || '/etc/motion/motion.conf',
  hookSecret: process.env.HOOK_SECRET || 'dev-hook-secret',
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
};
```

- [ ] **Step 2: DB-Singleton schreiben**

`src/db/index.js`:
```js
'use strict';
const Database = require('better-sqlite3');
const path = require('path');
const config = require('../config');

let _db = null;

function getDb() {
  if (!_db) {
    const dbPath = path.resolve(config.dbPath);
    _db = new Database(dbPath);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}

module.exports = { getDb };
```

- [ ] **Step 3: Migrations schreiben**

`src/db/migrations.js`:
```js
'use strict';
const { getDb } = require('./index');

function runMigrations() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      type        TEXT NOT NULL,
      occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
      meta        TEXT
    );

    CREATE TABLE IF NOT EXISTS recordings (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      filename         TEXT NOT NULL UNIQUE,
      filepath         TEXT NOT NULL,
      thumbnail_path   TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      duration_seconds REAL,
      file_size        INTEGER,
      width            INTEGER,
      height           INTEGER,
      has_audio        INTEGER NOT NULL DEFAULT 1,
      event_id         INTEGER REFERENCES events(id),
      processed        INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      type      TEXT NOT NULL,
      sent_at   TEXT NOT NULL DEFAULT (datetime('now')),
      recipient TEXT,
      subject   TEXT,
      status    TEXT NOT NULL,
      error     TEXT
    );
  `);
}

module.exports = { runMigrations };
```

- [ ] **Step 4: Seeds schreiben**

`src/db/seeds.js`:
```js
'use strict';
const { getDb } = require('./index');
const config = require('../config');

const DEFAULTS = [
  ['detection_enabled', 'true'],
  ['detection_sensitivity', '50'],
  ['detection_min_area', '500'],
  ['event_cooldown_seconds', '60'],
  ['recording_enabled', 'true'],
  ['recording_nachlaufzeit_seconds', '30'],
  ['video_fps', '15'],
  ['video_resolution', '1280x720'],
  ['video_bitrate', '2000k'],
  ['audio_enabled', 'true'],
  ['audio_bitrate', '128k'],
  ['storage_path', config.videoPath],
  ['thumbnail_path', config.thumbnailPath],
  ['snapshot_path', config.snapshotPath],
  ['camera_device', config.cameraDevice],
  ['audio_device', config.audioDevice],
  ['mail_enabled', 'false'],
  ['mail_cooldown_seconds', '300'],
  ['mail_snapshot_attach', 'true'],
  ['smtp_host', ''],
  ['smtp_port', '587'],
  ['smtp_user', ''],
  ['smtp_pass', ''],
  ['smtp_tls', 'true'],
  ['smtp_from', ''],
  ['mail_recipient', ''],
];

function runSeeds() {
  const db = getDb();
  const insert = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  const insertMany = db.transaction((rows) => {
    for (const [key, value] of rows) insert.run(key, value);
  });
  insertMany(DEFAULTS);
}

module.exports = { runSeeds };
```

- [ ] **Step 5: DB-Smoke-Test schreiben**

`tests/services/db.test.js`:
```js
'use strict';
process.env.DB_PATH = ':memory:';
const { getDb } = require('../../src/db');
const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');

describe('DB migrations + seeds', () => {
  beforeAll(() => {
    runMigrations();
    runSeeds();
  });

  test('users table exists', () => {
    const db = getDb();
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    expect(row).toBeTruthy();
  });

  test('settings seeded with detection_enabled', () => {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key='detection_enabled'").get();
    expect(row.value).toBe('true');
  });

  test('all 4 tables exist', () => {
    const db = getDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
    expect(tables).toEqual(expect.arrayContaining(['users', 'settings', 'events', 'recordings', 'notifications']));
  });
});
```

- [ ] **Step 6: Test ausführen — muss FAIL**

```bash
npx jest tests/services/db.test.js --no-coverage
```
Expected: FAIL — Module not found

- [ ] **Step 7: Test erneut — muss PASS**

```bash
npx jest tests/services/db.test.js --no-coverage
```
Expected: 3 passed

- [ ] **Step 9: Commit**

```bash
git add src/config src/db tests/services/db.test.js
git commit -m "feat: config loader, DB migrations and seeds"
```

---

## Task 3: Auth Service + Middleware

**Files:**
- Create: `src/services/authService.js`
- Create: `src/middleware/auth.js`
- Test: `tests/services/authService.test.js`

- [ ] **Step 1: Failing Test schreiben**

`tests/services/authService.test.js`:
```js
'use strict';
process.env.DB_PATH = ':memory:';
const { getDb } = require('../../src/db');
const { runMigrations } = require('../../src/db/migrations');
const authService = require('../../src/services/authService');

beforeAll(() => { runMigrations(); });

describe('authService', () => {
  test('createUser hashes password and stores user', async () => {
    await authService.createUser('admin', 'secret123');
    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE username='admin'").get();
    expect(user).toBeTruthy();
    expect(user.password).not.toBe('secret123');
  });

  test('verifyPassword returns true for correct password', async () => {
    await authService.createUser('user2', 'mypass');
    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE username='user2'").get();
    const ok = await authService.verifyPassword('mypass', user.password);
    expect(ok).toBe(true);
  });

  test('verifyPassword returns false for wrong password', async () => {
    await authService.createUser('user3', 'correct');
    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE username='user3'").get();
    const ok = await authService.verifyPassword('wrong', user.password);
    expect(ok).toBe(false);
  });

  test('findByUsername returns null for unknown user', async () => {
    const user = await authService.findByUsername('nobody');
    expect(user).toBeNull();
  });

  test('updateLastLogin updates last_login field', async () => {
    await authService.createUser('user4', 'pass');
    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE username='user4'").get();
    await authService.updateLastLogin(user.id);
    const updated = db.prepare("SELECT last_login FROM users WHERE id=?").get(user.id);
    expect(updated.last_login).toBeTruthy();
  });
});
```

- [ ] **Step 2: Test ausführen — muss FAIL**

```bash
npx jest tests/services/authService.test.js --no-coverage
```
Expected: FAIL — Cannot find module authService

- [ ] **Step 3: authService implementieren**

`src/services/authService.js`:
```js
'use strict';
const bcrypt = require('bcrypt');
const { getDb } = require('../db');

const BCRYPT_ROUNDS = 12;

async function createUser(username, plainPassword) {
  const hash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
  const db = getDb();
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hash);
}

async function findByUsername(username) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) || null;
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

async function updateLastLogin(userId) {
  const db = getDb();
  db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(userId);
}

async function changePassword(userId, newPlain) {
  const hash = await bcrypt.hash(newPlain, BCRYPT_ROUNDS);
  const db = getDb();
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, userId);
}

module.exports = { createUser, findByUsername, verifyPassword, updateLastLogin, changePassword };
```

- [ ] **Step 4: Test ausführen — muss PASS**

```bash
npx jest tests/services/authService.test.js --no-coverage
```
Expected: 5 passed

- [ ] **Step 5: requireLogin-Middleware schreiben**

`src/middleware/auth.js`:
```js
'use strict';

function requireLogin(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.redirect('/login');
}

module.exports = { requireLogin };
```

- [ ] **Step 6: hookAuth-Middleware schreiben**

`src/middleware/hookAuth.js`:
```js
'use strict';
const config = require('../config');

function requireHookSecret(req, res, next) {
  const secret = req.headers['x-hook-secret'];
  if (!secret || secret !== config.hookSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = { requireHookSecret };
```

- [ ] **Step 7: errorHandler schreiben**

`src/middleware/errorHandler.js`:
```js
'use strict';

function errorHandler(err, req, res, next) {
  console.error(err.stack);
  const status = err.status || 500;
  if (req.accepts('html')) {
    res.status(status).render('error', { message: err.message, status });
  } else {
    res.status(status).json({ error: err.message });
  }
}

module.exports = { errorHandler };
```

- [ ] **Step 8: Commit**

```bash
git add src/services/authService.js src/middleware/ tests/services/authService.test.js
git commit -m "feat: auth service, requireLogin and hookAuth middleware"
```

---

## Task 4: Settings Service

**Files:**
- Create: `src/services/settingsService.js`
- Test: `tests/services/settingsService.test.js`

- [ ] **Step 1: Failing Test schreiben**

`tests/services/settingsService.test.js`:
```js
'use strict';
process.env.DB_PATH = ':memory:';
const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');
const settingsService = require('../../src/services/settingsService');

beforeAll(() => {
  runMigrations();
  runSeeds();
  settingsService.loadAll();
});

describe('settingsService', () => {
  test('get returns seeded default', () => {
    expect(settingsService.get('detection_enabled')).toBe('true');
  });

  test('set persists and updates cache', () => {
    settingsService.set('video_fps', '25');
    expect(settingsService.get('video_fps')).toBe('25');
  });

  test('getAll returns object with all keys', () => {
    const all = settingsService.getAll();
    expect(all).toHaveProperty('detection_enabled');
    expect(all).toHaveProperty('mail_enabled');
  });

  test('getBool returns boolean', () => {
    expect(settingsService.getBool('detection_enabled')).toBe(true);
    expect(settingsService.getBool('mail_enabled')).toBe(false);
  });

  test('getInt returns integer', () => {
    expect(settingsService.getInt('smtp_port')).toBe(587);
  });

  test('setMany persists multiple keys', () => {
    settingsService.setMany({ video_fps: '30', audio_bitrate: '192k' });
    expect(settingsService.get('video_fps')).toBe('30');
    expect(settingsService.get('audio_bitrate')).toBe('192k');
  });
});
```

- [ ] **Step 2: Test ausführen — muss FAIL**

```bash
npx jest tests/services/settingsService.test.js --no-coverage
```

- [ ] **Step 3: settingsService implementieren**

`src/services/settingsService.js`:
```js
'use strict';
const { getDb } = require('../db');

let _cache = {};

function loadAll() {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  _cache = {};
  for (const row of rows) _cache[row.key] = row.value;
}

function get(key) {
  return _cache[key] ?? null;
}

function getAll() {
  return { ..._cache };
}

function getBool(key) {
  return get(key) === 'true';
}

function getInt(key) {
  return parseInt(get(key), 10);
}

function set(key, value) {
  const db = getDb();
  const strVal = String(value);
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, strVal);
  _cache[key] = strVal;
}

function setMany(obj) {
  const db = getDb();
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const tx = db.transaction((entries) => {
    for (const [k, v] of entries) {
      const strVal = String(v);
      stmt.run(k, strVal);
      _cache[k] = strVal;
    }
  });
  tx(Object.entries(obj));
}

module.exports = { loadAll, get, getAll, getBool, getInt, set, setMany };
```

- [ ] **Step 4: Test ausführen — muss PASS**

```bash
npx jest tests/services/settingsService.test.js --no-coverage
```
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add src/services/settingsService.js tests/services/settingsService.test.js
git commit -m "feat: settings service with in-memory cache"
```

---

## Task 5: FFmpeg Service

**Files:**
- Create: `src/services/ffmpegService.js`
- Test: `tests/services/ffmpegService.test.js`

- [ ] **Step 1: Failing Test schreiben**

`tests/services/ffmpegService.test.js`:
```js
'use strict';
jest.mock('child_process');
const { spawn } = require('child_process');
const EventEmitter = require('events');

const ffmpegService = require('../../src/services/ffmpegService');

function makeMockProcess() {
  const proc = new EventEmitter();
  proc.pid = 12345;
  proc.kill = jest.fn();
  proc.stdin = { end: jest.fn() };
  return proc;
}

describe('ffmpegService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ffmpegService.reset();
  });

  test('isRecording returns false initially', () => {
    expect(ffmpegService.isRecording()).toBe(false);
  });

  test('spawn starts a process and isRecording becomes true', () => {
    const proc = makeMockProcess();
    spawn.mockReturnValue(proc);

    ffmpegService.spawn('/tmp/test.mp4', {
      cameraDevice: '/dev/video0',
      audioDevice: 'hw:1,0',
      videoFps: '15',
      videoResolution: '1280x720',
      videoBitrate: '2000k',
      audioBitrate: '128k',
      audioEnabled: true,
    });

    expect(spawn).toHaveBeenCalledWith('ffmpeg', expect.any(Array));
    expect(ffmpegService.isRecording()).toBe(true);
  });

  test('stop sends SIGINT and resolves when process exits', async () => {
    const proc = makeMockProcess();
    spawn.mockReturnValue(proc);

    ffmpegService.spawn('/tmp/test.mp4', {
      cameraDevice: '/dev/video0',
      audioDevice: 'hw:1,0',
      videoFps: '15',
      videoResolution: '1280x720',
      videoBitrate: '2000k',
      audioBitrate: '128k',
      audioEnabled: true,
    });

    const stopPromise = ffmpegService.stop();
    expect(proc.kill).toHaveBeenCalledWith('SIGINT');
    proc.emit('close', 0);
    await stopPromise;
    expect(ffmpegService.isRecording()).toBe(false);
  });
});
```

- [ ] **Step 2: Test ausführen — muss FAIL**

```bash
npx jest tests/services/ffmpegService.test.js --no-coverage
```

- [ ] **Step 3: ffmpegService implementieren**

`src/services/ffmpegService.js`:
```js
'use strict';
const { spawn: spawnProcess } = require('child_process');

let _proc = null;

function isRecording() {
  return _proc !== null;
}

function reset() {
  _proc = null;
}

function spawn(outputPath, opts) {
  if (_proc) throw new Error('FFmpeg already running');

  const args = [
    '-f', 'v4l2', '-i', opts.cameraDevice,
  ];

  if (opts.audioEnabled) {
    args.push('-f', 'alsa', '-i', opts.audioDevice);
  }

  args.push(
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-b:v', opts.videoBitrate,
    '-r', String(opts.videoFps),
    '-s', opts.videoResolution,
  );

  if (opts.audioEnabled) {
    args.push('-c:a', 'aac', '-b:a', opts.audioBitrate);
  }

  args.push('-movflags', '+faststart', outputPath);

  _proc = spawnProcess('ffmpeg', args);

  _proc.on('close', () => { _proc = null; });
  _proc.stderr?.on('data', () => {}); // suppress stderr

  return _proc;
}

function stop() {
  return new Promise((resolve) => {
    if (!_proc) return resolve();
    _proc.once('close', resolve);
    _proc.kill('SIGINT');
  });
}

module.exports = { spawn, stop, isRecording, reset };
```

- [ ] **Step 4: Test ausführen — muss PASS**

```bash
npx jest tests/services/ffmpegService.test.js --no-coverage
```
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/services/ffmpegService.js tests/services/ffmpegService.test.js
git commit -m "feat: FFmpeg service for recording spawn/stop"
```

---

## Task 6: Thumbnail Service

**Files:**
- Create: `src/services/thumbnailService.js`
- Test: `tests/services/thumbnailService.test.js`

- [ ] **Step 1: Failing Test schreiben**

`tests/services/thumbnailService.test.js`:
```js
'use strict';
jest.mock('child_process');
const { execFile } = require('child_process');

const thumbnailService = require('../../src/services/thumbnailService');

describe('thumbnailService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('process calls ffprobe then ffmpeg', async () => {
    const ffprobeOutput = JSON.stringify({
      streams: [{ codec_type: 'video', width: 1280, height: 720, codec_name: 'h264' }],
      format: { duration: '60.0', size: '5000000' },
    });

    execFile.mockImplementation((cmd, args, opts, cb) => {
      if (cmd === 'ffprobe') cb(null, ffprobeOutput, '');
      else cb(null, '', '');
    });

    const result = await thumbnailService.process('/tmp/test.mp4', '/tmp/thumbs');
    expect(execFile).toHaveBeenCalledTimes(2);
    expect(result.duration).toBeCloseTo(60);
    expect(result.width).toBe(1280);
    expect(result.height).toBe(720);
    expect(result.thumbnailPath).toContain('.jpg');
  });

  test('process handles missing video stream gracefully', async () => {
    const ffprobeOutput = JSON.stringify({ streams: [], format: { duration: '0', size: '0' } });
    execFile.mockImplementation((cmd, args, opts, cb) => cb(null, ffprobeOutput, ''));

    const result = await thumbnailService.process('/tmp/empty.mp4', '/tmp/thumbs');
    expect(result.duration).toBe(0);
    expect(result.width).toBeNull();
    expect(result.height).toBeNull();
  });
});
```

- [ ] **Step 2: Test ausführen — muss FAIL**

```bash
npx jest tests/services/thumbnailService.test.js --no-coverage
```

- [ ] **Step 3: thumbnailService implementieren**

`src/services/thumbnailService.js`:
```js
'use strict';
const { execFile } = require('child_process');
const path = require('path');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

async function process(videoPath, thumbDir) {
  // Step 1: ffprobe
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_streams',
    '-show_format',
    videoPath,
  ]);

  const info = JSON.parse(stdout);
  const videoStream = info.streams?.find(s => s.codec_type === 'video') || null;
  const duration = parseFloat(info.format?.duration || '0') || 0;
  const fileSize = parseInt(info.format?.size || '0', 10) || 0;

  const width = videoStream?.width ?? null;
  const height = videoStream?.height ?? null;
  const codec = videoStream?.codec_name ?? null;

  // Step 2: Generate thumbnail at midpoint
  const basename = path.basename(videoPath, '.mp4');
  const thumbnailPath = path.join(thumbDir, `${basename}.jpg`);
  const seekTime = Math.max(0, duration / 2);

  await execFileAsync('ffmpeg', [
    '-ss', String(seekTime),
    '-i', videoPath,
    '-vframes', '1',
    '-q:v', '2',
    '-y',
    thumbnailPath,
  ]);

  return { duration, fileSize, width, height, codec, thumbnailPath };
}

module.exports = { process };
```

- [ ] **Step 4: Test ausführen — muss PASS**

```bash
npx jest tests/services/thumbnailService.test.js --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add src/services/thumbnailService.js tests/services/thumbnailService.test.js
git commit -m "feat: thumbnail service (ffprobe + ffmpeg)"
```

---

## Task 7: Recording Service

**Files:**
- Create: `src/services/recordingService.js`
- Test: `tests/services/recordingService.test.js`

- [ ] **Step 1: Failing Test schreiben**

`tests/services/recordingService.test.js`:
```js
'use strict';
process.env.DB_PATH = ':memory:';
jest.mock('../../src/services/ffmpegService');
jest.mock('../../src/services/thumbnailService');
jest.mock('../../src/services/mailService');

const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');
const settingsService = require('../../src/services/settingsService');
const ffmpegService = require('../../src/services/ffmpegService');
const thumbnailService = require('../../src/services/thumbnailService');
const mailService = require('../../src/services/mailService');
const recordingService = require('../../src/services/recordingService');
const { getDb } = require('../../src/db');

beforeAll(() => {
  runMigrations();
  runSeeds();
  settingsService.loadAll();
});

beforeEach(() => {
  jest.clearAllMocks();
  recordingService.reset();
  ffmpegService.isRecording.mockReturnValue(false);
});

describe('recordingService', () => {
  test('startRecording spawns ffmpeg and creates DB record', async () => {
    ffmpegService.spawn.mockReturnValue({ pid: 1 });
    await recordingService.startRecording();

    const db = getDb();
    const recording = db.prepare("SELECT * FROM recordings ORDER BY id DESC LIMIT 1").get();
    expect(recording).toBeTruthy();
    expect(recording.processed).toBe(0);
    expect(ffmpegService.spawn).toHaveBeenCalledTimes(1);
  });

  test('startRecording does nothing if already recording', async () => {
    ffmpegService.isRecording.mockReturnValue(true);
    await recordingService.startRecording();
    expect(ffmpegService.spawn).not.toHaveBeenCalled();
  });

  test('scheduleStop sets a timer', async () => {
    jest.useFakeTimers();
    ffmpegService.spawn.mockReturnValue({ pid: 1 });
    ffmpegService.stop.mockResolvedValue();
    thumbnailService.process.mockResolvedValue({
      duration: 10, fileSize: 1000, width: 1280, height: 720, codec: 'h264', thumbnailPath: '/tmp/t.jpg'
    });

    await recordingService.startRecording();
    recordingService.scheduleStop();

    expect(recordingService.isStopScheduled()).toBe(true);
    jest.runAllTimers();
    jest.useRealTimers();
  });
});
```

- [ ] **Step 2: Test ausführen — muss FAIL**

```bash
npx jest tests/services/recordingService.test.js --no-coverage
```

- [ ] **Step 3: recordingService implementieren**

`src/services/recordingService.js`:
```js
'use strict';
const path = require('path');
const { getDb } = require('../db');
const settingsService = require('./settingsService');
const ffmpegService = require('./ffmpegService');
const thumbnailService = require('./thumbnailService');
const mailService = require('./mailService');

let _currentRecordingId = null;
let _currentFilepath = null;
let _stopTimer = null;

function reset() {
  _currentRecordingId = null;
  _currentFilepath = null;
  if (_stopTimer) { clearTimeout(_stopTimer); _stopTimer = null; }
}

function isStopScheduled() {
  return _stopTimer !== null;
}

async function startRecording() {
  if (ffmpegService.isRecording()) return;

  const recordingEnabled = settingsService.getBool('recording_enabled');
  if (!recordingEnabled) return;

  // Cooldown check
  const cooldown = settingsService.getInt('event_cooldown_seconds');
  const db = getDb();
  const lastEvent = db.prepare(
    "SELECT occurred_at FROM events WHERE type='motion_start' ORDER BY id DESC LIMIT 1"
  ).get();
  if (lastEvent) {
    const lastTime = new Date(lastEvent.occurred_at).getTime();
    if (Date.now() - lastTime < cooldown * 1000) return;
  }

  const now = new Date();
  const filename = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19) + '.mp4';
  const storagePath = settingsService.get('storage_path');
  const filepath = path.join(storagePath, filename);

  const opts = {
    cameraDevice: settingsService.get('camera_device'),
    audioDevice: settingsService.get('audio_device'),
    videoFps: settingsService.get('video_fps'),
    videoResolution: settingsService.get('video_resolution'),
    videoBitrate: settingsService.get('video_bitrate'),
    audioBitrate: settingsService.get('audio_bitrate'),
    audioEnabled: settingsService.getBool('audio_enabled'),
  };

  ffmpegService.spawn(filepath, opts);

  // Log event
  const eventResult = db.prepare(
    "INSERT INTO events (type) VALUES ('motion_start')"
  ).run();

  // Create recording record
  const recResult = db.prepare(
    'INSERT INTO recordings (filename, filepath, event_id) VALUES (?, ?, ?)'
  ).run(filename, filepath, eventResult.lastInsertRowid);

  _currentRecordingId = recResult.lastInsertRowid;
  _currentFilepath = filepath;

  // Mail notification (non-blocking)
  mailService.notifyIfEnabled().catch(() => {});
}

function scheduleStop() {
  if (_stopTimer) return;
  const nachlaufzeit = settingsService.getInt('recording_nachlaufzeit_seconds') || 30;
  _stopTimer = setTimeout(() => _finishRecording(), nachlaufzeit * 1000);
}

async function _finishRecording() {
  _stopTimer = null;
  await ffmpegService.stop();

  if (!_currentRecordingId || !_currentFilepath) return;

  const db = getDb();
  const thumbPath = settingsService.get('thumbnail_path');
  try {
    const meta = await thumbnailService.process(_currentFilepath, thumbPath);
    db.prepare(`
      UPDATE recordings SET
        thumbnail_path = ?, duration_seconds = ?, file_size = ?,
        width = ?, height = ?, processed = 1
      WHERE id = ?
    `).run(meta.thumbnailPath, meta.duration, meta.fileSize, meta.width, meta.height, _currentRecordingId);
  } catch (err) {
    console.error('Post-processing failed:', err.message);
  }

  db.prepare("INSERT INTO events (type) VALUES ('recording_complete')").run();
  _currentRecordingId = null;
  _currentFilepath = null;
}

module.exports = { startRecording, scheduleStop, reset, isStopScheduled };
```

- [ ] **Step 4: Test ausführen — muss PASS**

```bash
npx jest tests/services/recordingService.test.js --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add src/services/recordingService.js tests/services/recordingService.test.js
git commit -m "feat: recording service (start, scheduleStop, post-processing)"
```

---

## Task 8: Mail Service

**Files:**
- Create: `src/services/mailService.js`
- Test: `tests/services/mailService.test.js`

- [ ] **Step 1: Failing Test schreiben**

`tests/services/mailService.test.js`:
```js
'use strict';
process.env.DB_PATH = ':memory:';
jest.mock('nodemailer');
const nodemailer = require('nodemailer');

const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');
const settingsService = require('../../src/services/settingsService');
const mailService = require('../../src/services/mailService');
const { getDb } = require('../../src/db');

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
nodemailer.createTransport.mockReturnValue({ sendMail: mockSendMail });

beforeAll(() => {
  runMigrations();
  runSeeds();
  settingsService.loadAll();
  settingsService.set('mail_enabled', 'true');
  settingsService.set('smtp_host', 'smtp.example.com');
  settingsService.set('smtp_user', 'user@example.com');
  settingsService.set('smtp_pass', 'secret');
  settingsService.set('mail_recipient', 'alert@example.com');
  settingsService.set('smtp_from', 'cam@example.com');
  mailService.reset();
});

describe('mailService', () => {
  test('notifyIfEnabled sends mail and logs notification', async () => {
    await mailService.notifyIfEnabled();
    expect(mockSendMail).toHaveBeenCalledTimes(1);

    const db = getDb();
    const notif = db.prepare("SELECT * FROM notifications ORDER BY id DESC LIMIT 1").get();
    expect(notif.status).toBe('sent');
  });

  test('sendTestMail sends mail ignoring cooldown', async () => {
    mockSendMail.mockClear();
    await mailService.sendTestMail();
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  test('notifyIfEnabled respects cooldown', async () => {
    mockSendMail.mockClear();
    mailService.reset(); // clear last-sent time
    settingsService.set('mail_cooldown_seconds', '300');

    await mailService.notifyIfEnabled(); // first — should send
    await mailService.notifyIfEnabled(); // second — within cooldown, should NOT send
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Test ausführen — muss FAIL**

```bash
npx jest tests/services/mailService.test.js --no-coverage
```

- [ ] **Step 3: mailService implementieren**

`src/services/mailService.js`:
```js
'use strict';
const nodemailer = require('nodemailer');
const { getDb } = require('../db');
const config = require('../config');
const settingsService = require('./settingsService');

let _lastSent = null;

function reset() {
  _lastSent = null;
}

function _createTransport() {
  return nodemailer.createTransport({
    host: settingsService.get('smtp_host'),
    port: settingsService.getInt('smtp_port'),
    secure: settingsService.getBool('smtp_tls'),
    auth: {
      user: settingsService.get('smtp_user'),
      pass: settingsService.get('smtp_pass'),
    },
  });
}

async function _send(subject, html) {
  const transport = _createTransport();
  const info = await transport.sendMail({
    from: settingsService.get('smtp_from'),
    to: settingsService.get('mail_recipient'),
    subject,
    html,
  });

  const db = getDb();
  db.prepare(
    'INSERT INTO notifications (type, recipient, subject, status) VALUES (?, ?, ?, ?)'
  ).run('email', settingsService.get('mail_recipient'), subject, 'sent');

  return info;
}

async function notifyIfEnabled() {
  if (!settingsService.getBool('mail_enabled')) return;

  const cooldown = settingsService.getInt('mail_cooldown_seconds') * 1000;
  if (_lastSent && Date.now() - _lastSent < cooldown) return;

  const now = new Date();
  const subject = `[MotionCam] Bewegung erkannt – ${now.toLocaleDateString('de-DE')} ${now.toLocaleTimeString('de-DE')}`;
  const html = `<p>Bewegung erkannt um ${now.toLocaleString('de-DE')}</p>
                <p><a href="${config.appBaseUrl}">Archiv öffnen</a></p>`;

  try {
    await _send(subject, html);
    _lastSent = Date.now();
  } catch (err) {
    const db = getDb();
    db.prepare(
      'INSERT INTO notifications (type, recipient, subject, status, error) VALUES (?, ?, ?, ?, ?)'
    ).run('email', settingsService.get('mail_recipient'), subject, 'failed', err.message);
  }
}

async function sendTestMail() {
  const subject = '[MotionCam] Test-E-Mail';
  const html = '<p>Diese E-Mail bestätigt, dass deine SMTP-Konfiguration funktioniert.</p>';
  await _send(subject, html);
}

module.exports = { notifyIfEnabled, sendTestMail, reset };
```

- [ ] **Step 4: Test ausführen — muss PASS**

```bash
npx jest tests/services/mailService.test.js --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add src/services/mailService.js tests/services/mailService.test.js
git commit -m "feat: mail service with cooldown and notification logging"
```

---

## Task 9: Hooks Route + Controller

**Files:**
- Create: `src/controllers/hooksController.js`
- Create: `src/routes/hooks.js`
- Test: `tests/routes/hooks.test.js`

- [ ] **Step 1: Failing Test schreiben**

`tests/routes/hooks.test.js`:
```js
'use strict';
process.env.DB_PATH = ':memory:';
process.env.HOOK_SECRET = 'test-secret';
jest.mock('../../src/services/recordingService');

const request = require('supertest');
const express = require('express');
const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');
const settingsService = require('../../src/services/settingsService');
const recordingService = require('../../src/services/recordingService');
const hooksRouter = require('../../src/routes/hooks');

const app = express();
app.use(express.json());
app.use('/api/hooks', hooksRouter);

beforeAll(() => {
  runMigrations();
  runSeeds();
  settingsService.loadAll();
  recordingService.startRecording.mockResolvedValue();
  recordingService.scheduleStop.mockReturnValue();
});

describe('POST /api/hooks/motion-start', () => {
  test('returns 401 without secret', async () => {
    const res = await request(app).post('/api/hooks/motion-start');
    expect(res.status).toBe(401);
  });

  test('returns 200 with valid secret', async () => {
    const res = await request(app)
      .post('/api/hooks/motion-start')
      .set('x-hook-secret', 'test-secret');
    expect(res.status).toBe(200);
    expect(recordingService.startRecording).toHaveBeenCalled();
  });
});

describe('POST /api/hooks/motion-end', () => {
  test('returns 200 and schedules stop', async () => {
    const res = await request(app)
      .post('/api/hooks/motion-end')
      .set('x-hook-secret', 'test-secret');
    expect(res.status).toBe(200);
    expect(recordingService.scheduleStop).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Test ausführen — muss FAIL**

```bash
npx jest tests/routes/hooks.test.js --no-coverage
```

- [ ] **Step 3: hooksController implementieren**

`src/controllers/hooksController.js`:
```js
'use strict';
const recordingService = require('../services/recordingService');

async function motionStart(req, res, next) {
  try {
    await recordingService.startRecording();
    res.json({ ok: true });
  } catch (err) { next(err); }
}

function motionEnd(req, res, next) {
  try {
    recordingService.scheduleStop();
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = { motionStart, motionEnd };
```

- [ ] **Step 4: hooks Route implementieren**

`src/routes/hooks.js`:
```js
'use strict';
const express = require('express');
const router = express.Router();
const { requireHookSecret } = require('../middleware/hookAuth');
const { motionStart, motionEnd } = require('../controllers/hooksController');

router.post('/motion-start', requireHookSecret, motionStart);
router.post('/motion-end', requireHookSecret, motionEnd);

module.exports = router;
```

- [ ] **Step 5: Test ausführen — muss PASS**

```bash
npx jest tests/routes/hooks.test.js --no-coverage
```

- [ ] **Step 6: Commit**

```bash
git add src/controllers/hooksController.js src/routes/hooks.js tests/routes/hooks.test.js
git commit -m "feat: motion hooks endpoints (motion-start, motion-end)"
```

---

## Task 10: Dashboard + Archive + Video Services

**Files:**
- Create: `src/services/dashboardService.js`
- Create: `src/services/storageService.js`
- Create: `src/services/watcherService.js`
- Test: `tests/services/dashboardService.test.js`
- Test: `tests/services/storageService.test.js`
- Test: `tests/services/watcherService.test.js`

- [ ] **Step 1: dashboardService implementieren**

`src/services/dashboardService.js`:
```js
'use strict';
const { getDb } = require('../db');
const ffmpegService = require('./ffmpegService');
const storageService = require('./storageService');

function getStats() {
  const db = getDb();

  const totalRecordings = db.prepare('SELECT COUNT(*) as n FROM recordings WHERE processed=1').get().n;
  const latestRecording = db.prepare(
    'SELECT * FROM recordings WHERE processed=1 ORDER BY created_at DESC LIMIT 1'
  ).get() || null;
  const totalDuration = db.prepare(
    'SELECT SUM(duration_seconds) as s FROM recordings WHERE processed=1'
  ).get().s || 0;
  const todayCount = db.prepare(
    "SELECT COUNT(*) as n FROM recordings WHERE date(created_at)=date('now')"
  ).get().n;
  const diskUsage = storageService.getDiskUsage();
  const isRecording = ffmpegService.isRecording();

  return { totalRecordings, latestRecording, totalDuration, todayCount, diskUsage, isRecording };
}

module.exports = { getStats };
```

- [ ] **Step 2: storageService implementieren**

`src/services/storageService.js`:
```js
'use strict';
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db');
const settingsService = require('./settingsService');

function getDiskUsage() {
  const dir = settingsService.get('storage_path');
  if (!dir || !fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).reduce((acc, f) => {
    try {
      return acc + fs.statSync(path.join(dir, f)).size;
    } catch { return acc; }
  }, 0);
}

function deleteRecording(id) {
  const db = getDb();
  const rec = db.prepare('SELECT * FROM recordings WHERE id=?').get(id);
  if (!rec) throw Object.assign(new Error('Recording not found'), { status: 404 });

  // Delete files (ignore errors if already gone)
  try { fs.unlinkSync(rec.filepath); } catch {}
  if (rec.thumbnail_path) try { fs.unlinkSync(rec.thumbnail_path); } catch {}

  db.prepare('DELETE FROM recordings WHERE id=?').run(id);
}

module.exports = { getDiskUsage, deleteRecording };
```

- [ ] **Step 3: watcherService implementieren**

`src/services/watcherService.js`:
```js
'use strict';
const chokidar = require('chokidar');
const path = require('path');
const { getDb } = require('../db');
const settingsService = require('./settingsService');
const thumbnailService = require('./thumbnailService');

let _watcher = null;

function start() {
  const watchDir = settingsService.get('storage_path');
  if (!watchDir) return;

  _watcher = chokidar.watch(path.join(watchDir, '*.mp4'), {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 },
  });

  _watcher.on('add', async (filepath) => {
    const filename = path.basename(filepath);
    const db = getDb();
    const existing = db.prepare('SELECT id FROM recordings WHERE filename=?').get(filename);
    if (existing) return; // Already tracked via hook

    const thumbDir = settingsService.get('thumbnail_path');
    try {
      const meta = await thumbnailService.process(filepath, thumbDir);
      db.prepare(`
        INSERT INTO recordings (filename, filepath, thumbnail_path, duration_seconds,
          file_size, width, height, processed)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `).run(filename, filepath, meta.thumbnailPath, meta.duration, meta.fileSize, meta.width, meta.height);
    } catch (err) {
      console.error('Watcher: could not process', filepath, err.message);
    }
  });
}

function stop() {
  if (_watcher) { _watcher.close(); _watcher = null; }
}

module.exports = { start, stop };
```

- [ ] **Step 4: Tests schreiben**

`tests/services/dashboardService.test.js`:
```js
'use strict';
process.env.DB_PATH = ':memory:';
jest.mock('../../src/services/ffmpegService');
jest.mock('../../src/services/storageService');

const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');
const settingsService = require('../../src/services/settingsService');
const ffmpegService = require('../../src/services/ffmpegService');
const storageService = require('../../src/services/storageService');
const dashboardService = require('../../src/services/dashboardService');

beforeAll(() => {
  runMigrations();
  runSeeds();
  settingsService.loadAll();
  ffmpegService.isRecording.mockReturnValue(false);
  storageService.getDiskUsage.mockReturnValue(0);
});

describe('dashboardService.getStats', () => {
  test('returns stats object with expected keys', () => {
    const stats = dashboardService.getStats();
    expect(stats).toHaveProperty('totalRecordings');
    expect(stats).toHaveProperty('todayCount');
    expect(stats).toHaveProperty('totalDuration');
    expect(stats).toHaveProperty('diskUsage');
    expect(stats).toHaveProperty('isRecording');
    expect(stats).toHaveProperty('latestRecording');
  });

  test('totalRecordings is 0 for empty DB', () => {
    expect(dashboardService.getStats().totalRecordings).toBe(0);
  });
});
```

`tests/services/storageService.test.js`:
```js
'use strict';
process.env.DB_PATH = ':memory:';
const fs = require('fs');
const os = require('os');
const path = require('path');

const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');
const settingsService = require('../../src/services/settingsService');
const storageService = require('../../src/services/storageService');
const { getDb } = require('../../src/db');

let tmpDir;
beforeAll(() => {
  runMigrations();
  runSeeds();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'motioncam-test-'));
  settingsService.loadAll();
  settingsService.set('storage_path', tmpDir);
});
afterAll(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

describe('storageService', () => {
  test('getDiskUsage returns 0 for empty dir', () => {
    expect(storageService.getDiskUsage()).toBe(0);
  });

  test('getDiskUsage counts file sizes', () => {
    fs.writeFileSync(path.join(tmpDir, 'test.mp4'), 'x'.repeat(100));
    expect(storageService.getDiskUsage()).toBe(100);
  });

  test('deleteRecording throws 404 for unknown id', () => {
    expect(() => storageService.deleteRecording(9999)).toThrow('Recording not found');
  });

  test('deleteRecording removes DB entry and file', () => {
    const fp = path.join(tmpDir, 'del.mp4');
    fs.writeFileSync(fp, 'data');
    const db = getDb();
    const res = db.prepare("INSERT INTO recordings (filename, filepath) VALUES ('del.mp4', ?)").run(fp);
    storageService.deleteRecording(res.lastInsertRowid);
    expect(fs.existsSync(fp)).toBe(false);
    const row = db.prepare('SELECT * FROM recordings WHERE id=?').get(res.lastInsertRowid);
    expect(row).toBeUndefined();
  });
});
```

`tests/services/watcherService.test.js`:
```js
'use strict';
process.env.DB_PATH = ':memory:';
jest.mock('chokidar');
jest.mock('../../src/services/thumbnailService');

const chokidar = require('chokidar');
const { EventEmitter } = require('events');

const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');
const settingsService = require('../../src/services/settingsService');
const watcherService = require('../../src/services/watcherService');
const thumbnailService = require('../../src/services/thumbnailService');
const { getDb } = require('../../src/db');

let mockWatcher;
beforeAll(() => {
  runMigrations();
  runSeeds();
  settingsService.loadAll();
  settingsService.set('storage_path', '/tmp/uploads');
  settingsService.set('thumbnail_path', '/tmp/thumbs');
  mockWatcher = new EventEmitter();
  mockWatcher.close = jest.fn();
  chokidar.watch.mockReturnValue(mockWatcher);
});

afterEach(() => watcherService.stop());

describe('watcherService', () => {
  test('start() calls chokidar.watch', () => {
    watcherService.start();
    expect(chokidar.watch).toHaveBeenCalled();
  });

  test('new untracked .mp4 triggers DB insert', async () => {
    thumbnailService.process.mockResolvedValue({
      duration: 5, fileSize: 500, width: 1280, height: 720, codec: 'h264',
      thumbnailPath: '/tmp/thumbs/new.jpg',
    });
    watcherService.start();
    mockWatcher.emit('add', '/tmp/uploads/new.mp4');
    // wait for async handler
    await new Promise(r => setTimeout(r, 50));
    const db = getDb();
    const row = db.prepare("SELECT * FROM recordings WHERE filename='new.mp4'").get();
    expect(row).toBeTruthy();
    expect(row.processed).toBe(1);
  });
});
```

- [ ] **Step 5: Tests ausführen — müssen PASS**

```bash
npx jest tests/services/dashboardService.test.js tests/services/storageService.test.js tests/services/watcherService.test.js --no-coverage
```

- [ ] **Step 6: Commit**

```bash
git add src/services/dashboardService.js src/services/storageService.js src/services/watcherService.js \
        tests/services/dashboardService.test.js tests/services/storageService.test.js tests/services/watcherService.test.js
git commit -m "feat: dashboard, storage and watcher services with tests"
```

---

## Task 10b: Motion Service

**Files:**
- Create: `src/services/motionService.js`

motionService liest die aktuelle `motion.conf`, ersetzt detection-relevante Werte und sendet SIGHUP an den motion-Daemon. Wird von `settingsController.saveSettings` aufgerufen wenn detection-Settings geändert werden.

- [ ] **Step 1: motionService implementieren**

`src/services/motionService.js`:
```js
'use strict';
const fs = require('fs');
const { execFile } = require('child_process');
const config = require('../config');
const settingsService = require('./settingsService');

// Maps settings keys to motion.conf directive names
const CONF_MAP = {
  detection_sensitivity: 'threshold',
  detection_min_area: 'minimum_motion_frames',
};

function _rewriteConf(confPath) {
  if (!fs.existsSync(confPath)) return; // Dev/Pi-less environment — skip silently

  let content = fs.readFileSync(confPath, 'utf-8');

  for (const [settingKey, directive] of Object.entries(CONF_MAP)) {
    const value = settingsService.get(settingKey);
    if (!value) continue;
    // Replace existing directive or append
    const regex = new RegExp(`^(${directive}\\s+).*`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `$1${value}`);
    } else {
      content += `\n${directive} ${value}`;
    }
  }

  fs.writeFileSync(confPath, content, 'utf-8');
}

function _sendSighup() {
  return new Promise((resolve) => {
    execFile('pkill', ['-HUP', 'motion'], () => resolve()); // ignore errors (motion may not be running)
  });
}

async function applyDetectionSettings() {
  _rewriteConf(config.motionConfPath);
  await _sendSighup();
}

module.exports = { applyDetectionSettings };
```

- [ ] **Step 2: settingsController — motionService nach detection-Save aufrufen**

In `src/controllers/settingsController.js` am Anfang hinzufügen:
```js
const motionService = require('../services/motionService');
```

Und in `saveSettings` nach `settingsService.setMany(update)`:
```js
// Apply detection settings to motion daemon (non-blocking)
const detectionKeys = ['detection_enabled', 'detection_sensitivity', 'detection_min_area'];
const hasDetectionChange = detectionKeys.some(k => k in update);
if (hasDetectionChange) motionService.applyDetectionSettings().catch(console.error);
```

- [ ] **Step 3: Commit**

```bash
git add src/services/motionService.js src/controllers/settingsController.js
git commit -m "feat: motion service (conf rewrite + SIGHUP) triggered on detection settings save"
```

---

## Task 10c: API + Archive Route Tests

**Files:**
- Test: `tests/routes/archive.test.js`
- Test: `tests/routes/api.test.js`

- [ ] **Step 1: archive.test.js schreiben**

`tests/routes/archive.test.js`:
```js
'use strict';
process.env.DB_PATH = ':memory:';
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');

const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');
const settingsService = require('../../src/services/settingsService');
const { getDb } = require('../../src/db');

let app;
beforeAll(() => {
  runMigrations();
  runSeeds();
  settingsService.loadAll();

  const a = express();
  a.set('view engine', 'ejs');
  a.set('views', path.join(__dirname, '../../src/views'));
  a.use(expressLayouts);
  a.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  // Simulate logged-in user
  a.use((req, res, next) => { req.session.userId = 1; req.session.username = 'admin'; next(); });
  a.use('/archive', require('../../src/routes/archive'));
  app = a;
});

describe('GET /archive', () => {
  test('returns 200 with empty archive', async () => {
    const res = await request(app).get('/archive');
    expect(res.status).toBe(200);
  });

  test('shows recordings when present', async () => {
    const db = getDb();
    db.prepare(
      "INSERT INTO recordings (filename, filepath, processed) VALUES ('test.mp4', '/tmp/test.mp4', 1)"
    ).run();
    const res = await request(app).get('/archive');
    expect(res.status).toBe(200);
    expect(res.text).toContain('test.mp4');
  });

  test('pagination: page param respected', async () => {
    const res = await request(app).get('/archive?page=1');
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: api.test.js schreiben**

`tests/routes/api.test.js`:
```js
'use strict';
process.env.DB_PATH = ':memory:';
jest.mock('../../src/services/dashboardService');

const request = require('supertest');
const express = require('express');
const session = require('express-session');
const dashboardService = require('../../src/services/dashboardService');
const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');
const settingsService = require('../../src/services/settingsService');

let app;
beforeAll(() => {
  runMigrations();
  runSeeds();
  settingsService.loadAll();
  dashboardService.getStats.mockReturnValue({
    totalRecordings: 5, todayCount: 2, totalDuration: 120, diskUsage: 1000,
    isRecording: false, latestRecording: null,
  });

  const a = express();
  a.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  a.use((req, res, next) => { req.session.userId = 1; next(); });
  a.use('/api', require('../../src/routes/api'));
  app = a;
});

describe('GET /api/dashboard/stats', () => {
  test('returns stats JSON', async () => {
    const res = await request(app).get('/api/dashboard/stats');
    expect(res.status).toBe(200);
    expect(res.body.totalRecordings).toBe(5);
    expect(res.body.isRecording).toBe(false);
  });
});

describe('GET /api/live/snapshot', () => {
  test('returns 404 when snapshot file does not exist', async () => {
    settingsService.set('snapshot_path', '/tmp/nonexistent-snap-xyz.jpg');
    const res = await request(app).get('/api/live/snapshot');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 3: Tests ausführen — müssen PASS**

```bash
npx jest tests/routes/archive.test.js tests/routes/api.test.js --no-coverage
```

- [ ] **Step 4: Commit**

```bash
git add tests/routes/archive.test.js tests/routes/api.test.js
git commit -m "test: archive and API route tests"
```

---

## Task 11: All Controllers + Routes

**Files:**
- Create: `src/controllers/authController.js`
- Create: `src/controllers/dashboardController.js`
- Create: `src/controllers/liveController.js`
- Create: `src/controllers/archiveController.js`
- Create: `src/controllers/videoController.js`
- Create: `src/controllers/settingsController.js`
- Create: `src/controllers/apiController.js`
- Create: alle `src/routes/*.js`
- Test: `tests/routes/auth.test.js`

- [ ] **Step 1: authController implementieren**

`src/controllers/authController.js`:
```js
'use strict';
const authService = require('../services/authService');

function showLogin(req, res) {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('login', { layout: false, error: req.session.error || null });
  delete req.session.error;
}

async function handleLogin(req, res) {
  const { username, password } = req.body;
  const user = await authService.findByUsername(username);
  if (!user || !(await authService.verifyPassword(password, user.password))) {
    req.session.error = 'Ungültiger Benutzername oder Passwort';
    return res.redirect('/login');
  }
  await authService.updateLastLogin(user.id);
  req.session.userId = user.id;
  req.session.username = user.username;
  res.redirect('/dashboard');
}

function handleLogout(req, res) {
  req.session.destroy(() => res.redirect('/login'));
}

module.exports = { showLogin, handleLogin, handleLogout };
```

- [ ] **Step 2: dashboardController implementieren**

`src/controllers/dashboardController.js`:
```js
'use strict';
const dashboardService = require('../services/dashboardService');

function showDashboard(req, res, next) {
  try {
    const stats = dashboardService.getStats();
    res.render('dashboard', { stats, username: req.session.username });
  } catch (err) { next(err); }
}

module.exports = { showDashboard };
```

- [ ] **Step 3: liveController implementieren**

`src/controllers/liveController.js`:
```js
'use strict';
const http = require('http');
const config = require('../config');

function showLive(req, res) {
  res.render('live', { username: req.session.username });
}

module.exports = { showLive };
```

- [ ] **Step 4: archiveController implementieren**

`src/controllers/archiveController.js`:
```js
'use strict';
const { getDb } = require('../db');

const PAGE_SIZE = 8;

function showArchive(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const offset = (page - 1) * PAGE_SIZE;
    const db = getDb();

    const total = db.prepare('SELECT COUNT(*) as n FROM recordings WHERE processed=1').get().n;
    const recordings = db.prepare(
      'SELECT * FROM recordings WHERE processed=1 ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(PAGE_SIZE, offset);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    res.render('archive', {
      recordings,
      page,
      totalPages,
      total,
      username: req.session.username,
    });
  } catch (err) { next(err); }
}

module.exports = { showArchive };
```

- [ ] **Step 5: videoController implementieren**

`src/controllers/videoController.js`:
```js
'use strict';
const path = require('path');
const { getDb } = require('../db');
const storageService = require('../services/storageService');

function showVideo(req, res, next) {
  try {
    const db = getDb();
    const recording = db.prepare('SELECT * FROM recordings WHERE id=?').get(req.params.id);
    if (!recording) return res.status(404).render('error', { message: 'Video nicht gefunden', status: 404 });
    res.render('video', { recording, username: req.session.username });
  } catch (err) { next(err); }
}

function deleteVideo(req, res, next) {
  try {
    storageService.deleteRecording(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

function downloadVideo(req, res, next) {
  try {
    const db = getDb();
    const recording = db.prepare('SELECT * FROM recordings WHERE id=?').get(req.params.id);
    if (!recording) return res.status(404).json({ error: 'Not found' });
    res.download(recording.filepath, recording.filename);
  } catch (err) { next(err); }
}

module.exports = { showVideo, deleteVideo, downloadVideo };
```

- [ ] **Step 6: settingsController implementieren**

`src/controllers/settingsController.js`:
```js
'use strict';
const settingsService = require('../services/settingsService');
const authService = require('../services/authService');
const mailService = require('../services/mailService');
const motionService = require('../services/motionService');

const EDITABLE_KEYS = [
  'detection_enabled', 'detection_sensitivity', 'detection_min_area', 'event_cooldown_seconds',
  'recording_enabled', 'recording_nachlaufzeit_seconds', 'video_fps', 'video_resolution',
  'video_bitrate', 'audio_enabled', 'audio_bitrate', 'storage_path', 'thumbnail_path',
  'snapshot_path', 'camera_device', 'audio_device',
  'mail_enabled', 'mail_cooldown_seconds', 'mail_snapshot_attach',
  'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_tls', 'smtp_from', 'mail_recipient',
];

function showSettings(req, res) {
  res.render('settings', {
    settings: settingsService.getAll(),
    username: req.session.username,
    flash: req.session.flash || null,
  });
  delete req.session.flash;
}

function saveSettings(req, res, next) {
  try {
    const update = {};
    for (const key of EDITABLE_KEYS) {
      if (key in req.body) update[key] = req.body[key];
      // Checkboxes: if not in body, they are false
      else if (['detection_enabled', 'recording_enabled', 'audio_enabled', 'mail_enabled', 'smtp_tls', 'mail_snapshot_attach'].includes(key)) {
        update[key] = 'false';
      }
    }
    settingsService.setMany(update);
    // Apply detection settings to motion daemon (non-blocking)
    const detectionKeys = ['detection_enabled', 'detection_sensitivity', 'detection_min_area'];
    if (detectionKeys.some(k => k in update)) motionService.applyDetectionSettings().catch(console.error);
    req.session.flash = { type: 'success', message: 'Einstellungen gespeichert.' };
    res.redirect('/settings');
  } catch (err) { next(err); }
}

async function testMail(req, res, next) {
  try {
    await mailService.sendTestMail();
    res.json({ ok: true, message: 'Test-E-Mail gesendet.' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
}

async function changePassword(req, res, next) {
  try {
    const { current, newPass, confirm } = req.body;
    if (newPass !== confirm) {
      req.session.flash = { type: 'error', message: 'Neue Passwörter stimmen nicht überein.' };
      return res.redirect('/settings');
    }
    const db = require('../db').getDb();
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.session.userId);
    const ok = await authService.verifyPassword(current, user.password);
    if (!ok) {
      req.session.flash = { type: 'error', message: 'Aktuelles Passwort falsch.' };
      return res.redirect('/settings');
    }
    await authService.changePassword(req.session.userId, newPass);
    req.session.flash = { type: 'success', message: 'Passwort geändert.' };
    res.redirect('/settings');
  } catch (err) { next(err); }
}

module.exports = { showSettings, saveSettings, testMail, changePassword };
```

- [ ] **Step 7: apiController implementieren**

`src/controllers/apiController.js`:
```js
'use strict';
const http = require('http');
const fs = require('fs');
const config = require('../config');
const settingsService = require('../services/settingsService');
const dashboardService = require('../services/dashboardService');

function proxyStream(req, res, next) {
  const port = config.motionStreamPort;
  const options = { hostname: '127.0.0.1', port, path: '/', timeout: 3000 };

  const proxyReq = http.get(options, (proxyRes) => {
    res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'multipart/x-mixed-replace');
    proxyRes.pipe(res);
    res.on('close', () => proxyReq.destroy());
  });

  proxyReq.on('error', () => {
    if (!res.headersSent) res.status(503).json({ error: 'Stream not available' });
  });
}

function getSnapshot(req, res) {
  const snapPath = settingsService.get('snapshot_path');
  if (!snapPath || !fs.existsSync(snapPath)) {
    return res.status(404).json({ error: 'Snapshot not available' });
  }
  res.setHeader('Content-Type', 'image/jpeg');
  res.sendFile(require('path').resolve(snapPath));
}

function getDashboardStats(req, res, next) {
  try {
    res.json(dashboardService.getStats());
  } catch (err) { next(err); }
}

module.exports = { proxyStream, getSnapshot, getDashboardStats };
```

- [ ] **Step 8: Alle Routes implementieren**

`src/routes/auth.js`:
```js
'use strict';
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { showLogin, handleLogin, handleLogout } = require('../controllers/authController');
const { requireLogin } = require('../middleware/auth');

const loginLimiter = rateLimit({ windowMs: 60_000, max: 5 });

router.get('/login', showLogin);
router.post('/login', loginLimiter, handleLogin);
router.get('/logout', requireLogin, handleLogout);

module.exports = router;
```

`src/routes/dashboard.js`:
```js
'use strict';
const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const { showDashboard } = require('../controllers/dashboardController');

router.get('/', requireLogin, showDashboard);

module.exports = router;
```

`src/routes/live.js`:
```js
'use strict';
const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const { showLive } = require('../controllers/liveController');

router.get('/', requireLogin, showLive);

module.exports = router;
```

`src/routes/archive.js`:
```js
'use strict';
const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const { showArchive } = require('../controllers/archiveController');

router.get('/', requireLogin, showArchive);

module.exports = router;
```

`src/routes/videos.js`:
```js
'use strict';
const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const { showVideo, deleteVideo, downloadVideo } = require('../controllers/videoController');

router.get('/:id', requireLogin, showVideo);
router.delete('/:id', requireLogin, deleteVideo);
router.get('/:id/download', requireLogin, downloadVideo);

module.exports = router;
```

`src/routes/settings.js`:
```js
'use strict';
const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const { showSettings, saveSettings, testMail, changePassword } = require('../controllers/settingsController');

router.get('/', requireLogin, showSettings);
router.post('/', requireLogin, saveSettings);
router.post('/test-mail', requireLogin, testMail);
router.post('/password', requireLogin, changePassword);

module.exports = router;
```

`src/routes/api.js`:
```js
'use strict';
const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const { proxyStream, getSnapshot, getDashboardStats } = require('../controllers/apiController');

router.get('/live/stream', requireLogin, proxyStream);
router.get('/live/snapshot', requireLogin, getSnapshot);
router.get('/dashboard/stats', requireLogin, getDashboardStats);

module.exports = router;
```

- [ ] **Step 9: Auth-Route Test schreiben**

`tests/routes/auth.test.js`:
```js
'use strict';
process.env.DB_PATH = ':memory:';
const request = require('supertest');
const { runMigrations } = require('../../src/db/migrations');
const { runSeeds } = require('../../src/db/seeds');
const settingsService = require('../../src/services/settingsService');
const authService = require('../../src/services/authService');

let app;
beforeAll(async () => {
  runMigrations();
  runSeeds();
  settingsService.loadAll();
  await authService.createUser('admin', 'testpass');
  // Build minimal app for auth testing
  const express = require('express');
  const session = require('express-session');
  const a = express();
  a.set('view engine', 'ejs');
  a.set('views', require('path').join(__dirname, '../../src/views'));
  a.use(require('express-ejs-layouts'));
  a.use(express.urlencoded({ extended: false }));
  a.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  a.use('/', require('../../src/routes/auth'));
  a.use('/dashboard', (req, res) => res.send('dashboard'));
  app = a;
});

describe('GET /login', () => {
  test('returns 200', async () => {
    const res = await request(app).get('/login');
    expect(res.status).toBe(200);
  });
});

describe('POST /login', () => {
  test('redirects to /dashboard on valid credentials', async () => {
    const res = await request(app)
      .post('/login')
      .send('username=admin&password=testpass');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/dashboard');
  });

  test('redirects back to /login on wrong password', async () => {
    const res = await request(app)
      .post('/login')
      .send('username=admin&password=wrong');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });
});
```

- [ ] **Step 10: Tests ausführen — müssen PASS**

```bash
npx jest tests/routes/auth.test.js --no-coverage
```

- [ ] **Step 11: Commit**

```bash
git add src/controllers/ src/routes/ tests/routes/auth.test.js
git commit -m "feat: all controllers and routes"
```

---

## Task 12: Express App + Server

**Files:**
- Create: `src/app.js`
- Create: `src/server.js`

- [ ] **Step 1: app.js implementieren**

`src/app.js`:
```js
'use strict';
const express = require('express');
const path = require('path');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const expressLayouts = require('express-ejs-layouts');
const config = require('./config');
const { errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  // View engine
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(expressLayouts);
  app.set('layout', 'layouts/main');

  // Body parsing
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  // Static files
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Session
  app.use(session({
    store: new FileStore({ path: './sessions', retries: 1 }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 },
  }));

  // Routes
  app.get('/', (req, res) => res.redirect('/dashboard'));
  app.use('/', require('./routes/auth'));
  app.use('/dashboard', require('./routes/dashboard'));
  app.use('/live', require('./routes/live'));
  app.use('/archive', require('./routes/archive'));
  app.use('/videos', require('./routes/videos'));
  app.use('/settings', require('./routes/settings'));
  app.use('/api/hooks', require('./routes/hooks'));
  app.use('/api', require('./routes/api'));

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
```

- [ ] **Step 2: server.js implementieren**

`src/server.js`:
```js
'use strict';
require('dotenv').config();
const config = require('./config');
const { runMigrations } = require('./db/migrations');
const { runSeeds } = require('./db/seeds');
const settingsService = require('./services/settingsService');
const watcherService = require('./services/watcherService');
const { createApp } = require('./app');

// Bootstrap DB
runMigrations();
runSeeds();
settingsService.loadAll();

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`MotionCam running on port ${config.port}`);
});

// Start file watcher
watcherService.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    watcherService.stop();
    process.exit(0);
  });
});
```

- [ ] **Step 3: sessions-Verzeichnis sicherstellen**

```bash
mkdir -p sessions
echo "sessions/" >> .gitignore
```

- [ ] **Step 4: Commit**

```bash
git add src/app.js src/server.js .gitignore
git commit -m "feat: Express app and server entry point"
```

---

## Task 13: EJS Views + Layouts

**Files:**
- Create: alle `src/views/**/*.ejs`

- [ ] **Step 1: Haupt-Layout schreiben**

`src/views/layouts/main.ejs`:
```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MotionCam</title>
  <link rel="stylesheet" href="/css/base.css">
  <link rel="stylesheet" href="/css/layout.css">
  <link rel="stylesheet" href="/css/components.css">
  <%- typeof pageCSS !== 'undefined' ? `<link rel="stylesheet" href="/css/${pageCSS}.css">` : '' %>
</head>
<body>
  <%- include('../partials/header') %>
  <main class="main-content">
    <%- include('../partials/flash') %>
    <%- body %>
  </main>
  <%- include('../partials/footer') %>
  <%- typeof pageJS !== 'undefined' ? `<script type="module" src="/js/${pageJS}.js"></script>` : '' %>
</body>
</html>
```

- [ ] **Step 2: Partials schreiben**

`src/views/partials/header.ejs`:
```html
<header class="site-header">
  <div class="header-inner">
    <a class="logo" href="/dashboard">MotionCam</a>
    <button class="hamburger" aria-label="Menu">&#9776;</button>
    <nav class="main-nav">
      <a href="/dashboard" class="nav-link <%= typeof title !== 'undefined' && title === 'Dashboard' ? 'active' : '' %>">Dashboard</a>
      <a href="/live" class="nav-link <%= typeof title !== 'undefined' && title === 'Live' ? 'active' : '' %>">Live</a>
      <a href="/archive" class="nav-link <%= typeof title !== 'undefined' && title === 'Archiv' ? 'active' : '' %>">Archiv</a>
      <a href="/settings" class="nav-link <%= typeof title !== 'undefined' && title === 'Einstellungen' ? 'active' : '' %>">Einstellungen</a>
      <a href="/logout" class="nav-link nav-link--logout">Abmelden</a>
    </nav>
  </div>
</header>
```

`src/views/partials/footer.ejs`:
```html
<footer class="site-footer">
  <span>MotionCam &copy; <%= new Date().getFullYear() %></span>
</footer>
```

`src/views/partials/flash.ejs`:
```html
<% if (typeof flash !== 'undefined' && flash) { %>
  <div class="flash flash--<%= flash.type %>"><%= flash.message %></div>
<% } %>
```

- [ ] **Step 3: login.ejs schreiben**

`src/views/login.ejs`:
```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MotionCam — Login</title>
  <link rel="stylesheet" href="/css/base.css">
  <link rel="stylesheet" href="/css/login.css">
</head>
<body class="login-body">
  <div class="login-card">
    <h1 class="login-title">MotionCam</h1>
    <% if (typeof error !== 'undefined' && error) { %>
      <div class="flash flash--error"><%= error %></div>
    <% } %>
    <form method="post" action="/login" class="login-form">
      <label class="form-label" for="username">Benutzername</label>
      <input class="form-input" type="text" id="username" name="username" required autofocus>
      <label class="form-label" for="password">Passwort</label>
      <input class="form-input" type="password" id="password" name="password" required>
      <button class="btn btn--primary btn--full" type="submit">Anmelden</button>
    </form>
  </div>
</body>
</html>
```

- [ ] **Step 4: dashboard.ejs schreiben**

`src/views/dashboard.ejs`:
```html
<% title = 'Dashboard'; pageCSS = 'dashboard'; pageJS = 'dashboard'; %>
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
  <div class="stat-card">
    <div class="stat-label">Speicher</div>
    <div class="stat-value"><%= (stats.diskUsage / 1024 / 1024).toFixed(1) %> MB</div>
  </div>
  <div class="stat-card stat-card--status">
    <div class="stat-label">Status</div>
    <div class="stat-value">
      <span class="badge badge--<%= stats.isRecording ? 'danger' : 'success' %>">
        <%= stats.isRecording ? 'Aufnahme läuft' : 'Bereit' %>
      </span>
    </div>
  </div>
</div>
<% if (stats.latestRecording) { %>
  <div class="latest-recording">
    <h2>Letzte Aufnahme</h2>
    <a href="/videos/<%= stats.latestRecording.id %>" class="recording-link">
      <% if (stats.latestRecording.thumbnail_path) { %>
        <img src="/thumbnails/<%= require('path').basename(stats.latestRecording.thumbnail_path) %>" alt="Thumbnail" class="thumb">
      <% } %>
      <span><%= stats.latestRecording.filename %></span>
    </a>
  </div>
<% } %>
```

- [ ] **Step 5: live.ejs schreiben**

`src/views/live.ejs`:
```html
<% title = 'Live'; pageCSS = 'live'; pageJS = 'live'; %>
<div class="live-container">
  <h1>Live-Ansicht</h1>
  <div class="stream-wrapper">
    <img id="live-stream" src="/api/live/stream" alt="Live Stream" class="live-img">
    <img id="snapshot-img" src="/api/live/snapshot" alt="Snapshot" class="live-img live-img--hidden">
  </div>
  <div id="stream-status" class="stream-status"></div>
</div>
```

- [ ] **Step 6: archive.ejs schreiben**

`src/views/archive.ejs`:
```html
<% title = 'Archiv'; pageCSS = 'archive'; pageJS = 'archive'; %>
<div class="archive-header">
  <h1>Archiv</h1>
  <span class="archive-count"><%= total %> Aufnahmen</span>
</div>
<% if (recordings.length === 0) { %>
  <p class="empty-state">Noch keine Aufnahmen vorhanden.</p>
<% } else { %>
  <div class="archive-grid">
    <% for (const rec of recordings) { %>
      <div class="recording-card" data-id="<%= rec.id %>">
        <a href="/videos/<%= rec.id %>" class="recording-card__link">
          <% if (rec.thumbnail_path) { %>
            <img src="/thumbnails/<%= require('path').basename(rec.thumbnail_path) %>" alt="" class="recording-card__thumb">
          <% } else { %>
            <div class="recording-card__no-thumb">Kein Thumbnail</div>
          <% } %>
          <div class="recording-card__info">
            <div class="recording-card__date"><%= new Date(rec.created_at).toLocaleString('de-DE') %></div>
            <% if (rec.duration_seconds) { %><div class="recording-card__dur"><%= Math.round(rec.duration_seconds) %>s</div><% } %>
          </div>
        </a>
        <button class="btn btn--danger btn--sm delete-btn" data-id="<%= rec.id %>">Löschen</button>
      </div>
    <% } %>
  </div>
  <div class="pagination">
    <% if (page > 1) { %><a href="/archive?page=<%= page - 1 %>" class="btn btn--secondary">Zurück</a><% } %>
    <span>Seite <%= page %> / <%= totalPages %></span>
    <% if (page < totalPages) { %><a href="/archive?page=<%= page + 1 %>" class="btn btn--secondary">Weiter</a><% } %>
  </div>
<% } %>
```

- [ ] **Step 7: video.ejs schreiben**

`src/views/video.ejs`:
```html
<% title = 'Video'; pageCSS = 'archive'; %>
<div class="video-detail">
  <a href="/archive" class="btn btn--secondary btn--back">&larr; Zurück</a>
  <h1 class="video-title"><%= recording.filename %></h1>
  <video class="video-player" controls preload="metadata">
    <source src="/videos/<%= recording.id %>/download" type="video/mp4">
  </video>
  <div class="video-meta">
    <% if (recording.duration_seconds) { %><div>Dauer: <%= Math.round(recording.duration_seconds) %>s</div><% } %>
    <% if (recording.width) { %><div>Auflösung: <%= recording.width %>×<%= recording.height %></div><% } %>
    <% if (recording.file_size) { %><div>Größe: <%= (recording.file_size / 1024 / 1024).toFixed(1) %> MB</div><% } %>
    <div>Aufgenommen: <%= new Date(recording.created_at).toLocaleString('de-DE') %></div>
  </div>
  <div class="video-actions">
    <a href="/videos/<%= recording.id %>/download" download class="btn btn--primary">Herunterladen</a>
    <button id="delete-btn" class="btn btn--danger" data-id="<%= recording.id %>">Löschen</button>
  </div>
</div>
<script>
  document.getElementById('delete-btn').addEventListener('click', async function() {
    if (!confirm('Aufnahme wirklich löschen?')) return;
    await fetch('/videos/' + this.dataset.id, { method: 'DELETE' });
    window.location.href = '/archive';
  });
</script>
```

- [ ] **Step 8: settings.ejs schreiben**

`src/views/settings.ejs`:
```html
<% title = 'Einstellungen'; pageCSS = 'settings'; pageJS = 'settings'; %>
<h1>Einstellungen</h1>
<form method="post" action="/settings" class="settings-form">
  <section class="settings-section">
    <h2>Erkennung</h2>
    <label class="form-label"><input type="checkbox" name="detection_enabled" value="true" <%= settings.detection_enabled === 'true' ? 'checked' : '' %>> Bewegungserkennung aktiv</label>
    <label class="form-label">Empfindlichkeit (1–100)<input class="form-input" type="number" name="detection_sensitivity" min="1" max="100" value="<%= settings.detection_sensitivity %>"></label>
    <label class="form-label">Mindestfläche<input class="form-input" type="number" name="detection_min_area" value="<%= settings.detection_min_area %>"></label>
    <label class="form-label">Event-Cooldown (s)<input class="form-input" type="number" name="event_cooldown_seconds" value="<%= settings.event_cooldown_seconds %>"></label>
  </section>
  <section class="settings-section">
    <h2>Aufnahme</h2>
    <label class="form-label"><input type="checkbox" name="recording_enabled" value="true" <%= settings.recording_enabled === 'true' ? 'checked' : '' %>> Automatisch aufnehmen</label>
    <label class="form-label">Nachlaufzeit (s)<input class="form-input" type="number" name="recording_nachlaufzeit_seconds" value="<%= settings.recording_nachlaufzeit_seconds %>"></label>
    <label class="form-label">FPS<input class="form-input" type="number" name="video_fps" value="<%= settings.video_fps %>"></label>
    <label class="form-label">Auflösung<input class="form-input" type="text" name="video_resolution" value="<%= settings.video_resolution %>"></label>
    <label class="form-label">Video-Bitrate<input class="form-input" type="text" name="video_bitrate" value="<%= settings.video_bitrate %>"></label>
    <label class="form-label"><input type="checkbox" name="audio_enabled" value="true" <%= settings.audio_enabled === 'true' ? 'checked' : '' %>> Audio aufnehmen</label>
    <label class="form-label">Audio-Bitrate<input class="form-input" type="text" name="audio_bitrate" value="<%= settings.audio_bitrate %>"></label>
    <label class="form-label">Kamera-Gerät<input class="form-input" type="text" name="camera_device" value="<%= settings.camera_device %>"></label>
    <label class="form-label">Audio-Gerät<input class="form-input" type="text" name="audio_device" value="<%= settings.audio_device %>"></label>
  </section>
  <section class="settings-section">
    <h2>E-Mail</h2>
    <label class="form-label"><input type="checkbox" name="mail_enabled" value="true" <%= settings.mail_enabled === 'true' ? 'checked' : '' %>> E-Mail-Benachrichtigungen</label>
    <label class="form-label">Mail-Cooldown (s)<input class="form-input" type="number" name="mail_cooldown_seconds" value="<%= settings.mail_cooldown_seconds %>"></label>
    <label class="form-label"><input type="checkbox" name="mail_snapshot_attach" value="true" <%= settings.mail_snapshot_attach === 'true' ? 'checked' : '' %>> Snapshot anhängen</label>
    <label class="form-label">SMTP-Host<input class="form-input" type="text" name="smtp_host" value="<%= settings.smtp_host %>"></label>
    <label class="form-label">SMTP-Port<input class="form-input" type="number" name="smtp_port" value="<%= settings.smtp_port %>"></label>
    <label class="form-label">SMTP-User<input class="form-input" type="text" name="smtp_user" value="<%= settings.smtp_user %>"></label>
    <label class="form-label">SMTP-Passwort<input class="form-input" type="password" name="smtp_pass" value="<%= settings.smtp_pass %>"></label>
    <label class="form-label"><input type="checkbox" name="smtp_tls" value="true" <%= settings.smtp_tls === 'true' ? 'checked' : '' %>> TLS verwenden</label>
    <label class="form-label">Absender<input class="form-input" type="email" name="smtp_from" value="<%= settings.smtp_from %>"></label>
    <label class="form-label">Empfänger<input class="form-input" type="email" name="mail_recipient" value="<%= settings.mail_recipient %>"></label>
    <button type="button" id="test-mail-btn" class="btn btn--secondary">Test-E-Mail senden</button>
  </section>
  <button type="submit" class="btn btn--primary">Speichern</button>
</form>

<hr>
<section class="settings-section">
  <h2>Passwort ändern</h2>
  <form method="post" action="/settings/password" class="settings-form">
    <label class="form-label">Aktuelles Passwort<input class="form-input" type="password" name="current" required></label>
    <label class="form-label">Neues Passwort<input class="form-input" type="password" name="newPass" required minlength="8"></label>
    <label class="form-label">Wiederholen<input class="form-input" type="password" name="confirm" required></label>
    <button type="submit" class="btn btn--primary">Passwort ändern</button>
  </form>
</section>
```

- [ ] **Step 9: error.ejs schreiben**

`src/views/error.ejs`:
```html
<% title = 'Fehler'; %>
<div class="error-page">
  <h1><%= status %></h1>
  <p><%= message %></p>
  <a href="/dashboard" class="btn btn--primary">Zurück zum Dashboard</a>
</div>
```

- [ ] **Step 10: Commit**

```bash
git add src/views/
git commit -m "feat: EJS views and layouts"
```

---

## Task 14: CSS — Dark Theme

**Files:**
- Create: `public/css/*.css`

- [ ] **Step 1: base.css schreiben**

`public/css/base.css`:
```css
:root {
  --bg: #0a0a0c;
  --panel: #111117;
  --border: #1e1e2e;
  --accent: #3b82f6;
  --accent-hover: #2563eb;
  --text: #e2e8f0;
  --text-muted: #64748b;
  --danger: #ef4444;
  --success: #22c55e;
  --warning: #f59e0b;
  --radius: 8px;
  --shadow: 0 2px 8px rgba(0,0,0,0.4);
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, sans-serif; font-size: 16px; line-height: 1.5; min-height: 100vh; }
a { color: var(--accent); text-decoration: none; }
a:hover { color: var(--accent-hover); }
img { max-width: 100%; display: block; }
```

- [ ] **Step 2: layout.css schreiben**

`public/css/layout.css`:
```css
.site-header { background: var(--panel); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 100; }
.header-inner { max-width: 1200px; margin: 0 auto; padding: 0 1rem; display: flex; align-items: center; gap: 1rem; height: 56px; }
.logo { font-size: 1.2rem; font-weight: 700; color: var(--text); }
.main-nav { display: flex; gap: 0.5rem; margin-left: auto; align-items: center; }
.nav-link { padding: 0.4rem 0.75rem; border-radius: var(--radius); color: var(--text-muted); font-size: 0.9rem; transition: color 0.15s, background 0.15s; }
.nav-link:hover, .nav-link.active { color: var(--text); background: var(--border); }
.nav-link--logout { color: var(--danger); }
.nav-link--logout:hover { background: rgba(239,68,68,0.1); }
.hamburger { display: none; background: none; border: none; color: var(--text); font-size: 1.5rem; cursor: pointer; margin-left: auto; }
.main-content { max-width: 1200px; margin: 0 auto; padding: 2rem 1rem; }
.site-footer { border-top: 1px solid var(--border); padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.8rem; margin-top: 4rem; }
@media (max-width: 640px) {
  .hamburger { display: block; }
  .main-nav { display: none; flex-direction: column; position: absolute; top: 56px; left: 0; right: 0; background: var(--panel); border-bottom: 1px solid var(--border); padding: 0.5rem; }
  .main-nav.open { display: flex; }
}
```

- [ ] **Step 3: components.css schreiben**

`public/css/components.css`:
```css
.btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem; border-radius: var(--radius); border: none; cursor: pointer; font-size: 0.9rem; font-weight: 500; transition: background 0.15s; }
.btn--primary { background: var(--accent); color: #fff; }
.btn--primary:hover { background: var(--accent-hover); color: #fff; }
.btn--secondary { background: var(--border); color: var(--text); }
.btn--secondary:hover { background: #2a2a3a; color: var(--text); }
.btn--danger { background: var(--danger); color: #fff; }
.btn--danger:hover { background: #dc2626; color: #fff; }
.btn--sm { padding: 0.25rem 0.6rem; font-size: 0.8rem; }
.btn--full { width: 100%; justify-content: center; }
.btn--back { margin-bottom: 1.5rem; }
.badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
.badge--success { background: rgba(34,197,94,0.15); color: var(--success); }
.badge--danger { background: rgba(239,68,68,0.15); color: var(--danger); }
.form-label { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem; }
.form-input { background: var(--bg); border: 1px solid var(--border); color: var(--text); padding: 0.5rem 0.75rem; border-radius: var(--radius); font-size: 0.95rem; }
.form-input:focus { outline: none; border-color: var(--accent); }
.flash { padding: 0.75rem 1rem; border-radius: var(--radius); margin-bottom: 1.5rem; font-size: 0.9rem; }
.flash--success { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); color: var(--success); }
.flash--error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: var(--danger); }
.empty-state { color: var(--text-muted); text-align: center; padding: 3rem; }
.error-page { text-align: center; padding: 4rem 1rem; }
.error-page h1 { font-size: 4rem; color: var(--danger); margin-bottom: 1rem; }
```

- [ ] **Step 4: Page-spezifische CSS schreiben**

`public/css/login.css`:
```css
.login-body { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
.login-card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); padding: 2.5rem; width: 100%; max-width: 380px; box-shadow: var(--shadow); }
.login-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem; text-align: center; }
.login-form { display: flex; flex-direction: column; }
```

`public/css/dashboard.css`:
```css
.dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
.stat-card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; }
.stat-label { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem; }
.stat-value { font-size: 1.8rem; font-weight: 700; }
.latest-recording { margin-top: 2rem; }
.latest-recording h2 { font-size: 1.1rem; margin-bottom: 1rem; }
.recording-link { display: flex; align-items: center; gap: 1rem; background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); padding: 0.75rem; color: var(--text); }
.recording-link .thumb { width: 80px; height: 45px; object-fit: cover; border-radius: 4px; }
```

`public/css/archive.css`:
```css
.archive-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
.archive-count { color: var(--text-muted); font-size: 0.9rem; }
.archive-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
.recording-card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.recording-card__link { display: block; color: var(--text); }
.recording-card__thumb { width: 100%; aspect-ratio: 16/9; object-fit: cover; }
.recording-card__no-thumb { width: 100%; aspect-ratio: 16/9; background: var(--border); display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.8rem; }
.recording-card__info { padding: 0.5rem 0.75rem; }
.recording-card__date { font-size: 0.8rem; color: var(--text-muted); }
.recording-card__dur { font-size: 0.75rem; color: var(--text-muted); }
.recording-card .delete-btn { width: 100%; border-radius: 0; }
.pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 2rem; }
.video-detail { max-width: 800px; }
.video-title { margin-bottom: 1rem; }
.video-player { width: 100%; border-radius: var(--radius); background: #000; margin-bottom: 1.5rem; }
.video-meta { display: flex; flex-wrap: wrap; gap: 1rem; color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem; }
.video-actions { display: flex; gap: 0.75rem; }
```

`public/css/live.css`:
```css
.live-container { max-width: 900px; }
.live-container h1 { margin-bottom: 1rem; }
.stream-wrapper { background: #000; border-radius: var(--radius); overflow: hidden; aspect-ratio: 16/9; }
.live-img { width: 100%; height: 100%; object-fit: contain; }
.live-img--hidden { display: none; }
.stream-status { margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-muted); }
```

`public/css/settings.css`:
```css
.settings-form { max-width: 600px; }
.settings-section { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.5rem; margin-bottom: 1.5rem; }
.settings-section h2 { font-size: 1rem; margin-bottom: 1.25rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
```

- [ ] **Step 5: Commit**

```bash
git add public/css/
git commit -m "feat: dark theme CSS (base, layout, components, pages)"
```

---

## Task 15: Frontend JavaScript

**Files:**
- Create: `public/js/*.js`

- [ ] **Step 1: dashboard.js schreiben**

`public/js/dashboard.js`:
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
setInterval(refreshStats, 10_000);
```

- [ ] **Step 2: live.js schreiben**

`public/js/live.js`:
```js
const streamImg = document.getElementById('live-stream');
const snapshotImg = document.getElementById('snapshot-img');
const statusDiv = document.getElementById('stream-status');
let snapshotMode = false;
let snapshotInterval = null;

streamImg.addEventListener('error', () => {
  if (!snapshotMode) {
    snapshotMode = true;
    streamImg.classList.add('live-img--hidden');
    snapshotImg.classList.remove('live-img--hidden');
    statusDiv.textContent = 'Stream nicht verfügbar — Snapshot-Modus';
    snapshotInterval = setInterval(() => {
      snapshotImg.src = '/api/live/snapshot?' + Date.now();
    }, 3000);
  }
});

streamImg.addEventListener('load', () => {
  if (snapshotMode) {
    snapshotMode = false;
    clearInterval(snapshotInterval);
    snapshotImg.classList.add('live-img--hidden');
    streamImg.classList.remove('live-img--hidden');
    statusDiv.textContent = '';
  }
});
```

- [ ] **Step 3: archive.js schreiben**

`public/js/archive.js`:
```js
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
```

- [ ] **Step 4: settings.js schreiben**

`public/js/settings.js`:
```js
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

// Hamburger menu
document.querySelector('.hamburger')?.addEventListener('click', () => {
  document.querySelector('.main-nav')?.classList.toggle('open');
});
```

- [ ] **Step 5: Commit**

```bash
git add public/js/
git commit -m "feat: frontend JavaScript (dashboard refresh, live fallback, archive delete)"
```

---

## Task 16: Deployment Files + README

**Files:**
- Create: `config/motion.conf.example`
- Create: `scripts/motioncam.service`
- Create: `README.md`
- Create: `scripts/create-admin.js`

- [ ] **Step 1: motion.conf.example schreiben**

`config/motion.conf.example`:
```
# motion.conf — Example configuration for MotionCam
daemon off
log_level 5
videodevice /dev/video0
width 1280
height 720
framerate 15
threshold 1500
minimum_motion_frames 2
event_gap 5

# MJPEG stream on port 8081
stream_port 8081
stream_localhost on
stream_quality 75
stream_maxrate 5

# Snapshot (latest frame)
snapshot_interval 0
snapshot_filename /var/lib/motion/lastsnap
picture_output off

# Movie output: disabled — FFmpeg handles this
movie_output off

# Hooks — Node.js app must be running on port 3000
on_event_start curl -s -X POST http://localhost:3000/api/hooks/motion-start -H "X-Hook-Secret: YOUR_HOOK_SECRET"
on_event_end curl -s -X POST http://localhost:3000/api/hooks/motion-end -H "X-Hook-Secret: YOUR_HOOK_SECRET"
```

- [ ] **Step 2: systemd service schreiben**

`scripts/motioncam.service`:
```ini
[Unit]
Description=MotionCam Node.js App
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/motioncam
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
RestartSec=5
EnvironmentFile=/home/pi/motioncam/.env
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 3: Admin-Erstell-Script schreiben**

`scripts/create-admin.js`:
```js
#!/usr/bin/env node
'use strict';
require('dotenv').config();
const readline = require('readline');
const { runMigrations } = require('../src/db/migrations');
const { runSeeds } = require('../src/db/seeds');
const authService = require('../src/services/authService');

runMigrations();
runSeeds();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Username: ', (username) => {
  rl.question('Password: ', async (password) => {
    rl.close();
    try {
      await authService.createUser(username, password);
      console.log(`User "${username}" created.`);
    } catch (err) {
      console.error('Error:', err.message);
    }
    process.exit(0);
  });
});
```

- [ ] **Step 4: README.md schreiben**

`README.md`:
```markdown
# MotionCam

Self-hosted surveillance web app for Raspberry Pi 4 (DietPi), accessible via Tailscale.

## Requirements

- Node.js 20 LTS
- FFmpeg + FFprobe
- `motion` daemon

```bash
sudo apt install ffmpeg motion nodejs npm
```

## Setup

```bash
cp .env.example .env
# Edit .env with your settings

npm install

# Create first admin user
node scripts/create-admin.js

# Start
npm start
```

## Deployment (systemd)

```bash
sudo cp scripts/motioncam.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable motioncam
sudo systemctl start motioncam
```

## motion daemon config

```bash
sudo cp config/motion.conf.example /etc/motion/motion.conf
# Edit: replace YOUR_HOOK_SECRET with value from .env
sudo systemctl enable motion
sudo systemctl start motion
```

## Adding more users

```bash
node scripts/create-admin.js
```
```

- [ ] **Step 5: Alle Tests ausführen**

```bash
npx jest --no-coverage
```
Expected: All tests pass

- [ ] **Step 6: Final Commit**

```bash
git add config/ scripts/ README.md
git commit -m "feat: deployment files, motion.conf example and README"
```

---

## Task 17: Integration Smoke Test

- [ ] **Step 1: .env aus .env.example anlegen**

```bash
cp .env.example .env
# SESSION_SECRET und HOOK_SECRET setzen (für lokalen Test genügen Defaults)
```

- [ ] **Step 2: Admin-User anlegen**

```bash
node scripts/create-admin.js
# Username: admin
# Password: admin123
```

- [ ] **Step 3: App starten**

```bash
npm start
# Expected: "MotionCam running on port 3000"
```

- [ ] **Step 4: Manuell im Browser testen**

Öffne `http://localhost:3000`:
- [ ] Login-Seite erscheint
- [ ] Login mit admin/admin123 → weiterleitung zu /dashboard
- [ ] Dashboard zeigt Stats
- [ ] /live erreichbar
- [ ] /archive erreichbar (leer)
- [ ] /settings erreichbar und speicherbar

- [ ] **Step 5: Hook-Endpoint testen**

```bash
curl -s -X POST http://localhost:3000/api/hooks/motion-start \
  -H "X-Hook-Secret: change-me-32-chars-random"
# Expected: {"ok":true}
```

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "chore: complete MotionCam initial implementation"
```

---

## Alle Tests auf einmal

```bash
npx jest --no-coverage --runInBand
```

Erwartetes Ergebnis: Alle Test-Suites grün.
