'use strict';

// ── Modal ─────────────────────────────────────────────────────
const modal       = document.getElementById('delete-modal');
const modalTitle  = document.getElementById('modal-title');
const modalBody   = document.getElementById('modal-body');
const modalCancel = document.getElementById('modal-cancel');
const modalConfirm= document.getElementById('modal-confirm');

let pendingAction = null;

function openModal({ title, body, onConfirm }) {
  modalTitle.textContent  = title;
  modalBody.textContent   = body;
  pendingAction           = onConfirm;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  modalConfirm.focus();
}

function closeModal() {
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  pendingAction = null;
}

modalCancel.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

modalConfirm.addEventListener('click', async () => {
  if (!pendingAction) return;
  const action = pendingAction;
  closeModal();
  await action();
});

// ── Per-page dropdown ─────────────────────────────────────────
const perPageSelect = document.getElementById('per-page-select');
perPageSelect.addEventListener('change', () => {
  const url = new URL(window.location.href);
  url.searchParams.set('per_page', perPageSelect.value);
  url.searchParams.set('page', '1');
  window.location.href = url.toString();
});

// ── Select mode ───────────────────────────────────────────────
const selectModeBtn   = document.getElementById('select-mode-btn');
const cancelSelectBtn = document.getElementById('cancel-select-btn');
const selectionToolbar= document.getElementById('selection-toolbar');
const selectAllCb     = document.getElementById('select-all');
const selectedCountEl = document.getElementById('selected-count');
const bulkDeleteBtn   = document.getElementById('bulk-delete-btn');
const grid            = document.getElementById('archive-grid');

let selectMode = false;

function getChecked() {
  return [...document.querySelectorAll('.card-check:checked')];
}

function updateSelectionUI() {
  const checked = getChecked();
  selectedCountEl.textContent = `${checked.length} ausgewählt`;
  bulkDeleteBtn.disabled = checked.length === 0;
  const all = document.querySelectorAll('.card-check');
  selectAllCb.indeterminate = checked.length > 0 && checked.length < all.length;
  selectAllCb.checked = all.length > 0 && checked.length === all.length;
}

function enterSelectMode() {
  selectMode = true;
  grid.classList.add('select-mode');
  selectionToolbar.classList.add('is-visible');
  selectModeBtn.style.display = 'none';
  updateSelectionUI();
}

function exitSelectMode() {
  selectMode = false;
  grid.classList.remove('select-mode');
  selectionToolbar.classList.remove('is-visible');
  selectModeBtn.style.display = '';
  document.querySelectorAll('.card-check').forEach(cb => cb.checked = false);
  selectAllCb.checked = false;
  selectAllCb.indeterminate = false;
  updateSelectionUI();
}

selectModeBtn.addEventListener('click', enterSelectMode);
cancelSelectBtn.addEventListener('click', exitSelectMode);

selectAllCb.addEventListener('change', () => {
  document.querySelectorAll('.card-check').forEach(cb => cb.checked = selectAllCb.checked);
  updateSelectionUI();
});

grid && grid.addEventListener('change', (e) => {
  if (e.target.classList.contains('card-check')) updateSelectionUI();
});

// ── Bulk delete ───────────────────────────────────────────────
bulkDeleteBtn.addEventListener('click', () => {
  const checked = getChecked();
  if (!checked.length) return;
  openModal({
    title: `${checked.length} Aufnahmen löschen?`,
    body: `Diese ${checked.length} Aufnahmen werden unwiderruflich gelöscht.`,
    onConfirm: async () => {
      const ids = checked.map(cb => Number(cb.value));
      const res = await fetch('/videos/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (res.ok) {
        ids.forEach(id => {
          document.querySelector(`.recording-card[data-id="${id}"]`)?.remove();
        });
        exitSelectMode();
      }
    },
  });
});

// ── Single delete ─────────────────────────────────────────────
document.querySelectorAll('.delete-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const id = btn.dataset.id;
    openModal({
      title: 'Aufnahme löschen?',
      body: 'Diese Aufnahme wird unwiderruflich gelöscht.',
      onConfirm: async () => {
        const res = await fetch(`/videos/${id}`, { method: 'DELETE' });
        if (res.ok) btn.closest('.recording-card').remove();
      },
    });
  });
});

// ── Star (favorite) buttons ───────────────────────────────────
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
        if (next === 0 && window.location.search.includes('favorites=1')) {
          btn.closest('.recording-card').remove();
        }
      }
    } catch {}
  });
});
