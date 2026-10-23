import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GameCanvas } from './ui/GameCanvas';
import './index.css'; // <-- Importante para bloquear o scroll!

const queryClient = new QueryClient();

async function enableMocking() {
  const { worker } = await import('./mocks/browser');
  return worker.start();
}

enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <GameCanvas />
      </QueryClientProvider>
    </React.StrictMode>,
  );
});