import { showSlotsPicker } from './stageEditor.js';

export default function createSelectionScene(opts = {}) {
  // opts: { choices, slotAssets, tyemanAssets, sbluerAssets, onConfirm }
  const choices = opts.choices || ['tyeman','sbluer'];
  let p1Sel = 0, p2Sel = 1, p1Confirmed = false, p2Confirmed = false;
  const state = { active: true };

  function handleInput(keysPressed, keysDown) {
    // mover índices y confirmaciones (mover aquí tu lógica de handleSelectionInput)
    // ejemplo mínimo:
    if (!p1Confirmed && keysPressed['a']) { p1Sel = Math.max(0, p1Sel - 1); keysPressed['a'] = false; }
    if (!p1Confirmed && keysPressed['d']) { p1Sel = Math.min(choices.length-1, p1Sel + 1); keysPressed['d'] = false; }
    if (!p1Confirmed && (keysPressed['i'])) { p1Confirmed = true; keysPressed['i'] = false; }
    if (!p2Confirmed && (keysPressed['arrowleft'])) { p2Sel = Math.max(0, p2Sel - 1); keysPressed['arrowleft'] = false; }
    if (!p2Confirmed && (keysPressed['arrowright'])) { p2Sel = Math.min(choices.length-1, p2Sel + 1); keysPressed['arrowright'] = false; }
    if (!p2Confirmed && (keysPressed['b'])) { p2Confirmed = true; keysPressed['b'] = false; }

    // si ambos confirman, abrir picker de slots (load) y luego llamar callback
    if (p1Confirmed && p2Confirmed && typeof opts.onConfirm === 'function') {
      // abrir picker para elegir slot de stage (opcional). El picker cargará el stage si se elige uno.
      try {
        showSlotsPicker('load', (picked) => {
          // ignorar picked si es null (cancel)
          state.active = false;
          opts.onConfirm({ p1Choice: choices[p1Sel], p2Choice: choices[p2Sel] });
        });
      } catch (e) {
        // fallback directo si algo falla
        state.active = false;
        opts.onConfirm({ p1Choice: choices[p1Sel], p2Choice: choices[p2Sel] });
      }
    }
  }

  function draw(ctx) {
    // aquí pones el código de drawCharacterSelect adaptado para leer p1Sel/p2Sel/p1Confirmed/p2Confirmed
    // use opts.slotAssets, opts.tyemanAssets, opts.sbluerAssets
    // para mantener la respuesta corta no copie todo — mover el bloque de drawCharacterSelect completo aquí.
  }

  return {
    active: () => state.active,
    handleInput,
    draw
  };
}