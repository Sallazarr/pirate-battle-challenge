import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GameCanvas } from './ui/GameCanvas';
import './index.css';
import { setControlledTime } from './game/gameClock';
import { setRandomSeed } from './game/random';
import { isE2ERuntimeEnabled } from './game/e2e';
import { initializeMockApiFromUrl } from './mocks/networkScenarios';

const queryClient = new QueryClient();

initializeMockApiFromUrl();

async function enableMocking() {
  const { worker } = await import('./mocks/browser');
  

  return worker.start();
}

const isE2EMode = isE2ERuntimeEnabled();

if (isE2EMode) {
  setRandomSeed(window.__PIRATE_E2E_CONFIG__?.seed ?? 1337);
  if (new URLSearchParams(window.location.search).get('realtime') !== '1') {
    setControlledTime(window.__PIRATE_E2E_CONFIG__?.startTime ?? 1_000_000);
  }
}

function renderApp() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <GameCanvas />
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

enableMocking().then(renderApp);
