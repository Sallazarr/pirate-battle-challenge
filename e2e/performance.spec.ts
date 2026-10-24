import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('profiles a three minute optimized combat session and five lifecycle cycles', async ({ page, browserName }, testInfo) => {
  const browser = page.context().browser();
  const browserCdp = browser ? await browser.newBrowserCDPSession() : null;
  let gpuInfo: unknown = null;
  if (browserCdp) {
    try {
      const systemInfo = await browserCdp.send('SystemInfo.getInfo');
      gpuInfo = {
        devices: systemInfo.gpu.devices,
        auxAttributes: systemInfo.gpu.auxAttributes,
        featureStatus: systemInfo.gpu.featureStatus,
      };
    } catch (error) {
      gpuInfo = { error: String(error) };
    }
  }
  const profile: Record<string, unknown> = {
    date: new Date().toISOString(), browser: `${browserName} ${await page.evaluate(() => navigator.userAgent).catch(() => 'Chromium')}`,
    browserVersion: browser?.version() ?? null,
    rendererMode: 'headless with GPU enabled; ANGLE D3D11 requested, actual backend recorded below',
    gpu: gpuInfo,
    targetFps: 60,
    viewport: { width: 1365, height: 900 }, devicePixelRatio: 1,
    configuration: { seed: 20261023, durationMs: 180_000, spawnIntervalSeconds: 2, simulation: 'production realtime' },
    hardware: await page.evaluate(() => ({ cores: navigator.hardwareConcurrency, deviceMemoryGB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null })),
  };
  await page.goto('/?e2e=1&realtime=1');
  await page.getByRole('button', { name: 'OPTIONS' }).click();
  await page.getByTestId('session-time-180').click();
  await page.getByTestId('spawn-time-2').click();
  await page.getByRole('button', { name: 'SAVE & CLOSE' }).click();
  await page.getByRole('button', { name: 'PLAY' }).click();
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__PIRATE_GAME_TEST__));
  const cdp = await page.context().newCDPSession(page);
  const samples: number[] = [];
  await page.evaluate(() => {
    (window as Window & { __perfFrames?: number[]; __perfLast?: number }).__perfFrames = [];
    const track = (time: number) => {
      const w = window as Window & { __perfFrames?: number[]; __perfLast?: number; __perfStop?: boolean };
      if (w.__perfStop) return;
      if (w.__perfLast !== undefined) w.__perfFrames?.push(time - w.__perfLast);
      w.__perfLast = time;
      requestAnimationFrame(track);
    };
    requestAnimationFrame(track);
  });
  await cdp.send('HeapProfiler.enable');
  await cdp.send('HeapProfiler.collectGarbage');
  const heapStart = await cdp.send('Runtime.getHeapUsage');
  const start = Date.now();
  while (Date.now() - start < 180_000) {
    await page.waitForTimeout(1_000);
    const snap = await page.evaluate(() => window.__PIRATE_GAME_TEST__?.snapshot());
    if (snap) {
      profile['peakEntities'] = Math.max(Number(profile['peakEntities'] ?? 0), snap.peakEntityCount);
      profile['peakEnemies'] = Math.max(Number(profile['peakEnemies'] ?? 0), snap.peakEnemyCount);
      profile['finalEntities'] = snap.entityCount;
      profile['spawnCount'] = snap.spawnCount;
    }
  }
  const heapAfterCombat = await cdp.send('Runtime.getHeapUsage');
  const measurements = await page.evaluate(() => {
    const w = window as Window & { __perfFrames?: number[]; __perfStop?: boolean };
    w.__perfStop = true;
    return w.__perfFrames ?? [];
  });
  samples.push(...measurements);
  const sorted = [...samples].sort((a, b) => a - b);
  const averageFps = samples.length ? samples.length / ((measurements.reduce((a, b) => a + b, 0)) / 1000) : 0;
  profile['targetAchieved'] = averageFps >= 60;
  profile['combat'] = {
    elapsedMs: Date.now() - start, frames: samples.length,
    averageFps,
    p95FrameIntervalMs: sorted[Math.floor(sorted.length * 0.95)] ?? null,
    targetFps: 60,
    targetAchieved: averageFps >= 60,
    heapUsedStartBytes: heapStart.usedSize, heapUsedAfterCombatBytes: heapAfterCombat.usedSize,
    limitation: 'Profiling runs in headless Chromium in the current container; hardware fields are browser-reported and are not a physical-device certification.',
  };

  await expect(page.getByTestId('result-screen')).toBeVisible();
  await page.getByRole('button', { name: 'MAIN MENU' }).click();
  const domCountersAfterCombat = await cdp.send('Memory.getDOMCounters');
  const cycles: Array<{ before: number; after: number; domCounters: unknown }> = [];
  for (let cycle = 0; cycle < 5; cycle += 1) {
    await page.getByRole('button', { name: 'PLAY' }).click();
    await expect(page.getByTestId('game-canvas')).toBeVisible();
    const before = (await cdp.send('Runtime.getHeapUsage')).usedSize;
    await page.waitForTimeout(1_000);
    await page.getByTestId('pause-button').click();
    await page.getByRole('button', { name: 'MAIN MENU' }).click();
    await cdp.send('HeapProfiler.collectGarbage');
    const after = (await cdp.send('Runtime.getHeapUsage')).usedSize;
    const domCounters = await cdp.send('Memory.getDOMCounters');
    cycles.push({ before, after, domCounters });
  }
  profile['domCountersAfterCombat'] = domCountersAfterCombat;
  profile['lifecycleCycles'] = cycles;
  profile['postCycleHeapUsedBytes'] = (await cdp.send('Runtime.getHeapUsage')).usedSize;
  if (browserCdp) await browserCdp.detach();
  const profilePath = 'artifacts/performance/profile.json';
  await mkdir('artifacts/performance', { recursive: true });
  await writeFile(profilePath, JSON.stringify(profile, null, 2), 'utf8');
  await testInfo.attach('performance-profile.json', { body: JSON.stringify(profile, null, 2), contentType: 'application/json' });
  await expect(page.getByTestId('main-menu')).toBeVisible();
});
