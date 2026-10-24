import { expect, test as base, type Page } from '@playwright/test';
import type { MatchRecord } from '../src/api/scoreTypes';
import { createDefaultScoreFixtures } from '../src/mocks/fixtures';
import {
  MOCK_POST_LOG_KEY,
  MOCK_RECORDS_KEY,
  MOCK_SCENARIO_KEY,
  MOCK_SEQUENCE_KEY,
} from '../src/mocks/networkScenarios';
import type { NetworkScenario, NetworkScenarioSettings } from '../src/mocks/networkScenarios';

export type ScoreRecord = MatchRecord;

export interface MockPost {
  key: string | null;
  body: unknown;
}

export interface ScoresApiMock {
  fixtures: ScoreRecord[];
  setScores: (records: ScoreRecord[]) => Promise<void>;
  setScenario: (name: NetworkScenario, settings?: Partial<NetworkScenarioSettings>) => Promise<void>;
  records: () => Promise<ScoreRecord[]>;
  posts: () => Promise<MockPost[]>;
}

export const fixtures = createDefaultScoreFixtures();

export const test = base.extend<{ scoresApi: ScoresApiMock }>({
  scoresApi: async ({ page }, use) => {
    await use({
      fixtures,
      setScores: async (records) => page.evaluate(({ key, records: nextRecords }) => {
        localStorage.setItem(key, JSON.stringify(nextRecords));
      }, { key: MOCK_RECORDS_KEY, records }),
      setScenario: async (name, settings = {}) => page.evaluate(({ key, sequenceKey, config }) => {
        localStorage.setItem(key, JSON.stringify(config));
        localStorage.removeItem(sequenceKey);
      }, {
        key: MOCK_SCENARIO_KEY,
        sequenceKey: MOCK_SEQUENCE_KEY,
        config: { ...settings, name, seed: settings.seed ?? 4100 },
      }),
      records: async () => {
        const stored = await page.evaluate((key) => {
          try {
            return JSON.parse(localStorage.getItem(key) ?? '[]') as ScoreRecord[];
          } catch {
            return [];
          }
        }, MOCK_RECORDS_KEY);
        return [...fixtures, ...stored];
      },
      posts: () => page.evaluate((key) => {
        try {
          return JSON.parse(localStorage.getItem(key) ?? '[]') as MockPost[];
        } catch {
          return [];
        }
      }, MOCK_POST_LOG_KEY),
    });
  },
});

export { expect };

export async function gotoApp(page: Page, seed = 20261023, query = 'e2e=1') {
  await page.addInitScript((config) => {
    if (!sessionStorage.getItem('__pirate_e2e_context_ready')) {
      localStorage.clear();
      localStorage.setItem('pirate_battle_player_id', 'e2e-player');
      localStorage.setItem('pirate_battle_mock_scenario', JSON.stringify({ name: 'success', seed: config.seed }));
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
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const state = await snapshot(page);
    if (state && state.spawnCount >= count) return state;
    await advance(page, 300);
  }
  throw new Error(`Enemy spawn count did not reach ${count}`);
}
