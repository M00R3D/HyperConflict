// core/assetLoader.js
import { loadPiskel } from './loader.js';

async function loadTyemanAssets() {
  return {
    idle: await loadPiskel('src/tyeman/tyeman_idle.piskel'),
    walk: await loadPiskel('src/tyeman/tyeman_walk.piskel'),
    jump: await loadPiskel('src/tyeman/tyeman_jump.piskel'),
    fall: await loadPiskel('src/tyeman/tyeman_fall.piskel'),
    run: await loadPiskel('src/tyeman/tyeman_run.piskel'),
    punch: await loadPiskel('src/tyeman/tyeman_punch.piskel'),
    punch2: await loadPiskel('src/tyeman/tyeman_punch_2.piskel'),
    punch3: await loadPiskel('src/tyeman/tyeman_punch_3.piskel'),
    kick: await loadPiskel('src/tyeman/tyeman_kick.piskel'),
    crouch: await loadPiskel('src/tyeman/tyeman_crouch.piskel'),
    crouchWalk: await loadPiskel('src/tyeman/tyeman_crouch_walk.piskel'),
    hit: await loadPiskel('src/tyeman/tyeman_hit.piskel'),
    shoot: await loadPiskel('src/tyeman/tyeman_shoot.piskel'),
    projectile: await loadPiskel('src/tyeman/tyeman_projectile.piskel'),
    dash: await loadPiskel('src/tyeman/tyeman_dash.piskel')
  };
}

async function loadSbluerAssets() {
  return {
    idle: await loadPiskel('src/sbluer/sbluer_idle.piskel'),
    walk: await loadPiskel('src/sbluer/sbluer_walk.piskel'),
    jump: await loadPiskel('src/sbluer/sbluer_jump.piskel'),
    fall: await loadPiskel('src/sbluer/sbluer_fall.piskel'),
    run: await loadPiskel('src/sbluer/sbluer_run.piskel'),
    punch: await loadPiskel('src/sbluer/sbluer_punch.piskel'),
    punch2: await loadPiskel('src/sbluer/sbluer_punch_2.piskel'),
    punch3: await loadPiskel('src/sbluer/sbluer_punch_3.piskel'),
    kick: await loadPiskel('src/sbluer/sbluer_kick.piskel'),
    crouch: await loadPiskel('src/sbluer/sbluer_crouch.piskel'),
    crouchWalk: await loadPiskel('src/sbluer/sbluer_crouch_walk.piskel'),
    hit: await loadPiskel('src/sbluer/sbluer_hit.piskel'),
    shoot: await loadPiskel('src/sbluer/sbluer_shoot.piskel'),
    projectile: await loadPiskel('src/sbluer/sbluer_projectile.piskel'),
    dash: await loadPiskel('src/sbluer/sbluer_dash.piskel')
  };
}

export { loadTyemanAssets, loadSbluerAssets };
