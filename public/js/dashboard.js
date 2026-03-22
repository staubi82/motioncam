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
