import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type { MatchListView, MatchPage, PendingMatch } from '../../api/scoreTypes';

interface MatchPageOptions {
  view: MatchListView | null;
  page: number;
  pageSize: number;
  playerId: string;
  playerName: string;
  configuration: string;
}

export function useMatchPage({ view, page, pageSize, playerId, playerName, configuration }: MatchPageOptions) {
  return useQuery<MatchPage>({
    queryKey: ['scores', view, page, playerId, playerName, configuration],
    enabled: view !== null,
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<MatchPage>('/api/scores', {
        signal,
        params: { view, page, pageSize, playerId, playerName, configuration },
      });
      if (!Array.isArray(response.data.items) || !Number.isInteger(response.data.total)) {
        throw new Error('Invalid match page response');
      }
      return response.data;
    },
  });
}

interface MatchSubmissionOptions {
  isE2E: boolean;
  onSuccess: (pending: PendingMatch) => void;
  onError: (pending: PendingMatch) => void;
}

export function useSubmitMatch({ isE2E, onSuccess, onError }: MatchSubmissionOptions) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pending: PendingMatch) => {
      const response = await apiClient.post('/api/scores', pending.record, {
        headers: { 'Idempotency-Key': pending.idempotencyKey },
        timeout: isE2E ? 700 : 10_000,
      });
      return response.data;
    },
    retry: 1,
    retryDelay: 250,
    onSuccess: (_data, pending) => {
      onSuccess(pending);
      void queryClient.invalidateQueries({ queryKey: ['scores'] });
    },
    onError: (_error, pending) => onError(pending),
  });
}
