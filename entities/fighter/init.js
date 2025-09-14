// entities/fighter/init.js
export function initBase(self, x, col, id) {
  self.x = x;
  self.y = height - 72;
  self.w = 32;
  self.h = 32;
  self.col = col;
  self.hp = 10;
  self.id = id;

  self.vx = 0;
  self.vy = 0;
  self.gravity = 0.3;
  self.jumpStrength = -5.67;
  self.onGround = true;

  self.acceleration = 1.1;
  self.runAcceleration = 1.11;
  self.maxSpeed = 4;
  self.runMaxSpeed = 10;
  self.friction = 0.1;
  self.runFriction = 0.051;
  self.runActive = false;
  // multiplicador para aumentar la fricción durante ataques de tipo "grounded" (hadouken/tats)
  self.groundedAttackFrictionMultiplier = 6;

  // dash defaults (velocidad objetivo y factor de easing 0..1)
  self.dashSpeed = 10;
  self.dashEase = 0.45;
  self.dashCooldown = 200;
  self.lastDashTime = 0;

  self.lastTapTime = { left: 0, right: 0 };

  self.frameIndex = 0;
  self.frameDelay = 10;
  self.runFrameDelay = 5;
  self.facing = 1;
  self.keys = { left: false, right: false, up: false };
  self.currentFramesByLayer = [];
  self.crouching = false;
  self.blocking = false;

  self.attacking = false;
  self.attackStartTime = 0;
  self.attackDuration = 400;

  self.isHit = false;
  self.hitStartTime = 0;
  self.hitDuration = 260;
}

export function initFrames(self, frames) {
  self.idleFramesByLayer = frames.idleFramesByLayer;
  self.walkFramesByLayer = frames.walkFramesByLayer;
  self.jumpFramesByLayer = frames.jumpFramesByLayer;
  self.fallFramesByLayer = frames.fallFramesByLayer;
  self.runFramesByLayer = frames.runFramesByLayer;
  self.punchFramesByLayer = frames.punchFramesByLayer;
  self.punch2FramesByLayer = frames.punch2FramesByLayer;
  self.punch3FramesByLayer = frames.punch3FramesByLayer;
  self.kickFramesByLayer = frames.kickFramesByLayer;
  self.kick2FramesByLayer = frames.kick2FramesByLayer || frames.kickFramesByLayer;
  self.kick3FramesByLayer = frames.kick3FramesByLayer || frames.kickFramesByLayer;
  self.crouchFramesByLayer = frames.crouchFramesByLayer;
  self.crouchWalkFramesByLayer = frames.crouchWalkFramesByLayer;
  self.hitFramesByLayer = frames.hitFramesByLayer;
  self.hit1FramesByLayer = frames.hit1FramesByLayer || frames.hitFramesByLayer || [];
  self.hit2FramesByLayer = frames.hit2FramesByLayer || frames.hitFramesByLayer || [];
  self.hit3FramesByLayer = frames.hit3FramesByLayer || frames.hitFramesByLayer || [];
  self.shootFramesByLayer = frames.shootFramesByLayer;
  self.projectileFramesByLayer = frames.projectileFramesByLayer;
  self.dashLightFramesByLayer = frames.dashLightFramesByLayer || [];
  self.dashFramesByLayer = frames.dashFramesByLayer || [];
  self.tatsFramesByLayer = frames.tatsFramesByLayer || frames.tats || [];
  self.tatsProjFramesByLayer = frames.tatsProjFramesByLayer || [];
  self.tauntFramesByLayer = frames.tauntFramesByLayer || [];
  self.blockFramesByLayer = frames.blockFramesByLayer || [];
  self.crouchBlockFramesByLayer = frames.crouchBlockFramesByLayer || [];
}

export function initComboAndInput(self) {
  self.waitingForDiagRelease = false;
  self.pendingSimple = null;
  self.pendingDiag = null;
  self.pendingSimpleTime = 0;
  self.pendingSimpleTimeout = 500;
  self.oppositeDiagInsertWindow = 200;

  self.comboChainsByKey = {
    i: ['punch', 'punch2', 'punch3'],
    o: ['kick', 'kick2', 'kick3'],
    b: ['punch', 'punch2', 'punch3'],
    n: ['kick', 'kick2', 'kick3']
  };

  self.comboStepByKey = {};
  self.lastAttackTimeByKey = {};
  self.inputLockedByKey = {};
  for (const k in self.comboChainsByKey) {
    self.comboStepByKey[k] = 0;
    self.lastAttackTimeByKey[k] = 0;
    self.inputLockedByKey[k] = false;
  }
  self.comboWindow = 250;
}

export function initHitboxes(self) {
  self.hitboxes = {
    idle:   { offsetX: 7, offsetY: 0, w: 22, h: 32 },
    walk:   { offsetX: 7, offsetY: 0, w: 22, h: 32 },
    run:    { offsetX: 7, offsetY: 0, w: 22, h: 32 },
    jump:   { offsetX: 7, offsetY: 0, w: 22, h: 32 },
    fall:   { offsetX: 7, offsetY: 0, w: 22, h: 32 },
    crouch: { offsetX: 0, offsetY: 16, w: 32, h: 16 },
    crouchwalk: { offsetX: 0, offsetY: 16, w: 32, h: 16 },
    punch:  { offsetX: -4, offsetY: 0, w: 32, h: 29 },
    punch2: { offsetX: -4, offsetY: 0, w: 32, h: 29 },
    punch3: { offsetX: -4, offsetY: 0, w: 32, h: 29 },
    kick:   { offsetX: 0, offsetY: 1, w: 32, h: 34 },
    hit:    { offsetX: 7, offsetY: 0, w: 22, h: 32 },
    hadouken: { offsetX: 10, offsetY: 10, w: 12, h: 12 }
  };
  self.attackHitboxes = {
    punch: { offsetX: 28, offsetY: 13, w: 10, h: 10 },
    punch2: { offsetX: 28, offsetY: 13, w: 10, h: 10 },
    punch3: { offsetX: 28, offsetY: 13, w: 10, h: 10 },
    kick:  { offsetX: 25, offsetY: 10, w: 30, h: 15 },
    hadouken: { offsetX: 0, offsetY: 0, w: 20, h: 20 },
    tats: { offsetX: 20, offsetY: 4, w: 18, h: 24 }
  };
}

// Fin del módulo init.js — funciones/métodos de Fighter deben estar en entities/fighter.js

