import type { CSSProperties } from 'react';
import { MenuButton } from './GameControls';

interface MainMenuProps {
  playerName: string;
  isLoading: boolean;
  assetProgress: number;
  assetLoadError: boolean;
  onPlay: () => void;
  onOptions: () => void;
  onRanking: () => void;
  onHistory: () => void;
}

export function MainMenu({ playerName, isLoading, assetProgress, assetLoadError, onPlay, onOptions, onRanking, onHistory }: MainMenuProps) {
  const panelStyle: CSSProperties = {
    backgroundImage: 'url(/assets/png/default/ui/menu/panel_menu.png)',
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
    width: '90%',
    maxWidth: '500px',
    minHeight: '480px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px 40px',
    boxSizing: 'border-box',
    filter: 'drop-shadow(0px 15px 25px rgba(0,0,0,0.6))',
  };

  return (
    <div data-testid="main-menu" style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      backgroundImage: 'url(/assets/ui_scene_background.jpg)', backgroundSize: 'cover', backgroundPosition: 'center',
      zIndex: 30, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10px', boxSizing: 'border-box',
    }}>
      <div style={panelStyle}>
        <img src="/assets/logo_jungle_gaming.svg" alt="Jungle Gaming" style={{ width: 'min(62%, 270px)', height: 'auto', marginBottom: '18px' }} />
        <img src="/assets/png/default/ui/menu/title_pirate_battle.png" alt="Pirate Battle" style={{ width: '85%', marginBottom: '15px' }} />
        <p style={{ fontSize: '0.9rem', color: '#fff', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '25px', textShadow: '1px 1px 2px #000', fontFamily: 'monospace' }}>
          Welcome, <span style={{ color: '#fbe29f' }}>{playerName}</span>
        </p>
        <MenuButton text={assetLoadError ? 'RETRY' : isLoading ? 'LOADING...' : 'PLAY'} onClick={onPlay} type="primary" disabled={isLoading} />
        {isLoading && <div role="status" aria-live="polite" aria-atomic="true" style={{ width: 'min(85%, 280px)', marginTop: '8px', color: '#fff', textAlign: 'center', fontFamily: 'monospace', fontSize: '0.8rem' }}>
          <span>Loading game assets</span>
          <progress aria-label="Game asset loading progress" value={assetProgress} max={100} style={{ display: 'block', width: '100%', height: '12px', marginTop: '6px', accentColor: '#e69e35' }} />
          <span>{assetProgress}%</span>
        </div>}
        {assetLoadError && <p role="alert" data-testid="asset-load-error" style={{ color: '#ffb4a2', fontFamily: 'monospace' }}>Some game assets failed to load. Retry?</p>}
        <div style={{ height: '15px' }} />
        <MenuButton text="OPTIONS" onClick={onOptions} type="primary" />
        <div style={{ margin: '20px 0 10px 0', opacity: 0.9 }}>
          <img src="/assets/png/default/ships/ship_player.png" alt="Ship" style={{ width: '45px', filter: 'drop-shadow(0 5px 5px rgba(0,0,0,0.5))' }} onError={(event) => { event.currentTarget.style.display = 'none'; }} />
        </div>
        <p style={{ fontSize: '0.8rem', color: '#e2e8f0', marginBottom: '20px', textShadow: '1px 1px 2px #000', fontFamily: 'monospace' }}>
          Navigate the islands. Survive the battle.
        </p>
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', width: '100%', flexWrap: 'wrap' }}>
          <MenuButton text="RANKING" onClick={onRanking} type="secondary" />
          <MenuButton text="HISTORY" onClick={onHistory} type="secondary" />
        </div>
      </div>
    </div>
  );
}
