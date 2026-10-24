import React, { useState } from 'react';

const ALLOWED_GAME_TIMES = [60, 90, 120, 150, 180];
const ALLOWED_SPAWN_TIMES = [2, 3, 4, 5];
export function Pagination({ page, pages, onPageChange, label }: { page: number; pages: number; onPageChange: (page: number) => void; label: string }) {
  return (
    <div className="pagination" data-testid={`${label}-pagination`}>
      <button aria-label={`Previous ${label} page`} disabled={page === 0} onClick={() => onPageChange(Math.max(0, page - 1))}>PREVIOUS</button>
      <span>{page + 1} / {pages}</span>
      <button aria-label={`Next ${label} page`} disabled={page >= pages - 1} onClick={() => onPageChange(Math.min(pages - 1, page + 1))}>NEXT</button>
    </div>
  );
}

export function MobileControlButton({ icon, onPressChange, title }: { icon: string, onPressChange: (active: boolean) => void, title?: string }) {
  const [isPressed, setIsPressed] = useState(false);

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
      className={`mobile-control ${isPressed ? 'pressed' : ''}`}
    >
      <img 
        src={icon} 
        alt="" 
        className="mobile-control-icon"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      {title && (
        <span className="mobile-control-label">
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
        <div className="options-overlay" ref={dialogRef} data-testid="options-modal" role="dialog" aria-modal="true" aria-labelledby="options-title">
      <div className="options-panel">
        <h2 className="options-title" id="options-title">
          OPTIONS
        </h2>

        <div className="options-field">
          <label className="options-label" htmlFor="captain-name">
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
            className="captain-input"
          />
          <p className={`captain-help ${hasInvalidName ? 'invalid' : ''}`} id="captain-name-help" role={hasInvalidName ? 'alert' : undefined}>
            {hasInvalidName ? 'Enter a captain name to continue.' : 'Up to 15 characters.'}
          </p>
        </div>

        <div className="options-field">
          <label className="options-label" htmlFor="session-time">
            Game Session Time
          </label>
          <div className="option-buttons" role="group" aria-label="Game session time">
            {ALLOWED_GAME_TIMES.map((time) => (
              <button
                key={time} onClick={() => setGameTime(time)}
                aria-pressed={gameTime === time}
                data-testid={`session-time-${time}`}
                className={`option-button ${gameTime === time ? 'selected' : ''}`}
              >
                {time}s
              </button>
            ))}
          </div>
        </div>

        <div className="options-field spawn-field">
          <label className="options-label" htmlFor="spawn-time">
            Enemy Spawn Time
          </label>
          <div className="option-buttons" role="group" aria-label="Enemy spawn interval">
            {ALLOWED_SPAWN_TIMES.map((spawn) => (
              <button
                key={spawn} onClick={() => setSpawnTime(spawn)}
                aria-pressed={spawnTime === spawn}
                data-testid={`spawn-time-${spawn}`}
                className={`option-button ${spawnTime === spawn ? 'selected' : ''}`}
              >
                {spawn}s
              </button>
            ))}
          </div>
        </div>

        <MenuButton text="SAVE & CLOSE" onClick={() => onSave(gameTime, spawnTime, normalizedName)} type="primary" disabled={hasInvalidName} />
        <div className="menu-spacer-10" />
        <MenuButton text="CANCEL" onClick={onClose} type="secondary" />
      </div>
    </div>
  );
}

export function MenuButton({ onClick, text, type = 'primary', disabled = false }: { onClick: () => void, text: string, type?: 'primary' | 'secondary', disabled?: boolean }) {
  const [interactionState, setInteractionState] = useState<'normal' | 'hover' | 'pressed'>('normal');

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setInteractionState('hover')}
      onMouseLeave={() => setInteractionState('normal')}
      onMouseDown={() => setInteractionState('pressed')}
      onMouseUp={() => setInteractionState('hover')}
      className={`menu-button ${type} ${interactionState} ${disabled ? 'disabled' : ''}`}
    >
      <span className={`menu-button-label ${interactionState === 'pressed' ? 'pressed' : ''}`}>
        {text}
      </span>
    </button>
  );
}
