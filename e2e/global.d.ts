export {};

declare global {
  interface Window {
    __PIRATE_E2E_CONFIG__?: { seed: number; startTime?: number };
    __PIRATE_GAME_TEST__?: {
      advanceSimulation: (milliseconds: number) => void;
      snapshot: () => {
        score: number;
        health: number;
        timeLeft: number;
        isPaused: boolean;
        isGameOver: boolean;
        spawnCount: number;
        peakEnemyCount: number;
        peakEntityCount: number;
        player: { x: number; y: number; rotation: number };
        enemies: Array<{ kind: 'chaser' | 'shooter' | 'boss'; model: string; x: number; y: number; health: number }>;
        projectiles: Array<{ x: number; y: number }>;
        enemyProjectiles: Array<{ x: number; y: number }>;
        pickups: Array<{ x: number; y: number }>;
        entityCount: number;
      };
    };
  }
}
