import type { Sprite } from 'pixi.js';
import type { Chaser } from './Chaser';
import type { Shooter } from './Shooter';

type Enemy = Chaser | Shooter;

export function areSpritesColliding(first: Sprite, second: Sprite): boolean {
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  return dx * dx + dy * dy < 45 * 45;
}

export function resolveEnemyCollisions(
  enemies: Enemy[],
  isSolid: (x: number, y: number, hitbox?: number) => boolean,
): void {
  for (let i = 0; i < enemies.length; i += 1) {
    const first = enemies[i];
    if (first.isDead) continue;
    const firstRadius = Math.max(first.sprite.width, first.sprite.height) * 0.35;

    for (let j = i + 1; j < enemies.length; j += 1) {
      const second = enemies[j];
      if (second.isDead) continue;
      const secondRadius = Math.max(second.sprite.width, second.sprite.height) * 0.35;
      const dx = second.sprite.x - first.sprite.x;
      const dy = second.sprite.y - first.sprite.y;
      const distance = Math.hypot(dx, dy);
      const minimumDistance = firstRadius + secondRadius;
      if (distance >= minimumDistance) continue;

      const directionX = distance < 0.001 ? 1 : dx / distance;
      const directionY = distance < 0.001 ? 0 : dy / distance;
      const overlap = minimumDistance - distance + 0.5;
      const canMoveFirst = (amount: number) => !isSolid(
        first.sprite.x - directionX * amount,
        first.sprite.y - directionY * amount,
        firstRadius * 2,
      );
      const canMoveSecond = (amount: number) => !isSolid(
        second.sprite.x + directionX * amount,
        second.sprite.y + directionY * amount,
        secondRadius * 2,
      );
      const canMoveFirstHalf = canMoveFirst(overlap / 2);
      const canMoveSecondHalf = canMoveSecond(overlap / 2);

      if (canMoveFirstHalf && canMoveSecondHalf) {
        first.sprite.x -= directionX * (overlap / 2);
        first.sprite.y -= directionY * (overlap / 2);
        second.sprite.x += directionX * (overlap / 2);
        second.sprite.y += directionY * (overlap / 2);
      } else if (canMoveFirst(overlap)) {
        first.sprite.x -= directionX * overlap;
        first.sprite.y -= directionY * overlap;
      } else if (canMoveSecond(overlap)) {
        second.sprite.x += directionX * overlap;
        second.sprite.y += directionY * overlap;
      }
    }
  }
}
