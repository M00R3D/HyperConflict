import { registerStatsForChar, registerActionsForChar } from './charConfig.js';
import { registerAttackHitboxesForChar, registerBodyHitboxesForChar } from './hitboxConfig.js';
import { registerSpecialsForChar } from '../entities/fighter/specials.js';
export function registerCharData() {
            registerStatsForChar('tyeman', {
            maxSpeed: 3,
            runMaxSpeed: 6,
            acceleration: 1.1,
            runAcceleration: 1.11,
            friction: 0.1,
            runFriction: 0.081
            });
            registerActionsForChar('tyeman', {
            punch: { duration: 400, frameDelay: 6 },
            punch2: { duration: 400, frameDelay: 6 },
            punch3: { duration: 800, frameDelay: 5 },
            kick: { duration: 400, frameDelay: 6 },
            kick2: { duration: 700, frameDelay: 6 },
            kick3: { duration: 1000, frameDelay: 6 },
            grab: { duration: 500, frameDelay: 3 }
            });

            registerStatsForChar('sbluer', {
            maxSpeed: 2.4,
            runMaxSpeed: 5.0,
            acceleration: 0.9,
            runAcceleration: 0.95,
            friction: 0.12,
            runFriction: 0.06
            });
            registerActionsForChar('sbluer', {
            punch: { duration: 700, frameDelay: 7 },
            punch2: { duration: 1000, frameDelay: 6 },
            punch3: { duration: 1000, frameDelay: 6 },
            kick: { duration: 700, frameDelay: 7 },
            kick2: { duration: 1000, frameDelay: 6 },
            kick3: { duration: 1000, frameDelay: 6 },
            grab: { duration: 500, frameDelay: 3 }
            });

            // ejemplo: ajustar hitboxes de tyeman
            registerAttackHitboxesForChar('tyeman', {
            punch:  { offsetX: 16, offsetY: 6, w: 20, h: 20 },
            punch2: { offsetX: 18, offsetY: 6, w: 22, h: 20 },
            punch3: { offsetX: 20, offsetY: 4, w: 28, h: 24 },
            kick:   { offsetX: 23, offsetY: 16, w: 11, h: 13 },
            kick2:   { offsetX: 23, offsetY: 16, w: 15, h: 13 },
            kick3:   { offsetX: 20, offsetY: 4, w: 17, h: 15 }
            });

            // ejemplo: sbluer tweaks
            registerAttackHitboxesForChar('sbluer', {
            punch: { offsetX: 14, offsetY: 6, w: 18, h: 18 },
            kick3:  { offsetX: 24, offsetY: 4, w: 30, h: 26 }
            });

            registerBodyHitboxesForChar('tyeman', {
            idle:  { offsetX: 6, offsetY: 0, w: 22, h: 32 },
            kick:  { offsetX: 6, offsetY: 0, w: 22, h: 32 },
            kick2:  { offsetX: 6, offsetY: 1, w: 20, h: 32 },
            kick3:  { offsetX: 6, offsetY: 10, w: 22, h: 23 },
            // punch: { offsetX: 14, offsetY: 6, w: 18, h: 20 },
            // hit:   { offsetX: 8, offsetY: 0, w: 20, h: 32 },
            // knocked:{ offsetX: 4, offsetY: 0, w: 28, h: 28 }
            });

            registerBodyHitboxesForChar('sbluer', {
            idle: { offsetX: 7, offsetY: 0, w: 22, h: 32 },
            kick:  { offsetX: 6, offsetY: 0, w: 22, h: 32 },
            // kick: { offsetX: 20, offsetY: 8, w: 28, h: 18 }
            });
}

export function registerSpecials(){
  registerSpecialsForChar('tyeman', {
    hadouken: { seq: ['↓','↘','→','P'], direction: 'forward' },
    bun: { seq: ['←','→','P'], direction: 'forward' },
    ty_tats: { seq: ['↓','↙','←','K'], direction: 'backward' },
    taunt: { seq: ['T'], direction: 'any' },
    supersalto: { seq: ['↓','↑'], direction: 'any' },
    grab: { seq: ['G'], direction: 'any' }
  });
  registerSpecialsForChar('sbluer', {
    shoryuken: { seq: ['→','↓','↘','P'], direction: 'forward' },
    supersalto: { seq: ['↓','↑'], direction: 'any' },
    taunt: { seq: ['T'], direction: 'any' },
    grab: { seq: ['G'], direction: 'any' }
  });

  // Fernando: placeholder stats/actions/hitboxes and register specials
  registerStatsForChar('fernando', {
    maxSpeed: 2.2,
    runMaxSpeed: 4.8,
    acceleration: 1.0,
    runAcceleration: 1.05,
    friction: 0.11,
    runFriction: 0.08
  });

  registerActionsForChar('fernando', {
    punch: { duration: 500, frameDelay: 6 },
    kick: { duration: 500, frameDelay: 6 },
    grab: { duration: 500, frameDelay: 4 }
  });

  registerAttackHitboxesForChar('fernando', {});
  registerBodyHitboxesForChar('fernando', {});

  registerSpecialsForChar('fernando', {
    taunt: { seq: ['T'], direction: 'any' },
    grab: { seq: ['G'], direction: 'any' },
    supersalto: { seq: ['↓','↑'], direction: 'any' }
  });
}