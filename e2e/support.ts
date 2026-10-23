import { expect, test as base, type Page, type Route } from '@playwright/test';

export interface ScoreRecord {
  id: string;
  score: number;
  date: string;
  reason: string;
  playerName: string;
  isFixture?: boolean;
}

export interface ScoresApiMock {
  posts: Array<{ key: string | null; body: unknown }>;
  setScores: (records: ScoreRecord[]) => void;
  setGetMode: (mode: 'ok' | 'empty' | 'error' | 'delayed' | 'delayed-first') => void;
  setPostMode: (mode: 'ok' | 'timeout-first' | 'delayed-first') => void;
  records: () => ScoreRecord[];
}

export const fixtures: ScoreRecord[] = [
  ['Captain Flint', 38], ['Red Sparrow', 32], ['Blackbeard', 28],
  ['Davy Jones', 25], ['Anne Bonny', 24], ['Storm Rider', 21],
  ['Sea Wolf', 19], ['Iron Anchor', 15], ['Salty Dog', 12],
].map(([playerName, score], index) => ({
  id: `fixture-${index + 1}`,
  playerName: String(playerName),
  score: Number(score),
  date: '2026-01-01T00:00:00.000Z',
  reason: 'time_out',
  isFixture: true,
}));

export const test = base.extend<{ scoresApi: ScoresApiMock }>({
  scoresApi: async ({ page }, use) => {
    let records = [...fixtures];
    let getMode: 'ok' | 'empty' | 'error' | 'delayed' | 'delayed-first' = 'ok';
    let postMode: 'ok' | 'timeout-first' | 'delayed-first' = 'ok';
    const seenKeys = new Map<string, ScoreRecord>();
    const posts: ScoresApiMock['posts'] = [];
    let timedOutOnce = false;
    let delayedOnce = false;
    let delayedGetOnce = false;

    await page.route('**/api/scores', async (route: Route) => {
      const request = route.request();
      if (request.method() === 'GET') {
        const responseRecords = getMode === 'empty' ? [] : [...records];
        if (getMode === 'delayed' || (getMode === 'delayed-first' && !delayedGetOnce)) {
          delayedGetOnce = true;
          await new Promise((resolve) => setTimeout(resolve, 1_200));
        }
        if (getMode === 'error') {
          await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'unavailable' }) });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(responseRecords),
        });
        return;
      }

      if (request.method() === 'POST') {
        const key = request.headers()['idempotency-key'] ?? null;
        const body = request.postDataJSON() as Omit<ScoreRecord, 'id' | 'date' | 'isFixture'>;
        posts.push({ key, body });
        if (postMode === 'timeout-first' && !timedOutOnce) {
          timedOutOnce = true;
          await new Promise((resolve) => setTimeout(resolve, 900));
        }
        if (postMode === 'delayed-first' && !delayedOnce) {
          delayedOnce = true;
          await new Promise((resolve) => setTimeout(resolve, 900));
        }
        if (key && seenKeys.has(key)) {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(seenKeys.get(key)) });
          return;
        }
        const record: ScoreRecord = {
          ...body,
          id: `result-${posts.length}`,
          date: new Date().toISOString(),
          isFixture: false,
        };
        records = [record, ...records];
        if (key) seenKeys.set(key, record);
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(record) });
        return;
      }
      await route.fallback();
    });

    await use({
      posts,
      setScores: (nextRecords) => { records = [...nextRecords]; },
      setGetMode: (mode) => { getMode = mode; },
      setPostMode: (mode) => { postMode = mode; },
      records: () => [...records],
    });
  },
});

export { expect };

export async function gotoApp(page: Page, seed = 20261023, query = 'e2e=1') {
  await page.addInitScript((config) => {
    if (!sessionStorage.getItem('__pirate_e2e_context_ready')) {
      localStorage.clear();
      sessionStorage.setItem('__pirate_e2e_context_ready', '1');
    }
    window.__PIRATE_E2E_CONFIG__ = config;
  }, { seed, startTime: 1_000_000 });
  await page.goto(`/?${query}`);
  await expect(page.getByTestId('main-menu')).toBeVisible();
}

export async function openGame(page: Page, options: { time?: number; spawn?: number } = {}) {
  if (options.time || options.spawn) {
    await page.getByRole('button', { name: 'OPTIONS' }).click();
    if (options.time) await page.getByTestId(`session-time-${options.time}`).click();
    if (options.spawn) await page.getByTestId(`spawn-time-${options.spawn}`).click();
    await page.getByRole('button', { name: 'SAVE & CLOSE' }).click();
  }
  await page.getByRole('button', { name: 'PLAY' }).click();
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__PIRATE_GAME_TEST__));
}

export async function advance(page: Page, milliseconds: number) {
  await page.evaluate((ms) => window.__PIRATE_GAME_TEST__?.advanceSimulation(ms), milliseconds);
  await page.waitForTimeout(30);
}

export async function snapshot(page: Page) {
  return page.evaluate(() => window.__PIRATE_GAME_TEST__?.snapshot() ?? null);
}

export async function waitForSpawn(page: Page, count: number) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const state = await snapshot(page);
    if (state && state.spawnCount >= count) return state;
    await advance(page, 300);
  }
  throw new Error(`Enemy spawn count did not reach ${count}`);
}
