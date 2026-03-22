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
