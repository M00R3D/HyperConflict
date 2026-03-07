// core/health.js
// Central helper to apply damage in a way that consumes visible hearts first,
// then the extended lifebar pool.
export function applyDamage(player, damageQuarters = 1, heartsCount = 2, quartersPerHeart = 4) {
  if (!player) return;
  const heartsQuarters = Math.max(0, heartsCount * quartersPerHeart);
  const totalHp = Math.max(0, typeof player.hpMax === 'number' ? player.hpMax : (typeof player.hp === 'number' ? player.hp : 0));

  // Ensure separate pools exist: `player.hearts` and `player.lifebar`.
  if (typeof player.hearts !== 'number' || typeof player.lifebar !== 'number') {
    const curHp = Math.max(0, typeof player.hp === 'number' ? player.hp : 0);
    player.hearts = Math.min(heartsQuarters, curHp >= heartsQuarters ? heartsQuarters : curHp);
    player.lifebar = Math.max(0, curHp - heartsQuarters);
  }

  let dmg = Math.max(0, Math.floor(damageQuarters || 0));

  // consume from hearts first
  if (player.hearts > 0 && dmg > 0) {
    const take = Math.min(player.hearts, dmg);
    player.hearts = Math.max(0, player.hearts - take);
    dmg -= take;
  }

  // then lifebar
  if (dmg > 0 && player.lifebar > 0) {
    const take2 = Math.min(player.lifebar, dmg);
    player.lifebar = Math.max(0, player.lifebar - take2);
    dmg -= take2;
  }

  // recompute combined hp
  player.hp = Math.max(0, Math.min(totalHp, (player.hearts || 0) + (player.lifebar || 0)));
  if (typeof player.alive === 'boolean') player.alive = player.hp > 0;
}

export default { applyDamage };
