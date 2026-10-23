import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { GameEngine } from '../game/GameEngine';

interface ScoreRecord {
  id: string;
  score: number;
  date: string;
  reason: string;
}

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const gameOverFiredRef = useRef(false); 

  const [hasStarted, setHasStarted] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState<number>(() => {
    return Number(localStorage.getItem('pirate_battle_highscore') || '0');
  });
  const [health, setHealth] = useState(100);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // TANSTACK QUERY: Buscar o histórico e ranking da API
  const { data: scores = [], refetch } = useQuery<ScoreRecord[]>({
    queryKey: ['scores'],
    queryFn: async () => {
      const response = await apiClient.get('/api/scores');
      return response.data;
    }
  });

  // TANSTACK QUERY: Mutação para submeter o recorde via Axios
  const { mutate: submitScore, isPending, isSuccess } = useMutation({
    mutationFn: async (data: { score: number; reason: string }) => {
      const response = await apiClient.post('/api/scores', data);
      return response.data;
    },
    onSuccess: () => {
      refetch(); // Atualiza a lista do ranking automaticamente ao terminar
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
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasStarted, isGameOver]);

  const startGame = () => {
    setHasStarted(true);
    const container = containerRef.current;
    if (!container) return;

    if (!engineRef.current) {
      const engine = new GameEngine();
      engineRef.current = engine;
      
      engine.init(container, (newScore, newHealth, newTime, gameOverFlag, pausedFlag, currentHighScore) => {
        setScore(newScore);
        setHealth(newHealth);
        setTimeLeft(newTime);
        setIsGameOver(gameOverFlag);
        setIsPaused(pausedFlag);
        setHighScore(currentHighScore);

        if (gameOverFlag && !gameOverFiredRef.current) {
          gameOverFiredRef.current = true;
          const reason = newHealth <= 0 ? 'ship_destroyed' : 'time_out';
          submitScore({ score: newScore, reason });
        }
      });
    } else {
      gameOverFiredRef.current = false;
      engineRef.current.restart();
    }
  };

  const handleRestart = () => {
    if (engineRef.current) {
      engineRef.current.audio.playClick();
      gameOverFiredRef.current = false;
      engineRef.current.restart();
    }
  };

  const handleReturnToMenu = () => {
    if (engineRef.current) {
      engineRef.current.audio.playClick();
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

  // Top 3 Melhores para o Menu Inicial
  const topThree = scores.slice(0, 3);
  // Últimos 10 para o Histórico
  const lastTen = scores.slice(0, 10);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#001a33' }}>
      
      {/* 1. MENU INICIAL */}
      {!hasStarted && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: '#001a33', zIndex: 30,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          color: 'white', fontFamily: 'monospace', overflowY: 'auto', padding: '20px'
        }}>
          <h1 style={{ fontSize: '3.5rem', color: '#ffb703', textShadow: '4px 4px 0 #000', margin: '0 0 5px 0' }}>🏴‍☠️ PIRATE BATTLE</h1>
          <p style={{ fontSize: '1.1rem', color: '#8ecae6', marginBottom: '15px' }}>Survive the attacks in the fortress waters!</p>
          
          <h3 style={{ fontSize: '1.3rem', color: '#ffb703', textShadow: '2px 2px 0 #000', margin: '0 0 20px 0' }}>
            🏆 Personal Best: {highScore}
          </h3>

          {/* TOP 3 RANKING NO MENU */}
          <div style={{
            backgroundColor: 'rgba(2, 62, 138, 0.4)', border: '2px solid #8ecae6', borderRadius: '10px',
            padding: '12px 25px', marginBottom: '20px', minWidth: '280px', textAlign: 'center'
          }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#ffb703' }}>🎖️ Top 3 Captains</h4>
            {topThree.length === 0 ? (
              <p style={{ fontSize: '0.9rem', color: '#aaa', margin: 0 }}>No battles recorded yet</p>
            ) : (
              topThree.map((item, index) => (
                <div key={item.id} style={{ fontSize: '0.95rem', margin: '4px 0', color: '#fff' }}>
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'} #{index + 1} — <b>{item.score}</b> ships
                </div>
              ))
            )}
          </div>

          <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
            <button 
              onClick={startGame}
              style={{
                padding: '15px 35px', fontSize: '1.6rem', fontWeight: 'bold', cursor: 'pointer',
                backgroundColor: '#ffb703', color: '#000', border: '3px solid #fff', borderRadius: '12px',
                boxShadow: '0 6px 15px rgba(0,0,0,0.5)', transition: 'transform 0.1s'
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              Start Battle
            </button>

            <button 
              onClick={() => setShowHistoryModal(true)}
              style={{
                padding: '15px 25px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer',
                backgroundColor: '#023e8a', color: 'white', border: '2px solid #fff', borderRadius: '12px',
                boxShadow: '0 6px 15px rgba(0,0,0,0.4)'
              }}
            >
              📜 Match History
            </button>
          </div>

          <div style={{ fontSize: '1rem', color: '#aaa', textAlign: 'center' }}>
            <p style={{ margin: '4px 0', color: '#fff' }}>W, A, S, D — Navigate</p>
            <p style={{ margin: '4px 0', color: '#ffb703' }}>SPACE — Front Cannon</p>
            <p style={{ margin: '4px 0', color: '#4caf50' }}>Q / E — Broadside Cannons (Left / Right)</p>
            <p style={{ margin: '4px 0', color: '#8ecae6' }}>P / ESC — Pause</p>
          </div>
        </div>
      )}

      {/* MODAL DE HISTÓRICO (ÚLTIMOS 10) */}
      {showHistoryModal && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 40,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          color: 'white', fontFamily: 'monospace', backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: '#001a33', border: '3px solid #ffb703', borderRadius: '15px',
            padding: '30px', width: '90%', maxWidth: '450px', maxHeight: '80vh', overflowY: 'auto',
            boxShadow: '0 8px 25px rgba(0,0,0,0.7)'
          }}>
            <h2 style={{ textAlign: 'center', color: '#ffb703', marginTop: 0 }}>📜 Last 10 Battles</h2>
            
            {lastTen.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#aaa' }}>No battle history found.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {lastTen.map((match, idx) => (
                  <li key={match.id} style={{
                    display: 'flex', justifyContent: 'space-between', padding: '10px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.15)'
                  }}>
                    <span>#{idx + 1} — Score: <b>{match.score}</b></span>
                    <span style={{ color: '#8ecae6', fontSize: '0.85rem' }}>
                      {match.reason === 'ship_destroyed' ? '💥 Defeat' : '⏱️ Time Out'}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <button 
              onClick={() => setShowHistoryModal(false)}
              style={{
                width: '100%', marginTop: '20px', padding: '12px', fontSize: '1.2rem', fontWeight: 'bold',
                cursor: 'pointer', backgroundColor: '#f44336', color: 'white', border: '2px solid #fff', borderRadius: '10px'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* 2. HUD SUPERIOR EM JOGO */}
      {hasStarted && (
        <div style={{
          position: 'absolute', top: 20, left: 20, color: 'white', zIndex: 10,
          fontFamily: 'monospace', textShadow: '2px 2px 0 #000', pointerEvents: 'none'
        }}>
          <h2 style={{ margin: '5px 0' }}>🏆 Score: {score} <span style={{ fontSize: '1rem', color: '#ffb703' }}>(Best: {highScore})</span></h2>
          <h2 style={{ margin: '5px 0', color: health <= 30 ? '#ff4444' : 'white' }}>❤️ Health: {health}</h2>
          <h2 style={{ margin: '5px 0', color: timeLeft <= 10 ? '#ff4444' : 'white' }}>⏱️ Time: {timeLeft}s</h2>
        </div>
      )}

      {/* Botão de Pausa Manual */}
      {hasStarted && !isGameOver && (
        <button
          onClick={handleTogglePause}
          style={{
            position: 'absolute', top: 20, right: 20, zIndex: 15,
            padding: '10px 20px', fontSize: '1.2rem', fontFamily: 'monospace', fontWeight: 'bold',
            backgroundColor: '#023e8a', color: 'white', border: '2px solid #fff', borderRadius: '8px',
            cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.4)'
          }}
        >
          {isPaused ? '▶ Resume' : '⏸ Pause'}
        </button>
      )}

      {/* 3. MENU DE PAUSA */}
      {isPaused && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.65)', zIndex: 20,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          color: 'white', fontFamily: 'monospace', backdropFilter: 'blur(3px)'
        }}>
          <h1 style={{ fontSize: '4rem', color: '#8ecae6', textShadow: '4px 4px 0 #000', margin: '0 0 20px 0' }}>GAME PAUSED</h1>
          
          <button 
            onClick={handleTogglePause}
            style={{
              padding: '12px 35px', fontSize: '1.5rem', fontWeight: 'bold', cursor: 'pointer',
              backgroundColor: '#2196F3', color: 'white', border: '2px solid #fff', borderRadius: '10px',
              margin: '10px 0', width: '260px'
            }}
          >
            Resume (P)
          </button>

          <button 
            onClick={handleRestart}
            style={{
              padding: '12px 35px', fontSize: '1.5rem', fontWeight: 'bold', cursor: 'pointer',
              backgroundColor: '#f44336', color: 'white', border: '2px solid #fff', borderRadius: '10px',
              margin: '10px 0', width: '260px'
            }}
          >
            Restart
          </button>

          <button 
            onClick={handleReturnToMenu}
            style={{
              padding: '12px 35px', fontSize: '1.5rem', fontWeight: 'bold', cursor: 'pointer',
              backgroundColor: '#023e8a', color: 'white', border: '2px solid #fff', borderRadius: '10px',
              margin: '10px 0', width: '260px'
            }}
          >
            Main Menu
          </button>
        </div>
      )}

      {/* 4. TELA DE GAME OVER */}
      {isGameOver && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.8)', zIndex: 20,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          color: 'white', fontFamily: 'monospace', backdropFilter: 'blur(4px)'
        }}>
          <h1 style={{ fontSize: '5rem', color: '#ff4444', textShadow: '4px 4px 0 #000', margin: '0 0 10px 0' }}>GAME OVER</h1>
          <h2 style={{ fontSize: '2.2rem', margin: '0 0 5px 0', textShadow: '2px 2px 0 #000' }}>Ships Destroyed: {score}</h2>
          <h3 style={{ fontSize: '1.5rem', color: '#ffb703', margin: '0 0 15px 0' }}>Best Score: {highScore}</h3>
          
          <div style={{ height: '30px', marginBottom: '20px', fontSize: '1.2rem', color: '#8ecae6' }}>
            {isPending && <span>Saving score to API... ⏳</span>}
            {isSuccess && <span style={{ color: '#4CAF50' }}>Score saved successfully! ✅</span>}
          </div>
          
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button 
              onClick={handleRestart}
              style={{
                padding: '15px 35px', fontSize: '1.6rem', fontWeight: 'bold', cursor: 'pointer',
                backgroundColor: '#4CAF50', color: 'white', border: '3px solid #fff', borderRadius: '12px',
                boxShadow: '0 6px 15px rgba(0,0,0,0.5)', transition: 'transform 0.1s'
              }}
            >
              Try Again
            </button>

            <button 
              onClick={handleReturnToMenu}
              style={{
                padding: '15px 35px', fontSize: '1.6rem', fontWeight: 'bold', cursor: 'pointer',
                backgroundColor: '#023e8a', color: 'white', border: '3px solid #fff', borderRadius: '12px',
                boxShadow: '0 6px 15px rgba(0,0,0,0.5)', transition: 'transform 0.1s'
              }}
            >
              Main Menu
            </button>
          </div>
        </div>
      )}

      {/* Contentor Canvas do PixiJS */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}