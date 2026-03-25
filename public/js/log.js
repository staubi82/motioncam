'use strict';

const logList  = document.getElementById('log-list');
const liveDot  = document.getElementById('live-dot');
const filter   = new URLSearchParams(window.location.search).get('filter') || 'all';

// Track newest timestamp to only fetch new entries
let newestTs = (() => {
  const first = logList?.querySelector('.log-entry');
  if (!first) return null;
  const title = first.querySelector('.log-entry__time')?.getAttribute('title');
  return title || null;
})();

// Build an ISO string from the server-rendered "DD.MM.YYYY HH:MM:SS" title
function titleToISO(title) {
  if (!title) return null;
  // "25.03.2026 14:32:01" → "2026-03-25T14:32:01"
  const [datePart, timePart] = title.split(' ');
  if (!datePart || !timePart) return null;
  const [d, m, y] = datePart.split('.');
  return `${y}-${m}-${d}T${timePart}`;
}

// Newest ISO from first rendered entry
let newestISO = (() => {
  const first = logList?.querySelector('.log-entry');
  if (!first) return null;
  const title = first.querySelector('.log-entry__time')?.getAttribute('title');
  return titleToISO(title);
})();

async function fetchNew() {
  try {
    const url = `/log/api?filter=${filter}${newestISO ? `&since=${encodeURIComponent(newestISO)}` : ''}`;
    const res  = await fetch(url);
    if (!res.ok) return;
    const entries = await res.json();
    if (!entries.length) return;

    // Build HTML for new entries via a temp div and a fetch of the partial
    // Since we can't render EJS on client, we build it ourselves
    entries.forEach(entry => {
      const el = buildEntryEl(entry);
      el.classList.add('log-entry--new');
      logList?.prepend(el);
    });

    // Update newestISO
    const latestTs = entries[0].ts;
    newestISO = latestTs.replace(' ', 'T');

    // Flash live dot
    liveDot.classList.add('active');
    setTimeout(() => liveDot.classList.remove('active'), 2000);
  } catch {}
}

function fmt(ts) {
  const d = new Date(ts.replace(' ', 'T') + 'Z');
  return {
    date: d.toLocaleDateString('de-DE'),
    time: d.toLocaleTimeString('de-DE'),
  };
}

function buildEntryEl(e) {
  let icon, label, colorClass, detail = '';

  if (e.source === 'event') {
    const meta = (() => { try { return JSON.parse(e.meta || '{}'); } catch { return {}; } })();
    if (e.type === 'motion_start') {
      icon = iconSvg('zap');
      label = 'Bewegung erkannt';
      colorClass = 'log-entry--warning';
      if (meta.threshold) detail = `Schwelle: ${meta.threshold} px · Min. Frames: ${meta.min_frames || '–'}`;
    } else if (e.type === 'recording_complete') {
      icon = iconSvg('clock');
      label = 'Aufnahme abgeschlossen';
      colorClass = 'log-entry--success';
      if (e.duration_seconds) {
        const dur  = Math.round(e.duration_seconds);
        const size = e.file_size ? (e.file_size / 1024 / 1024).toFixed(1) + ' MB' : '';
        detail = `${dur}s` + (size ? ` · ${size}` : '');
      }
      if (e.rec_id) detail += (detail ? ' · ' : '') + `<a class="log-link" href="/videos/${e.rec_id}">Video ansehen</a>`;
    } else {
      icon = iconSvg('info');
      label = e.type;
      colorClass = 'log-entry--default';
    }
  } else {
    if (e.status === 'sent') {
      icon = iconSvg('mail');
      label = 'E-Mail gesendet';
      colorClass = 'log-entry--info';
      detail = e.recipient || '';
    } else {
      icon = iconSvg('x');
      label = 'E-Mail fehlgeschlagen';
      colorClass = 'log-entry--danger';
      detail = e.error || e.recipient || '';
    }
  }

  const { date, time } = fmt(e.ts);
  const div = document.createElement('div');
  div.className = `log-entry ${colorClass}`;
  div.innerHTML = `
    <div class="log-entry__icon">${icon}</div>
    <div class="log-entry__body">
      <span class="log-entry__label">${label}</span>
      ${detail ? `<span class="log-entry__detail">${detail}</span>` : ''}
    </div>
    <div class="log-entry__time" title="${date} ${time}">
      <span class="log-entry__date">${date}</span>
      <span class="log-entry__clock">${time}</span>
    </div>`;
  return div;
}

function iconSvg(name) {
  const icons = {
    zap:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    mail:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    x:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  };
  return icons[name] || icons.info;
}

// Only auto-refresh on page 1
const isPageOne = !window.location.search.includes('page=') || window.location.search.includes('page=1');
if (logList && isPageOne) {
  liveDot.classList.add('active');
  setInterval(fetchNew, 10000);
}
