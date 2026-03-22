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
