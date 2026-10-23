import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GameCanvas } from './ui/GameCanvas';
import './index.css';

const queryClient = new QueryClient();

async function enableMocking() {
  if (!import.meta.env.DEV) {
    return;
  }
  const { worker } = await import('./mocks/browser');
  
  // Inicia o MSW sem propriedades customizadas para satisfazer o TypeScript
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