import { http, HttpResponse } from 'msw';

// Base de dados simulada em memória
let scores: Array<{ id: string; score: number; date: string; reason: string }> = [];

export const handlers = [
  http.post('/api/scores', async ({ request }) => {
    const data = await request.json() as any;
    const newScore = {
      id: Math.random().toString(36).substring(7),
      score: data.score,
      reason: data.reason || 'time_out',
      date: new Date().toISOString(),
    };
    scores.push(newScore);
    return HttpResponse.json(newScore, { status: 201 });
  }),

  http.get('/api/scores', () => {
    // Retorna ordenado do maior para o menor score
    const sorted = [...scores].sort((a, b) => b.score - a.score);
    return HttpResponse.json(sorted, { status: 200 });
  })
];