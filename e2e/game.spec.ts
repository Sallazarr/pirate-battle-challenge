import type { Page } from '@playwright/test';
import { createMatchConfiguration } from '../src/game/gameConfig';
import { test, expect, gotoApp, openGame, advance, snapshot, waitForSpawn, fixtures } from './support';

test.beforeEach(async ({ page }, testInfo) => {
  await gotoApp(page, 4100 + testInfo.workerIndex * 31 + testInfo.repeatEachIndex);
});

test('navigates the menu and validates, saves, and restores options', async ({ page }) => {
  await page.getByRole('button', { name: 'OPTIONS' }).click();
  const captain = page.getByLabel('Captain Name');
  await captain.fill('   ');
  await expect(page.getByRole('button', { name: 'SAVE & CLOSE' })).toBeDisabled();
  await captain.fill('Black Pearl');
  await page.getByTestId('session-time-90').click();
  await page.getByTestId('spawn-time-4').click();
  await page.getByRole('button', { name: 'SAVE & CLOSE' }).click();
  await expect(page.getByText('Black Pearl')).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'OPTIONS' }).click();
  await expect(page.getByLabel('Captain Name')).toHaveValue('Black Pearl');
  await expect(page.getByTestId('session-time-90')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('spawn-time-4')).toHaveAttribute('aria-pressed', 'true');
});

test('reports an asset load failure and retries the real Pixi initialization', async ({ page }) => {
  let failedOnce = false;
  await page.route('**/assets/png/default/tiles/tile_73.png', async (route) => {
    if (!failedOnce) {
      failedOnce = true;
      await route.abort('failed');
      return;
    }
    await route.continue();
  });

  await page.getByRole('button', { name: 'PLAY' }).click();
  await expect(page.getByTestId('asset-load-error')).toBeVisible();
  await page.getByRole('button', { name: 'RETRY' }).click();
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__PIRATE_GAME_TEST__));
  expect(failedOnce).toBe(true);
});

test('loads and renders the arena assets at a stable state', async ({ page }) => {
  await openGame(page, { time: 180, spawn: 5 });
  await advance(page, 500);
  const state = await snapshot(page);
  expect(state?.health).toBe(100);
  expect(state?.spawnCount).toBe(0);
  await expect(page.getByTestId('game-canvas')).toHaveScreenshot('arena-stable.png', { animations: 'disabled' });
});

test('moves, rotates, clamps at the arena edge, and collides with an island', async ({ page }) => {
  await openGame(page, { time: 180, spawn: 5 });
  const start = await snapshot(page);
  await page.keyboard.down('w');
  await advance(page, 600);
  await page.keyboard.up('w');
  const moved = await snapshot(page);
  expect(moved?.player.x).toBeGreaterThan(start!.player.x);

  await page.keyboard.down('d');
  await advance(page, 350);
  await page.keyboard.up('d');
  const rotated = await snapshot(page);
  expect(rotated?.player.rotation).toBeGreaterThan(moved!.player.rotation);

  await page.keyboard.down('w');
  await advance(page, 12_000);
  const atEdge = await snapshot(page);
  await advance(page, 2_000);
  await page.keyboard.up('w');
  const afterEdge = await snapshot(page);
  expect(Math.abs(afterEdge!.player.x - atEdge!.player.x)).toBeLessThan(1);

  await page.getByTestId('pause-button').click();
  await page.getByRole('button', { name: 'RESTART' }).click();
  await page.keyboard.down('w');
  await advance(page, 1_400);
  await page.keyboard.up('w');
  await page.keyboard.down('d');
  await advance(page, 550);
  await page.keyboard.up('d');
  const approachingIsland = await snapshot(page);
  await page.keyboard.down('w');
  await advance(page, 2_000);
  await page.keyboard.up('w');
  const blockedByIsland = await snapshot(page);
  expect(blockedByIsland!.player.y).toBeGreaterThan(approachingIsland!.player.y);
  expect(blockedByIsland!.player.y).toBeLessThan(340);
});

test('fires front and both broadsides, honoring the shot cooldown', async ({ page }) => {
  await openGame(page, { time: 180, spawn: 5 });
  await page.keyboard.down('Space');
  await advance(page, 80);
  const firstShot = await snapshot(page);
  await advance(page, 250);
  const beforeCooldown = await snapshot(page);
  expect(beforeCooldown!.projectiles.length).toBe(firstShot!.projectiles.length);
  await advance(page, 400);
  const afterCooldown = await snapshot(page);
  expect(afterCooldown!.projectiles.length).toBeGreaterThan(firstShot!.projectiles.length);
  await page.keyboard.up('Space');

  const countBeforeLeft = afterCooldown!.projectiles.length;
  await advance(page, 600);
  await page.keyboard.down('q');
  await advance(page, 20);
  await page.keyboard.up('q');
  const afterLeft = await snapshot(page);
  expect(afterLeft!.projectiles.length).toBeGreaterThan(countBeforeLeft);

  await page.keyboard.down('e');
  await advance(page, 600);
  await advance(page, 20);
  await page.keyboard.up('e');
  await advance(page, 50);
  const afterRight = await snapshot(page);
  expect(afterRight!.projectiles.length).toBeGreaterThan(afterLeft!.projectiles.length);
});

test('spawns Chasers and Shooters with fixed basic and advanced models and real movement', async ({ page }) => {
  await openGame(page, { time: 180, spawn: 2 });
  const first = await waitForSpawn(page, 1);
  expect(first.enemies.length).toBeGreaterThan(0);
  const firstPosition = { ...first.enemies[0] };
  await advance(page, 1_000);
  const moved = await snapshot(page);
  const sameEnemy = moved!.enemies.find((enemy) => enemy.model === firstPosition.model);
  expect(sameEnemy).toBeTruthy();
  expect(Math.hypot(sameEnemy!.x - firstPosition.x, sameEnemy!.y - firstPosition.y)).toBeGreaterThan(1);

  const observedModels = new Set<string>();
  const observedHealth = new Set<number>();
  for (let i = 0; i < 18; i += 1) {
    await advance(page, 1_000);
    const state = await snapshot(page);
    for (const enemy of state!.enemies) {
      if (enemy.kind !== 'boss') {
        observedModels.add(enemy.model);
        observedHealth.add(enemy.health);
      }
    }
  }
  expect([...observedModels].some((model) => model.endsWith('-basic'))).toBe(true);
  expect([...observedModels].some((model) => model.endsWith('-advanced'))).toBe(true);
  expect(observedHealth.has(1)).toBe(true);
  expect(observedHealth.has(2)).toBe(true);
  let finalState = await snapshot(page);
  for (let attempt = 0; attempt < 14 && !finalState!.enemyProjectiles.length && !finalState!.isGameOver; attempt += 1) {
    await advance(page, 1_000);
    finalState = await snapshot(page);
  }
  expect(finalState!.enemyProjectiles.length).toBeGreaterThan(0);
});

test('honors the configured interval before the first enemy spawn', async ({ page }) => {
  await openGame(page, { time: 180, spawn: 2 });
  await advance(page, 1_900);
  expect((await snapshot(page))!.spawnCount).toBe(0);
  await advance(page, 200);
  expect((await snapshot(page))!.spawnCount).toBe(1);
});

test('spawns a boss every fifth enemy spawn with four health and only the boss health bar', async ({ page }) => {
  await openGame(page, { time: 180, spawn: 2 });
  const state = await waitForSpawn(page, 5);
  const boss = state.enemies.find((enemy) => enemy.kind === 'boss');
  expect(boss).toBeTruthy();
  expect(boss!.health).toBe(4);
  expect(boss!.model).toMatch(/^boss-(armored|corsair)$/);
  const frameCount = await page.evaluate(() => {
    const app = window.__PIRATE_GAME_TEST__;
    return document.querySelectorAll('canvas').length + (app ? 0 : 0);
  });
  expect(frameCount).toBe(1);
});

test('pauses on focus loss, freezes the clock, and restarts with clean state', async ({ page }) => {
  await openGame(page, { time: 90, spawn: 5 });
  await advance(page, 1_500);
  const beforePause = await snapshot(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByText('PAUSED')).toBeVisible();
  await advance(page, 3_000);
  expect((await snapshot(page))!.timeLeft).toBe(beforePause!.timeLeft);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await advance(page, 1_000);
  expect((await snapshot(page))!.timeLeft).toBe(beforePause!.timeLeft);
  await page.getByRole('button', { name: 'RESTART' }).click();
  const restarted = await snapshot(page);
  expect(restarted).toMatchObject({ score: 0, health: 100, timeLeft: 90, spawnCount: 0, isPaused: false, isGameOver: false });
  expect(restarted!.enemies).toHaveLength(0);
  expect(restarted!.projectiles).toHaveLength(0);
});

test('ends on time, saves and restores the result after refresh', async ({ page, scoresApi }) => {
  await openGame(page, { time: 60, spawn: 3 });
  await advance(page, 60_000);
  await expect(page.getByTestId('result-screen')).toBeVisible();
  await expect(page.getByText('BATTLE COMPLETE')).toBeVisible();
  await expect.poll(async () => (await scoresApi.records()).length).toBe(fixtures.length + 1);
  const savedScore = await page.getByTestId('result-score').textContent();
  await page.reload();
  await expect(page.getByTestId('result-screen')).toBeVisible();
  await expect(page.getByTestId('result-score')).toHaveText(savedScore!);
});

test('ends by enemy damage and persists the result, and cleans up on abandonment', async ({ page }) => {
  await openGame(page, { time: 180, spawn: 2 });
  let result = await snapshot(page);
  for (let i = 0; i < 90 && !result!.isGameOver; i += 1) {
    await advance(page, 1_000);
    result = await snapshot(page);
  }
  await expect(page.getByTestId('result-screen')).toBeVisible();
  expect(result!.health).toBeLessThanOrEqual(0);
  await page.reload();
  await expect(page.getByTestId('result-screen')).toBeVisible();
  await page.getByRole('button', { name: 'MAIN MENU' }).click();
  await expect(page.getByTestId('main-menu')).toBeVisible();

  for (let i = 0; i < 2; i += 1) {
    await page.getByRole('button', { name: 'OPTIONS' }).click();
    await page.getByRole('button', { name: 'CANCEL' }).click();
    await page.getByRole('button', { name: 'RANKING' }).click();
    await page.getByRole('button', { name: 'CLOSE' }).click();
    await page.getByRole('button', { name: 'HISTORY' }).click();
    await page.getByRole('button', { name: 'CLOSE' }).click();
  }
  await openGame(page);
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await page.getByTestId('pause-button').click();
  await page.getByRole('button', { name: 'MAIN MENU' }).click();
  await expect(page.getByTestId('main-menu')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('uses mobile touch controls to rotate and move the ship', async ({ page, context }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'Touch control behavior is covered by the mobile Chromium project');
  await openGame(page, { time: 180, spawn: 5 });
  const before = await snapshot(page);
  const left = await page.getByTestId('touch-turn-left').boundingBox();
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: left!.x + 25, y: left!.y + 25, id: 1 }] });
  await advance(page, 350);
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const afterTurn = await snapshot(page);
  expect(afterTurn!.player.rotation).toBeLessThan(before!.player.rotation);

  const forward = await page.getByTestId('touch-forward').boundingBox();
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: forward!.x + 25, y: forward!.y + 25, id: 2 }] });
  await advance(page, 500);
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const afterForward = await snapshot(page);
  expect(Math.hypot(afterForward!.player.x - afterTurn!.player.x, afterForward!.player.y - afterTurn!.player.y)).toBeGreaterThan(1);
});

test('paginates Ranking and Match History, including empty and failed reads', async ({ page, scoresApi }) => {
  await scoresApi.setScores(fixtures.map((record, index) => ({ ...record, id: `extra-${index}`, playerId: `extra-player-${index}` })));
  await page.reload();
  await page.getByRole('button', { name: 'RANKING' }).click();
  await expect(page.getByTestId('ranking-pagination')).toBeVisible();
  await expect(page.getByTestId('ranking-pagination')).toContainText('1 / 2');
  await page.getByRole('button', { name: 'Next ranking page' }).click();
  await expect(page.getByTestId('ranking-pagination')).toContainText('2 / 2');
  await page.getByRole('button', { name: 'CLOSE' }).click();

  const personalRecords = Array.from({ length: 7 }, (_, index) => ({
    id: `history-${index}`,
    playerName: 'Captain Jack',
    score: 20 - index,
    date: '2026-10-23T00:00:00.000Z',
    reason: index % 2 ? 'time_out' as const : 'ship_destroyed' as const,
    playerId: 'e2e-player',
    durationSeconds: 60,
    configuration: createMatchConfiguration(60, 3),
  }));
  await scoresApi.setScores(personalRecords);
  await page.reload();
  await page.getByRole('button', { name: 'HISTORY' }).click();
  await expect(page.getByTestId('history-pagination')).toContainText('1 / 2');
  await page.getByRole('button', { name: 'Next history page' }).click();
  await expect(page.getByTestId('history-pagination')).toContainText('2 / 2');
});

test('shows query loading, empty, and error states with retry', async ({ page, scoresApi }) => {
  await scoresApi.setScenario('slow', { latencyMs: 1_200 });
  await page.reload();
  await page.getByRole('button', { name: 'RANKING' }).click();
  await expect(page.getByTestId('scores-loading')).toBeVisible();
  await expect(page.getByTestId('ranking-modal')).toBeVisible();
  await page.getByRole('button', { name: 'CLOSE' }).click();

  await scoresApi.setScenario('empty');
  await page.reload();
  await page.getByRole('button', { name: 'RANKING' }).click();
  await expect(page.getByTestId('ranking-empty')).toBeVisible();
  await page.getByRole('button', { name: 'CLOSE' }).click();

  await scoresApi.setScenario('ranking-error');
  await page.reload();
  await page.getByRole('button', { name: 'RANKING' }).click();
  await expect(page.getByRole('alert')).toContainText('Could not load scores');
  await page.getByRole('button', { name: 'RETRY' }).click();
  await expect(page.getByRole('alert')).toContainText('Could not load scores');
});

test('registers one match and refreshes Ranking and Match History; recovers a pending outbox entry', async ({ page, scoresApi }) => {
  await openGame(page, { time: 60, spawn: 3 });
  await advance(page, 60_000);
  await expect(page.getByTestId('result-screen')).toBeVisible();
  await expect.poll(async () => (await scoresApi.records()).length).toBe(fixtures.length + 1);
  await page.getByRole('button', { name: 'MAIN MENU' }).click();
  await page.getByRole('button', { name: 'HISTORY' }).click();
  await expect(page.getByText(/Score:/)).toBeVisible();
  await page.getByRole('button', { name: 'CLOSE' }).click();
  await page.getByRole('button', { name: 'RANKING' }).click();
  await page.getByRole('button', { name: 'Next ranking page' }).click();
  await expect(page.getByTestId('ranking-modal').getByText('Captain Jack')).toBeVisible();

  await page.getByRole('button', { name: 'CLOSE' }).click();
  await page.evaluate(() => {
    localStorage.setItem('pirate_battle_last_result', JSON.stringify({ score: 7, health: 70, reason: 'time_out', playerName: 'Pending Captain', date: new Date().toISOString() }));
    localStorage.setItem('pirate_battle_pending_score', JSON.stringify({ idempotencyKey: 'recover-key', record: { score: 7, reason: 'time_out', playerName: 'Pending Captain' } }));
  });
  await page.reload();
  await expect(page.getByTestId('result-screen')).toBeVisible();
  await expect.poll(async () => (await scoresApi.records()).filter((record) => record.playerName === 'Pending Captain').length).toBe(1);
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('pirate_battle_pending_score'))).toBeNull();
});

test('retries a timed out submission with the same key and tolerates delayed stale score reads', async ({ page, scoresApi }) => {
  await scoresApi.setScenario('timeout-after-commit', { responseDelayMs: 900 });
  await openGame(page, { time: 60, spawn: 5 });
  await advance(page, 60_000);
  await expect(page.getByTestId('result-screen')).toBeVisible();
  await expect.poll(async () => (await scoresApi.posts()).length).toBeGreaterThanOrEqual(2);
  const posts = await scoresApi.posts();
  expect(posts[0].key).toBeTruthy();
  expect(posts.map((post) => post.key).every((key) => key === posts[0].key)).toBe(true);
  expect((await scoresApi.records()).filter((record) => !record.isFixture)).toHaveLength(1);

  await page.getByRole('button', { name: 'MAIN MENU' }).click();
  await page.evaluate(() => {
    localStorage.setItem('pirate_battle_last_result', JSON.stringify({ score: 99, health: 100, reason: 'time_out', playerName: 'Recent Captain', date: new Date().toISOString() }));
    localStorage.setItem('pirate_battle_pending_score', JSON.stringify({ idempotencyKey: 'recent-response-key', record: { score: 99, reason: 'time_out', playerName: 'Recent Captain' } }));
  });
  await scoresApi.setScenario('out-of-order', { latencyMs: 1_200 });
  await page.reload();
  await expect(page.getByTestId('result-screen')).toBeVisible();
  await expect.poll(async () => (await scoresApi.records()).filter((record) => record.playerName === 'Recent Captain').length).toBe(1);
  await page.getByRole('button', { name: 'MAIN MENU' }).click();
  await page.getByRole('button', { name: 'HISTORY' }).click();
  await expect(page.getByTestId('history-modal').getByText(/Score:/).first()).toBeVisible();
});

test('captures versioned visual baselines for menu and result states', async ({ page }) => {
  await expect(page.getByTestId('app-surface')).toHaveScreenshot('menu.png', { animations: 'disabled' });
  await openGame(page, { time: 60, spawn: 5 });
  await advance(page, 60_000);
  await expect(page.getByTestId('result-screen')).toBeVisible();
  await expect(page.getByTestId('app-surface')).toHaveScreenshot('result.png', { animations: 'disabled' });
});

export async function aimAtEnemy(page: Page, targetModel?: string) {
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const state = await snapshot(page);
    const target = state?.enemies.find((enemy) => !targetModel || enemy.model === targetModel);
    if (!state || !target) return false;
    const desiredAngle = Math.atan2(target.y - state.player.y, target.x - state.player.x);
    const currentAngle = state.player.rotation + Math.PI / 2;
    let difference = desiredAngle - currentAngle;
    while (difference > Math.PI) difference -= Math.PI * 2;
    while (difference < -Math.PI) difference += Math.PI * 2;
    if (Math.abs(difference) < 0.08) return true;
    const key = difference > 0 ? 'd' : 'a';
    await page.keyboard.down(key);
    await advance(page, Math.min(1_200, Math.ceil(Math.abs(difference) / 0.05) * (1000 / 60)));
    await page.keyboard.up(key);
  }
  return true;
}

export async function fireAtEnemy(page: Page, targetModel?: string) {
  const initialScore = (await snapshot(page))?.score ?? 0;
  for (let iteration = 0; iteration < 30; iteration += 1) {
    const state = await snapshot(page);
    if (!state || !state.enemies.some((enemy) => !targetModel || enemy.model === targetModel)) break;
    await aimAtEnemy(page, targetModel);
    await page.keyboard.down('Space');
    await advance(page, 250);
    await page.keyboard.up('Space');
    await advance(page, 100);
    const after = await snapshot(page);
    if (after && after.score > initialScore) return after.score;
  }
  return (await snapshot(page))?.score ?? initialScore;
}

test('uses real controls to damage and score an enemy once', async ({ page }) => {
  await openGame(page, { time: 180, spawn: 5 });
  await waitForSpawn(page, 1);
  const state = await snapshot(page);
  const target = state!.enemies[0];
  expect(target.health).toBeGreaterThanOrEqual(1);
  const score = await fireAtEnemy(page, target.model);
  expect(score).toBeGreaterThan(0);
  await page.keyboard.down('Space');
  await advance(page, 2_000);
  await page.keyboard.up('Space');
  expect((await snapshot(page))!.score).toBe(score);
});
