# MotionCam Dashboard Overhaul – Design Spec

**Date:** 2026-03-22
**Status:** Approved by user

---

## Overview

Complete visual and structural overhaul of the MotionCam dashboard. The goal is a professional, modern dark UI that looks great on both desktop and mobile. The existing functional structure (stat cards, latest recordings, favorites) is preserved and enhanced with new sections and better information density.

---

## Design Direction

**Style:** Modern Dark — GitHub/Vercel/Linear inspired. Dark background (`#0d1117`), slightly lighter card surfaces (`#161b22`), subtle gradients on cards, colored accent lines as visual cues. No external CSS framework or component library.

**Color palette (updated CSS variables):**

| Variable | Value | Usage |
|---|---|---|
| `--bg` | `#0d1117` | Page background |
| `--panel` | `#161b22` | Card / nav background |
| `--panel2` | `#1c2128` | Nested elements |
| `--border` | `#30363d` | Borders |
| `--accent` | `#3b82f6` | Primary blue |
| `--accent2` | `#6366f1` | Secondary indigo (gradients) |
| `--text` | `#e6edf3` | Primary text |
| `--text-muted` | `#7d8590` | Secondary text |
| `--success` | `#3fb950` | Green |
| `--danger` | `#f85149` | Red |
| `--warning` | `#d29922` | Amber |

---

## Components

### 1. Navbar (Glassmorphism)

**Desktop:**
- `position: sticky; top: 0` — blurs content scrolling beneath
- `background: rgba(22,27,34,0.75); backdrop-filter: blur(12px)`
- `border-bottom: 1px solid rgba(255,255,255,0.06)`
- **Logo:** SVG camera icon with blue→indigo gradient background, "MotionCam" text
- **Nav links:** Dashboard / Live / Archiv / Einstellungen — active state: `rgba(59,130,246,0.15)` background + blue text
- **Right side:** Status-Pill (green "Bereit" / red pulsing "Aufnahme läuft") + Avatar circle (initial letter, gradient background, hover shows "Abmelden")

**Mobile (≤ 640px):**
- Desktop nav hidden
- Fixed bottom tab bar with SVG icons + labels: Dashboard / Live / Archiv / Profil
- Active tab uses accent color, others use muted

### 2. Stat Cards (4-column grid → 2×2 on mobile)

Each card has a 2px colored top border as visual type indicator:

| Card | Top border | Special element |
|---|---|---|
| Aufnahmen gesamt | Blue | `↑ N heute` trend text |
| Gesamtdauer | Amber | `ø X min / Aufnahme` sub-text |
| Speicher | Green | Progress bar (% used) + GB free |
| Kamera-Status | Green/Red | Status pill (pulsing dot when recording) |

### 3. Middle Row (2-column → stacks on mobile)

**Left — Aktivitäts-Chart (SVG, inline):**
- 7 bar chart rendered as inline SVG in `dashboard.ejs`
- Data: `last7Days` array from controller — `[{label: 'Mo', count: 5}, ...]`
- Bars use blue→indigo gradient fill; today's bar is full opacity, others 70%
- Day labels below each bar; today's label in accent color
- No external library — pure SVG with calculated heights

**Right — System Status panel:**
- CPU / RAM / Disk / Temp as labeled progress bars
- Color-coded: green < 60%, amber 60–80%, red > 80%
- Values pulled from existing `systemService` API (already polled by `dashboard.js` frontend script)

### 4. Latest Recordings (4-column → 2-column on mobile)

- Thumbnail grid, `aspect-ratio: 16/9` per thumb
- On hover: gradient overlay slides up from bottom with date + duration
- Top-right star icon on hover (for quick-favorite, future feature)
- "Alle ansehen →" link top-right of section header

### 5. Favorites (4-column → 2-column on mobile)

- Same thumbnail component as latest recordings
- Section only rendered if favorites exist (existing behavior preserved)
- "Alle Favoriten →" link

---

## Data Changes

### `dashboardService.js` — new function: `getLast7DaysActivity()`

```js
// Returns array of 7 objects: [{label: 'Mo', count: N}, ...]
// SQL: GROUP BY date(created_at) for last 7 days
// Fill missing days with count: 0
// Labels in German: Mo Di Mi Do Fr Sa So
```

### `dashboardController.js`

Add `last7Days` to the stats object passed to the view:

```js
stats.last7Days = await dashboardService.getLast7DaysActivity();
```

---

## Files Changed

| File | Change |
|---|---|
| `public/css/base.css` | Updated CSS variables (new palette) |
| `public/css/layout.css` | Glassmorphism navbar, sticky, bottom mobile nav |
| `public/css/components.css` | Status pill, avatar, badge updates |
| `public/css/dashboard.css` | Full rewrite — stat cards, chart panel, system panel, thumb grid |
| `src/views/partials/header.ejs` | New navbar markup with camera icon, status pill, avatar |
| `src/views/dashboard.ejs` | Full rewrite with new sections and inline SVG chart |
| `src/services/dashboardService.js` | Add `getLast7DaysActivity()` |
| `src/controllers/dashboardController.js` | Pass `last7Days` to view |

---

## Responsive Behavior

| Breakpoint | Layout |
|---|---|
| > 640px | 4-col stats, 2-col mid row, 4-col thumbs, top navbar |
| ≤ 640px | 2×2 stats, 1-col mid row, 2-col thumbs, bottom tab bar |

---

## Out of Scope

- Actual favorite-toggle interaction on thumbnail hover (star button is visual only for now)
- Dark/light mode toggle
- Animated chart transitions
- Other pages (Live, Archiv, Einstellungen) — only Dashboard is changed
