export interface GameTestSnapshot {
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
}

export interface GameTestHandle {
  advanceSimulation: (milliseconds: number) => void;
  snapshot: () => GameTestSnapshot;
}

export function isE2ERuntimeEnabled(): boolean {
  const params = new URLSearchParams(window.location.search);
  const testContextWasInjected = window.__PIRATE_E2E_CONFIG__ !== undefined;
  const realtimePerformanceRun = params.get('realtime') === '1';
  return (import.meta.env.DEV || import.meta.env.MODE === 'e2e')
    && params.get('e2e') === '1'
    && (testContextWasInjected || realtimePerformanceRun);
}

declare global {
  interface Window {
    __PIRATE_E2E_CONFIG__?: { seed: number; startTime?: number };
    __PIRATE_GAME_TEST__?: GameTestHandle;
  }
}
