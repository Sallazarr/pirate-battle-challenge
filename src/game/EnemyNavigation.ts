import type { Sprite } from 'pixi.js';

const STEERING_OFFSETS = [0.4, 0.8, 1.2, 1.6, 2, 2.45, 2.8];

export function moveTowardTarget(
  sprite: Sprite,
  targetX: number,
  targetY: number,
  speed: number,
  delta: number,
  isBlocked: (x: number, y: number, hitbox: number) => boolean,
  preferredSide: 1 | -1,
): number {
  const dx = targetX - sprite.x;
  const dy = targetY - sprite.y;
  const distance = Math.hypot(dx, dy);
  const directAngle = Math.atan2(dy, dx);
  const step = Math.max(0, speed * delta);
  if (distance < 1 || step === 0) return directAngle;

  const hitbox = Math.max(sprite.width, sprite.height) * 0.7;
  const lookAhead = Math.max(hitbox * 1.25, step * 5);
  let chosenAngle = directAngle;
  if (isSweepBlocked(sprite, directAngle, lookAhead, hitbox, isBlocked)) {
    let bestCost = Number.POSITIVE_INFINITY;
    let fallbackCost = Number.POSITIVE_INFINITY;
    let fallbackAngle = directAngle;
    for (const offset of STEERING_OFFSETS) {
      for (const side of [preferredSide, -preferredSide] as const) {
        const candidate = directAngle + offset * side;
        const isLongPathClear = !isSweepBlocked(sprite, candidate, lookAhead, hitbox, isBlocked);
        const nextX = sprite.x + Math.cos(candidate) * step;
        const nextY = sprite.y + Math.sin(candidate) * step;
        if (!isLongPathClear && isBlocked(nextX, nextY, hitbox)) continue;
        const candidateX = sprite.x + Math.cos(candidate) * lookAhead;
        const candidateY = sprite.y + Math.sin(candidate) * lookAhead;
        const remainingDistance = Math.hypot(targetX - candidateX, targetY - candidateY);
        const cost = remainingDistance + offset * hitbox * 0.2 + (side === preferredSide ? 0 : hitbox * 0.15);
        if (isLongPathClear && cost < bestCost) {
          bestCost = cost;
          chosenAngle = candidate;
        }
        if (cost < fallbackCost) {
          fallbackCost = cost;
          fallbackAngle = candidate;
        }
      }
    }
    if (!Number.isFinite(bestCost)) chosenAngle = fallbackAngle;
  }

  const nextX = sprite.x + Math.cos(chosenAngle) * step;
  const nextY = sprite.y + Math.sin(chosenAngle) * step;
  if (!isBlocked(nextX, nextY, hitbox)) {
    sprite.x = nextX;
    sprite.y = nextY;
  } else {
    if (!isBlocked(nextX, sprite.y, hitbox)) sprite.x = nextX;
    if (!isBlocked(sprite.x, nextY, hitbox)) sprite.y = nextY;
  }
  return chosenAngle;
}

function isSweepBlocked(
  sprite: Sprite,
  angle: number,
  distance: number,
  hitbox: number,
  isBlocked: (x: number, y: number, hitbox: number) => boolean,
): boolean {
  const samples = 3;
  for (let index = 1; index <= samples; index += 1) {
    const progress = distance * index / samples;
    if (isBlocked(
      sprite.x + Math.cos(angle) * progress,
      sprite.y + Math.sin(angle) * progress,
      hitbox,
    )) return true;
  }
  return false;
}
