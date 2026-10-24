export interface GameConfiguration {
  sessionSeconds: number;
  spawnIntervalSeconds: number;
  spawnIntervalRampMsPerSecond: number;
  minimumSpawnIntervalMs: number;
  player: {
    health: number;
    moveSpeed: number;
    rotationSpeed: number;
    collisionDamage: number;
    projectileDamage: number;
    pickupHeal: number;
  };
  chaser: {
    basicHealth: number;
    advancedHealth: number;
    moveSpeed: number;
    collisionDamage: number;
  };
  shooter: {
    basicHealth: number;
    advancedHealth: number;
    moveSpeed: number;
    attackRange: number;
    shotCooldownMs: number;
    projectileDamage: number;
  };
  boss: {
    health: number;
    moveSpeed: number;
    attackRange: number;
    shotCooldownMs: number;
  };
  weapons: {
    projectileSpeed: number;
    projectileMaxDistance: number;
    shotCooldownMs: number;
    lateralProjectileCount: number;
    lateralSpacing: number;
  };
  spawnPoints: ReadonlyArray<{ edge: 'top' | 'right' | 'bottom' | 'left'; offset: number }>;
}

export const DEFAULT_GAME_CONFIGURATION: Readonly<GameConfiguration> = Object.freeze({
  sessionSeconds: 60,
  spawnIntervalSeconds: 3,
  spawnIntervalRampMsPerSecond: 40,
  minimumSpawnIntervalMs: 600,
  player: {
    health: 100,
    moveSpeed: 3,
    rotationSpeed: 0.05,
    collisionDamage: 20,
    projectileDamage: 1,
    pickupHeal: 10,
  },
  chaser: {
    basicHealth: 1,
    advancedHealth: 2,
    moveSpeed: 2,
    collisionDamage: 20,
  },
  shooter: {
    basicHealth: 1,
    advancedHealth: 2,
    moveSpeed: 1.5,
    attackRange: 300,
    shotCooldownMs: 2_000,
    projectileDamage: 10,
  },
  boss: {
    health: 4,
    moveSpeed: 1.5,
    attackRange: 300,
    shotCooldownMs: 2_000,
  },
  weapons: {
    projectileSpeed: 8,
    projectileMaxDistance: 1_600,
    shotCooldownMs: 500,
    lateralProjectileCount: 3,
    lateralSpacing: 20,
  },
  spawnPoints: [
    { edge: 'top' as const, offset: 0.35 },
    { edge: 'right' as const, offset: 0.4 },
    { edge: 'bottom' as const, offset: 0.65 },
    { edge: 'left' as const, offset: 0.6 },
  ],
});

export function createMatchConfiguration(
  sessionSeconds = DEFAULT_GAME_CONFIGURATION.sessionSeconds,
  spawnIntervalSeconds = DEFAULT_GAME_CONFIGURATION.spawnIntervalSeconds,
): GameConfiguration {
  return {
    ...DEFAULT_GAME_CONFIGURATION,
    sessionSeconds,
    spawnIntervalSeconds,
    player: { ...DEFAULT_GAME_CONFIGURATION.player },
    chaser: { ...DEFAULT_GAME_CONFIGURATION.chaser },
    shooter: { ...DEFAULT_GAME_CONFIGURATION.shooter },
    boss: { ...DEFAULT_GAME_CONFIGURATION.boss },
    weapons: { ...DEFAULT_GAME_CONFIGURATION.weapons },
    spawnPoints: DEFAULT_GAME_CONFIGURATION.spawnPoints.map((point) => ({ ...point })),
  };
}

export function configurationKey(configuration: GameConfiguration): string {
  return JSON.stringify(configuration);
}
