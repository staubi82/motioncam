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
    if (camPillText) camPillText.textContent = recording ? 'Läuft' : 'Keine Bewegung';

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
        document.getElementById('sys-disk-val'),
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
