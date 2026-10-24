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
  return (
    <div className="menu-overlay" data-testid="main-menu">
      <div className="menu-panel">
        <img className="menu-logo" src="/assets/logo_jungle_gaming.svg" alt="Jungle Gaming" />
        <img className="menu-title" src="/assets/png/default/ui/menu/title_pirate_battle.png" alt="Pirate Battle" />
        <p className="menu-welcome">
          Welcome, <span className="menu-welcome-name">{playerName}</span>
        </p>
        <MenuButton text={assetLoadError ? 'RETRY' : isLoading ? 'LOADING...' : 'PLAY'} onClick={onPlay} type="primary" disabled={isLoading} />
        {isLoading && <div className="menu-loading" role="status" aria-live="polite" aria-atomic="true">
          <span>Loading game assets</span>
          <progress aria-label="Game asset loading progress" value={assetProgress} max={100} />
          <span>{assetProgress}%</span>
        </div>}
        {assetLoadError && <p className="menu-error" role="alert" data-testid="asset-load-error">Some game assets failed to load. Retry?</p>}
        <div className="menu-spacer-15" />
        <MenuButton text="OPTIONS" onClick={onOptions} type="primary" />
        <div className="menu-ship-wrap">
          <img className="menu-ship" src="/assets/png/default/ships/ship_2.png" alt="Ship" />
        </div>
        <p className="menu-description">
          Navigate the islands. Survive the battle.
        </p>
        <div className="menu-links">
          <MenuButton text="RANKING" onClick={onRanking} type="secondary" />
          <MenuButton text="HISTORY" onClick={onHistory} type="secondary" />
        </div>
      </div>
    </div>
  );
}
