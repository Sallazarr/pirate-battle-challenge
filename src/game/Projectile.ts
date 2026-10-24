import { Sprite, Assets } from 'pixi.js';
import type { GameConfiguration } from './gameConfig';

export class Projectile {
  public sprite: Sprite;
  public isDead = false;
  
  private readonly speed: number;
  private readonly maxDistance: number;
  private distanceTravelled = 0;
  private angle = 0;

  constructor(x: number, y: number, angle: number, configuration: GameConfiguration) {
    this.sprite = new Sprite();
    this.sprite.anchor.set(0.5);
    this.speed = configuration.weapons.projectileSpeed;
    this.maxDistance = configuration.weapons.projectileMaxDistance;
    this.spawn(x, y, angle);
  }

  public async init() {
    try {
      this.sprite.texture = await Assets.load('/assets/png/default/ship_parts/cannon_ball.png');
    } catch (e) {
      console.warn("Textura do projétil não encontrada:", e);
    }
  }

  public spawn(x: number, y: number, angle: number) {
    this.sprite.x = x;
    this.sprite.y = y;
    this.angle = angle;
    this.distanceTravelled = 0;
    this.sprite.rotation = angle;
    this.isDead = false;
    this.sprite.visible = true;
  }

  public despawn() {
    this.isDead = true;
    this.sprite.visible = false;
  }

  public update(delta: number) {
    if (this.isDead) return;
    
    const distance = this.speed * delta;
    this.sprite.x += Math.cos(this.angle) * distance;
    this.sprite.y += Math.sin(this.angle) * distance;
    this.distanceTravelled += distance;

    if (this.distanceTravelled >= this.maxDistance ||
      this.sprite.x < -4000 || 
      this.sprite.x > 4000 || 
      this.sprite.y < -4000 || 
      this.sprite.y > 4000
    ) {
      this.despawn();
    }
  }

  public destroy() {
    this.sprite.destroy();
  }
}
