import { Sprite, Assets } from 'pixi.js';
import { now } from './gameClock';

export class Shooter {
  public sprite: Sprite;
  public isDead = false;
  public health: number;
  public modelId: string;

  private speed = 1.5;
  private attackRange = 300;
  private lastShotTime = 0;
  private shootCooldown = 2000; // Dispara a cada 2 segundos

  private onShoot: (x: number, y: number, angle: number) => void;
  private texturePath: string;

  constructor(
    x: number,
    y: number,
    onShoot: (x: number, y: number, angle: number) => void,
    model: 'basic' | 'advanced' = 'basic',
    texturePath?: string
  ) {
    this.sprite = new Sprite();
    this.sprite.anchor.set(0.5);
    this.sprite.x = x;
    this.sprite.y = y;
    this.onShoot = onShoot;
    this.health = model === 'advanced' ? 2 : 1;
    const shipModel = model === 'advanced' ? 6 : 13;
    this.modelId = model === 'advanced' ? 'shooter-advanced' : 'shooter-basic';
    this.texturePath = texturePath ?? `/assets/png/default/ships/ship_${shipModel}.png`;
  }

  public async init() {
    this.sprite.texture = await Assets.load(this.texturePath);
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
      const currentTime = now();
      if (currentTime - this.lastShotTime > this.shootCooldown) {
        // O tiro é disparado no ângulo matemático
        this.onShoot(this.sprite.x, this.sprite.y, angle);
        this.lastShotTime = currentTime;
      }
    }
  }

  public takeHit(): boolean {
    this.health = Math.max(0, this.health - 1);
    return this.health === 0;
  }

  public destroy() {
    this.sprite.destroy();
  }
}
