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

export function GameCanvas() {
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const gameOverFiredRef = useRef(false); 

  const [hasStarted, setHasStarted] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showRankingModal, setShowRankingModal] = useState(false);

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
  const [highScore, setHighScore] = useState<number>(() => {
    return Number(localStorage.getItem('pirate_battle_highscore') || '0');
  });
  const [health, setHealth] = useState(100);
  const [timeLeft, setTimeLeft] = useState(gameTime);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const { data: scores = [], refetch } = useQuery<ScoreRecord[]>({
    queryKey: ['scores'],
    queryFn: async () => {
      const response = await apiClient.get('/api/scores');
      return Array.isArray(response.data) ? response.data : [];
    },
    initialData: [],
  });

  const { mutate: submitScore, isPending, isSuccess } = useMutation({
    mutationFn: async (data: { score: number; reason: string; playerName: string }) => {
      const response = await apiClient.post('/api/scores', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scores'] });
      refetch();
    }
  });

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
        engineRef.current.togglePause();
      }
    };
    const handleWindowBlur = () => {
      if (engineRef.current && hasStarted && !isGameOver) {
        engineRef.current.togglePause();
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

  const startGame = () => {
    setHasStarted(true);
    setTimeLeft(gameTime);
    const container = containerRef.current;
    if (!container) return;

    if (!engineRef.current) {
      const engine = new GameEngine();
      engineRef.current = engine;
      
      engine.init(container, gameTime, spawnTime, (newScore, newHealth, newTime, gameOverFlag, pausedFlag, currentHighScore) => {
        setScore(newScore);
        setHealth(newHealth);
        setTimeLeft(newTime);
        setIsGameOver(gameOverFlag);
        setIsPaused(pausedFlag);
        setHighScore(currentHighScore);

        if (gameOverFlag && !gameOverFiredRef.current) {
          gameOverFiredRef.current = true;
          const reason = newHealth <= 0 ? 'ship_destroyed' : 'time_out';
          submitScore({ score: newScore, reason, playerName });
        }
      });
    } else {
      gameOverFiredRef.current = false;
      engineRef.current.restart(gameTime, spawnTime);
    }
  };

  const handleRestart = () => {
    if (engineRef.current) {
      gameOverFiredRef.current = false;
      engineRef.current.restart(gameTime, spawnTime);
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
    refetch();
  };

  const handleTogglePause = () => {
    if (engineRef.current) {
      engineRef.current.togglePause();
    }
  };

  const safeScores = Array.isArray(scores) ? scores : [];
  const myHistory = safeScores.filter(s => !s.isFixture).slice(0, 10);
  const mockMatches = safeScores.filter(s => s.isFixture);
  const myMatches = safeScores.filter(s => !s.isFixture);
  const myBestMatch = myMatches.length > 0 
    ? [...myMatches].sort((a, b) => b.score - a.score)[0] 
    : null;

  const rankingPool = [...mockMatches];
  if (myBestMatch) rankingPool.push(myBestMatch);
  const topScores = rankingPool.sort((a, b) => b.score - a.score).slice(0, 10);

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
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#001a33' }}>
      
      {!hasStarted && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          backgroundImage: 'url(/assets/ui_scene_background.jpg)',
          backgroundSize: 'cover', backgroundPosition: 'center',
          zIndex: 30, display: 'flex', justifyContent: 'center', alignItems: 'center'
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

            <MenuButton text="PLAY" onClick={startGame} type="primary" />
            <div style={{ height: '15px' }} />
            <MenuButton text="OPTIONS" onClick={() => setShowOptionsModal(true)} type="primary" />

            <div style={{ margin: '20px 0 10px 0', opacity: 0.9 }}>
              <img src="/assets/png/default/ships/ship_player.png" alt="Ship" style={{ width: '45px', filter: 'drop-shadow(0 5px 5px rgba(0,0,0,0.5))' }} onError={(e) => e.currentTarget.style.display = 'none'} />
            </div>

            <p style={{ fontSize: '0.8rem', color: '#e2e8f0', marginBottom: '20px', textShadow: '1px 1px 2px #000', fontFamily: GAME_FONT }}>
              Navigate the islands. Survive the battle.
            </p>

            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', width: '100%' }}>
              <MenuButton text="RANKING" onClick={() => setShowRankingModal(true)} type="secondary" />
              <MenuButton text="HISTORY" onClick={() => setShowHistoryModal(true)} type="secondary" />
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
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 40,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{ ...panelImageStyle, minHeight: '550px' }}>
            <h2 style={{ textAlign: 'center', color: '#fbe29f', marginTop: 0, textShadow: '2px 2px 0 #3e1d04', fontFamily: GAME_FONT, fontSize: '1.8rem' }}>
              🏆 TOP CAPTAINS
            </h2>
            
            <div style={{ width: '100%', flex: 1, overflowY: 'auto', marginBottom: '20px', fontFamily: GAME_FONT, color: '#fff' }}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {topScores.map((match, idx) => {
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
            <MenuButton text="CLOSE" onClick={() => setShowRankingModal(false)} type="primary" />
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 40,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{ ...panelImageStyle, minHeight: '550px' }}>
            <h2 style={{ textAlign: 'center', color: '#fbe29f', marginTop: 0, textShadow: '2px 2px 0 #3e1d04', fontFamily: GAME_FONT, fontSize: '1.8rem' }}>
              📜 MATCH HISTORY
            </h2>
            
            <div style={{ width: '100%', flex: 1, overflowY: 'auto', marginBottom: '20px', fontFamily: GAME_FONT, color: '#fff' }}>
              {myHistory.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#aaa', marginTop: '20px', fontSize: '1rem' }}>No battles recorded for {playerName}.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {myHistory.map((match, idx) => (
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
            <MenuButton text="CLOSE" onClick={() => setShowHistoryModal(false)} type="primary" />
          </div>
        </div>
      )}

      {/* HUD SUPERIOR EM JOGO */}
      {hasStarted && (
        <div style={{
          position: 'absolute', top: 20, left: 20, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          zIndex: 10, fontFamily: GAME_FONT, pointerEvents: 'none'
        }}>
          <div style={{
            backgroundColor: 'rgba(0, 26, 51, 0.85)', border: '3px solid #d4a351', borderRadius: '10px',
            padding: '10px 15px', display: 'flex', alignItems: 'center', gap: '12px',
            boxShadow: '0 5px 15px rgba(0,0,0,0.5)'
          }}>
            <span style={{ fontSize: '1.4rem' }}>❤️</span>
            <div style={{ width: '140px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
                <span>HEALTH</span>
                <span>{health}/100</span>
              </div>
              <div style={{ width: '100%', height: '12px', backgroundColor: '#1e293b', borderRadius: '6px', overflow: 'hidden', border: '1px solid #475569' }}>
                <div style={{ 
                  width: `${Math.max(0, Math.min(100, health))}%`, 
                  height: '100%', 
                  backgroundColor: health <= 30 ? '#ef4444' : '#22c55e',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', pointerEvents: 'auto' }}>
            <div style={{
              backgroundColor: 'rgba(0, 26, 51, 0.85)', border: '3px solid #d4a351', borderRadius: '10px',
              padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '10px',
              boxShadow: '0 5px 15px rgba(0,0,0,0.5)', color: '#fff', fontFamily: GAME_FONT
            }}>
              <span style={{ fontSize: '1.2rem' }}>🏆</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Score</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fbe29f' }}>{score}</span>
              </div>
            </div>

            <div style={{
              backgroundColor: 'rgba(0, 26, 51, 0.85)', border: '3px solid #d4a351', borderRadius: '10px',
              padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '10px',
              boxShadow: '0 5px 15px rgba(0,0,0,0.5)', color: '#fff', fontFamily: GAME_FONT
            }}>
              <span style={{ fontSize: '1.2rem' }}>⏱️</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Time</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: timeLeft <= 10 ? '#ef4444' : '#fbe29f' }}>{timeLeft}s</span>
              </div>
            </div>

            {!isGameOver && (
              <button
                onClick={handleTogglePause}
                style={{
                  backgroundColor: '#e69e35', border: '3px solid #6b3e1b', borderRadius: '10px',
                  width: '48px', height: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center',
                  cursor: 'pointer', boxShadow: '0 5px 15px rgba(0,0,0,0.5)', color: '#3e1d04', fontSize: '1.2rem', fontWeight: 'bold'
                }}
                title="Pause"
              >
                {isPaused ? '▶' : '⏸'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* BOTÕES TÁTEIS / MOBILE FLUTUANTES (Totalmente interativos com ponteiro/rato/toque) */}
      {hasStarted && !isGameOver && !isPaused && (
        <div style={{
          position: 'absolute', bottom: 20, left: 20, right: 20, 
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          zIndex: 15, pointerEvents: 'none', userSelect: 'none'
        }}>
          {/* Controles de Direção / Rotação (Esquerda) */}
          <div style={{ display: 'flex', gap: '12px', pointerEvents: 'auto' }}>
            <MobileControlButton
              icon="/assets/png/default/ui/controls/icon_turn_left.png"
              onPressChange={(active) => engineRef.current?.setControl('left', active)}
            />
            <MobileControlButton
              icon="/assets/png/default/ui/controls/icon_turn_right.png"
              onPressChange={(active) => engineRef.current?.setControl('right', active)}
            />
            <MobileControlButton
              icon="/assets/png/default/ui/controls/icon_forward.png"
              onPressChange={(active) => engineRef.current?.setControl('forward', active)}
            />
          </div>

          {/* Controles de Disparo: Esquerda, Frente e Direita (Direita) */}
          <div style={{ display: 'flex', gap: '10px', pointerEvents: 'auto' }}>
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
          backdropFilter: 'blur(3px)'
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

      {isGameOver && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.8)', zIndex: 20,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{ ...panelImageStyle, minHeight: 'auto', paddingBottom: '40px' }}>
            <h1 style={{ fontSize: '2.5rem', color: '#fbe29f', textShadow: '2px 2px 0 #3e1d04', margin: '0 0 10px 0', fontFamily: GAME_FONT, textAlign: 'center' }}>BATTLE COMPLETE</h1>
            <h2 style={{ fontSize: '4.5rem', margin: '10px 0', color: '#fff', textShadow: '3px 3px 0 #000', fontFamily: GAME_FONT }}>{score}</h2>
            
            <p style={{ color: '#aaa', fontSize: '1rem', marginBottom: '25px', fontFamily: GAME_FONT, textTransform: 'uppercase' }}>
              POINTS • {health <= 0 ? 'DEFEATED' : 'TIME UP'}
            </p>
            
            <div style={{ height: '25px', marginBottom: '15px', fontSize: '1rem', color: '#8ecae6', fontFamily: GAME_FONT }}>
              {isPending && <span>Saving score... ⏳</span>}
              {isSuccess && <span style={{ color: '#4CAF50' }}>Score saved! ✅</span>}
            </div>
            
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

function MobileControlButton({ icon, onPressChange, title }: { icon: string, onPressChange: (active: boolean) => void, title?: string }) {
  const [isPressed, setIsPressed] = useState(false);

  const bgImage = isPressed 
    ? 'url(/assets/png/default/ui/controls/button_round_pressed.png)' 
    : 'url(/assets/png/default/ui/controls/button_round_normal.png)';

  return (
    <button
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsPressed(true);
        onPressChange(true);
      }}
      onPointerUp={(e) => {
        setIsPressed(false);
        onPressChange(false);
      }}
      onPointerCancel={(e) => {
        setIsPressed(false);
        onPressChange(false);
      }}
      style={{
        backgroundImage: bgImage,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        backgroundColor: 'transparent',
        border: 'none',
        width: '60px',
        height: '60px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        outline: 'none',
        position: 'relative',
        filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.5))',
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
        style={{ width: '26px', height: '26px', objectFit: 'contain', pointerEvents: 'none', margin: '0 auto' }} 
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      {title && (
        <span style={{ fontSize: '0.55rem', color: '#fbe29f', fontFamily: GAME_FONT, fontWeight: 'bold', textShadow: '1px 1px 0 #000', position: 'absolute', bottom: '4px', width: '100%', textAlign: 'center', pointerEvents: 'none' }}>
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
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 40,
      display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      backdropFilter: 'blur(4px)'
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
          <label style={{ display: 'block', marginBottom: '8px', color: '#fff', fontSize: '0.9rem', textTransform: 'uppercase', textAlign: 'center' }}>
            Captain Name
          </label>
          <input 
            type="text" 
            maxLength={15}
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
          <label style={{ display: 'block', marginBottom: '8px', color: '#fff', fontSize: '0.9rem', textTransform: 'uppercase', textAlign: 'center' }}>
            Game Session Time
          </label>
          <div style={{ display: 'flex', gap: '5px', justifyContent: 'space-between' }}>
            {allowedGameTimes.map((time) => (
              <button
                key={time} onClick={() => setGameTime(time)}
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
          <label style={{ display: 'block', marginBottom: '8px', color: '#fff', fontSize: '0.9rem', textTransform: 'uppercase', textAlign: 'center' }}>
            Enemy Spawn Time
          </label>
          <div style={{ display: 'flex', gap: '5px', justifyContent: 'space-between' }}>
            {allowedSpawnTimes.map((spawn) => (
              <button
                key={spawn} onClick={() => setSpawnTime(spawn)}
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

        <MenuButton text="SAVE & CLOSE" onClick={() => onSave(gameTime, spawnTime, playerName || 'Captain Jack')} type="primary" />
        <div style={{ height: '10px' }} />
        <MenuButton text="CANCEL" onClick={onClose} type="secondary" />
      </div>
    </div>
  );
}

function MenuButton({ onClick, text, type = 'primary' }: { onClick: () => void, text: string, type?: 'primary' | 'secondary' }) {
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