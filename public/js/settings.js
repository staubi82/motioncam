'use strict';

// Slider live value display
document.querySelectorAll('input[type=range]').forEach(slider => {
  const display = slider.closest('.slider-wrapper')?.querySelector('.slider-value');
  if (display) {
    const unit = slider.dataset.unit || '';
    display.textContent = slider.value + unit;
    slider.addEventListener('input', () => {
      display.textContent = slider.value + unit;
    });
  }
});

// Position tiles
const positionInput = document.getElementById('overlay_position');
document.querySelectorAll('.position-tile').forEach(tile => {
  tile.addEventListener('click', () => {
    document.querySelectorAll('.position-tile').forEach(t => t.classList.remove('active'));
    tile.classList.add('active');
    if (positionInput) positionInput.value = tile.dataset.position;
  });
});

// Detection profile presets
document.getElementById('apply-detection-profile')?.addEventListener('click', () => {
  const profile = document.getElementById('detection-profile-select')?.value;
  const presets = {
    indoor_less_false_alarms: {
      detection_min_area: 900,
      detection_min_frames: 6,
      detection_lightswitch_percent: 40,
      event_cooldown_seconds: 120,
    },
    balanced: {
      detection_min_area: 650,
      detection_min_frames: 4,
      detection_lightswitch_percent: 25,
      event_cooldown_seconds: 60,
    },
    high_sensitivity: {
      detection_min_area: 400,
      detection_min_frames: 3,
      detection_lightswitch_percent: 15,
      event_cooldown_seconds: 30,
    },
  };

  const selected = presets[profile];
  if (!selected) return;

  const setField = (name, value) => {
    const field = document.querySelector(`[name="${name}"]`);
    if (!field) return;
    field.value = String(value);
    if (field.type === 'range') {
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  Object.entries(selected).forEach(([key, value]) => setField(key, value));
});

// Test mail button
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

// Test motion button
document.getElementById('test-motion-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('test-motion-btn');
  const checkbox = document.getElementById('test-motion-mail');
  const status = document.getElementById('test-motion-status');
  btn.disabled = true;
  if (checkbox) checkbox.disabled = true;
  status.textContent = 'Aufnahme läuft…';
  try {
    const res = await fetch('/settings/test-motion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sendMail: checkbox?.checked || false }),
    });
    const data = await res.json();
    if (data.ok) {
      status.textContent = data.mailError
        ? `Fertig ✓ – Mail-Fehler: ${data.mailError}`
        : 'Fertig ✓ – Aufnahme gestartet';
    } else {
      status.textContent = `Fehler: ${data.message}`;
    }
  } catch {
    status.textContent = 'Verbindungsfehler';
  } finally {
    btn.disabled = false;
    if (checkbox) checkbox.disabled = false;
    setTimeout(() => { status.textContent = ''; }, 4000);
  }
});

// Hamburger menu
document.querySelector('.hamburger')?.addEventListener('click', () => {
  document.querySelector('.main-nav')?.classList.toggle('open');
});
