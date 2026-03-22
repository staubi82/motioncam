document.getElementById('test-mail-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('test-mail-btn');
  btn.disabled = true;
  btn.textContent = 'Sende…';
  try {
    const res = await fetch('/settings/test-mail', { method: 'POST' });
    const data = await res.json();
    alert(data.message);
  } catch {
    alert('Fehler beim Senden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Test-E-Mail senden';
  }
});

// Hamburger menu
document.querySelector('.hamburger')?.addEventListener('click', () => {
  document.querySelector('.main-nav')?.classList.toggle('open');
});
