import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GameCanvas } from './ui/GameCanvas';

const queryClient = new QueryClient();

async function enableMocking() {
  const { worker } = await import('./mocks/browser');
  
  // Inicia o worker sem propriedades extras para satisfazer o TypeScript
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