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

  // snapshot previous pools to detect large losses (4 quarters == 1 heart)
  const prevHearts = (typeof player.hearts === 'number') ? player.hearts : null;
  const prevLifebar = (typeof player.lifebar === 'number') ? player.lifebar : null;

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

  // Spawn heart particles only when visible hearts (the initial visible
  // hearts pool) lose whole hearts. Do NOT spawn hearts for lifebar damage.
  try {
    const newHearts = (typeof player.hearts === 'number') ? player.hearts : null;
    if (prevHearts !== null && newHearts !== null) {
      // visible capacity (e.g. 2 hearts * 4 quarters = 8 quarters)
      const visibleCap = heartsQuarters;
      // compute how many whole visible hearts were already lost before and after
      const prevLostQuarters = Math.max(0, visibleCap - prevHearts);
      const newLostQuarters = Math.max(0, visibleCap - newHearts);
      const prevFullLost = Math.floor(prevLostQuarters / quartersPerHeart);
      const newFullLost = Math.floor(newLostQuarters / quartersPerHeart);
      const heartsLostVisible = Math.max(0, newFullLost - prevFullLost);
      if (heartsLostVisible > 0) {
        try {
          if (typeof window !== 'undefined' && window.ParticleSystem && typeof window.ParticleSystem.spawnParticle === 'function') {
            const cx = Math.round((typeof player.x === 'number' ? player.x : 0) + ((typeof player.w === 'number' ? player.w : 0) / 2));
            const cy = Math.round((typeof player.y === 'number' ? player.y : 0) + ((typeof player.h === 'number' ? player.h : 0) / 2));
            window.ParticleSystem.spawnParticle('heart', cx, cy, { size: 8, count: heartsLostVisible, screenSpace: false });
          }
        } catch (e) { /* ignore particle spawn errors */ }
      }
    }
  } catch (e) { /* keep health application resilient */ }
}

export default { applyDamage };
