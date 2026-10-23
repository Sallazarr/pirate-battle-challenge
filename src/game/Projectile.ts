import { Sprite, Assets } from 'pixi.js';

export class Projectile {
  public sprite: Sprite;
  public isDead = false;
  
  private speed = 8;
  private angle = 0;

  constructor(x: number, y: number, angle: number) {
    this.sprite = new Sprite();
    this.sprite.anchor.set(0.5);
    this.spawn(x, y, angle);
  }

  public async init() {
    try {
      this.sprite.texture = await Assets.load('/assets/png/default/ship_parts/cannon_ball.png');
    } catch (e) {
      console.warn("Textura do projétil não encontrada:", e);
    }
  }

  // OBJECT POOLING: Repor estado em vez de instanciar de novo
  public spawn(x: number, y: number, angle: number) {
    this.sprite.x = x;
    this.sprite.y = y;
    this.angle = angle;
    this.sprite.rotation = angle;
    this.isDead = false;
    this.sprite.visible = true;
  }

  // OBJECT POOLING: Ocultar em vez de destruir
  public despawn() {
    this.isDead = true;
    this.sprite.visible = false;
  }

  public update(delta: number) {
    if (this.isDead) return;
    
    this.sprite.x += Math.cos(this.angle) * this.speed * delta;
    this.sprite.y += Math.sin(this.angle) * this.speed * delta;

    if (
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