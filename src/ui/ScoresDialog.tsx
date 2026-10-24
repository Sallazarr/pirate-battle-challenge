import type { CSSProperties, RefObject } from 'react';
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
  const panelStyle: CSSProperties = {
    backgroundImage: 'url(/assets/png/default/ui/menu/panel_menu.png)',
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
    width: '90%',
    maxWidth: '620px',
    height: 'min(82dvh, 680px)',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '36px 48px',
    boxSizing: 'border-box',
    overflow: 'hidden',
    filter: 'drop-shadow(0px 15px 25px rgba(0,0,0,0.6))',
  };

  return (
    <div ref={dialogRef} data-testid={isRanking ? 'ranking-modal' : 'history-modal'} role="dialog" aria-modal="true" aria-label={isRanking ? 'Ranking' : 'Match History'} style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 40,
      display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      backdropFilter: 'blur(4px)', padding: '15px', boxSizing: 'border-box',
    }}>
      <div style={panelStyle}>
        <h2 style={{ textAlign: 'center', color: '#fbe29f', marginTop: 0, textShadow: '2px 2px 0 #3e1d04', fontFamily: 'monospace', fontSize: '1.8rem' }}>
          {isRanking ? '🏆 TOP CAPTAINS' : '📜 MATCH HISTORY'}
        </h2>

        <div className="scores-scroll" aria-busy={isFetching} style={{ width: '100%', flex: 1, minHeight: 0, overflowY: 'auto', marginBottom: '20px', fontFamily: 'monospace', color: '#fff' }}>
          {isLoading ? <p data-testid="scores-loading" aria-live="polite">Loading {isRanking ? 'scores' : 'matches'}...</p>
            : isError ? <p role="alert">Could not load {isRanking ? 'scores' : 'matches'}. <button onClick={onRetry}>RETRY</button></p>
              : total === 0 ? <p data-testid={isRanking ? 'ranking-empty' : 'history-empty'} style={{ textAlign: 'center', color: '#aaa', marginTop: '20px', fontSize: '1rem' }}>
                {isRanking ? 'No scores found.' : `No battles recorded for ${playerName}.`}
              </p>
                : <ul style={{ listStyle: 'none', padding: 0, margin: 0, width: '100%', boxSizing: 'border-box' }}>
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
    <li style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '12px 0', fontSize: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
      <span style={{ display: 'flex', alignItems: 'center', flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}>
        <span style={{ display: 'inline-block', flex: '0 0 36px', width: '36px', marginRight: '5px', whiteSpace: 'nowrap' }}>#{rank}</span>
        <span title={displayTitle} style={{ color: isMe ? '#fbe29f' : '#fff', fontWeight: isMe ? 'bold' : 'normal', flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayTitle}</span>
        {isMe && <span style={{ flex: '0 0 auto', fontSize: '0.75rem', backgroundColor: '#e69e35', color: '#3e1d04', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px', fontWeight: 'bold' }}>YOU</span>}
      </span>
      <span style={{ flex: '0 0 auto', color: '#fbe29f', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{match.score} pts</span>
    </li>
  );
}

function HistoryRow({ match, rank }: { match: MatchRecord; rank: number }) {
  return (
    <li style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
      <span>#{rank} — Score: <b style={{ color: '#fbe29f' }}>{match.score}</b><br /><small>{new Date(match.date).toLocaleDateString()} · {match.durationSeconds}s</small></span>
      <span style={{ color: match.reason === 'ship_destroyed' ? '#ff6b6b' : '#69b3a2', fontSize: '0.9rem' }}>
        {match.reason === 'ship_destroyed' ? 'DEFEATED' : 'TIME UP'}
      </span>
    </li>
  );
}
