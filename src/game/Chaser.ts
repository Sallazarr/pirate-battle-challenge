import { Sprite, Assets } from 'pixi.js';
import type { GameConfiguration } from './gameConfig';
import { moveTowardTarget } from './EnemyNavigation';

export class Chaser {
  public sprite: Sprite;
  public isDead = false;
  public health: number;
  public readonly maxHealth: number;
  public modelId: string;
  
  private readonly speed: number;
  private readonly avoidanceSide: 1 | -1;
  private texturePath: string;

  constructor(x: number, y: number, model: 'basic' | 'advanced', configuration: GameConfiguration) {
    this.sprite = new Sprite();
    this.sprite.anchor.set(0.5);
    this.sprite.x = x;
    this.sprite.y = y;
    this.maxHealth = model === 'advanced' ? configuration.chaser.advancedHealth : configuration.chaser.basicHealth;
    this.health = this.maxHealth;
    this.speed = configuration.chaser.moveSpeed;
    this.avoidanceSide = Math.round(x + y) % 2 === 0 ? 1 : -1;
    const shipModel = model === 'advanced' ? 4 : 7;
    this.modelId = model === 'advanced' ? 'chaser-advanced' : 'chaser-basic';
    this.texturePath = `/assets/png/default/ships/ship_${shipModel}.png`;
  }

  public async init() {
    this.sprite.texture = await Assets.load(this.texturePath);
  }

  public takeHit(damage = 1): boolean {
    this.health = Math.max(0, this.health - damage);
    this.sprite.tint = this.health / this.maxHealth <= 0.5 ? 0xffa45e : 0xffffff;
    return this.health === 0;
  }

  public update(
    delta: number,
    playerX: number,
    playerY: number,
    isBlocked: (x: number, y: number, hitbox: number) => boolean = () => false,
  ) {
    const angle = moveTowardTarget(this.sprite, playerX, playerY, this.speed, delta, isBlocked, this.avoidanceSide);
    this.sprite.rotation = angle - Math.PI / 2;
  }

  public destroy() {
    this.sprite.destroy();
  }
}
