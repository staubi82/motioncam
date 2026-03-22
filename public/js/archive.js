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
    const current = btn.dataset.favorite === '1';
    const next = current ? 0 : 1;
    try {
      const res = await fetch(`/api/recordings/${id}/favorite`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorite: next }),
      });
      if (res.ok) {
        btn.dataset.favorite = String(next);
        btn.textContent = next === 1 ? '⭐' : '☆';
        // If favorites filter is active and we just un-starred, remove the card
        if (next === 0 && window.location.search.includes('favorites=1')) {
          btn.closest('.recording-card').remove();
        }
      } else {
        alert('Fehler beim Aktualisieren');
      }
    } catch {
      alert('Fehler beim Aktualisieren');
    }
  });
});
