import { Shooter } from './Shooter';
import type { GameConfiguration } from './gameConfig';

export class Boss extends Shooter {
  constructor(
    x: number,
    y: number,
    onShoot: (x: number, y: number, angle: number) => void,
    model: 'armored' | 'corsair',
    configuration: GameConfiguration,
  ) {
    const shipModel = model === 'armored' ? 24 : 21;
    super(x, y, onShoot, 'basic', configuration, `/assets/png/default/ships/ship_${shipModel}.png`);
    this.maxHealth = configuration.boss.health;
    this.health = this.maxHealth;
    this.speed = configuration.boss.moveSpeed;
    this.attackRange = configuration.boss.attackRange;
    this.shootCooldown = configuration.boss.shotCooldownMs;
    this.modelId = `boss-${model}`;
    this.sprite.scale.set(1.35);
  }

  public async init() {
    await super.init();
  }
}
