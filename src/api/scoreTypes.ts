import type { GameConfiguration } from '../game/gameConfig';

export type MatchEndReason = 'time_out' | 'ship_destroyed';

export interface MatchRecord {
  id: string;
  playerId: string;
  playerName: string;
  score: number;
  date: string;
  durationSeconds: number;
  reason: MatchEndReason;
  configuration: GameConfiguration;
  isFixture?: boolean;
}

export type MatchSubmission = Omit<MatchRecord, 'date' | 'isFixture'>;

export interface PendingMatch {
  idempotencyKey: string;
  record: MatchSubmission;
}

export type MatchListView = 'ranking' | 'history';

export interface MatchPage {
  items: MatchRecord[];
  total: number;
  page: number;
  pageSize: number;
}
