# Pirate Battle

Pirate Battle is a top-down naval shooter built with React, TypeScript, and PixiJS. React renders menus, options, the HUD, pause and result screens, and score views. PixiJS owns the arena, simulation, inputs, entities, collisions, and rendering.

## Requirements

- Node.js 20 or newer
- npm

## Setup and commands

```sh
npm install
npm run dev          # start Vite
npm run typecheck    # TypeScript project check
npm run lint         # ESLint
npm run build        # production build
npm run preview      # serve the production build
npm run build:e2e    # build with deterministic E2E hooks
npm run test:e2e     # Chromium desktop and mobile E2E suite
npm run test:e2e:update
npm run test:performance
```

Playwright writes its HTML report and traces under `artifacts/`. The performance run takes about three minutes plus five lifecycle cycles and writes its measurements under `artifacts/performance/`.

## Gameplay

The default session lasts 60 seconds and spawns enemies every 3 seconds. Options let players choose a 60, 90, 120, 150, or 180 second session and a 2, 3, 4, or 5 second spawn interval. The selected values are captured in each match record, so ranking comparisons use only the same configuration.

- **W / Up:** move forward
- **A / D or Left / Right:** rotate
- **Space:** fire forward
- **Q / E:** fire port / starboard
- **P / Escape:** pause or resume

On touch devices, use the on-screen controls. Preferences, player identity, the latest result, and pending score submissions are stored in `localStorage`.

## API and local data

Axios calls `/api/scores`; TanStack Query caches and refreshes score data. Mock Service Worker handles the API in development, Playwright, and the published build. The shared fixtures are in `src/mocks/fixtures.ts`; the shared request handlers and scenario definitions are in `src/mocks/handlers.ts` and `src/mocks/networkScenarios.ts`. Confirmed matches and idempotency keys persist in `localStorage`. Match submissions also use a local outbox so pending records can be retried after refresh. No environment variables are required for the default setup.

## Network scenarios

Choose a reproducible MSW scenario with the `mockScenario` query parameter:

| Scenario | Behavior |
| --- | --- |
| `success` | Normal paginated responses and successful submissions |
| `empty` | Empty Ranking and Match History responses |
| `slow` | Fixed delay, 1,200 ms by default |
| `variable-latency` | Seeded deterministic delays from 100 ms to the configured maximum |
| `out-of-order` | First request per view is delayed; subsequent requests return quickly |
| `connection-error` | Network-level failure for reads and submissions |
| `http-400`, `http-500` | HTTP failure responses |
| `ranking-error`, `history-error` | Failures isolated to one read view |
| `timeout-after-commit` | Persists a submission, then delays its response to exercise idempotent recovery |
| `submit-unavailable` | Submission endpoint returns HTTP 503 |

Examples:

```text
http://localhost:5173/?mockScenario=empty
http://localhost:5173/?mockScenario=variable-latency&mockSeed=123&mockLatencyMs=900
http://localhost:5173/?mockScenario=timeout-after-commit&mockResponseDelayMs=12000
http://localhost:5173/?mockScenario=success&mockReset=1
```

`mockReset=1` clears confirmed mock matches, idempotency records, request counters, submission logs, the pending submission, and the last result, then selects `success` unless another valid scenario is specified. It preserves player identity and Options. Scenario settings remain selected in `localStorage` after refresh. Use the final example to restore the API state before a demonstration.

Playwright selects the same scenarios by writing shared MSW settings to isolated browser storage. Its `scoresApi` fixture seeds records and inspects requests without intercepting `/api/scores` with `page.route`.

## Deterministic test hooks

The E2E build accepts `?e2e=1`. Playwright injects a seed and a controlled simulation clock through the test harness. This advances the actual game loop and leaves real input, collision, and Pixi rendering paths active. Do not enable the harness in normal production builds.

Visual baselines are versioned in `e2e/game.spec.ts-snapshots/`; regenerate them intentionally with `npm run test:e2e:update` on the reference OS/browser.
