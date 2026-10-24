# Architecture

## Runtime boundaries

- **React (`src/ui/GameCanvas.tsx`)** coordinates screen state and the match lifecycle. `MainMenu.tsx`, `ScoresDialog.tsx`, and `GameControls.tsx` render the menu, score lists, reusable controls, and options form. `GameCanvas` passes state and callbacks to these views rather than owning their markup and interaction details. React receives game state callbacks at meaningful simulation updates and does not own per-frame entity state.
- **Match data (`src/ui/hooks/useMatchRecords.ts`)** owns ranking/history queries, score submission, retries, and TanStack Query invalidation. `GameCanvas` handles local result/outbox presentation and supplies the persistence callbacks.
- **PixiJS (`src/game/GameEngine.ts`)** coordinates the ticker, map, player, active entities, audio, and rendering. `EnemySpawner.ts` chooses spawn positions and enemy variants; `collisionSystem.ts` handles sprite collisions and enemy separation. `destroy()` removes browser listeners and destroys game resources; restart resets simulation state and reuses the initialized renderer.
- **Configuration (`src/game/gameConfig.ts`)** provides a typed default and immutable-in-practice per-match snapshot. Gameplay entities read movement, health, damage, cooldown, projectile, ramp, and spawn settings from that snapshot.

## Simulation

The game loop consumes PixiJS ticker deltas. Movement, cooldowns, the session timer, and the spawn interval are advanced from simulation time. Pause and focus loss stop simulation updates, so elapsed wall time is not charged to a paused match. E2E mode substitutes a controlled clock while calling the same update loop and retaining real input, collisions, and rendering.

Projectiles and explosions are pooled and reused. Health bars are Pixi display objects synchronized with entity health and position. A defeated enemy is marked dead before further projectile collision checks, preventing duplicate damage and scoring during one update.

## Match data and persistence

`src/api/scoreTypes.ts` defines a match as an ID, player identity, score, end reason, duration, and full `GameConfiguration`, with a timestamp added by the API. Ranking comparisons first filter by configuration and then sort by score, duration, date, and ID. History is scoped to the stable local player ID.

Axios communicates with `/api/scores`; TanStack Query handles loading, error, cache invalidation, and refresh. A match submission is stored in a local outbox with an idempotency key before sending. Success clears the matching outbox entry, failure leaves it available for retry, and the latest result is persisted for display after refresh.

MSW supplies shared fixtures from `src/mocks/fixtures.ts` and persists submitted records in `localStorage`. The GET endpoint accepts a view, player/configuration filters, page, and page size, then returns page items and a total. Ranking includes each captain's best eligible match; history is filtered by stable player ID. `src/mocks/networkScenarios.ts` defines scenarios consumed by the same handlers in development, tests, and the published build. Query parameters select scenarios and reset mock records; a seeded sequence controls variable latency. This mock contract should be mirrored by a production API.

## Verification and known limits

Playwright runs desktop and mobile Chromium projects with isolated browser storage, seeded randomness, controlled simulation time, traces on failures, and versioned screenshots. The performance scenario measures the available browser environment and is not a physical-device certification. Browser heap readings are approximate and depend on Chromium's memory APIs and runtime flags.
