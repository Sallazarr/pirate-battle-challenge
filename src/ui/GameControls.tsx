import React, { useState } from 'react';

const GAME_FONT = 'monospace';
const ALLOWED_GAME_TIMES = [60, 90, 120, 150, 180];
const ALLOWED_SPAWN_TIMES = [2, 3, 4, 5];
export function Pagination({ page, pages, onPageChange, label }: { page: number; pages: number; onPageChange: (page: number) => void; label: string }) {
  return (
    <div data-testid={`${label}-pagination`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '12px', color: '#fff', fontFamily: GAME_FONT }}>
      <button aria-label={`Previous ${label} page`} disabled={page === 0} onClick={() => onPageChange(Math.max(0, page - 1))}>PREVIOUS</button>
      <span>{page + 1} / {pages}</span>
      <button aria-label={`Next ${label} page`} disabled={page >= pages - 1} onClick={() => onPageChange(Math.min(pages - 1, page + 1))}>NEXT</button>
    </div>
  );
}

export function MobileControlButton({ icon, onPressChange, title }: { icon: string, onPressChange: (active: boolean) => void, title?: string }) {
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

export function OptionsModal({ dialogRef, initialGameTime, initialSpawnTime, initialPlayerName, onSave, onClose }: {
  dialogRef: React.RefObject<HTMLDivElement | null>;
  initialGameTime: number;
  initialSpawnTime: number;
  initialPlayerName: string;
  onSave: (gameTime: number, spawnTime: number, playerName: string) => void;
  onClose: () => void;
}) {
  const [gameTime, setGameTime] = useState(initialGameTime);
  const [spawnTime, setSpawnTime] = useState(initialSpawnTime);
  const [playerName, setPlayerName] = useState(initialPlayerName);

  const normalizedName = playerName.trim();
  const hasInvalidName = normalizedName.length === 0;

  return (
        <div ref={dialogRef} data-testid="options-modal" role="dialog" aria-modal="true" aria-labelledby="options-title" style={{
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
        <h2 id="options-title" style={{ textAlign: 'center', color: '#fbe29f', marginTop: 0, marginBottom: '25px', textShadow: '2px 2px 0 #3e1d04', fontFamily: GAME_FONT, fontSize: '1.8rem' }}>
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
            aria-invalid={hasInvalidName}
            aria-describedby="captain-name-help"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            style={{
              width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 'bold', textAlign: 'center',
              backgroundColor: 'rgba(0,0,0,0.4)', color: '#fbe29f',
              border: '2px solid #aaa', borderRadius: '6px', textTransform: 'uppercase',
              boxSizing: 'border-box'
            }}
          />
          <p id="captain-name-help" role={hasInvalidName ? 'alert' : undefined} style={{ color: hasInvalidName ? '#ffb4a2' : '#aaa', fontSize: '0.75rem', textAlign: 'center', margin: '6px 0 0' }}>
            {hasInvalidName ? 'Enter a captain name to continue.' : 'Up to 15 characters.'}
          </p>
        </div>

        <div style={{ width: '100%', marginBottom: '20px', fontFamily: GAME_FONT }}>
          <label htmlFor="session-time" style={{ display: 'block', marginBottom: '8px', color: '#fff', fontSize: '0.9rem', textTransform: 'uppercase', textAlign: 'center' }}>
            Game Session Time
          </label>
          <div role="group" aria-label="Game session time" style={{ display: 'flex', gap: '5px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            {ALLOWED_GAME_TIMES.map((time) => (
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
          <div role="group" aria-label="Enemy spawn interval" style={{ display: 'flex', gap: '5px', justifyContent: 'space-between' }}>
            {ALLOWED_SPAWN_TIMES.map((spawn) => (
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

        <MenuButton text="SAVE & CLOSE" onClick={() => onSave(gameTime, spawnTime, normalizedName)} type="primary" disabled={hasInvalidName} />
        <div style={{ height: '10px' }} />
        <MenuButton text="CANCEL" onClick={onClose} type="secondary" />
      </div>
    </div>
  );
}

export function MenuButton({ onClick, text, type = 'primary', disabled = false }: { onClick: () => void, text: string, type?: 'primary' | 'secondary', disabled?: boolean }) {
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
        display: 'flex', justifyContent: 'center', alignItems: 'center'
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
