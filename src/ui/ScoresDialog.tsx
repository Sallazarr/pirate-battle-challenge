import type { RefObject } from 'react';
import type { MatchListView, MatchRecord } from '../api/scoreTypes';
import { MenuButton, Pagination } from './GameControls';

interface ScoresDialogProps {
  view: MatchListView;
  dialogRef: RefObject<HTMLDivElement | null>;
  items: MatchRecord[];
  total: number;
  page: number;
  pageSize: number;
  playerName: string;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  onRetry: () => void;
  onPageChange: (page: number) => void;
  onClose: () => void;
}

export function ScoresDialog({
  view, dialogRef, items, total, page, pageSize, playerName,
  isLoading, isFetching, isError, onRetry, onPageChange, onClose,
}: ScoresDialogProps) {
  const isRanking = view === 'ranking';
  const pageCount = Math.ceil(total / pageSize);
  return (
    <div className="scores-overlay" ref={dialogRef} data-testid={isRanking ? 'ranking-modal' : 'history-modal'} role="dialog" aria-modal="true" aria-label={isRanking ? 'Ranking' : 'Match History'}>
      <div className="scores-panel">
        <h2 className="dialog-title">
          {isRanking ? '🏆 TOP CAPTAINS' : '📜 MATCH HISTORY'}
        </h2>

        <div className="scores-scroll" aria-busy={isFetching}>
          {isLoading ? <p data-testid="scores-loading" aria-live="polite">Loading {isRanking ? 'scores' : 'matches'}...</p>
            : isError ? <p role="alert">Could not load {isRanking ? 'scores' : 'matches'}. <button onClick={onRetry}>RETRY</button></p>
              : total === 0 ? <p className="scores-empty" data-testid={isRanking ? 'ranking-empty' : 'history-empty'}>
                {isRanking ? 'No scores found.' : `No battles recorded for ${playerName}.`}
              </p>
                : <ul className="scores-list">
                  {items.map((match, index) => isRanking ? (
                    <RankingRow key={match.id} match={match} rank={page * pageSize + index + 1} playerName={playerName} />
                  ) : (
                    <HistoryRow key={match.id} match={match} rank={page * pageSize + index + 1} />
                  ))}
                </ul>}
        </div>
        {total > pageSize && <Pagination page={page} pages={pageCount} onPageChange={onPageChange} label={view} />}
        <MenuButton text="CLOSE" onClick={onClose} type="primary" />
      </div>
    </div>
  );
}

function RankingRow({ match, rank, playerName }: { match: MatchRecord; rank: number; playerName: string }) {
  const isMe = !match.isFixture;
  const displayTitle = isMe ? (match.playerName || playerName) : match.playerName;
  return (
    <li className="score-row">
      <span className="score-row-main">
        <span className="score-rank">#{rank}</span>
        <span title={displayTitle} className={`score-player ${isMe ? 'is-me' : 'is-other'}`}>{displayTitle}</span>
        {isMe && <span className="score-you">YOU</span>}
      </span>
      <span className="score-value">{match.score} pts</span>
    </li>
  );
}

function HistoryRow({ match, rank }: { match: MatchRecord; rank: number }) {
  return (
    <li className="history-row">
      <span>#{rank} — Score: <b className="history-score">{match.score}</b><br /><small>{new Date(match.date).toLocaleDateString()} · {match.durationSeconds}s</small></span>
      <span className={`history-status ${match.reason === 'ship_destroyed' ? 'defeated' : 'time-up'}`}>
        {match.reason === 'ship_destroyed' ? 'DEFEATED' : 'TIME UP'}
      </span>
    </li>
  );
}
