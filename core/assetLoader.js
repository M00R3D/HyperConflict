// core/assetLoader.js
import { loadPiskel } from './loader.js';

async function loadOrNull(path) {
  try {
    return await loadPiskel(path);
  } catch (err) {
    console.warn('No se pudo cargar asset:', path, err);
    return null;
  }
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
    // animación "tats" que se mostrará en el personaje (hitbox/anim)
    tats: await loadOrNull('src/tyeman/tyeman_tats.piskel'),
    // frames específicos para el proyectil (sprite distinto)
    tatsProjFramesByLayer: await loadOrNull('src/tyeman/tyeman_tats_proj.piskel'),
    crouch: await loadOrNull('src/tyeman/tyeman_crouch.piskel'),
    crouchWalk: await loadOrNull('src/tyeman/tyeman_crouch_walk.piskel'),
    hit: await loadOrNull('src/tyeman/tyeman_hit.piskel'),
    hit2: await loadOrNull('src/tyeman/tyeman_hit_2.piskel'),
    hit3: await loadOrNull('src/tyeman/tyeman_hit_3.piskel'),
    shoot: await loadOrNull('src/tyeman/tyeman_shoot.piskel'),
    projectile: await loadOrNull('src/tyeman/tyeman_projectile.piskel'),
    dash: await loadOrNull('src/tyeman/tyeman_dash.piskel'),
  dashLight: await loadOrNull('src/tyeman/tyeman_dash_light.piskel'),
  taunt: await loadOrNull('src/tyeman/tyeman_taunt.piskel'),
  block: await loadOrNull('src/tyeman/tyeman_block.piskel')
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
    // animación "tats" para personaje (si existe)
    tats: await loadOrNull('src/sbluer/sbluer_tats.piskel'),
    // sprite de proyectil tats para sbluer (puede ser null si no existe)
    tatsProjFramesByLayer: await loadOrNull('src/sbluer/sbluer_tats_proj.piskel'),
    crouch: await loadOrNull('src/sbluer/sbluer_crouch.piskel'),
    crouchWalk: await loadOrNull('src/sbluer/sbluer_crouch_walk.piskel'),
    hit: await loadOrNull('src/sbluer/sbluer_hit.piskel'),
    hit2: await loadOrNull('src/sbluer/sbluer_hit_2.piskel'),
    hit3: await loadOrNull('src/sbluer/sbluer_hit_3.piskel'),
    shoot: await loadOrNull('src/sbluer/sbluer_shoot.piskel'),
    projectile: await loadOrNull('src/sbluer/sbluer_projectile.piskel'),
    dash: await loadOrNull('src/sbluer/sbluer_dash.piskel'),
  dashLight: await loadOrNull('src/sbluer/sbluer_dash_light.piskel'),
  taunt: await loadOrNull('src/sbluer/sbluer_taunt.piskel'),
  block: await loadOrNull('src/sbluer/sbluer_block.piskel')
  };
}
 
export { loadTyemanAssets, loadSbluerAssets };
