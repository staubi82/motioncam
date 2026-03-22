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
