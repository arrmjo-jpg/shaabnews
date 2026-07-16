import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { competitionsService, matchBarSettingsService } from '@/services/sport.service';
import { useToast } from '@/hooks/useToast';
import type {
  CompetitionCreatePayload,
  CompetitionUpdatePayload,
  MatchBarSource,
} from '@/types/sport.types';
import type { NormalizedError } from '@/types/api';

const SPORT = ['sport'] as const;

export function useCompetitions() {
  return useQuery({ queryKey: [...SPORT, 'competitions'], queryFn: () => competitionsService.list() });
}

export function useCreateCompetition() {
  const qc = useQueryClient();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (payload: CompetitionCreatePayload) => competitionsService.create(payload),
    onSuccess: (message) => {
      success(message);
      void qc.invalidateQueries({ queryKey: [...SPORT, 'competitions'] });
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useUpdateCompetition() {
  const qc = useQueryClient();
  const { error } = useToast();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CompetitionUpdatePayload }) =>
      competitionsService.update(id, payload),
    onSuccess: () => {
      // بلا توست هنا عمداً: تبديل متكرّر لأعلام (is_tracked/is_featured_tournament/...)
      // على صفّ الجدول لا يستحقّ توست في كلّ مرّة — الأعمدة نفسها تعكس الحالة فورًا.
      void qc.invalidateQueries({ queryKey: [...SPORT, 'competitions'] });
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useDeleteCompetition() {
  const qc = useQueryClient();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => competitionsService.remove(id),
    onSuccess: (message) => {
      success(message);
      void qc.invalidateQueries({ queryKey: [...SPORT, 'competitions'] });
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useMatchBarSettings() {
  return useQuery({ queryKey: [...SPORT, 'match-bar-settings'], queryFn: () => matchBarSettingsService.get() });
}

export function useUpdateMatchBarSettings() {
  const qc = useQueryClient();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (source: MatchBarSource) => matchBarSettingsService.update(source),
    onSuccess: (message) => {
      success(message);
      void qc.invalidateQueries({ queryKey: [...SPORT, 'match-bar-settings'] });
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}
