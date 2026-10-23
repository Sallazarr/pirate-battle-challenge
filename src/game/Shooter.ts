import { Sprite, Assets } from 'pixi.js';

export class Shooter {
  public sprite: Sprite;
  public isDead = false;

  private speed = 1.5;
  private attackRange = 300;
  private lastShotTime = 0;
  private shootCooldown = 2000; // Dispara a cada 2 segundos

  private onShoot: (x: number, y: number, angle: number) => void;

  constructor(x: number, y: number, onShoot: (x: number, y: number, angle: number) => void) {
    this.sprite = new Sprite();
    this.sprite.anchor.set(0.5);
    this.sprite.x = x;
    this.sprite.y = y;
    this.onShoot = onShoot;
  }

  public async init() {
    // Usamos o navio normal para distinguir do Chaser (dark)
    this.sprite.texture = await Assets.load('/assets/png/default/ships/ship_13.png');
  }

  public update(delta: number, playerX: number, playerY: number) {
    const dx = playerX - this.sprite.x;
    const dy = playerY - this.sprite.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    // A imagem roda +90 graus
    this.sprite.rotation = angle - Math.PI / 2;

    if (distance > this.attackRange) {
      this.sprite.x += Math.cos(angle) * this.speed * delta;
      this.sprite.y += Math.sin(angle) * this.speed * delta;
    } else {
      const now = Date.now();
      if (now - this.lastShotTime > this.shootCooldown) {
        // O tiro é disparado no ângulo matemático
        this.onShoot(this.sprite.x, this.sprite.y, angle);
        this.lastShotTime = now;
      }
    }
  }

  public destroy() {
    this.sprite.destroy();
  }
}