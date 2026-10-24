import { createMatchConfiguration } from '../game/gameConfig';
import type { GameConfiguration } from '../game/gameConfig';
import type { MatchRecord } from '../api/scoreTypes';

const fixtureTemplates = [
  ['Captain Flint', 38], ['Red Sparrow', 32], ['Blackbeard', 28],
  ['Davy Jones', 25], ['Anne Bonny', 24], ['Storm Rider', 21],
  ['Sea Wolf', 19], ['Iron Anchor', 15], ['Salty Dog', 12],
] as const;

export function createScoreFixtures(configuration: GameConfiguration): MatchRecord[] {
  return fixtureTemplates.map(([playerName, score], index) => ({
    id: `fixture-${index + 1}`,
    playerId: `fixture-player-${index + 1}`,
    playerName,
    score,
    date: '2026-01-01T00:00:00.000Z',
    durationSeconds: configuration.sessionSeconds,
    reason: 'time_out',
    configuration,
    isFixture: true,
  }));
}

export function createDefaultScoreFixtures(): MatchRecord[] {
  return createScoreFixtures(createMatchConfiguration());
}
