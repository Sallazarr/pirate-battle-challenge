import { Sprite, Assets } from 'pixi.js';
import { now } from './gameClock';
import type { GameConfiguration } from './gameConfig';
import { moveTowardTarget } from './EnemyNavigation';

export class Shooter {
  public sprite: Sprite;
  public isDead = false;
  public health: number;
  public maxHealth: number;
  public modelId: string;

  protected speed: number;
  protected attackRange: number;
  private lastShotTime = 0;
  protected shootCooldown: number;
  private readonly avoidanceSide: 1 | -1;

  private onShoot: (x: number, y: number, angle: number) => void;
  private texturePath: string;

  constructor(
    x: number,
    y: number,
    onShoot: (x: number, y: number, angle: number) => void,
    model: 'basic' | 'advanced' = 'basic',
    configuration: GameConfiguration,
    texturePath?: string,
  ) {
    this.sprite = new Sprite();
    this.sprite.anchor.set(0.5);
    this.sprite.x = x;
    this.sprite.y = y;
    this.onShoot = onShoot;
    this.maxHealth = model === 'advanced' ? configuration.shooter.advancedHealth : configuration.shooter.basicHealth;
    this.health = this.maxHealth;
    this.speed = configuration.shooter.moveSpeed;
    this.avoidanceSide = Math.round(x + y) % 2 === 0 ? 1 : -1;
    this.attackRange = configuration.shooter.attackRange;
    this.shootCooldown = configuration.shooter.shotCooldownMs;
    const shipModel = model === 'advanced' ? 6 : 13;
    this.modelId = model === 'advanced' ? 'shooter-advanced' : 'shooter-basic';
    this.texturePath = texturePath ?? `/assets/png/default/ships/ship_${shipModel}.png`;
  }

  public async init() {
    this.sprite.texture = await Assets.load(this.texturePath);
  }

  public update(
    delta: number,
    playerX: number,
    playerY: number,
    isBlocked: (x: number, y: number, hitbox: number) => boolean = () => false,
  ) {
    const dx = playerX - this.sprite.x;
    const dy = playerY - this.sprite.y;
    const distanceSquared = dx * dx + dy * dy;
    let angle = Math.atan2(dy, dx);

    this.sprite.rotation = angle - Math.PI / 2;

    if (distanceSquared > this.attackRange * this.attackRange) {
      angle = moveTowardTarget(this.sprite, playerX, playerY, this.speed, delta, isBlocked, this.avoidanceSide);
      this.sprite.rotation = angle - Math.PI / 2;
    } else {
      const currentTime = now();
      if (currentTime - this.lastShotTime > this.shootCooldown) {
        this.onShoot(this.sprite.x, this.sprite.y, angle);
        this.lastShotTime = currentTime;
      }
    }
  }

  public takeHit(damage = 1): boolean {
    this.health = Math.max(0, this.health - damage);
    this.sprite.tint = this.health / this.maxHealth <= 0.5 ? 0xffa45e : 0xffffff;
    return this.health === 0;
  }

  public destroy() {
    this.sprite.destroy();
  }
}
