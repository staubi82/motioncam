# Dashboard Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the MotionCam dashboard with a Modern Dark aesthetic (GitHub/Vercel-inspired), glassmorphism navbar, activity chart, system status panel, and responsive mobile layout.

**Architecture:** Pure CSS + EJS rewrite — no new frontend libraries. The activity chart is an inline SVG rendered server-side from a new `getLast7DaysActivity()` DB query. The existing `/api/system-status` polling in `dashboard.js` is preserved but updated to match new element selectors.

**Tech Stack:** Node.js, Express, EJS, better-sqlite3, vanilla CSS, inline SVG

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `public/css/base.css` | Modify | Updated CSS variables (new color palette) |
| `public/css/layout.css` | Modify | Glassmorphism navbar, bottom mobile tab bar |
| `public/css/components.css` | Modify | Status pill, avatar, badge updates |
| `public/css/dashboard.css` | Rewrite | Stat cards, chart panel, system panel, thumb grid |
| `src/views/partials/header.ejs` | Rewrite | Glassmorphism navbar markup |
| `src/views/dashboard.ejs` | Rewrite | New sections + inline SVG chart |
| `src/services/dashboardService.js` | Modify | Add `getLast7DaysActivity()` |
| `src/controllers/dashboardController.js` | Modify | Pass `last7Days` to view |
| `public/js/dashboard.js` | Modify | Update element selectors to match new markup |

---

## Task 1: Update CSS variables

**Files:**
- Modify: `public/css/base.css`

- [ ] **Step 1: Replace the `:root` block in `base.css`**

Replace the existing `:root { ... }` block with:

```css
:root {
  --bg: #0d1117;
  --panel: #161b22;
  --panel2: #1c2128;
  --border: #30363d;
  --accent: #3b82f6;
  --accent2: #6366f1;
  --accent-hover: #2563eb;
  --text: #e6edf3;
  --text-muted: #7d8590;
  --danger: #f85149;
  --success: #3fb950;
  --warning: #d29922;
  --radius: 10px;
  --shadow: 0 4px 16px rgba(0,0,0,0.5);
}
```

- [ ] **Step 2: Start the app and open the browser to verify nothing is broken**

```bash
npm start
```

Open http://localhost:3000 — page should still render, just with slightly adjusted colors.

- [ ] **Step 3: Commit**

```bash
git add public/css/base.css
git commit -m "style: update CSS variables to new dark palette"
```

---

## Task 2: Rewrite layout.css — glassmorphism navbar + mobile bottom nav

**Files:**
- Modify: `public/css/layout.css`

- [ ] **Step 1: Replace `layout.css` entirely**

```css
/* ── Header / Navbar ── */
.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(22, 27, 34, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.header-inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 1.25rem;
  height: 52px;
  display: flex;
  align-items: center;
  gap: 1rem;
}
.logo {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 0.45rem;
  text-decoration: none;
}
.logo-icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.logo-icon svg { display: block; }
.main-nav {
  display: flex;
  gap: 0.15rem;
  margin-left: 1rem;
  align-items: center;
}
.nav-link {
  padding: 0.3rem 0.7rem;
  border-radius: 6px;
  color: var(--text-muted);
  font-size: 0.83rem;
  transition: color 0.15s, background 0.15s;
}
.nav-link:hover { color: var(--text); background: var(--panel2); }
.nav-link.active {
  background: rgba(59, 130, 246, 0.15);
  color: var(--accent);
}
.header-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
/* Status pill */
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.22rem 0.6rem;
  border-radius: 99px;
  font-size: 0.72rem;
  font-weight: 600;
  border: 1px solid;
}
.status-pill--idle {
  background: rgba(63, 185, 80, 0.1);
  border-color: rgba(63, 185, 80, 0.25);
  color: var(--success);
}
.status-pill--recording {
  background: rgba(248, 81, 73, 0.1);
  border-color: rgba(248, 81, 73, 0.25);
  color: var(--danger);
}
.status-pill__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.status-pill--recording .status-pill__dot {
  animation: pill-pulse 1.2s infinite;
}
@keyframes pill-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}
/* Avatar */
.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  text-decoration: none;
  flex-shrink: 0;
}
.avatar:hover { opacity: 0.85; }

/* ── Main content ── */
.main-content {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.5rem 1rem 2rem;
}

/* ── Footer ── */
.site-footer {
  border-top: 1px solid var(--border);
  padding: 1rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.78rem;
  margin-top: 3rem;
}

/* ── Mobile bottom nav ── */
.mobile-nav { display: none; }

/* ── Hamburger (kept for JS compat, hidden on desktop) ── */
.hamburger { display: none; }

@media (max-width: 640px) {
  .main-nav { display: none; }
  .header-right .status-pill { display: none; }
  .main-content { padding: 1rem 0.75rem 5rem; }
  .mobile-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--panel);
    border-top: 1px solid var(--border);
    padding: 0.5rem 0 0.6rem;
    z-index: 200;
  }
  .mobile-nav a {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    font-size: 0.58rem;
    color: var(--text-muted);
    text-decoration: none;
    padding: 0.2rem 0;
  }
  .mobile-nav a.active { color: var(--accent); }
  .mobile-nav svg { width: 20px; height: 20px; }
}
```

- [ ] **Step 2: Verify navbar renders correctly**

Open http://localhost:3000 — the old navbar markup won't look right yet (we update the EJS in Task 5). That's fine; just confirm the CSS loads without errors in the browser console.

- [ ] **Step 3: Commit**

```bash
git add public/css/layout.css
git commit -m "style: glassmorphism navbar + mobile bottom nav CSS"
```

---

## Task 3: Update components.css — remove redundant styles

**Files:**
- Modify: `public/css/components.css`

The status pill and badge are now defined in `layout.css`. Remove the old `.badge` block and keep everything else.

- [ ] **Step 1: Remove old `.badge` and `.badge--*` rules from `components.css`**

Delete these lines from `components.css`:
```css
.badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
.badge--success { background: rgba(34,197,94,0.15); color: var(--success); }
.badge--danger { background: rgba(239,68,68,0.15); color: var(--danger); }
```

(The new `.status-pill` in `layout.css` replaces these for the dashboard. The badge classes are only used in `dashboard.ejs` which we rewrite in Task 7.)

- [ ] **Step 2: Commit**

```bash
git add public/css/components.css
git commit -m "style: remove old badge styles superseded by status-pill"
```

---

## Task 4: Rewrite dashboard.css

**Files:**
- Rewrite: `public/css/dashboard.css`

- [ ] **Step 1: Replace `dashboard.css` entirely**

```css
/* ── Page title ── */
.page-title {
  font-size: 1.15rem;
  font-weight: 600;
  margin-bottom: 1.25rem;
  color: var(--text);
}

/* ── Stat cards ── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}
.stat-card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem 1.1rem;
  position: relative;
  overflow: hidden;
}
.stat-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
}
.stat-card--blue::before   { background: linear-gradient(90deg, var(--accent), transparent); }
.stat-card--amber::before  { background: linear-gradient(90deg, var(--warning), transparent); }
.stat-card--green::before  { background: linear-gradient(90deg, var(--success), transparent); }
.stat-card--red::before    { background: linear-gradient(90deg, var(--danger), transparent); }
.stat-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.4rem;
}
.stat-value {
  font-size: 1.8rem;
  font-weight: 700;
  line-height: 1;
  color: var(--text);
}
.stat-value span { font-size: 1rem; font-weight: 400; color: var(--text-muted); }
.stat-sub {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-top: 0.35rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.stat-sub--up   { color: var(--success); }
.stat-progress {
  height: 4px;
  border-radius: 2px;
  background: var(--border);
  margin-top: 0.5rem;
  overflow: hidden;
}
.stat-progress__fill {
  height: 100%;
  border-radius: 2px;
  background: var(--success);
  transition: width 0.3s;
}

/* ── Middle row: chart + system ── */
.mid-row {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}
.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem 1.1rem;
}
.panel-title {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 1rem;
}

/* ── Activity chart (SVG) ── */
.activity-chart { width: 100%; height: 100px; }

/* ── System status bars ── */
.sys-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.65rem;
}
.sys-row:last-child { margin-bottom: 0; }
.sys-label {
  font-size: 0.73rem;
  color: var(--text-muted);
  width: 52px;
  flex-shrink: 0;
}
.sys-bar {
  flex: 1;
  height: 5px;
  border-radius: 3px;
  background: var(--border);
  overflow: hidden;
}
.sys-bar__fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
}
.sys-bar__fill--green  { background: var(--success); }
.sys-bar__fill--amber  { background: var(--warning); }
.sys-bar__fill--red    { background: var(--danger); }
.sys-bar__fill--blue   { background: var(--accent); }
.sys-val {
  font-size: 0.73rem;
  font-weight: 600;
  width: 48px;
  text-align: right;
  flex-shrink: 0;
}

/* ── Section header ── */
.section-header {
  display: flex;
  align-items: center;
  margin-bottom: 0.75rem;
}
.section-header h2 {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
}
.section-header a {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--text-muted);
  text-decoration: none;
  padding: 0.22rem 0.6rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  transition: color 0.15s, background 0.15s;
}
.section-header a:hover { color: var(--text); background: var(--panel2); }

/* ── Thumbnail grid ── */
.thumb-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}
.thumb {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background: var(--panel2);
  border: 1px solid var(--border);
  display: block;
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.thumb__empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--border);
}
.thumb__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 55%);
  opacity: 0;
  transition: opacity 0.15s;
}
.thumb:hover .thumb__overlay { opacity: 1; }
.thumb__meta {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  padding: 0.35rem 0.5rem;
  pointer-events: none;
}
.thumb__date {
  font-size: 0.65rem;
  color: #e6edf3;
  font-weight: 500;
  display: block;
}
.thumb__dur {
  font-size: 0.6rem;
  color: rgba(230, 237, 243, 0.65);
}
.thumb__star {
  position: absolute;
  top: 0.35rem;
  right: 0.35rem;
  font-size: 0.75rem;
  color: #f59e0b;
  opacity: 0;
  transition: opacity 0.15s;
  line-height: 1;
}
.thumb:hover .thumb__star { opacity: 1; }

/* ── Responsive ── */
@media (max-width: 640px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .stat-value { font-size: 1.5rem; }
  .mid-row { grid-template-columns: 1fr; }
  .thumb-grid { grid-template-columns: repeat(2, 1fr); }
}
```

- [ ] **Step 2: Commit**

```bash
git add public/css/dashboard.css
git commit -m "style: rewrite dashboard CSS — stat cards, chart, system panel, thumb grid"
```

---

## Task 5: Add getLast7DaysActivity() to dashboardService

**Files:**
- Modify: `src/services/dashboardService.js`

- [ ] **Step 1: Add the new function before `module.exports`**

```js
function getLast7DaysActivity() {
  const db = getDb();
  // Get counts grouped by date for the last 7 days
  const rows = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count
    FROM recordings
    WHERE processed = 1
      AND date(created_at) >= date('now', '-6 days')
    GROUP BY date(created_at)
  `).all();

  // Build a map: { '2026-03-22': 5, ... }
  const countMap = {};
  for (const row of rows) countMap[row.day] = row.count;

  // Generate last 7 days with German labels
  const dayLabels = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10); // 'YYYY-MM-DD'
    result.push({
      label: dayLabels[d.getDay()],
      count: countMap[iso] || 0,
      isToday: i === 0,
    });
  }
  return result;
}
```

- [ ] **Step 2: Export the new function**

Change `module.exports = { getStats };` to:
```js
module.exports = { getStats, getLast7DaysActivity };
```

- [ ] **Step 3: Commit**

```bash
git add src/services/dashboardService.js
git commit -m "feat: add getLast7DaysActivity() for 7-day recording chart"
```

---

## Task 6: Update dashboardController to pass last7Days

**Files:**
- Modify: `src/controllers/dashboardController.js`

- [ ] **Step 1: Update `showDashboard`**

Replace the existing function with:

```js
function showDashboard(req, res, next) {
  try {
    const stats = dashboardService.getStats();
    stats.last7Days = dashboardService.getLast7DaysActivity();
    res.render('dashboard', { stats, username: req.session.username });
  } catch (err) { next(err); }
}
```

- [ ] **Step 2: Verify no startup errors**

```bash
npm start
```

Check terminal — no crash. Open http://localhost:3000/dashboard — page still loads (old template, just ensuring the controller doesn't throw).

- [ ] **Step 3: Commit**

```bash
git add src/controllers/dashboardController.js
git commit -m "feat: pass last7Days data to dashboard view"
```

---

## Task 7: Rewrite header.ejs — glassmorphism navbar

**Files:**
- Rewrite: `src/views/partials/header.ejs`

The `username` variable is available in all views via `req.session.username` (passed in controller). Use the first letter as avatar initial.

- [ ] **Step 1: Replace `header.ejs` entirely**

```html
<%
  const _pages = [
    { href: '/dashboard', label: 'Dashboard', key: 'Dashboard' },
    { href: '/live',      label: 'Live',       key: 'Live' },
    { href: '/archive',   label: 'Archiv',     key: 'Archiv' },
    { href: '/settings',  label: 'Einstellungen', key: 'Einstellungen' },
  ];
  const _initial = (typeof username !== 'undefined' && username) ? username[0].toUpperCase() : 'U';
%>
<header class="site-header">
  <div class="header-inner">
    <a class="logo" href="/dashboard">
      <span class="logo-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14"/>
          <rect x="3" y="7" width="12" height="10" rx="2"/>
        </svg>
      </span>
      MotionCam
    </a>
    <nav class="main-nav">
      <% for (const p of _pages) { %>
        <a href="<%= p.href %>" class="nav-link <%= typeof title !== 'undefined' && title === p.key ? 'active' : '' %>">
          <%= p.label %>
        </a>
      <% } %>
    </nav>
    <div class="header-right">
      <span class="status-pill status-pill--idle" id="header-status-pill">
        <span class="status-pill__dot"></span>
        <span id="header-status-text">Bereit</span>
      </span>
      <a href="/logout" class="avatar" title="Abmelden (<%= typeof username !== 'undefined' ? username : '' %>)">
        <%= _initial %>
      </a>
    </div>
  </div>
</header>

<!-- Mobile bottom nav -->
<nav class="mobile-nav">
  <% for (const p of _pages) { %>
    <a href="<%= p.href %>" class="<%= typeof title !== 'undefined' && title === p.key ? 'active' : '' %>">
      <% if (p.key === 'Dashboard') { %>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
      <% } else if (p.key === 'Live') { %>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/></svg>
      <% } else if (p.key === 'Archiv') { %>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14"/><rect x="3" y="7" width="12" height="10" rx="2"/></svg>
      <% } else { %>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0112 0v2"/></svg>
      <% } %>
      <%= p.label %>
    </a>
  <% } %>
</nav>
```

- [ ] **Step 2: Verify navbar renders**

Reload http://localhost:3000 — glassmorphism navbar should appear with logo icon, nav links, status pill, and avatar.

- [ ] **Step 3: Commit**

```bash
git add src/views/partials/header.ejs
git commit -m "feat: glassmorphism navbar with status pill, avatar, mobile bottom nav"
```

---

## Task 8: Rewrite dashboard.ejs

**Files:**
- Rewrite: `src/views/dashboard.ejs`

The inline SVG chart calculates bar heights from `stats.last7Days`. Max bar height is 80px; minimum visible height is 4px.

- [ ] **Step 1: Replace `dashboard.ejs` entirely**

```html
<% title = 'Dashboard'; pageCSS = 'dashboard'; pageJS = 'dashboard'; %>

<div class="page-title">Übersicht</div>

<!-- Stat Cards -->
<div class="stats-grid">
  <div class="stat-card stat-card--blue">
    <div class="stat-label">Aufnahmen gesamt</div>
    <div class="stat-value"><%= stats.totalRecordings %></div>
    <div class="stat-sub">
      <span class="stat-sub--up">↑ <%= stats.todayCount %></span> heute
    </div>
  </div>
  <div class="stat-card stat-card--amber">
    <div class="stat-label">Gesamtdauer</div>
    <%
      const _totalMin = Math.round(stats.totalDuration / 60);
      const _h = Math.floor(_totalMin / 60);
      const _m = _totalMin % 60;
      const _avgSec = stats.totalRecordings > 0 ? Math.round(stats.totalDuration / stats.totalRecordings) : 0;
    %>
    <div class="stat-value"><%= _h %><span>h</span> <%= _m %><span>m</span></div>
    <div class="stat-sub">ø <%= Math.floor(_avgSec/60) %>m <%= _avgSec%60 %>s / Aufnahme</div>
  </div>
  <div class="stat-card stat-card--green" id="stat-disk">
    <div class="stat-label">Speicher</div>
    <div class="stat-value" id="stat-disk-val">…</div>
    <div class="stat-progress"><div class="stat-progress__fill" id="stat-disk-bar" style="width:0%"></div></div>
    <div class="stat-sub" id="stat-disk-sub"></div>
  </div>
  <div class="stat-card stat-card--green" id="stat-camera">
    <div class="stat-label">Kamera</div>
    <div class="stat-value" id="stat-camera-val" style="font-size:1.1rem;margin-top:0.2rem;">
      <%= stats.isRecording ? 'Aufnahme' : 'Bereit' %>
    </div>
    <div style="margin-top:0.4rem;">
      <span class="status-pill <%= stats.isRecording ? 'status-pill--recording' : 'status-pill--idle' %>" id="stat-camera-pill">
        <span class="status-pill__dot"></span>
        <span id="stat-camera-pill-text"><%= stats.isRecording ? 'Läuft' : 'Kein Bewegung' %></span>
      </span>
    </div>
  </div>
</div>

<!-- Middle row: Chart + System -->
<div class="mid-row">
  <!-- Activity Chart (inline SVG) -->
  <div class="panel">
    <div class="panel-title">Aufnahmen letzte 7 Tage</div>
    <%
      const _days = stats.last7Days || [];
      const _maxCount = Math.max(..._days.map(d => d.count), 1);
      const _chartH = 80;
      const _barW = 28;
      const _gap = 12;
      const _totalW = _days.length * (_barW + _gap) - _gap;
    %>
    <svg class="activity-chart" viewBox="0 0 <%= _totalW %> <%= _chartH + 20 %>" preserveAspectRatio="xMidYMid meet">
      <% _days.forEach(function(d, i) {
        const bh = Math.max(4, Math.round((d.count / _maxCount) * _chartH));
        const x = i * (_barW + _gap);
        const y = _chartH - bh;
        const opacity = d.isToday ? '1' : '0.55';
        const labelColor = d.isToday ? '#3b82f6' : '#7d8590';
        const labelWeight = d.isToday ? '600' : '400';
      %>
        <defs>
          <linearGradient id="barGrad<%= i %>" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#6366f1" stop-opacity="<%= opacity %>"/>
            <stop offset="100%" stop-color="#3b82f6" stop-opacity="<%= opacity %>"/>
          </linearGradient>
        </defs>
        <rect x="<%= x %>" y="<%= y %>" width="<%= _barW %>" height="<%= bh %>"
              rx="4" fill="url(#barGrad<%= i %>)"/>
        <text x="<%= x + _barW / 2 %>" y="<%= _chartH + 14 %>"
              text-anchor="middle" font-size="9" fill="<%= labelColor %>"
              font-weight="<%= labelWeight %>" font-family="system-ui,sans-serif">
          <%= d.label %>
        </text>
      <% }); %>
    </svg>
  </div>

  <!-- System Status -->
  <div class="panel">
    <div class="panel-title">System</div>
    <div class="sys-row">
      <span class="sys-label">CPU</span>
      <div class="sys-bar"><div class="sys-bar__fill sys-bar__fill--amber" id="sys-cpu-bar" style="width:0%"></div></div>
      <span class="sys-val" id="sys-cpu-val">…</span>
    </div>
    <div class="sys-row">
      <span class="sys-label">RAM</span>
      <div class="sys-bar"><div class="sys-bar__fill sys-bar__fill--blue" id="sys-ram-bar" style="width:0%"></div></div>
      <span class="sys-val" id="sys-ram-val">…</span>
    </div>
    <div class="sys-row">
      <span class="sys-label">Disk</span>
      <div class="sys-bar"><div class="sys-bar__fill sys-bar__fill--green" id="sys-disk-bar" style="width:0%"></div></div>
      <span class="sys-val" id="sys-disk-val2">…</span>
    </div>
    <div class="sys-row">
      <span class="sys-label">Temp</span>
      <div class="sys-bar"><div class="sys-bar__fill sys-bar__fill--amber" id="sys-temp-bar" style="width:0%"></div></div>
      <span class="sys-val" id="sys-temp-val">…</span>
    </div>
  </div>
</div>

<!-- Latest Recordings -->
<% if (stats.latestRecordings && stats.latestRecordings.length > 0) { %>
  <div class="section-header">
    <h2>Letzte Aufnahmen</h2>
    <a href="/archive">Alle ansehen →</a>
  </div>
  <div class="thumb-grid">
    <% for (const rec of stats.latestRecordings) { %>
      <a href="/videos/<%= rec.id %>" class="thumb">
        <% if (rec.thumbnail_path) { %>
          <img src="/thumbnails/<%= rec.thumbnail_path.split('/').pop() %>" alt="" loading="lazy">
        <% } else { %>
          <div class="thumb__empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14"/>
              <rect x="3" y="7" width="12" height="10" rx="2"/>
            </svg>
          </div>
        <% } %>
        <div class="thumb__overlay"></div>
        <div class="thumb__meta">
          <span class="thumb__date"><%= new Date(rec.created_at).toLocaleString('de-DE', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) %></span>
          <% if (rec.duration_seconds) { %>
            <span class="thumb__dur"><%= Math.floor(rec.duration_seconds/60) %>:<%= String(rec.duration_seconds%60).padStart(2,'0') %></span>
          <% } %>
        </div>
        <span class="thumb__star">★</span>
      </a>
    <% } %>
  </div>
<% } %>

<!-- Favorites -->
<% if (stats.favoriteRecordings && stats.favoriteRecordings.length > 0) { %>
  <div class="section-header">
    <h2>Favoriten ★</h2>
    <a href="/archive?favorites=1">Alle Favoriten →</a>
  </div>
  <div class="thumb-grid">
    <% for (const rec of stats.favoriteRecordings) { %>
      <a href="/videos/<%= rec.id %>" class="thumb">
        <% if (rec.thumbnail_path) { %>
          <img src="/thumbnails/<%= rec.thumbnail_path.split('/').pop() %>" alt="" loading="lazy">
        <% } else { %>
          <div class="thumb__empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14"/>
              <rect x="3" y="7" width="12" height="10" rx="2"/>
            </svg>
          </div>
        <% } %>
        <div class="thumb__overlay"></div>
        <div class="thumb__meta">
          <span class="thumb__date"><%= new Date(rec.created_at).toLocaleString('de-DE', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) %></span>
        </div>
        <span class="thumb__star">★</span>
      </a>
    <% } %>
  </div>
<% } %>
```

- [ ] **Step 2: Verify the page renders correctly**

Open http://localhost:3000/dashboard — all sections should appear with the new design. Check:
- 4 stat cards visible with colored top borders
- Activity chart SVG bars visible
- System status rows show "…" (updated by JS after load)
- Thumbnail grids render (or empty state icons if no recordings)

- [ ] **Step 3: Commit**

```bash
git add src/views/dashboard.ejs
git commit -m "feat: rewrite dashboard template — stat cards, SVG chart, system panel, thumb grid"
```

---

## Task 9: Update dashboard.js — new element selectors

**Files:**
- Modify: `public/js/dashboard.js`

The new markup uses different element IDs. Update the JS to match.

- [ ] **Step 1: Replace `dashboard.js` entirely**

```js
// ── Helpers ──────────────────────────────────────────────
function pct(used, total) {
  return total > 0 ? Math.round((used / total) * 100) : 0;
}
function barColor(p) {
  return p > 80 ? 'red' : p > 60 ? 'amber' : 'green';
}
function setBar(barEl, valEl, value, unit, percent) {
  if (barEl) {
    barEl.style.width = percent + '%';
    // swap color class
    barEl.className = barEl.className.replace(/sys-bar__fill--\w+/, '');
    const col = barColor(percent);
    if (col) barEl.classList.add('sys-bar__fill--' + col);
  }
  if (valEl) valEl.textContent = value + (unit || '');
}

// ── Camera / recording status ─────────────────────────────
async function refreshStatus() {
  try {
    const res = await fetch('/api/dashboard/stats');
    if (!res.ok) return;
    const s = await res.json();
    const recording = s.isRecording;

    // Header pill
    const pill = document.getElementById('header-status-pill');
    const pillText = document.getElementById('header-status-text');
    if (pill) {
      pill.className = 'status-pill ' + (recording ? 'status-pill--recording' : 'status-pill--idle');
      if (pillText) pillText.textContent = recording ? 'Aufnahme läuft' : 'Bereit';
    }

    // Camera stat card
    const camVal = document.getElementById('stat-camera-val');
    const camPill = document.getElementById('stat-camera-pill');
    const camPillText = document.getElementById('stat-camera-pill-text');
    if (camVal) camVal.textContent = recording ? 'Aufnahme' : 'Bereit';
    if (camPill) camPill.className = 'status-pill ' + (recording ? 'status-pill--recording' : 'status-pill--idle');
    if (camPillText) camPillText.textContent = recording ? 'Läuft' : 'Kein Bewegung';

    // Camera card border color
    const camCard = document.getElementById('stat-camera');
    if (camCard) {
      camCard.classList.remove('stat-card--green', 'stat-card--red');
      camCard.classList.add(recording ? 'stat-card--red' : 'stat-card--green');
    }
  } catch {}
}

// ── System status ─────────────────────────────────────────
async function refreshSystem() {
  try {
    const res = await fetch('/api/system-status');
    if (!res.ok) return;
    const s = await res.json();

    // CPU
    setBar(
      document.getElementById('sys-cpu-bar'),
      document.getElementById('sys-cpu-val'),
      s.cpuPercent, '%', s.cpuPercent
    );
    // RAM
    const ramPct = pct(s.ramUsedMB, s.ramTotalMB);
    setBar(
      document.getElementById('sys-ram-bar'),
      document.getElementById('sys-ram-val'),
      ramPct, '%', ramPct
    );
    // Disk (system panel bar + stat card)
    if (s.diskTotalMB) {
      const diskPct = pct(s.diskUsedMB, s.diskTotalMB);
      setBar(
        document.getElementById('sys-disk-bar'),
        document.getElementById('sys-disk-val2'),
        diskPct, '%', diskPct
      );
      // Stat card
      const diskVal = document.getElementById('stat-disk-val');
      const diskBar = document.getElementById('stat-disk-bar');
      const diskSub = document.getElementById('stat-disk-sub');
      if (diskVal) diskVal.textContent = diskPct + '%';
      if (diskBar) diskBar.style.width = diskPct + '%';
      const freeMB = s.diskTotalMB - s.diskUsedMB;
      if (diskSub) diskSub.textContent = (freeMB > 1024 ? (freeMB / 1024).toFixed(1) + ' GB' : freeMB + ' MB') + ' frei';
    }
    // Temp
    if (s.tempCelsius !== null) {
      const tempPct = Math.min(100, Math.round((s.tempCelsius / 85) * 100)); // 85°C = 100%
      setBar(
        document.getElementById('sys-temp-bar'),
        document.getElementById('sys-temp-val'),
        s.tempCelsius, '°C', tempPct
      );
    }
  } catch {}
}

// ── Init ──────────────────────────────────────────────────
refreshStatus();
refreshSystem();
setInterval(refreshStatus, 10_000);
setInterval(refreshSystem, 10_000);
```

- [ ] **Step 2: Full verification**

Open http://localhost:3000/dashboard and check:
- After ~1s the system stat bars fill with real values (CPU %, RAM %, Disk %, Temp)
- Header status pill shows "Bereit" (green) or "Aufnahme läuft" (red, pulsing)
- Camera stat card updates to match
- On mobile viewport (DevTools → 375px wide): 2×2 stat grid, 2-col thumbnails, bottom tab bar visible

- [ ] **Step 3: Commit**

```bash
git add public/js/dashboard.js
git commit -m "feat: update dashboard.js selectors for new markup, improve system bar colors"
```

---

## Task 10: Final check + push

- [ ] **Step 1: Smoke test all pages**

Navigate to each page to confirm no regressions:
- `/dashboard` — new design ✓
- `/live` — still works ✓
- `/archive` — still works ✓
- `/settings` — still works ✓
- `/login` (log out first) — still works ✓

- [ ] **Step 2: Mobile check**

Open DevTools → toggle device toolbar → iPhone 12 (390px). Verify:
- Bottom tab bar visible and usable
- Stats in 2×2 grid
- Thumbnails in 2-column grid
- No horizontal overflow

- [ ] **Step 3: Push**

```bash
git push
```
