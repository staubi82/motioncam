# MotionCam — Design Specification
**Date:** 2026-03-21
**Status:** Approved by user

---

## 1. Overview

MotionCam is a self-hosted, production-ready surveillance web application designed to run on a Raspberry Pi 4 (DietPi), accessible exclusively via Tailscale. It provides motion-triggered video recording with audio, live streaming, a web-based archive, email notifications, and full configuration via a dark, responsive web UI.

**Design goals:**
- Secure (login required, session-based auth, bcrypt passwords)
- Pi-efficient (no unnecessary CPU/RAM usage)
- Modular codebase (many small files, clear separation of concerns)
- No auto-delete (recordings persist until manually deleted)
- Deployable as systemd service

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 LTS |
| Web Framework | Express.js |
| Template Engine | EJS (with partials) via `express-ejs-layouts` |
| Database | SQLite via `better-sqlite3` |
| Auth | `express-session` + `bcrypt` + `session-file-store` |
| Motion Detection | `motion` daemon (systemd service) |
| Video Recording | FFmpeg (Node-controlled) |
| Post-Processing | FFprobe + FFmpeg |
| Mail | Nodemailer (SMTP) |
| Live Stream | MJPEG (from motion, proxied via Node) + snapshot fallback |
| MJPEG Proxy | Manual `http.get` pipe (no extra package needed) |
| Styling | Vanilla CSS (modular files) |
| Frontend JS | Vanilla ES modules (no build step) |

---

## 3. System Architecture

### Component Responsibilities

**`motion` daemon (systemd)**
- Accesses camera via V4L2 (`/dev/video0`)
- Performs frame-diff motion detection
- Provides MJPEG live stream (port 8081)
- Fires HTTP hooks on events:
  - `on_event_start` → `POST /api/hooks/motion-start`
  - `on_event_end` → `POST /api/hooks/motion-end`
- Does NOT handle MP4 recording (that is FFmpeg's job)

**Node.js App**
- Receives hooks → triggers FFmpeg recording start/stop
- Manages nachlaufzeit (post-motion recording delay) via timer
- Stores events and recordings in SQLite
- Sends email notifications via SMTP
- Serves web UI (EJS templates)
- Manages all settings (persisted in SQLite `settings` table)
- Streams MJPEG from motion to browser (proxy)
- Serves snapshots as fallback

**FFmpeg (child_process)**
- Started by Node on `motion-start`
- Records MP4 with H.264 video + AAC audio from Logitech C920
- Stopped by Node after nachlaufzeit expires
- Command: `ffmpeg -f v4l2 -i ${camera_device} -f alsa -i ${audio_device} -c:v libx264 -preset fast -b:v ${video_bitrate} -r ${video_fps} -s ${video_resolution} -c:a aac -b:a ${audio_bitrate} -movflags +faststart YYYY-MM-DD_HH-mm-ss.mp4`
- Default values: `camera_device=/dev/video0`, `audio_device=hw:1,0`

**FFprobe / FFmpeg (post-processing)**
- Run after recording completes
- Extract: duration, resolution, codec, file size
- Generate thumbnail from middle of video:
  `ffmpeg -ss [duration/2] -i input.mp4 -vframes 1 -q:v 2 thumbnail.jpg`

**File Watcher (safety net)**
- Node `chokidar` watches recordings directory
- If a new `.mp4` appears without a corresponding DB entry → creates entry automatically
- Does not replace hook-based flow; only fills gaps

### Event Flow: Motion Detected

```
Camera → motion detects movement
       → POST /api/hooks/motion-start (with hook secret)
       → Node: create event record, spawn FFmpeg, send mail (if enabled)
       → FFmpeg writes YYYY-MM-DD_HH-mm-ss.mp4

       → POST /api/hooks/motion-end
       → Node: start nachlaufzeit timer (configurable, default 30s)
       → After timer: kill FFmpeg gracefully (SIGINT)
       → Post-processing: FFprobe metadata + FFmpeg thumbnail
       → Update SQLite recording record
```

### Hook Authentication

Motion hooks include a shared secret header (`X-Hook-Secret`) validated by Node middleware. The secret is set in `.env` and configured in `motion.conf`.

---

## 4. Project Structure

```
motion/
├── src/
│   ├── app.js                    # Express app setup
│   ├── server.js                 # HTTP server entry point
│   ├── config/
│   │   └── index.js              # Env + defaults loader
│   ├── db/
│   │   ├── index.js              # DB connection singleton
│   │   ├── migrations.js         # Schema creation / migrations
│   │   └── seeds.js              # Default settings seed
│   ├── routes/
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   ├── live.js
│   │   ├── archive.js
│   │   ├── videos.js
│   │   ├── settings.js
│   │   ├── hooks.js              # motion webhook endpoints
│   │   └── api.js                # JSON API (snapshots etc.)
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── dashboardController.js
│   │   ├── liveController.js
│   │   ├── archiveController.js
│   │   ├── videoController.js
│   │   ├── settingsController.js
│   │   ├── hooksController.js        # Handles motion-start / motion-end hooks
│   │   └── apiController.js          # Handles JSON API endpoints
│   ├── services/
│   │   ├── authService.js
│   │   ├── settingsService.js
│   │   ├── motionService.js      # Communicates with motion daemon
│   │   ├── ffmpegService.js      # Spawn/stop FFmpeg recording
│   │   ├── recordingService.js   # Recording lifecycle + DB
│   │   ├── thumbnailService.js   # FFprobe + thumbnail generation
│   │   ├── mailService.js        # Nodemailer + cooldown logic
│   │   ├── storageService.js     # Disk usage, file ops
│   │   ├── watcherService.js     # chokidar file watcher (fallback)
│   │   └── dashboardService.js   # Aggregate stats for dashboard
│   ├── middleware/
│   │   ├── auth.js               # requireLogin middleware
│   │   ├── hookAuth.js           # Hook secret validation
│   │   └── errorHandler.js
│   └── views/
│       ├── partials/
│       │   ├── header.ejs
│       │   ├── footer.ejs
│       │   └── flash.ejs         # Success/error messages
│       ├── layouts/
│       │   └── main.ejs          # Base layout wrapping all pages
│       ├── login.ejs
│       ├── dashboard.ejs
│       ├── live.ejs
│       ├── archive.ejs
│       ├── video.ejs             # Video detail / player
│       └── settings.ejs
├── public/
│   ├── css/
│   │   ├── base.css              # Reset, variables, typography
│   │   ├── layout.css            # Header, footer, main layout
│   │   ├── components.css        # Cards, buttons, forms, badges
│   │   ├── dashboard.css
│   │   ├── archive.css
│   │   ├── live.css
│   │   ├── settings.css
│   │   └── login.css
│   ├── js/
│   │   ├── archive.js            # Filter, delete confirm
│   │   ├── live.js               # Stream / snapshot refresh
│   │   ├── settings.js           # Test mail, form interactions
│   │   └── dashboard.js          # Auto-refresh stats
│   ├── uploads/                  # MP4 recordings
│   └── thumbnails/               # Generated thumbnails
├── data/
│   └── motioncam.db              # SQLite database
├── config/
│   └── motion.conf.example       # Example motion daemon config
├── scripts/
│   └── motioncam.service         # systemd unit file
├── .env.example
├── package.json
└── README.md
```

---

## 5. Database Schema

### `users`
```sql
CREATE TABLE users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,             -- bcrypt hash
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  last_login  TEXT
);
```

### `settings`
```sql
CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
```
Key/value pairs for all configurable settings. Loaded at startup, cached in memory, invalidated on change.

### `recordings`
```sql
CREATE TABLE recordings (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  filename         TEXT NOT NULL UNIQUE,
  filepath         TEXT NOT NULL,
  thumbnail_path   TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  duration_seconds REAL,
  file_size        INTEGER,              -- bytes
  width            INTEGER,
  height           INTEGER,
  has_audio        INTEGER NOT NULL DEFAULT 1,
  event_id         INTEGER REFERENCES events(id),
  processed        INTEGER NOT NULL DEFAULT 0
);
```

### `events`
```sql
CREATE TABLE events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  type         TEXT NOT NULL,            -- 'motion_start' | 'motion_end' | 'recording_complete'
  occurred_at  TEXT NOT NULL DEFAULT (datetime('now')),
  meta         TEXT                      -- JSON blob (coordinates, frame delta, etc.)
);
```

### `notifications`
```sql
CREATE TABLE notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type       TEXT NOT NULL,              -- 'email'
  sent_at    TEXT NOT NULL DEFAULT (datetime('now')),
  recipient  TEXT,
  subject    TEXT,
  status     TEXT NOT NULL,             -- 'sent' | 'failed'
  error      TEXT
);
```

---

## 6. Settings (Key/Value Store)

All settings stored in `settings` table. Default values seeded on first run.

### Detection
| Key | Default | Description |
|---|---|---|
| `detection_enabled` | `true` | Motion detection on/off — applied by rewriting `motion.conf` and sending SIGHUP to daemon |
| `detection_sensitivity` | `50` | Threshold (1–100) mapped to motion's `threshold` param — applied via conf rewrite |
| `detection_min_area` | `500` | Mapped to motion's `minimum_motion_frames` — applied via conf rewrite |
| `event_cooldown_seconds` | `60` | Min seconds between recording events; enforced in `recordingService` (if last event was within cooldown, hook is ignored) |

### Recording
| Key | Default | Description |
|---|---|---|
| `recording_enabled` | `true` | Auto-record on motion |
| `recording_nachlaufzeit_seconds` | `30` | Post-motion recording tail |
| `video_fps` | `15` | FPS |
| `video_resolution` | `1280x720` | Resolution |
| `video_bitrate` | `2000k` | Video bitrate |
| `audio_enabled` | `true` | Record audio |
| `audio_bitrate` | `128k` | Audio bitrate |
| `storage_path` | from `VIDEO_PATH` env | MP4 storage path (seeded from `.env` at first run) |
| `thumbnail_path` | from `THUMBNAIL_PATH` env | Thumbnail path (seeded from `.env` at first run) |
| `snapshot_path` | from `SNAPSHOT_PATH` env | Path where motion writes latest snapshot JPEG |
| `camera_device` | from `CAMERA_DEVICE` env | V4L2 device |
| `audio_device` | from `AUDIO_DEVICE` env | ALSA device |

### Mail
| Key | Default | Description |
|---|---|---|
| `mail_enabled` | `false` | Email notifications |
| `mail_cooldown_seconds` | `300` | Min time between mails |
| `mail_snapshot_attach` | `true` | Attach snapshot to mail |
| `smtp_host` | `` | SMTP server |
| `smtp_port` | `587` | SMTP port |
| `smtp_user` | `` | SMTP username |
| `smtp_pass` | `` | SMTP password (stored encrypted) |
| `smtp_tls` | `true` | Use TLS |
| `smtp_from` | `` | From address |
| `mail_recipient` | `` | To address |

---

## 7. UI Pages & Routes

| Route | Page | Auth Required |
|---|---|---|
| `GET /login` | Login form | No |
| `POST /login` | Login handler | No |
| `GET /logout` | Logout | Yes |
| `GET /` → redirect `/dashboard` | — | Yes |
| `GET /dashboard` | Dashboard | Yes |
| `GET /live` | Live stream page | Yes |
| `GET /archive` | Archive grid (2×4, paginated) | Yes |
| `GET /videos/:id` | Video detail / player | Yes |
| `DELETE /videos/:id` | Delete recording | Yes |
| `GET /videos/:id/download` | Serve MP4 file | Yes |
| `GET /settings` | Settings page | Yes |
| `POST /settings` | Save settings | Yes |
| `POST /settings/test-mail` | Send test mail | Yes |
| `POST /settings/password` | Change password | Yes |

### Internal / API Routes
| Route | Description |
|---|---|
| `POST /api/hooks/motion-start` | Receives motion-start from motion daemon |
| `POST /api/hooks/motion-end` | Receives motion-end from motion daemon |
| `GET /api/live/stream` | Proxy MJPEG stream from motion |
| `GET /api/live/snapshot` | Serve latest JPEG snapshot |
| `GET /api/dashboard/stats` | JSON stats for dashboard auto-refresh |

---

## 8. Live View

- **Primary**: MJPEG proxy from `motion` (port `MOTION_STREAM_PORT`, default 8081) served via `/api/live/stream`
  - Proxied through Node using manual `http.get()` pipe — no extra package needed
  - Sets `Content-Type: multipart/x-mixed-replace` header for browser compatibility
- **Fallback**: If MJPEG stream unreachable (connection refused / timeout), the live page auto-switches to snapshot refresh mode
  - Polls `/api/live/snapshot` every 3 seconds via `setInterval`
  - Node reads the file at `snapshot_path` (written by motion's `snapshot_filename` config) and serves it as JPEG

---

## 9. Recording Lifecycle

```
1. Hook received: POST /api/hooks/motion-start
2. recordingService.startRecording()
   - Determine filename: YYYY-MM-DD_HH-mm-ss.mp4
   - ffmpegService.spawn(filename, settings)
   - Create DB entry (recordings) with processed=0
   - Create DB entry (events)
   - mailService.notifyIfEnabled() (with cooldown check)
3. Hook received: POST /api/hooks/motion-end
   - recordingService.scheduleStop() — starts nachlaufzeit timer
4. Timer expires
   - ffmpegService.stop() — SIGINT to FFmpeg
5. FFmpeg exits cleanly
   - thumbnailService.process(filepath)
     - ffprobe → duration, resolution, codec
     - ffmpeg → thumbnail at duration/2
   - Update DB record (duration, thumbnail_path, file_size, processed=1)
6. File watcher fallback
   - If new .mp4 found in directory without DB entry → auto-create entry
   - Triggers thumbnailService.process()
```

---

## 10. Mail Notification

- Uses **Nodemailer** with configurable SMTP
- Cooldown tracked via in-memory timestamp + `notifications` table
- Email content:
  - Subject: `[MotionCam] Bewegung erkannt – DD.MM.YYYY HH:mm`
  - Body: timestamp, duration estimate, link to archive
  - Optional: inline snapshot attachment
- Test mail sends immediately, ignoring cooldown
- SMTP password stored as plaintext in SQLite (acceptable for local/private use); user is warned in UI

---

## 11. Security

- All routes except `/login` protected by `requireLogin` middleware
- Passwords hashed with **bcrypt** (rounds: 12)
- Sessions via **express-session** with:
  - `httpOnly: true`
  - `sameSite: 'lax'`
  - Session secret from `.env`
  - 24h TTL (configurable)
  - File store via `session-file-store` (survives restarts)
- Hook endpoint protected by `X-Hook-Secret` header
- No public ports; designed for Tailscale-only access
- Rate limiting on `/login` (5 attempts per minute via `express-rate-limit`)

---

## 12. Design System

- **Color scheme**: Dark — `#0a0a0c` background, `#111117` panels, `#3b82f6` accent
- **Typography**: System font stack, clear hierarchy
- **Components**: Cards, badges, buttons consistent across pages
- **Responsive**: Mobile-first CSS, top-nav collapses to hamburger on small screens
- **Feedback**: Flash messages (success/error) in `flash.ejs` partial
- **Loading states**: Spinner for async actions (test mail, delete)

---

## 13. Deployment

### Requirements (Raspberry Pi 4 / DietPi)
```bash
sudo apt install ffmpeg motion nodejs npm
```
Node.js 20 LTS via NodeSource.

### Path Precedence Rule
`.env` values are used as **seed defaults** when the `settings` table is first populated. At runtime, `settingsService` reads from the database — the `settings` table always takes precedence. If a user changes a path in the UI, the DB value is used. `.env` is only the initial source of truth.

### Environment (`.env`)
```
PORT=3000
SESSION_SECRET=<random-64-char>
DB_PATH=/home/pi/motioncam/data/motioncam.db
VIDEO_PATH=/home/pi/motioncam/public/uploads
THUMBNAIL_PATH=/home/pi/motioncam/public/thumbnails
SNAPSHOT_PATH=/var/lib/motion/lastsnap.jpg
CAMERA_DEVICE=/dev/video0
AUDIO_DEVICE=hw:1,0
MOTION_STREAM_PORT=8081
MOTION_CONF_PATH=/etc/motion/motion.conf
HOOK_SECRET=<random-32-char>
APP_BASE_URL=http://your-tailscale-hostname:3000
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

### systemd Service
- `scripts/motioncam.service` — manages the Node process
- `motion` runs as its own systemd service (installed by `apt`)
- `motion` configured to call Node hooks via `on_event_start` / `on_event_end`

---

## 14. Pragmatic Decisions

1. **No real-time WebSocket for events** — dashboard auto-refreshes via polling (`/api/dashboard/stats`) every 10s. Keeps architecture simple.
2. **SMTP password stored in SQLite** — acceptable given Tailscale-only access. A warning is shown in the settings UI.
3. **No multi-user management UI** — DB schema supports multiple users; password change works for current user only. Adding users requires a one-time CLI script (documented in README).
4. **No video transcoding on the fly** — MP4/H.264 plays natively in all modern browsers via HTML5 `<video>`.
5. **Archive pagination** — server-side, 8 per page (2×4 grid). No lazy loading to keep JS minimal.
6. **chokidar for file watching** — reliable, cross-platform, minimal footprint.
7. **EJS layouts via `express-ejs-layouts`** — wraps all pages in `layouts/main.ejs` automatically, with `header.ejs` and `footer.ejs` as partials.
