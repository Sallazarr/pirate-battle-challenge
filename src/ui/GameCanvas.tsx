import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GameEngine } from '../game/GameEngine';
import { configurationKey, createMatchConfiguration } from '../game/gameConfig';
import type { GameConfiguration } from '../game/gameConfig';
import type { MatchListView, MatchRecord, PendingMatch } from '../api/scoreTypes';
import { isE2ERuntimeEnabled } from '../game/e2e';
import { useMatchPage, useSubmitMatch } from './hooks/useMatchRecords';

const GAME_FONT = 'monospace';

type StoredResult = MatchRecord & {
  health: number;
  submissionStatus?: 'pending' | 'saved' | 'failed';
};

const RESULT_STORAGE_KEY = 'pirate_battle_last_result';
const PENDING_SCORE_KEY = 'pirate_battle_pending_score';
const PLAYER_ID_STORAGE_KEY = 'pirate_battle_player_id';
const PAGE_SIZE = 10;
const ALLOWED_GAME_TIMES = [60, 90, 120, 150, 180];
const ALLOWED_SPAWN_TIMES = [2, 3, 4, 5];

function getStoredOption(key: string, allowedValues: number[], fallback: number): number {
  const value = Number(localStorage.getItem(key));
  return allowedValues.includes(value) ? value : fallback;
}

function useDialogAccessibility(
  isOpen: boolean,
  dialogRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  closeOnEscape = true,
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const getFocusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
    ));
    getFocusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Tab') event.stopPropagation();
      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen, closeOnEscape, dialogRef]);
}

function getPlayerId(): string {
  const existing = localStorage.getItem(PLAYER_ID_STORAGE_KEY);
  if (existing) return existing;
  const playerId = globalThis.crypto.randomUUID();
  localStorage.setItem(PLAYER_ID_STORAGE_KEY, playerId);
  return playerId;
}

function updateStoredResult(update: Partial<StoredResult>) {
  const result = readStoredJson<StoredResult>(RESULT_STORAGE_KEY);
  if (result) localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify({ ...result, ...update }));
}

function readStoredJson<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const gameOverFiredRef = useRef(false);

  const [hasStarted, setHasStarted] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showRankingModal, setShowRankingModal] = useState(false);
  const [activeScoresView, setActiveScoresView] = useState<MatchListView | null>(null);
  const optionsDialogRef = useRef<HTMLDivElement>(null);
  const rankingDialogRef = useRef<HTMLDivElement>(null);
  const historyDialogRef = useRef<HTMLDivElement>(null);
  const pauseDialogRef = useRef<HTMLDivElement>(null);
  const resultDialogRef = useRef<HTMLDivElement>(null);
  const [rankingPage, setRankingPage] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [savedResult, setSavedResult] = useState<StoredResult | null>(() => readStoredJson<StoredResult>(RESULT_STORAGE_KEY));
  const [pendingScore, setPendingScore] = useState<PendingMatch | null>(() => readStoredJson<PendingMatch>(PENDING_SCORE_KEY));
  const pendingScoreOnMountRef = useRef(pendingScore);
  const pendingScoreSubmittedRef = useRef(false);
  const isE2EMode = isE2ERuntimeEnabled();
  const [isLoadingGame, setIsLoadingGame] = useState(false);
  const [assetProgress, setAssetProgress] = useState(0);
  const [assetLoadError, setAssetLoadError] = useState(false);

  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem('pirate_battle_playername') || 'Captain Jack';
  });
  const [gameTime, setGameTime] = useState<number>(() => {
    return getStoredOption('pirate_battle_gametime', ALLOWED_GAME_TIMES, 60);
  });
  const [spawnTime, setSpawnTime] = useState<number>(() => {
    return getStoredOption('pirate_battle_spawntime', ALLOWED_SPAWN_TIMES, 3);
  });
  const [playerId] = useState(getPlayerId);
  const playerNameRef = useRef(playerName);
  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);
  const activeConfiguration = useMemo(
    () => createMatchConfiguration(gameTime, spawnTime),
    [gameTime, spawnTime],
  );
  const activeConfigurationRef = useRef<GameConfiguration>(activeConfiguration);
  useEffect(() => {
    activeConfigurationRef.current = activeConfiguration;
  }, [activeConfiguration]);

  const [score, setScore] = useState(0);
  const [, setHighScore] = useState<number>(() => {
    return Number(localStorage.getItem('pirate_battle_highscore') || '0');
  });
  const [health, setHealth] = useState(() => readStoredJson<StoredResult>(RESULT_STORAGE_KEY)?.health ?? 100);
  const [timeLeft, setTimeLeft] = useState(gameTime);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const selectedScoresPage = activeScoresView === 'history' ? historyPage : rankingPage;
  const matchConfigurationKey = configurationKey(activeConfiguration);
  const { data: scorePage, refetch, isLoading: isLoadingScores, isFetching: isFetchingScores, isError: isScoresError } = useMatchPage({
    view: activeScoresView,
    page: selectedScoresPage,
    pageSize: PAGE_SIZE,
    playerId,
    playerName,
    configuration: matchConfigurationKey,
  });
  const updateSubmissionStatus = (pending: PendingMatch, status: 'saved' | 'failed') => {
    const result = readStoredJson<StoredResult>(RESULT_STORAGE_KEY);
    if (result?.id !== pending.record.id) return;
    updateStoredResult({ submissionStatus: status });
    setSavedResult(readStoredJson<StoredResult>(RESULT_STORAGE_KEY));
  };
  const { mutate: submitScore, isPending, isSuccess, isError: isSubmissionError } = useSubmitMatch({
    isE2E: isE2EMode,
    onSuccess: (completedPending) => {
      const currentPending = readStoredJson<PendingMatch>(PENDING_SCORE_KEY);
      if (currentPending?.idempotencyKey === completedPending.idempotencyKey) {
        localStorage.removeItem(PENDING_SCORE_KEY);
        setPendingScore(null);
      }
      updateSubmissionStatus(completedPending, 'saved');
    },
    onError: (failedPending) => updateSubmissionStatus(failedPending, 'failed'),
  });

  useEffect(() => {
    if (pendingScoreSubmittedRef.current || !pendingScoreOnMountRef.current) return;
    pendingScoreSubmittedRef.current = true;
    submitScore(pendingScoreOnMountRef.current);
  }, [submitScore]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (engineRef.current && hasStarted && !isGameOver) {
          engineRef.current.togglePause();
        }
      }
    };
    const handleVisibilityChange = () => {
      if (document.hidden && engineRef.current && hasStarted && !isGameOver) {
        engineRef.current.pause();
      }
    };

    const isMobileTouch = window.matchMedia('(pointer: coarse)').matches;
    const handleWindowBlur = () => {
      if (engineRef.current && hasStarted && !isGameOver && !isMobileTouch) {
        engineRef.current.pause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [hasStarted, isGameOver]);

  const handleSaveOptions = (newTime: number, newSpawn: number, newName: string) => {
    const normalizedName = newName.trim().slice(0, 15);
    if (!ALLOWED_GAME_TIMES.includes(newTime) || !ALLOWED_SPAWN_TIMES.includes(newSpawn) || !normalizedName) return;
    setGameTime(newTime);
    setSpawnTime(newSpawn);
    setPlayerName(normalizedName);
    setTimeLeft(newTime);
    localStorage.setItem('pirate_battle_gametime', String(newTime));
    localStorage.setItem('pirate_battle_spawntime', String(newSpawn));
    localStorage.setItem('pirate_battle_playername', normalizedName);
    setRankingPage(0);
    setHistoryPage(0);
    setShowOptionsModal(false);
  };

  const startGame = async () => {
    const matchConfiguration = createMatchConfiguration(gameTime, spawnTime);
    activeConfigurationRef.current = matchConfiguration;
    setAssetLoadError(false);
    setAssetProgress(0);
    setIsLoadingGame(true);
    setIsGameOver(false);
    setIsPaused(false);
    setSavedResult(null);
    localStorage.removeItem(RESULT_STORAGE_KEY);
    setTimeLeft(gameTime);
    const container = containerRef.current;
    if (!container) {
      setIsLoadingGame(false);
      return;
    }

    if (!engineRef.current) {
      const engine = new GameEngine(matchConfiguration);
      engineRef.current = engine;
      try {
        await engine.init(container, (newScore, newHealth, newTime, gameOverFlag, pausedFlag, currentHighScore, durationSeconds) => {
          setScore(newScore);
          setHealth(newHealth);
          setTimeLeft(newTime);
          setIsGameOver(gameOverFlag);
          setIsPaused(pausedFlag);
          setHighScore(currentHighScore);

          if (gameOverFlag && !gameOverFiredRef.current) {
            gameOverFiredRef.current = true;
            const reason = newHealth <= 0 ? 'ship_destroyed' : 'time_out';
            const matchId = globalThis.crypto.randomUUID();
            const result: StoredResult = {
              id: matchId,
              playerId,
              playerName: playerNameRef.current,
              score: newScore,
              health: newHealth,
              reason,
              date: new Date().toISOString(),
              durationSeconds,
              configuration: activeConfigurationRef.current,
              submissionStatus: 'pending',
            };
            const pending: PendingMatch = {
              idempotencyKey: matchId,
              record: {
                id: matchId,
                playerId,
                playerName: playerNameRef.current,
                score: newScore,
                durationSeconds,
                reason,
                configuration: activeConfigurationRef.current,
              },
            };
            localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(result));
            localStorage.setItem(PENDING_SCORE_KEY, JSON.stringify(pending));
            setSavedResult(result);
            setPendingScore(pending);
            submitScore(pending);
          }
        }, setAssetProgress);
        setHasStarted(true);
      } catch {
        engine.destroy();
        if (engineRef.current === engine) engineRef.current = null;
        setAssetLoadError(true);
      } finally {
        setIsLoadingGame(false);
      }
    } else {
      gameOverFiredRef.current = false;
      engineRef.current.restart(matchConfiguration);
      setHasStarted(true);
      setIsLoadingGame(false);
    }
  };

  const handleRestart = () => {
    if (engineRef.current) {
      gameOverFiredRef.current = false;
      activeConfigurationRef.current = createMatchConfiguration(gameTime, spawnTime);
      engineRef.current.restart(activeConfigurationRef.current);
      setSavedResult(null);
      localStorage.removeItem(RESULT_STORAGE_KEY);
    } else {
      gameOverFiredRef.current = false;
      setSavedResult(null);
      localStorage.removeItem(RESULT_STORAGE_KEY);
      void startGame();
    }
  };

  const handleReturnToMenu = () => {
    if (engineRef.current) {
      gameOverFiredRef.current = false;
      engineRef.current.destroy();
      engineRef.current = null;
    }
    setHasStarted(false);
    setIsGameOver(false);
    setIsPaused(false);
    setSavedResult(null);
    localStorage.removeItem(RESULT_STORAGE_KEY);
  };

  const handleTogglePause = () => {
    if (engineRef.current) {
      engineRef.current.togglePause();
    }
  };

  const pageItems = scorePage?.items ?? [];
  const totalScores = scorePage?.total ?? 0;
  const resultForDisplay = savedResult ?? {
    score,
    health,
    reason: health <= 0 ? 'ship_destroyed' : 'time_out',
    playerName,
    date: new Date().toISOString(),
    durationSeconds: activeConfiguration.sessionSeconds - timeLeft,
    submissionStatus: 'pending' as const,
  };
  const resultConfiguration = savedResult?.configuration ?? activeConfiguration;
  const resultDurationSeconds = resultForDisplay.durationSeconds ?? 0;
  const resultMinutes = Math.floor(resultDurationSeconds / 60).toString().padStart(2, '0');
  const resultSeconds = (resultDurationSeconds % 60).toString().padStart(2, '0');
  const submissionStatus = isPending
    ? 'pending'
    : isSubmissionError || resultForDisplay.submissionStatus === 'failed'
      ? 'failed'
      : isSuccess || resultForDisplay.submissionStatus === 'saved'
        ? 'saved'
        : 'pending';
  const showResult = isGameOver || (!hasStarted && savedResult !== null);
  useDialogAccessibility(showOptionsModal, optionsDialogRef, () => setShowOptionsModal(false));
  useDialogAccessibility(showRankingModal, rankingDialogRef, () => { setShowRankingModal(false); setActiveScoresView(null); });
  useDialogAccessibility(showHistoryModal, historyDialogRef, () => { setShowHistoryModal(false); setActiveScoresView(null); });
  useDialogAccessibility(isPaused, pauseDialogRef, handleTogglePause);
  useDialogAccessibility(showResult, resultDialogRef, () => undefined, false);

  const panelImageStyle: React.CSSProperties = {
    backgroundImage: 'url(/assets/png/default/ui/menu/panel_menu.png)',
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
    width: '90%', maxWidth: '500px', minHeight: '480px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '60px 40px', boxSizing: 'border-box',
    filter: 'drop-shadow(0px 15px 25px rgba(0,0,0,0.6))'
  };

  return (
    <div data-testid="app-surface" style={{ position: 'relative', width: '100vw', height: '100dvh', overflow: 'hidden', backgroundColor: '#001a33' }}>

      {!hasStarted && savedResult === null && (
        <MainMenu
          playerName={playerName}
          isLoading={isLoadingGame}
          assetLoadError={assetLoadError}
          assetProgress={assetProgress}
          onPlay={startGame}
          onOptions={() => setShowOptionsModal(true)}
          onRanking={() => { setRankingPage(0); setActiveScoresView('ranking'); setShowRankingModal(true); }}
          onHistory={() => { setHistoryPage(0); setActiveScoresView('history'); setShowHistoryModal(true); }}
        />
      )}
      {showOptionsModal && (
        <OptionsModal
          dialogRef={optionsDialogRef}
          initialGameTime={gameTime}
          initialSpawnTime={spawnTime}
          initialPlayerName={playerName}
          onSave={handleSaveOptions}
          onClose={() => setShowOptionsModal(false)}
        />
      )}

      {(showRankingModal || showHistoryModal) && (
        <ScoresDialog
          view={showRankingModal ? 'ranking' : 'history'}
          dialogRef={showRankingModal ? rankingDialogRef : historyDialogRef}
          items={pageItems}
          total={totalScores}
          page={showRankingModal ? rankingPage : historyPage}
          pageSize={PAGE_SIZE}
          playerName={playerName}
          isLoading={isLoadingScores}
          isFetching={isFetchingScores}
          isError={isScoresError}
          onRetry={() => refetch()}
          onPageChange={showRankingModal ? setRankingPage : setHistoryPage}
          onClose={() => {
            setShowRankingModal(false);
            setShowHistoryModal(false);
            setActiveScoresView(null);
          }}
        />
      )}

      {hasStarted && (
        <div style={{
          position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          zIndex: 10, fontFamily: GAME_FONT, pointerEvents: 'none', flexWrap: 'wrap', gap: '8px'
        }}>
          <div style={{
            backgroundColor: 'rgba(0, 26, 51, 0.85)', border: '2px solid #d4a351', borderRadius: '8px',
            padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
          }}>
            <span style={{ fontSize: '1.2rem' }}>❤️</span>
            <div style={{ width: '110px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '2px' }}>
                <span>HEALTH</span>
                <span role="status" aria-label={`Health ${health} of 100`}>{health}/100</span>
              </div>
              <div style={{ width: '100%', height: '10px', backgroundColor: '#1e293b', borderRadius: '5px', overflow: 'hidden', border: '1px solid #475569' }}>
                <div style={{
                  width: `${Math.max(0, Math.min(100, health))}%`,
                  height: '100%',
                  backgroundColor: health <= 30 ? '#ef4444' : '#22c55e',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', pointerEvents: 'auto' }}>
            <div style={{
              backgroundColor: 'rgba(0, 26, 51, 0.85)', border: '2px solid #d4a351', borderRadius: '8px',
              padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px',
              boxShadow: '0 4px 10px rgba(0,0,0,0.5)', color: '#fff', fontFamily: GAME_FONT
            }}>
              <span style={{ fontSize: '1rem' }}>🏆</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase' }}>Score</span>
                <span role="status" aria-label={`Score ${score}`} style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fbe29f' }}>{score}</span>
              </div>
            </div>

            <div style={{
              backgroundColor: 'rgba(0, 26, 51, 0.85)', border: '2px solid #d4a351', borderRadius: '8px',
              padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px',
              boxShadow: '0 4px 10px rgba(0,0,0,0.5)', color: '#fff', fontFamily: GAME_FONT
            }}>
              <span style={{ fontSize: '1rem' }}>⏱️</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase' }}>Time</span>
                <span role="timer" aria-label={`${timeLeft} seconds remaining`} style={{ fontSize: '0.95rem', fontWeight: 'bold', color: timeLeft <= 10 ? '#ef4444' : '#fbe29f' }}>{timeLeft}s</span>
              </div>
            </div>

            {!showResult && (
              <button
                onClick={handleTogglePause}
                aria-label="Pause game"
                data-testid="pause-button"
                style={{
                  backgroundColor: '#e69e35', border: '2px solid #6b3e1b', borderRadius: '8px',
                  width: '38px', height: '38px', display: 'flex', justifyContent: 'center', alignItems: 'center',
                  cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', color: '#3e1d04', fontSize: '1rem', fontWeight: 'bold'
                }}
                title="Pause"
              >
                {isPaused ? '▶' : '⏸'}
              </button>
            )}
          </div>
        </div>
      )}


      {hasStarted && !isGameOver && !isPaused && (
        <div style={{
          position: 'absolute',
          bottom: 'max(15px, env(safe-area-inset-bottom, 15px))',
          left: 10,
          right: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          zIndex: 15,
          pointerEvents: 'none',
          userSelect: 'none',
          boxSizing: 'border-box',
          paddingBottom: 0
        }}>

          <div style={{ display: 'flex', gap: '8px', pointerEvents: 'auto' }}>
            <MobileControlButton
              icon="/assets/png/default/ui/controls/icon_turn_left.png"
              onPressChange={(active) => engineRef.current?.setControl('left', active)}
              title="TURN LEFT"
            />
            <MobileControlButton
              icon="/assets/png/default/ui/controls/icon_turn_right.png"
              onPressChange={(active) => engineRef.current?.setControl('right', active)}
              title="TURN RIGHT"
            />
            <MobileControlButton
              icon="/assets/png/default/ui/controls/icon_forward.png"
              onPressChange={(active) => engineRef.current?.setControl('forward', active)}
              title="FORWARD"
            />
          </div>


          <div style={{ display: 'flex', gap: '8px', pointerEvents: 'auto' }}>
            <MobileControlButton
              icon="/assets/png/default/ui/controls/icon_fire_left.png"
              onPressChange={(active) => engineRef.current?.setControl('fireLeft', active)}
              title="LEFT"
            />
            <MobileControlButton
              icon="/assets/png/default/ui/controls/icon_fire_front.png"
              onPressChange={(active) => engineRef.current?.setControl('fireFront', active)}
              title="FRONT"
            />
            <MobileControlButton
              icon="/assets/png/default/ui/controls/icon_fire_right.png"
              onPressChange={(active) => engineRef.current?.setControl('fireRight', active)}
              title="RIGHT"
            />
          </div>
        </div>
      )}

      {isPaused && (
        <div ref={pauseDialogRef} role="dialog" aria-modal="true" aria-label="Game paused" style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.65)', zIndex: 20,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          backdropFilter: 'blur(3px)', padding: '15px', boxSizing: 'border-box'
        }}>
          <div style={{ ...panelImageStyle, minHeight: 'auto', paddingBottom: '40px' }}>
            <h1 style={{ fontSize: '2.5rem', color: '#fbe29f', textShadow: '2px 2px 0 #3e1d04', margin: '0 0 10px 0', fontFamily: GAME_FONT }}>PAUSED</h1>
            <p style={{ color: '#fff', marginBottom: '30px', fontFamily: GAME_FONT, fontSize: '1rem' }}>Ready when you are.</p>

            <MenuButton text="RESUME" onClick={handleTogglePause} type="primary" />
            <div style={{ height: '15px' }} />
            <MenuButton text="RESTART" onClick={handleRestart} type="primary" />
            <div style={{ height: '15px' }} />
            <MenuButton text="MAIN MENU" onClick={handleReturnToMenu} type="primary" />
          </div>
        </div>
      )}

      {showResult && (
        <div ref={resultDialogRef} data-testid="result-screen" role="dialog" aria-modal="true" aria-label="Battle result" style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.8)', zIndex: 20,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          backdropFilter: 'blur(4px)', padding: '15px', boxSizing: 'border-box'
        }}>
          <div style={{ ...panelImageStyle, minHeight: 'auto', paddingBottom: '40px' }}>
            <h1 style={{ fontSize: '2.5rem', color: '#fbe29f', textShadow: '2px 2px 0 #3e1d04', margin: '0 0 10px 0', fontFamily: GAME_FONT, textAlign: 'center' }}>BATTLE COMPLETE</h1>
            <h2 data-testid="result-score" style={{ fontSize: '4.5rem', margin: '10px 0', color: '#fff', textShadow: '3px 3px 0 #000', fontFamily: GAME_FONT }}>{resultForDisplay.score}</h2>

            <p style={{ color: '#aaa', fontSize: '1rem', marginBottom: '25px', fontFamily: GAME_FONT, textTransform: 'uppercase' }}>
              POINTS · {resultForDisplay.reason === 'ship_destroyed' ? 'DEFEATED' : 'TIME UP'}
            </p>
            <p data-testid="result-duration" style={{ color: '#fff', fontFamily: GAME_FONT }}>Duration: {resultMinutes}:{resultSeconds}</p>
            <p data-testid="result-configuration" style={{ color: '#aaa', fontFamily: GAME_FONT }}>Session {resultConfiguration.sessionSeconds}s · Spawn every {resultConfiguration.spawnIntervalSeconds}s</p>
            <div style={{ height: '25px', marginBottom: '15px', fontSize: '1rem', color: '#8ecae6', fontFamily: GAME_FONT }}>
              <span data-testid="result-registration-status" data-status={submissionStatus} style={{ color: submissionStatus === 'saved' ? '#4CAF50' : submissionStatus === 'failed' ? '#ff6b6b' : '#8ecae6' }}>
                {submissionStatus === 'pending' ? 'Saving score…' : submissionStatus === 'saved' ? 'Score saved!' : 'Score not saved'}
              </span>
            </div>
            {(isSubmissionError || submissionStatus === 'failed') && pendingScore && <button data-testid="retry-score" onClick={() => submitScore(pendingScore)}>RETRY SAVE</button>}
            <MenuButton text="PLAY AGAIN" onClick={handleRestart} type="primary" />
            <div style={{ height: '15px' }} />
            <MenuButton text="MAIN MENU" onClick={handleReturnToMenu} type="primary" />
          </div>
        </div>
      )}

      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

import { MenuButton, MobileControlButton, OptionsModal } from './GameControls';
import { ScoresDialog } from './ScoresDialog';
import { MainMenu } from './MainMenu';
