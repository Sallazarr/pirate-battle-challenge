import { delay, http, HttpResponse } from 'msw';
import { configurationKey, createMatchConfiguration } from '../game/gameConfig';
import type { MatchPage, MatchRecord, MatchSubmission } from '../api/scoreTypes';
import { createScoreFixtures } from './fixtures';
import {
  MOCK_IDEMPOTENCY_KEY,
  MOCK_POST_LOG_KEY,
  MOCK_RECORDS_KEY,
  nextMockSequence,
  readNetworkScenario,
} from './networkScenarios';

const supportedConfigurations = [60, 90, 120, 150, 180].flatMap((sessionSeconds) =>
  [2, 3, 4, 5].map((spawnIntervalSeconds) => createMatchConfiguration(sessionSeconds, spawnIntervalSeconds)),
);

function readStoredScores(): MatchRecord[] {
  try {
    const scores = JSON.parse(localStorage.getItem(MOCK_RECORDS_KEY) ?? '[]') as unknown;
    return Array.isArray(scores) ? scores as MatchRecord[] : [];
  } catch {
    return [];
  }
}

function saveStoredScores(scores: MatchRecord[]): void {
  localStorage.setItem(MOCK_RECORDS_KEY, JSON.stringify(scores));
}

function readIdempotentRecords(): Record<string, MatchRecord> {
  try {
    return JSON.parse(localStorage.getItem(MOCK_IDEMPOTENCY_KEY) ?? '{}') as Record<string, MatchRecord>;
  } catch {
    return {};
  }
}

function recordPost(key: string | null, body: MatchSubmission): void {
  let posts: Array<{ key: string | null; body: MatchSubmission }> = [];
  try {
    posts = JSON.parse(localStorage.getItem(MOCK_POST_LOG_KEY) ?? '[]') as Array<{ key: string | null; body: MatchSubmission }>;
  } catch {
    posts = [];
  }
  posts.push({ key, body });
  localStorage.setItem(MOCK_POST_LOG_KEY, JSON.stringify(posts));
}

function getFixtures(configurationKeyToMatch: string | null): MatchRecord[] {
  const configuration = supportedConfigurations.find((candidate) => configurationKey(candidate) === configurationKeyToMatch);
  return configuration ? createScoreFixtures(configuration) : [];
}

function getGetErrorResponse(scenario: string, view: string | null): Response | null {
  if (scenario === 'connection-error') return HttpResponse.error();
  if (scenario === 'http-400') return HttpResponse.json({ error: 'Bad request' }, { status: 400 });
  if (scenario === 'http-500') return HttpResponse.json({ error: 'Service unavailable' }, { status: 500 });
  if (scenario === 'ranking-error' && view !== 'history') return HttpResponse.json({ error: 'Ranking unavailable' }, { status: 503 });
  if (scenario === 'history-error' && view === 'history') return HttpResponse.json({ error: 'History unavailable' }, { status: 503 });
  return null;
}

async function applyGetLatency(view: string | null): Promise<void> {
  const settings = readNetworkScenario();
  const sequence = nextMockSequence(`GET:${view ?? 'ranking'}`);
  if (settings.name === 'slow') {
    await delay(settings.latencyMs ?? 1_200);
  } else if (settings.name === 'variable-latency') {
    const min = 100;
    const max = settings.latencyMs ?? 1_000;
    const randomValue = (Math.imul(settings.seed ^ sequence, 1_664_525) + 1_013_904_223) >>> 0;
    await delay(min + randomValue % Math.max(1, max - min + 1));
  } else if (settings.name === 'out-of-order') {
    await delay(sequence === 1 ? settings.latencyMs ?? 1_200 : 25);
  }
}

export const handlers = [
  http.get('*/api/scores', async ({ request }) => {
    const url = new URL(request.url);
    const view = url.searchParams.get('view');
    await applyGetLatency(view);

    const errorResponse = getGetErrorResponse(readNetworkScenario().name, view);
    if (errorResponse) return errorResponse;

    const page = Math.max(0, Number.parseInt(url.searchParams.get('page') ?? '0', 10) || 0);
    const pageSize = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get('pageSize') ?? '5', 10) || 5));
    let matches: MatchRecord[];

    if (readNetworkScenario().name === 'empty') {
      matches = [];
    } else if (view === 'history') {
      const playerId = url.searchParams.get('playerId');
      const playerName = url.searchParams.get('playerName')?.trim().toLocaleLowerCase();
      matches = readStoredScores()
        .filter((match) => !match.isFixture && (
          match.playerId === playerId
          || (!match.playerId && !!playerName && match.playerName.trim().toLocaleLowerCase() === playerName)
        ))
        .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
    } else {
      const playerId = url.searchParams.get('playerId');
      const playerName = url.searchParams.get('playerName')?.trim();
      const configurationKeyToMatch = url.searchParams.get('configuration');
      const compare = (a: MatchRecord, b: MatchRecord) =>
        b.score - a.score || a.durationSeconds - b.durationSeconds || a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
      const ranked = [
        ...getFixtures(configurationKeyToMatch),
        ...readStoredScores().filter((match) => match.configuration && configurationKey(match.configuration) === configurationKeyToMatch),
      ];
      const bestByPlayer = new Map<string, MatchRecord>();
      for (const match of ranked) {
        const playerKey = match.isFixture ? match.id : match.playerId;
        const best = bestByPlayer.get(playerKey);
        if (!best || compare(match, best) < 0) bestByPlayer.set(playerKey, match);
      }
      matches = [...bestByPlayer.values()]
        .map((match) => !match.isFixture && match.playerId === playerId && playerName
          ? { ...match, playerName }
          : match)
        .sort(compare);
    }

    const response: MatchPage = {
      items: matches.slice(page * pageSize, (page + 1) * pageSize),
      total: matches.length,
      page,
      pageSize,
    };
    return HttpResponse.json(response);
  }),

  http.post('*/api/scores', async ({ request }) => {
    const submission = await request.json() as MatchSubmission;
    const idempotencyKey = request.headers.get('Idempotency-Key');
    recordPost(idempotencyKey, submission);
    const settings = readNetworkScenario();

    if (settings.name === 'connection-error') return HttpResponse.error();
    if (settings.name === 'http-400') return HttpResponse.json({ error: 'Bad request' }, { status: 400 });
    if (settings.name === 'http-500' || settings.name === 'submit-unavailable') {
      return HttpResponse.json({ error: 'Score service unavailable' }, { status: 503 });
    }

    const idempotentRecords = readIdempotentRecords();
    if (idempotencyKey && idempotentRecords[idempotencyKey]) {
      return HttpResponse.json(idempotentRecords[idempotencyKey]);
    }

    if (settings.name === 'timeout-after-commit') {
      const record = persistSubmission(submission, idempotencyKey, idempotentRecords);
      await delay(settings.responseDelayMs ?? 11_000);
      return HttpResponse.json(record, { status: 201 });
    }

    if (settings.name === 'slow') await delay(settings.latencyMs ?? 1_200);
    if (settings.name === 'variable-latency') {
      const sequence = nextMockSequence('POST');
      const randomValue = (Math.imul(settings.seed ^ sequence, 1_664_525) + 1_013_904_223) >>> 0;
      await delay(100 + randomValue % Math.max(1, (settings.latencyMs ?? 1_000) - 99));
    }

    return HttpResponse.json(persistSubmission(submission, idempotencyKey, idempotentRecords), { status: 201 });
  }),
];

function persistSubmission(
  submission: MatchSubmission,
  idempotencyKey: string | null,
  idempotentRecords: Record<string, MatchRecord>,
): MatchRecord {
  const record: MatchRecord = {
    ...submission,
    date: new Date().toISOString(),
    isFixture: false,
  };
  const scores = readStoredScores();
  scores.unshift(record);
  saveStoredScores(scores);
  if (idempotencyKey) {
    idempotentRecords[idempotencyKey] = record;
    localStorage.setItem(MOCK_IDEMPOTENCY_KEY, JSON.stringify(idempotentRecords));
  }
  return record;
}
