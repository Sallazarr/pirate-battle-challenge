import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GameCanvas } from './ui/GameCanvas';
import './index.css'; // Mantém o reset de CSS para evitar o scroll
import { setControlledTime } from './game/gameClock';
import { setRandomSeed } from './game/random';

const queryClient = new QueryClient();

async function enableMocking() {
  const { worker } = await import('./mocks/browser');
  

  return worker.start();
}

const isE2EMode = (import.meta.env.DEV || import.meta.env.MODE === 'e2e') && new URLSearchParams(window.location.search).get('e2e') === '1';

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

if (isE2EMode) renderApp();
else enableMocking().then(renderApp);
