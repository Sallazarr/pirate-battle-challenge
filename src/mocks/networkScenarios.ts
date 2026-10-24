export const MOCK_SCENARIO_KEY = 'pirate_battle_mock_scenario';
export const MOCK_RECORDS_KEY = 'pirate_battle_scores';
export const MOCK_IDEMPOTENCY_KEY = 'pirate_battle_score_idempotency';
export const MOCK_SEQUENCE_KEY = 'pirate_battle_mock_sequences';
export const MOCK_POST_LOG_KEY = 'pirate_battle_mock_posts';
export const MOCK_PENDING_SCORE_KEY = 'pirate_battle_pending_score';
export const MOCK_LAST_RESULT_KEY = 'pirate_battle_last_result';

export const NETWORK_SCENARIOS = [
  'success',
  'empty',
  'slow',
  'variable-latency',
  'out-of-order',
  'connection-error',
  'http-400',
  'http-500',
  'ranking-error',
  'history-error',
  'timeout-after-commit',
  'submit-unavailable',
] as const;

export type NetworkScenario = typeof NETWORK_SCENARIOS[number];

export interface NetworkScenarioSettings {
  name: NetworkScenario;
  seed: number;
  latencyMs?: number;
  responseDelayMs?: number;
}

const DEFAULT_SETTINGS: NetworkScenarioSettings = { name: 'success', seed: 20261023 };

export function readNetworkScenario(): NetworkScenarioSettings {
  try {
    const settings = JSON.parse(localStorage.getItem(MOCK_SCENARIO_KEY) ?? 'null') as Partial<NetworkScenarioSettings> | null;
    if (!settings || !isNetworkScenario(settings.name)) return { ...DEFAULT_SETTINGS };
    return {
      name: settings.name,
      seed: Number.isFinite(settings.seed) ? Number(settings.seed) : DEFAULT_SETTINGS.seed,
      latencyMs: positiveNumber(settings.latencyMs),
      responseDelayMs: positiveNumber(settings.responseDelayMs),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function setNetworkScenario(settings: NetworkScenarioSettings): void {
  localStorage.setItem(MOCK_SCENARIO_KEY, JSON.stringify(settings));
  localStorage.removeItem(MOCK_SEQUENCE_KEY);
}

export function resetMockApiState(): void {
  for (const key of [
    MOCK_RECORDS_KEY,
    MOCK_IDEMPOTENCY_KEY,
    MOCK_SEQUENCE_KEY,
    MOCK_POST_LOG_KEY,
    MOCK_PENDING_SCORE_KEY,
    MOCK_LAST_RESULT_KEY,
  ]) localStorage.removeItem(key);
  setNetworkScenario({ ...DEFAULT_SETTINGS });
}

export function initializeMockApiFromUrl(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.get('mockReset') === '1') resetMockApiState();

  const requestedScenario = params.get('mockScenario');
  if (!requestedScenario || !isNetworkScenario(requestedScenario)) return;

  setNetworkScenario({
    name: requestedScenario,
    seed: parseInteger(params.get('mockSeed'), DEFAULT_SETTINGS.seed),
    latencyMs: parsePositiveInteger(params.get('mockLatencyMs')),
    responseDelayMs: parsePositiveInteger(params.get('mockResponseDelayMs')),
  });
}

export function nextMockSequence(key: string): number {
  let sequences: Record<string, number> = {};
  try {
    sequences = JSON.parse(localStorage.getItem(MOCK_SEQUENCE_KEY) ?? '{}') as Record<string, number>;
  } catch {
    sequences = {};
  }
  const next = (sequences[key] ?? 0) + 1;
  sequences[key] = next;
  localStorage.setItem(MOCK_SEQUENCE_KEY, JSON.stringify(sequences));
  return next;
}

export function isNetworkScenario(value: unknown): value is NetworkScenario {
  return typeof value === 'string' && NETWORK_SCENARIOS.includes(value as NetworkScenario);
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function parseInteger(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parsePositiveInteger(value: string | null): number | undefined {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
