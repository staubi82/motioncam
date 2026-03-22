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
    function setValue(card, text) {
      const el = card && card.querySelector('.stat-value');
      if (el) el.textContent = text;
    }
    setValue(document.getElementById('stat-cpu'),  s.cpuPercent + '%');
    setValue(document.getElementById('stat-ram'),  s.ramUsedMB + ' / ' + s.ramTotalMB + ' MB');
    setValue(document.getElementById('stat-temp'), s.tempCelsius !== null ? s.tempCelsius + '°C' : '-');
    setValue(document.getElementById('stat-disk'), s.diskTotalMB ? s.diskUsedMB + ' / ' + s.diskTotalMB + ' MB' : s.diskUsedMB + ' MB');
  } catch {}
}

setInterval(refreshStats, 10_000);
setInterval(refreshSystemStatus, 10_000);
refreshStats();
refreshSystemStatus(); // immediate first load
