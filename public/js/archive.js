// Delete buttons
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

// Star (favorite) buttons
document.querySelectorAll('.star-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const id = btn.dataset.id;
    const current = parseInt(btn.dataset.favorite, 10);
    const next = current === 1 ? 0 : 1;
    const res = await fetch(`/api/recordings/${id}/favorite`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_favorite: next }),
    });
    if (res.ok) {
      btn.dataset.favorite = next;
      btn.textContent = next === 1 ? '⭐' : '☆';
    }
  });
});
