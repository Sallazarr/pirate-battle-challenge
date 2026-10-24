import type { GameConfiguration } from './gameConfig';
import { Boss } from './Boss';
import { Chaser } from './Chaser';
import { Shooter } from './Shooter';
import { random } from './random';

type EnemyShoot = (x: number, y: number, angle: number) => Promise<void>;
export type SpawnableEnemy = Chaser | Shooter;

export interface ArenaBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export class EnemySpawner {
  private spawnCount = 0;
  private chaserCount = 0;
  private shooterCount = 0;
  private configuration: GameConfiguration;

  constructor(configuration: GameConfiguration) {
    this.configuration = configuration;
  }

  public configure(configuration: GameConfiguration): void {
    this.configuration = configuration;
  }

  public reset(): void {
    this.spawnCount = 0;
    this.chaserCount = 0;
    this.shooterCount = 0;
  }

  public get totalSpawns(): number {
    return this.spawnCount;
  }

  public createNext(bounds: ArenaBounds, edgeDistance: number, onShoot: EnemyShoot): SpawnableEnemy | null {
    const spawnPoints = this.configuration.spawnPoints;
    const spawn = spawnPoints[Math.floor(random() * spawnPoints.length)];
    if (!spawn) return null;

    this.spawnCount += 1;
    const offset = Math.max(0.1, Math.min(0.9, spawn.offset));
    let x: number;
    let y: number;
    switch (spawn.edge) {
      case 'top':
        x = bounds.left + (bounds.right - bounds.left) * offset;
        y = bounds.top - edgeDistance;
        break;
      case 'right':
        x = bounds.right + edgeDistance;
        y = bounds.top + (bounds.bottom - bounds.top) * offset;
        break;
      case 'bottom':
        x = bounds.left + (bounds.right - bounds.left) * offset;
        y = bounds.bottom + edgeDistance;
        break;
      case 'left':
        x = bounds.left - edgeDistance;
        y = bounds.top + (bounds.bottom - bounds.top) * offset;
        break;
    }

    if (this.spawnCount % 5 === 0) {
      const model = Math.floor(this.spawnCount / 5) % 2 === 1 ? 'armored' : 'corsair';
      return new Boss(x, y, onShoot, model, this.configuration);
    }
    if (random() > 0.5) {
      const model = this.chaserCount++ % 2 === 0 ? 'basic' : 'advanced';
      return new Chaser(x, y, model, this.configuration);
    }
    const model = this.shooterCount++ % 2 === 0 ? 'basic' : 'advanced';
    return new Shooter(x, y, onShoot, model, this.configuration);
  }
}
