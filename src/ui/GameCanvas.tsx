import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { GameEngine } from '../game/GameEngine';

const GAME_FONT = 'monospace';

interface ScoreRecord {
  id: string;
  score: number;
  date: string;
  reason: string;
  playerName?: string;
  isFixture?: boolean;
}

interface StoredResult {
  score: number;
  health: number;
  reason: string;
  playerName: string;
  date: string;
}

interface PendingScore {
  idempotencyKey: string;
  record: { score: number; reason: string; playerName: string };
}

const RESULT_STORAGE_KEY = 'pirate_battle_last_result';
const PENDING_SCORE_KEY = 'pirate_battle_pending_score';
const PAGE_SIZE = 5;

function readStoredJson<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

export function GameCanvas() {
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const gameOverFiredRef = useRef(false); 

  const [hasStarted, setHasStarted] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showRankingModal, setShowRankingModal] = useState(false);
  const [rankingPage, setRankingPage] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [savedResult, setSavedResult] = useState<StoredResult | null>(() => readStoredJson<StoredResult>(RESULT_STORAGE_KEY));
  const [pendingScore, setPendingScore] = useState<PendingScore | null>(() => readStoredJson<PendingScore>(PENDING_SCORE_KEY));
  const isE2EMode = (import.meta.env.DEV || import.meta.env.MODE === 'e2e') && new URLSearchParams(window.location.search).get('e2e') === '1';
  const [isLoadingGame, setIsLoadingGame] = useState(false);
  const [assetLoadError, setAssetLoadError] = useState(false);

  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem('pirate_battle_playername') || 'Captain Jack';
  });
  const [gameTime, setGameTime] = useState<number>(() => {
    return Number(localStorage.getItem('pirate_battle_gametime') || '60');
  });
  const [spawnTime, setSpawnTime] = useState<number>(() => {
    return Number(localStorage.getItem('pirate_battle_spawntime') || '3');
  });

  const [score, setScore] = useState(0);
  const [, setHighScore] = useState<number>(() => {
    return Number(localStorage.getItem('pirate_battle_highscore') || '0');
  });
  const [health, setHealth] = useState(() => readStoredJson<StoredResult>(RESULT_STORAGE_KEY)?.health ?? 100);
  const [timeLeft, setTimeLeft] = useState(gameTime);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const { data: scores = [], refetch, isFetching: isFetchingScores, isError: isScoresError } = useQuery<ScoreRecord[]>({
    queryKey: ['scores'],
    queryFn: async ({ signal }) => {
      const response = await apiClient.get('/api/scores', { signal });
      return Array.isArray(response.data) ? response.data : [];
    },
    initialData: [],
  });

  const { mutate: submitScore, isPending, isSuccess, isError: isSubmissionError } = useMutation({
    mutationFn: async (pending: PendingScore) => {
      const response = await apiClient.post('/api/scores', pending.record, {
        headers: { 'Idempotency-Key': pending.idempotencyKey },
        timeout: isE2EMode ? 700 : 10_000,
      });
      return response.data;
    },
    retry: 1,
    retryDelay: 250,
    onSuccess: (_data, completedPending) => {
      const currentPending = readStoredJson<PendingScore>(PENDING_SCORE_KEY);
      if (currentPending?.idempotencyKey === completedPending.idempotencyKey) {
        localStorage.removeItem(PENDING_SCORE_KEY);
        setPendingScore(null);
      }
      queryClient.invalidateQueries({ queryKey: ['scores'] });
      refetch();
    }
  });

  useEffect(() => {
    if (pendingScore) submitScore(pendingScore);
  // A stored outbox entry is intentionally submitted once when the UI mounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setGameTime(newTime);
    setSpawnTime(newSpawn);
    setPlayerName(newName);
    setTimeLeft(newTime);
    localStorage.setItem('pirate_battle_gametime', newTime.toString());
    localStorage.setItem('pirate_battle_spawntime', newSpawn.toString());
    localStorage.setItem('pirate_battle_playername', newName);
    setShowOptionsModal(false);
  };

  const startGame = async () => {
    setAssetLoadError(false);
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
      const engine = new GameEngine();
      engineRef.current = engine;
      try {
        await engine.init(container, gameTime, spawnTime, (newScore, newHealth, newTime, gameOverFlag, pausedFlag, currentHighScore) => {
          setScore(newScore);
          setHealth(newHealth);
          setTimeLeft(newTime);
          setIsGameOver(gameOverFlag);
          setIsPaused(pausedFlag);
          setHighScore(currentHighScore);

          if (gameOverFlag && !gameOverFiredRef.current) {
            gameOverFiredRef.current = true;
            const reason = newHealth <= 0 ? 'ship_destroyed' : 'time_out';
            const result = { score: newScore, health: newHealth, reason, playerName, date: new Date().toISOString() };
            const pending = {
              idempotencyKey: globalThis.crypto.randomUUID(),
              record: { score: newScore, reason, playerName },
            };
            localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(result));
            localStorage.setItem(PENDING_SCORE_KEY, JSON.stringify(pending));
            setSavedResult(result);
            setPendingScore(pending);
            submitScore(pending);
          }
        });
        setHasStarted(true);
      } catch (error) {
        engine.destroy();
        if (engineRef.current === engine) engineRef.current = null;
        setAssetLoadError(true);
      } finally {
        setIsLoadingGame(false);
      }
    } else {
      gameOverFiredRef.current = false;
      engineRef.current.restart(gameTime, spawnTime);
      setHasStarted(true);
      setIsLoadingGame(false);
    }
  };

  const handleRestart = () => {
    if (engineRef.current) {
      gameOverFiredRef.current = false;
      engineRef.current.restart(gameTime, spawnTime);
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
    refetch();
  };

  const handleTogglePause = () => {
    if (engineRef.current) {
      engineRef.current.togglePause();
    }
  };

  const safeScores = Array.isArray(scores) ? scores : [];
  const myHistory = safeScores.filter(s => !s.isFixture);
  const mockMatches = safeScores.filter(s => s.isFixture);
  const myMatches = safeScores.filter(s => !s.isFixture);
  const myBestMatch = myMatches.length > 0 
    ? [...myMatches].sort((a, b) => b.score - a.score)[0] 
    : null;

  const rankingPool = [...mockMatches];
  if (myBestMatch) rankingPool.push(myBestMatch);
  const topScores = rankingPool.sort((a, b) => b.score - a.score);
  const visibleRanking = topScores.slice(rankingPage * PAGE_SIZE, (rankingPage + 1) * PAGE_SIZE);
  const visibleHistory = myHistory.slice(historyPage * PAGE_SIZE, (historyPage + 1) * PAGE_SIZE);
  const resultForDisplay = savedResult ?? { score, health, reason: health <= 0 ? 'ship_destroyed' : 'time_out', playerName, date: new Date().toISOString() };
  const showResult = isGameOver || (!hasStarted && savedResult !== null);

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
        <div data-testid="main-menu" style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          backgroundImage: 'url(/assets/ui_scene_background.jpg)',
          backgroundSize: 'cover', backgroundPosition: 'center',
          zIndex: 30, display: 'flex', justifyContent: 'center', alignItems: 'center',
          padding: '10px', boxSizing: 'border-box'
        }}>
          <div style={panelImageStyle}>
            <img 
              src="/assets/png/default/ui/menu/title_pirate_battle.png" 
              alt="Pirate Battle" 
              style={{ width: '85%', marginBottom: '15px' }} 
            />
            
            <p style={{ fontSize: '0.9rem', color: '#fff', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '25px', textShadow: '1px 1px 2px #000', fontFamily: GAME_FONT }}>
              Welcome, <span style={{ color: '#fbe29f' }}>{playerName}</span>
            </p>

            <MenuButton text={assetLoadError ? 'RETRY' : isLoadingGame ? 'LOADING...' : 'PLAY'} onClick={startGame} type="primary" disabled={isLoadingGame} />
            {assetLoadError && <p role="alert" data-testid="asset-load-error" style={{ color: '#ffb4a2', fontFamily: GAME_FONT }}>Some game assets failed to load. Retry?</p>}
            <div style={{ height: '15px' }} />
            <MenuButton text="OPTIONS" onClick={() => setShowOptionsModal(true)} type="primary" />

            <div style={{ margin: '20px 0 10px 0', opacity: 0.9 }}>
              <img src="/assets/png/default/ships/ship_player.png" alt="Ship" style={{ width: '45px', filter: 'drop-shadow(0 5px 5px rgba(0,0,0,0.5))' }} onError={(e) => e.currentTarget.style.display = 'none'} />
            </div>

            <p style={{ fontSize: '0.8rem', color: '#e2e8f0', marginBottom: '20px', textShadow: '1px 1px 2px #000', fontFamily: GAME_FONT }}>
              Navigate the islands. Survive the battle.
            </p>

            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', width: '100%', flexWrap: 'wrap' }}>
              <MenuButton text="RANKING" onClick={() => { setRankingPage(0); setShowRankingModal(true); }} type="secondary" />
              <MenuButton text="HISTORY" onClick={() => { setHistoryPage(0); setShowHistoryModal(true); }} type="secondary" />
            </div>
          </div>
        </div>
      )}

      {showOptionsModal && (
        <OptionsModal 
          initialGameTime={gameTime}
          initialSpawnTime={spawnTime}
          initialPlayerName={playerName}
          onSave={handleSaveOptions}
          onClose={() => setShowOptionsModal(false)}
        />
      )}

      {showRankingModal && (
        <div data-testid="ranking-modal" role="dialog" aria-label="Ranking" style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 40,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          backdropFilter: 'blur(4px)', padding: '15px', boxSizing: 'border-box'
        }}>
          <div style={{ ...panelImageStyle, minHeight: '550px' }}>
            <h2 style={{ textAlign: 'center', color: '#fbe29f', marginTop: 0, textShadow: '2px 2px 0 #3e1d04', fontFamily: GAME_FONT, fontSize: '1.8rem' }}>
              🏆 TOP CAPTAINS
            </h2>
            
            <div style={{ width: '100%', flex: 1, overflowY: 'auto', marginBottom: '20px', fontFamily: GAME_FONT, color: '#fff' }}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {isFetchingScores && safeScores.length === 0 && <li data-testid="scores-loading">Loading scores...</li>}
                {isScoresError && <li role="alert">Could not load scores. <button onClick={() => refetch()}>RETRY</button></li>}
                {!isFetchingScores && !isScoresError && topScores.length === 0 && <li data-testid="ranking-empty">No scores found.</li>}
                {visibleRanking.map((match, idx) => {
                  const isMe = !match.isFixture;
                  const displayTitle = isMe ? (match.playerName || playerName) : match.playerName;

                  return (
                    <li key={match.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', fontSize: '1rem',
                      borderBottom: '1px solid rgba(255,255,255,0.1)'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ display: 'inline-block', minWidth: '45px', marginRight: '5px' }}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                        </span> 
                        <span style={{ color: isMe ? '#fbe29f' : '#fff', fontWeight: isMe ? 'bold' : 'normal' }}>
                          {displayTitle}
                        </span>
                        {isMe && (
                          <span style={{ fontSize: '0.75rem', backgroundColor: '#e69e35', color: '#3e1d04', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px', fontWeight: 'bold' }}>YOU</span>
                        )}
                      </span>
                      <span style={{ color: '#fbe29f', fontWeight: 'bold' }}>{match.score} pts</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            {topScores.length > PAGE_SIZE && <Pagination page={rankingPage} pages={Math.ceil(topScores.length / PAGE_SIZE)} onPageChange={setRankingPage} label="ranking" />}
            <MenuButton text="CLOSE" onClick={() => setShowRankingModal(false)} type="primary" />
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div data-testid="history-modal" role="dialog" aria-label="Match History" style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 40,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          backdropFilter: 'blur(4px)', padding: '15px', boxSizing: 'border-box'
        }}>
          <div style={{ ...panelImageStyle, minHeight: '550px' }}>
            <h2 style={{ textAlign: 'center', color: '#fbe29f', marginTop: 0, textShadow: '2px 2px 0 #3e1d04', fontFamily: GAME_FONT, fontSize: '1.8rem' }}>
              📜 MATCH HISTORY
            </h2>
            
            <div style={{ width: '100%', flex: 1, overflowY: 'auto', marginBottom: '20px', fontFamily: GAME_FONT, color: '#fff' }}>
              {isFetchingScores && safeScores.length === 0 ? <p data-testid="scores-loading">Loading matches...</p> : isScoresError ? <p role="alert">Could not load matches. <button onClick={() => refetch()}>RETRY</button></p> : myHistory.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#aaa', marginTop: '20px', fontSize: '1rem' }}>No battles recorded for {playerName}.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {visibleHistory.map((match, idx) => (
                    <li key={match.id} style={{
                      display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: '1rem',
                      borderBottom: '1px solid rgba(255,255,255,0.1)'
                    }}>
                      <span>#{idx + 1} — Score: <b style={{ color: '#fbe29f' }}>{match.score}</b></span>
                      <span style={{ color: match.reason === 'ship_destroyed' ? '#ff6b6b' : '#69b3a2', fontSize: '0.9rem' }}>
                        {match.reason === 'ship_destroyed' ? 'DEFEATED' : 'TIME UP'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {myHistory.length > PAGE_SIZE && <Pagination page={historyPage} pages={Math.ceil(myHistory.length / PAGE_SIZE)} onPageChange={setHistoryPage} label="history" />}
            <MenuButton text="CLOSE" onClick={() => setShowHistoryModal(false)} type="primary" />
          </div>
        </div>
      )}

      {/* HUD SUPERIOR EM JOGO (Adaptado para mobile) */}
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
                <span>{health}/100</span>
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
                <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fbe29f' }}>{score}</span>
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
                <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: timeLeft <= 10 ? '#ef4444' : '#fbe29f' }}>{timeLeft}s</span>
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

      {/* BOTÕES TÁTEIS / MOBILE FLUTUANTES OTIMIZADOS COM SAFE-AREA */}
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
          {/* Controles de Direção / Rotação (Esquerda) */}
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

          {/* Controles de Disparo: Esquerda, Frente e Direita (Direita) */}
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
        <div style={{
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
        <div data-testid="result-screen" role="dialog" aria-label="Battle result" style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.8)', zIndex: 20,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          backdropFilter: 'blur(4px)', padding: '15px', boxSizing: 'border-box'
        }}>
          <div style={{ ...panelImageStyle, minHeight: 'auto', paddingBottom: '40px' }}>
            <h1 style={{ fontSize: '2.5rem', color: '#fbe29f', textShadow: '2px 2px 0 #3e1d04', margin: '0 0 10px 0', fontFamily: GAME_FONT, textAlign: 'center' }}>BATTLE COMPLETE</h1>
            <h2 data-testid="result-score" style={{ fontSize: '4.5rem', margin: '10px 0', color: '#fff', textShadow: '3px 3px 0 #000', fontFamily: GAME_FONT }}>{resultForDisplay.score}</h2>
            
            <p style={{ color: '#aaa', fontSize: '1rem', marginBottom: '25px', fontFamily: GAME_FONT, textTransform: 'uppercase' }}>
              POINTS • {health <= 0 ? 'DEFEATED' : 'TIME UP'}
            </p>
            
            <div style={{ height: '25px', marginBottom: '15px', fontSize: '1rem', color: '#8ecae6', fontFamily: GAME_FONT }}>
              {isPending && <span>Saving score... ⏳</span>}
              {isSuccess && <span style={{ color: '#4CAF50' }}>Score saved! ✅</span>}
            </div>
            {isSubmissionError && pendingScore && <button data-testid="retry-score" onClick={() => submitScore(pendingScore)}>RETRY SAVE</button>}
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

function Pagination({ page, pages, onPageChange, label }: { page: number; pages: number; onPageChange: (page: number) => void; label: string }) {
  return (
    <div data-testid={`${label}-pagination`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '12px', color: '#fff', fontFamily: GAME_FONT }}>
      <button aria-label={`Previous ${label} page`} disabled={page === 0} onClick={() => onPageChange(Math.max(0, page - 1))}>PREVIOUS</button>
      <span>{page + 1} / {pages}</span>
      <button aria-label={`Next ${label} page`} disabled={page >= pages - 1} onClick={() => onPageChange(Math.min(pages - 1, page + 1))}>NEXT</button>
    </div>
  );
}

function MobileControlButton({ icon, onPressChange, title }: { icon: string, onPressChange: (active: boolean) => void, title?: string }) {
  const [isPressed, setIsPressed] = useState(false);

  const bgImage = isPressed 
    ? 'url(/assets/png/default/ui/controls/button_round_pressed.png)' 
    : 'url(/assets/png/default/ui/controls/button_round_normal.png)';

  return (
    <button
      aria-label={title}
      data-testid={title ? `touch-${title.toLowerCase().replaceAll(' ', '-')}` : undefined}
      onMouseDown={(e) => {
        e.preventDefault();
        setIsPressed(true);
        onPressChange(true);
      }}
      onMouseUp={(e) => {
        e.preventDefault();
        setIsPressed(false);
        onPressChange(false);
      }}
      onMouseLeave={(e) => {
        e.preventDefault();
        if (isPressed) {
          setIsPressed(false);
          onPressChange(false);
        }
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        setIsPressed(true);
        onPressChange(true);
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        setIsPressed(false);
        onPressChange(false);
      }}
      onTouchCancel={(e) => {
        e.preventDefault();
        setIsPressed(false);
        onPressChange(false);
      }}
      style={{
        backgroundImage: bgImage,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        backgroundColor: 'transparent',
        border: 'none',
        width: '54px',
        height: '54px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        outline: 'none',
        position: 'relative',
        filter: 'drop-shadow(0px 3px 5px rgba(0,0,0,0.6))',
        transform: isPressed ? 'translateY(2px)' : 'none',
        pointerEvents: 'auto',
        touchAction: 'none',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none'
      }}
    >
      <img 
        src={icon} 
        alt="" 
        style={{ width: '22px', height: '22px', objectFit: 'contain', pointerEvents: 'none', margin: '0 auto' }} 
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      {title && (
        <span style={{ fontSize: '0.45rem', color: '#fbe29f', fontFamily: GAME_FONT, fontWeight: 'bold', textShadow: '1px 1px 0 #000', position: 'absolute', bottom: '2px', width: '100%', textAlign: 'center', pointerEvents: 'none' }}>
          {title}
        </span>
      )}
    </button>
  );
}

function OptionsModal({ initialGameTime, initialSpawnTime, initialPlayerName, onSave, onClose }: {
  initialGameTime: number;
  initialSpawnTime: number;
  initialPlayerName: string;
  onSave: (gameTime: number, spawnTime: number, playerName: string) => void;
  onClose: () => void;
}) {
  const [gameTime, setGameTime] = useState(initialGameTime);
  const [spawnTime, setSpawnTime] = useState(initialSpawnTime);
  const [playerName, setPlayerName] = useState(initialPlayerName);

  const allowedGameTimes = [60, 90, 120, 150, 180];
  const allowedSpawnTimes = [2, 3, 4, 5];

  return (
        <div data-testid="options-modal" role="dialog" aria-label="Options" style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 40,
      display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      backdropFilter: 'blur(4px)', padding: '15px', boxSizing: 'border-box'
    }}>
      <div style={{
        backgroundImage: 'url(/assets/png/default/ui/menu/panel_menu.png)',
        backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat',
        width: '90%', maxWidth: '500px', minHeight: '520px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '50px 40px', boxSizing: 'border-box',
        filter: 'drop-shadow(0px 15px 25px rgba(0,0,0,0.6))'
      }}>
        <h2 style={{ textAlign: 'center', color: '#fbe29f', marginTop: 0, marginBottom: '25px', textShadow: '2px 2px 0 #3e1d04', fontFamily: GAME_FONT, fontSize: '1.8rem' }}>
          OPTIONS
        </h2>

        <div style={{ width: '100%', marginBottom: '20px', fontFamily: GAME_FONT }}>
          <label htmlFor="captain-name" style={{ display: 'block', marginBottom: '8px', color: '#fff', fontSize: '0.9rem', textTransform: 'uppercase', textAlign: 'center' }}>
            Captain Name
          </label>
          <input 
            id="captain-name"
            type="text" 
            maxLength={15}
            required
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            style={{
              width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 'bold', textAlign: 'center',
              backgroundColor: 'rgba(0,0,0,0.4)', color: '#fbe29f',
              border: '2px solid #aaa', borderRadius: '6px', outline: 'none', textTransform: 'uppercase',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ width: '100%', marginBottom: '20px', fontFamily: GAME_FONT }}>
          <label htmlFor="session-time" style={{ display: 'block', marginBottom: '8px', color: '#fff', fontSize: '0.9rem', textTransform: 'uppercase', textAlign: 'center' }}>
            Game Session Time
          </label>
          <div style={{ display: 'flex', gap: '5px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            {allowedGameTimes.map((time) => (
              <button
                key={time} onClick={() => setGameTime(time)}
                aria-pressed={gameTime === time}
                data-testid={`session-time-${time}`}
                style={{
                  flex: 1, padding: '10px 0', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer',
                  backgroundColor: gameTime === time ? '#e69e35' : 'rgba(0,0,0,0.4)',
                  color: gameTime === time ? '#3e1d04' : 'white',
                  border: gameTime === time ? '2px solid #6b3e1b' : '1px solid #aaa', borderRadius: '6px',
                  fontFamily: GAME_FONT
                }}
              >
                {time}s
              </button>
            ))}
          </div>
        </div>

        <div style={{ width: '100%', marginBottom: '30px', fontFamily: GAME_FONT }}>
          <label htmlFor="spawn-time" style={{ display: 'block', marginBottom: '8px', color: '#fff', fontSize: '0.9rem', textTransform: 'uppercase', textAlign: 'center' }}>
            Enemy Spawn Time
          </label>
          <div style={{ display: 'flex', gap: '5px', justifyContent: 'space-between' }}>
            {allowedSpawnTimes.map((spawn) => (
              <button
                key={spawn} onClick={() => setSpawnTime(spawn)}
                aria-pressed={spawnTime === spawn}
                data-testid={`spawn-time-${spawn}`}
                style={{
                  flex: 1, padding: '10px 0', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer',
                  backgroundColor: spawnTime === spawn ? '#e69e35' : 'rgba(0,0,0,0.4)',
                  color: spawnTime === spawn ? '#3e1d04' : 'white',
                  border: spawnTime === spawn ? '2px solid #6b3e1b' : '1px solid #aaa', borderRadius: '6px',
                  fontFamily: GAME_FONT
                }}
              >
                {spawn}s
              </button>
            ))}
          </div>
        </div>

        <MenuButton text="SAVE & CLOSE" onClick={() => onSave(gameTime, spawnTime, playerName.trim() || 'Captain Jack')} type="primary" disabled={!playerName.trim()} />
        <div style={{ height: '10px' }} />
        <MenuButton text="CANCEL" onClick={onClose} type="secondary" />
      </div>
    </div>
  );
}

function MenuButton({ onClick, text, type = 'primary', disabled = false }: { onClick: () => void, text: string, type?: 'primary' | 'secondary', disabled?: boolean }) {
  const [interactionState, setInteractionState] = useState<'normal' | 'hover' | 'pressed'>('normal');

  const getBackgroundImage = () => {
    if (interactionState === 'pressed') return `url(/assets/png/default/ui/menu/button_${type}_pressed.png)`;
    if (interactionState === 'hover' && type === 'primary') return `url(/assets/png/default/ui/menu/button_${type}_hover.png)`;
    return `url(/assets/png/default/ui/menu/button_${type}_normal.png)`;
  };

  const width = type === 'primary' ? '220px' : '160px';
  const height = type === 'primary' ? '55px' : '45px';
  const fontSize = type === 'primary' ? '1.2rem' : '1rem';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setInteractionState('hover')}
      onMouseLeave={() => setInteractionState('normal')}
      onMouseDown={() => setInteractionState('pressed')}
      onMouseUp={() => setInteractionState('hover')}
      style={{
        backgroundImage: getBackgroundImage(), backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat',
        backgroundColor: 'transparent', border: 'none', 
        color: '#fbe29f',
        fontFamily: GAME_FONT, fontWeight: 'bold', fontSize: fontSize,
        width: width, height: height, cursor: 'pointer', textTransform: 'uppercase',
        display: 'flex', justifyContent: 'center', alignItems: 'center', outline: 'none'
      }}
    >
      <span style={{ 
        transform: interactionState === 'pressed' ? 'translateY(3px)' : 'none',
        textShadow: '2px 2px 0px #3e1d04, 1px 1px 0px #000'
      }}>
        {text}
      </span>
    </button>
  );
}
