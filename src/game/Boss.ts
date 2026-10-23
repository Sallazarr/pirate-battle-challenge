import { Assets, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';
import { Shooter } from './Shooter';

export class Boss extends Shooter {
  public readonly healthFrame = new Sprite();
  public readonly healthFill = new Sprite();
  public health = 4;
  private readonly maxHealth = 4;
  private redHealthTexture!: Texture;
  private amberHealthTexture!: Texture;
  private greenHealthTexture!: Texture;

  constructor(x: number, y: number, onShoot: (x: number, y: number, angle: number) => void, model: 'armored' | 'corsair') {
    const shipModel = model === 'armored' ? 24 : 21;
    super(x, y, onShoot, 'basic', `/assets/png/default/ships/ship_${shipModel}.png`);
    this.modelId = `boss-${model}`;
  }

  public async init() {
    await super.init();
    this.sprite.scale.set(1.35);

    const [frame, red, amber, green] = await Promise.all([
      Assets.load('/assets/png/default/ui/hud/enemy_health_frame.png'),
      Assets.load('/assets/png/default/ui/hud/enemy_health_fill_red.png'),
      Assets.load('/assets/png/default/ui/hud/health_fill_amber.png'),
      Assets.load('/assets/png/default/ui/hud/enemy_health_fill_green.png'),
    ]);
    this.healthFrame.texture = frame;
    this.redHealthTexture = red;
    this.amberHealthTexture = amber;
    this.greenHealthTexture = green;
    this.healthFrame.anchor.set(0.5, 1);
    this.healthFrame.width = 72;
    this.healthFrame.height = 16;
    this.healthFill.anchor.set(0, 0.5);
    this.healthFill.height = 7;
    this.syncHealthBar();
  }

  public takeHit(): boolean {
    this.health = Math.max(0, this.health - 1);
    this.syncHealthBar();
    return this.health === 0;
  }

  public syncHealthBar() {
    const barY = this.sprite.y - this.sprite.height / 2 - 4;
    this.healthFrame.position.set(this.sprite.x, barY);
    this.healthFill.position.set(this.sprite.x - 27, barY - this.healthFrame.height / 2);
    const fillTexture = this.health <= 1
      ? this.redHealthTexture
      : this.health <= 2
        ? this.amberHealthTexture
        : this.greenHealthTexture;
    if (this.healthFill.texture !== fillTexture) this.healthFill.texture = fillTexture;
    this.healthFill.width = 54 * (this.health / this.maxHealth);
  }

  public destroy() {
    super.destroy();
    this.healthFrame.destroy();
    this.healthFill.destroy();
  }
}
