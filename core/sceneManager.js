import createSelectionScene from '../ui/selection.js';
import { loadTyemanAssets, loadSbluerAssets, loadSlotAssets, loadHeartFrames, loadBootFrames } from './assetLoader.js';
// import createGameplay from './gameplay.js';
import { getLevels, loadStageCode, deleteLevel } from '../ui/stageEditor.js';

export function showStagePicker(cb) {
  const existing = document.getElementById('hc-stage-picker');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'hc-stage-picker';
  Object.assign(overlay.style, {
    position: 'fixed', left: '0', top: '0', right: '0', bottom: '0',
    background: 'rgba(0,0,0,0.9)', color: '#fff', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 10000, fontFamily: 'monospace'
  });

  const box = document.createElement('div');
  Object.assign(box.style, {
    width: '640px', maxHeight: '80vh', overflowY: 'auto',
    background: '#0b0b0b', padding: '12px', borderRadius: '8px'
  });

  const title = document.createElement('div');
  title.textContent = 'Select Stage';
  title.style.fontSize = '16px';
  title.style.marginBottom = '10px';
  box.appendChild(title);

  const list = document.createElement('div');
  box.appendChild(list);

  const levels = (typeof getLevels === 'function') ? getLevels() || [] : [];
  let idx = 0;

  function renderList() {
    list.innerHTML = '';
    if (!levels || levels.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = '(no saved stages)';
      empty.style.color = '#aaa';
      empty.style.marginBottom = '8px';
      list.appendChild(empty);
      return;
    }

    levels.forEach((rec, i) => {
      const row = document.createElement('div');
      row.dataset.idx = String(i);
      Object.assign(row.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        cursor: 'pointer',
        background: (i === idx) ? 'linear-gradient(90deg,#163b74,#0b0b0b)' : 'transparent',
        color: (i === idx) ? '#fff' : '#ddd'
      });

      const left = document.createElement('div');
      left.style.flex = '1';
      left.textContent = rec.title || rec.name || `Stage ${i+1}`;
      row.appendChild(left);

      const meta = document.createElement('div');
      meta.style.marginLeft = '12px';
      meta.style.color = '#999';
      meta.style.fontSize = '12px';
      meta.textContent = `saved ${new Date(rec.ts || 0).toLocaleString()}`;
      row.appendChild(meta);

      row.onclick = () => { setIndex(i); activateIndex(i); };
      row.onmouseover = () => { setIndex(i); };

      list.appendChild(row);
    });
  }

  function setIndex(i) {
    if (!levels || levels.length === 0) return;
    idx = ((i % levels.length) + levels.length) % levels.length;
    updateHighlight();
  }

  function updateHighlight() {
    const rows = Array.from(list.children).filter(n => n.dataset && n.dataset.idx !== undefined);
    rows.forEach(r => {
      const i = Number(r.dataset.idx);
      r.style.background = (i === idx) ? 'linear-gradient(90deg,#163b74,#0b0b0b)' : 'transparent';
      r.style.color = (i === idx) ? '#fff' : '#ddd';
    });
    // ensure selected row visible
    const sel = list.querySelector(`[data-idx="${idx}"]`);
    if (sel && typeof sel.scrollIntoView === 'function') sel.scrollIntoView({ block: 'nearest' });
  }

  function activateIndex(i) {
    const rec = levels[i];
    if (!rec) return closeAndCallback(null);
    try {
      if (typeof loadStageCode === 'function' && rec.code) loadStageCode(rec.code);
      closeAndCallback(rec);
    } catch (e) {
      console.warn(e);
      alert('Load failed');
      closeAndCallback(null);
    }
  }

  const footer = document.createElement('div');
  footer.style.textAlign = 'right';
  footer.style.marginTop = '10px';
  const btnCancel = document.createElement('button');
  btnCancel.textContent = 'Cancel';
  btnCancel.onclick = () => closeAndCallback(null);
  footer.appendChild(btnCancel);
  box.appendChild(footer);

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  function close() {
    const el = document.getElementById('hc-stage-picker');
    if (el && el.parentNode) el.parentNode.removeChild(el);
    window.removeEventListener('keydown', onKey);
  }
  function closeAndCallback(res) { close(); if (typeof cb === 'function') cb(res); }

  function onKey(e) {
    const k = e.key;
    if (!levels || levels.length === 0) {
      if (k === 'Escape') { e.preventDefault(); closeAndCallback(null); }
      return;
    }

    if (k === 'ArrowUp' || k === 'w' || k === 'W') {
      e.preventDefault();
      setIndex(idx - 1);
    } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
      e.preventDefault();
      setIndex(idx + 1);
    } else if (k === 'Enter') {
      e.preventDefault();
      activateIndex(idx);
    } else if (k === 'Escape') {
      e.preventDefault();
      closeAndCallback(null);
    }
  }

  // initial render & highlight
  renderList();
  updateHighlight();

  // focus handling so keyboard events reach window
  window.addEventListener('keydown', onKey, { passive: false });
}

if (typeof window !== 'undefined') {
  window.stageShowPicker = showStagePicker;
  window.stageGetSaved = () => {
    try { return (typeof getLevels === 'function') ? getLevels() || [] : []; }
    catch (e) { return []; }
  };
}