// core/assetLoader.js
import { loadPiskel } from './loader.js';

async function loadOrNull(path) {try {    return await loadPiskel(path);  } catch (err)
  {console.warn('No se pudo cargar asset:', path, err);
    return null;}
}

function normalizePiskelLayers(layers) {
  if (!Array.isArray(layers)) return layers;
  return layers.map((layerFrames) => {
    if (!Array.isArray(layerFrames) || layerFrames.length === 0) return layerFrames;
    // find a representative image
    const rep = layerFrames.find(f => f && f.width && f.height);
    if (!rep) return layerFrames;

    let count = layerFrames.length || 0;
    if (count <= 1) {
      // try to infer count from aspect ratio
      const horizGuess = Math.round(rep.width / rep.height) || 1;
      const vertGuess = Math.round(rep.height / rep.width) || 1;
      if (horizGuess >= 2) count = horizGuess;
      else if (vertGuess >= 2) count = vertGuess;
      else count = 1;
    }

    // if rep already matches a sheet containing multiple frames, split it
    if (count > 1 && rep.width >= rep.height * count) {
      const fw = Math.round(rep.width / count);
      const out = new Array(count).fill(null).map((_, i) => rep.get(fw * i, 0, fw, rep.height));
      return out;
    }
    if (count > 1 && rep.height >= rep.width * count) {
      const fh = Math.round(rep.height / count);
      const out = new Array(count).fill(null).map((_, i) => rep.get(0, fh * i, rep.width, fh));
      return out;
    }

    return layerFrames;
  });
}

async function loadTyemanAssets() {
  return {
    idle: await loadOrNull('src/tyeman/tyeman_idle.piskel'),
    walk: await loadOrNull('src/tyeman/tyeman_walk.piskel'),
    jump: await loadOrNull('src/tyeman/tyeman_jump.piskel'),
    fall: await loadOrNull('src/tyeman/tyeman_fall.piskel'),
    run: await loadOrNull('src/tyeman/tyeman_run.piskel'),
    punch: await loadOrNull('src/tyeman/tyeman_punch.piskel'),
    punch2: await loadOrNull('src/tyeman/tyeman_punch_2.piskel'),
    punch3: await loadOrNull('src/tyeman/tyeman_punch_3.piskel'),
    kick2: await loadOrNull('src/tyeman/tyeman_kick_2.piskel'),
    kick3: await loadOrNull('src/tyeman/tyeman_kick_3.piskel'),
    kick: await loadOrNull('src/tyeman/tyeman_kick.piskel'),
    tats: await loadOrNull('src/tyeman/tyeman_tats.piskel'),
    tatsProjFramesByLayer: await loadOrNull('src/tyeman/tyeman_tats_proj.piskel'),
    shor: await loadOrNull('src/tyeman/tyeman_shor.piskel'),
    bunProj: await loadOrNull('src/tyeman/tyeman_bun.piskel'),
    bunString: await loadOrNull('src/tyeman/tyeman_string.piskel'),
    crouch: await loadOrNull('src/tyeman/tyeman_crouch.piskel'),
    crouchWalk: await loadOrNull('src/tyeman/tyeman_crouch_walk.piskel'),
    hit: await loadOrNull('src/tyeman/tyeman_hit.piskel'),
    hit2: await loadOrNull('src/tyeman/tyeman_hit_2.piskel'),
    hit3: await loadOrNull('src/tyeman/tyeman_hit_3.piskel'),
    flyback: await loadOrNull('src/tyeman/tyeman_fly_back.piskel'),
    flyup: await loadOrNull('src/tyeman/tyeman_fly_up.piskel'),
    shoot: await loadOrNull('src/tyeman/tyeman_shoot.piskel'),
    projectile: await loadOrNull('src/tyeman/tyeman_projectile.piskel'),
    dash: await loadOrNull('src/tyeman/tyeman_dash.piskel'),
  dashLight: await loadOrNull('src/tyeman/tyeman_dash_light.piskel'),
  taunt: await loadOrNull('src/tyeman/tyeman_taunt.piskel'),
  block: await loadOrNull('src/tyeman/tyeman_block.piskel'),
  crouchBlock: await loadOrNull('src/tyeman/tyeman_crouch_block.piskel'),
  grab: await loadOrNull('src/tyeman/tyeman_grab.piskel'),
  grabbed: await loadOrNull('src/tyeman/tyeman_grabbed.piskel'),
  knocking: await loadOrNull('src/tyeman/tyeman_knocking.piskel'),
  knocked: await loadOrNull('src/tyeman/tyeman_knocked.piskel'),
  recovery: await loadOrNull('src/tyeman/tyeman_recovery.piskel'),
  };
}
 
async function loadSbluerAssets() {
  return {
    idle: await loadOrNull('src/sbluer/sbluer_idle.piskel'),
    walk: await loadOrNull('src/sbluer/sbluer_walk.piskel'),
    jump: await loadOrNull('src/sbluer/sbluer_jump.piskel'),
    fall: await loadOrNull('src/sbluer/sbluer_fall.piskel'),
    run: await loadOrNull('src/sbluer/sbluer_run.piskel'),
    punch: await loadOrNull('src/sbluer/sbluer_punch.piskel'),
    punch2: await loadOrNull('src/sbluer/sbluer_punch_2.piskel'),
    punch3: await loadOrNull('src/sbluer/sbluer_punch_3.piskel'),
    kick2: await loadOrNull('src/sbluer/sbluer_kick_2.piskel'),
    kick3: await loadOrNull('src/sbluer/sbluer_kick_3.piskel'),
    kick: await loadOrNull('src/sbluer/sbluer_kick.piskel'),
    tats: await loadOrNull('src/sbluer/sbluer_tats.piskel'),
    tatsProjFramesByLayer: await loadOrNull('src/sbluer/sbluer_tats_proj.piskel'),
    crouch: await loadOrNull('src/sbluer/sbluer_crouch.piskel'),
    crouchWalk: await loadOrNull('src/sbluer/sbluer_crouch_walk.piskel'),
    hit: await loadOrNull('src/sbluer/sbluer_hit.piskel'),
    hit2: await loadOrNull('src/sbluer/sbluer_hit_2.piskel'),
    hit3: await loadOrNull('src/sbluer/sbluer_hit_3.piskel'),
    flyback: await loadOrNull('src/sbluer/sbluer_fly_back.piskel'),
    flyup: await loadOrNull('src/sbluer/sbluer_fly_up.piskel'),
    shoot: await loadOrNull('src/sbluer/sbluer_shoot.piskel'),
    projectile: await loadOrNull('src/sbluer/sbluer_projectile.piskel'),
    dash: await loadOrNull('src/sbluer/sbluer_dash.piskel'),
  dashLight: await loadOrNull('src/sbluer/sbluer_dash_light.piskel'),
  taunt: await loadOrNull('src/sbluer/sbluer_taunt.piskel'),
  block: await loadOrNull('src/sbluer/sbluer_block.piskel'),
  crouchBlock: await loadOrNull('src/sbluer/sbluer_crouch_block.piskel'),
  grab: await loadOrNull('src/sbluer/sbluer_grab.piskel'),
  grabbed: await loadOrNull('src/sbluer/sbluer_grabbed.piskel'),
  knocking: await loadOrNull('src/sbluer/sbluer_knocking.piskel'),
  knocked: await loadOrNull('src/sbluer/sbluer_knocked.piskel'),
  recovery: await loadOrNull('src/sbluer/sbluer_recovery.piskel'),
  };
}
async function loadFernandoAssets() {
  const raw = {
    idle: await loadOrNull('src/fernando/fernando_idle.piskel'),
    walk: await loadOrNull('src/fernando/fernando_walk.piskel'),
    run: await loadOrNull('src/fernando/fernando_run.piskel'),
    jump: await loadOrNull('src/fernando/fernando_jump.piskel'),
    fall: await loadOrNull('src/fernando/fernando_fall.piskel'),
    punch: await loadOrNull('src/fernando/fernando_punch.piskel'),
    punch2: await loadOrNull('src/fernando/fernando_punch_2.piskel'),
    punch3: await loadOrNull('src/fernando/fernando_punch_3.piskel'),
    kick: await loadOrNull('src/fernando/fernando_kick.piskel'),
    kick2: await loadOrNull('src/fernando/fernando_kick_2.piskel'),
    kick3: await loadOrNull('src/fernando/fernando_kick_3.piskel'),
    dash: await loadOrNull('src/fernando/fernando_dash.piskel'),
    dashLight: await loadOrNull('src/fernando/fernando_dash_light.piskel'),
    crouch: await loadOrNull('src/fernando/fernando_crouch.piskel'),
    crouchWalk: await loadOrNull('src/fernando/fernando_crouch_walk.piskel'),
    hit: await loadOrNull('src/fernando/fernando_hit.piskel'),
    hit2: await loadOrNull('src/fernando/fernando_hit_2.piskel'),
    hit3: await loadOrNull('src/fernando/fernando_hit_3.piskel'),
    flyback: await loadOrNull('src/fernando/fernando_fly_back.piskel'),
    flyup: await loadOrNull('src/fernando/fernando_fly_up.piskel'),
    block: await loadOrNull('src/fernando/fernando_block.piskel'),
    crouchBlock: await loadOrNull('src/fernando/fernando_crouch_block.piskel'),
    grab: await loadOrNull('src/fernando/fernando_grab.piskel'),
    grabbed: await loadOrNull('src/fernando/fernando_grabbed.piskel'),
    knocking: await loadOrNull('src/fernando/fernando_knocking.piskel'),
    grabbed: await loadOrNull('src/fernando/fernando_grabbed.piskel'),
    knocked: await loadOrNull('src/fernando/fernando_knocked.piskel'),
    recovery: await loadOrNull('src/fernando/fernando_recovery.piskel'),
    taunt: await loadOrNull('src/fernando/fernando_taunt.piskel')
  };

  // Normalize each piskel's layers so spritesheets are split into per-frame images when needed
  const normalized = {};
  for (const k of Object.keys(raw)) {
    const v = raw[k];
    normalized[k] = Array.isArray(v) ? normalizePiskelLayers(v) : v;
  }
  return normalized;
}
export { loadTyemanAssets, loadSbluerAssets, loadFernandoAssets };
export async function loadSlotAssets() {return {
    empty: await loadOrNull('src/slots/slot_empty.piskel'),
    rounderP1: await loadOrNull('src/slots/slot_rounder_p1.piskel'),
    rounderP2: await loadOrNull('src/slots/slot_rounder_p2.piskel'),
  };}

export async function loadHeartFrames() {return await loadOrNull('src/hearth/hearth_red.piskel');}
export async function loadBootFrames() {return await loadOrNull('src/hearth/boot_green.piskel');}

if (typeof window !== 'undefined') {
  if (typeof window.loadTyemanAssets === 'undefined') window.loadTyemanAssets = loadTyemanAssets;
  if (typeof window.loadSbluerAssets === 'undefined') window.loadSbluerAssets = loadSbluerAssets;
  if (typeof window.loadHeartFrames === 'undefined') window.loadHeartFrames = loadHeartFrames;
  if (typeof window.loadBootFrames === 'undefined') window.loadBootFrames = loadBootFrames;
  if (typeof window.loadSlotAssets === 'undefined') window.loadSlotAssets = loadSlotAssets;
}
