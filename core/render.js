// core/render.js
import { applyCamera } from './camera.js';
import { drawBackground } from '../ui/background.js';
import { drawSavedItems } from '../ui/stageEditor.js';
import { capturePendingHitstopSnapshot, isHitstopActive, remainingHitstopMs } from './hitstop.js';

export function renderScene(ctx = {}) {
  // ctx: { player1, player2, projectiles, cam, appliedCamZoom, _hitEffect, _blockstunZoom, _prevBlockstun, PAUSED }
  try {
    const player1 = ctx.player1;
    const player2 = ctx.player2;
    let projectiles = Array.isArray(ctx.projectiles) ? ctx.projectiles : [];
    let cam = ctx.cam || { x: 0, y: 0, zoom: 1 };
    let appliedCamZoom = (typeof ctx.appliedCamZoom === 'number') ? ctx.appliedCamZoom : (cam.zoom || 1);
    let _hitEffect = ctx._hitEffect || { active: false };
    let _blockstunZoom = ctx._blockstunZoom || { active: false };
    let _prevBlockstun = ctx._prevBlockstun || { p1: false, p2: false };

    push();
    const maxPauseZoom = 3;
    const pauseMultiplier = 2;
    const targetZoom = (ctx.PAUSED) ? Math.min((cam.zoom || 1) * pauseMultiplier, maxPauseZoom) : (cam.zoom || 1);

    let shakeX = 0, shakeY = 0, zoomAdd = 0;
    if (_hitEffect && _hitEffect.active) {
      const now = millis();
      const elapsed = now - _hitEffect.start;
      if (elapsed >= _hitEffect.duration) {
        _hitEffect.active = false;
      } else {
        const t = Math.max(0, Math.min(1, elapsed / _hitEffect.duration));
        const ease = Math.sin((1 - t) * Math.PI / 2);
        const phase = now / 28;
        const xAmp = _hitEffect.mag * ease;
        const yAmp = _hitEffect.mag * 0.55 * ease;
        shakeX = (Math.sin(phase * 1.3) + Math.sin(phase * 0.67)) * xAmp * 0.45;
        shakeY = (Math.cos(phase * 1.1) + Math.cos(phase * 0.5)) * yAmp * 0.45;
        zoomAdd = _hitEffect.zoom * ease;
      }
    }

    if (_blockstunZoom && _blockstunZoom.active) {
      const bev = millis() - _blockstunZoom.start;
      if (bev >= (_blockstunZoom.duration || 0)) {
        _blockstunZoom.active = false;
      } else {
        const t = constrain(bev / (_blockstunZoom.duration || 1), 0, 1);
        const eased = 1 - Math.pow(1 - Math.min(1, t * 1.6), 3);
        zoomAdd += (_blockstunZoom.targetAdd || 0.14) * eased;
      }
    }

    appliedCamZoom = lerp(appliedCamZoom, targetZoom * (1 + zoomAdd), 0.08);
    applyCamera({ x: cam.x + shakeX, y: cam.y + shakeY, zoom: appliedCamZoom });
    drawBackground();

    try { if (typeof drawSavedItems === 'function') drawSavedItems({ x: cam.x + shakeX, y: cam.y + shakeY, zoom: appliedCamZoom }); } catch (e) { console.warn('drawSavedItems failed', e); }

    if (typeof window !== 'undefined' && window.SHOW_DEBUG_OVERLAYS) { push(); noFill(); stroke(255,160,60); strokeWeight(2); rect(0, height - 40, width, 40); pop(); }

    if (player1 && typeof player1.display === 'function') player1.display();
    if (player2 && typeof player2.display === 'function') player2.display();

    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];
      if (p && typeof p.display === 'function') p.display();
    }

    if (window.SHOW_DEBUG_OVERLAYS) {
      for (let i = 0; i < projectiles.length; i++) {
        const p = projectiles[i];
        if (!p) continue;
        const hb = (typeof p.getHitbox === 'function') ? p.getHitbox() : null;
        if (hb) { push(); noFill(); stroke(0,255,255,180); strokeWeight(1.5); rect(hb.x, hb.y, hb.w, hb.h); pop(); }
      }
    }

    pop();

    try { if (typeof capturePendingHitstopSnapshot === 'function') capturePendingHitstopSnapshot(); } catch (e) {}

    if (typeof window !== 'undefined' && window.SHOW_DEBUG_OVERLAYS) {
      try {
        push();
        const size = 12; const pad = 118; const padX = 78;
        const hsActive = (typeof isHitstopActive === 'function') ? !!isHitstopActive() : !!window.HITSTOP_ACTIVE;
        let msLeft = 0;
        if (typeof remainingHitstopMs === 'function') { try { msLeft = Math.max(0, Math.round(remainingHitstopMs())); } catch (e) { msLeft = 0; } }
        if ((!msLeft || msLeft === 0) && typeof window !== 'undefined') msLeft = Math.max(0, Math.round(window.HITSTOP_REMAINING_MS || 0));
        noStroke(); fill(hsActive ? color(80,220,120,220) : color(220,80,80,200)); rect(pad, padX, size, size, 3);
        stroke(0,0,0,120); noFill(); rect(pad, padX, size, size, 3);
        noStroke(); fill(240); textSize(12); textAlign(LEFT, CENTER); text(`${msLeft}ms`, pad + size + 8, padX + size / 2);
        pop();
      } catch (e) {}
    }

    return { cam, appliedCamZoom, _hitEffect, _blockstunZoom, _prevBlockstun, projectiles };
  } catch (e) {
    console.warn('renderScene error', e);
    return null;
  }
}

export default renderScene;
