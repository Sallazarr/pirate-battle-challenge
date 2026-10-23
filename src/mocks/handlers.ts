import { http, HttpResponse } from 'msw';

// 9 Fixtures exigidos para popular o ranking
const fixtures = [
  { id: 'fix-1', playerName: 'Captain Flint', score: 38, date: new Date().toISOString(), reason: 'time_out', isFixture: true },
  { id: 'fix-2', playerName: 'Red Sparrow', score: 32, date: new Date().toISOString(), reason: 'time_out', isFixture: true },
  { id: 'fix-3', playerName: 'Blackbeard', score: 28, date: new Date().toISOString(), reason: 'time_out', isFixture: true },
  { id: 'fix-4', playerName: 'Davy Jones', score: 25, date: new Date().toISOString(), reason: 'ship_destroyed', isFixture: true },
  { id: 'fix-5', playerName: 'Anne Bonny', score: 24, date: new Date().toISOString(), reason: 'time_out', isFixture: true },
  { id: 'fix-6', playerName: 'Storm Rider', score: 21, date: new Date().toISOString(), reason: 'ship_destroyed', isFixture: true },
  { id: 'fix-7', playerName: 'Sea Wolf', score: 19, date: new Date().toISOString(), reason: 'ship_destroyed', isFixture: true },
  { id: 'fix-8', playerName: 'Iron Anchor', score: 15, date: new Date().toISOString(), reason: 'ship_destroyed', isFixture: true },
  { id: 'fix-9', playerName: 'Salty Dog', score: 12, date: new Date().toISOString(), reason: 'time_out', isFixture: true }
];

const getStoredScores = () => {
  try {
    const data = localStorage.getItem('pirate_battle_scores');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

const saveStoredScores = (scores: any[]) => {
  localStorage.setItem('pirate_battle_scores', JSON.stringify(scores));
};

const getIdempotentRecords = (): Record<string, any> => {
  try {
    return JSON.parse(localStorage.getItem('pirate_battle_score_idempotency') || '{}');
  } catch {
    return {};
  }
};

export const handlers = [
  http.get('*/api/scores', () => {
    const localScores = getStoredScores();
    const allScores = [...fixtures, ...localScores];
    return HttpResponse.json(allScores);
  }),

  http.post('*/api/scores', async ({ request }) => {
    const newRecord = (await request.json()) as any;
    const idempotencyKey = request.headers.get('Idempotency-Key');
    const existingRecords = getIdempotentRecords();
    if (idempotencyKey && existingRecords[idempotencyKey]) {
      return HttpResponse.json(existingRecords[idempotencyKey]);
    }
    const scores = getStoredScores();
    
    const recordWithId = {
      id: Math.random().toString(36).substring(2, 9),
      date: new Date().toISOString(),
      isFixture: false,
      ...newRecord,
    };

    scores.unshift(recordWithId);
    saveStoredScores(scores);
    if (idempotencyKey) {
      existingRecords[idempotencyKey] = recordWithId;
      localStorage.setItem('pirate_battle_score_idempotency', JSON.stringify(existingRecords));
    }

    return HttpResponse.json(recordWithId, { status: 201 });
  }),
];
