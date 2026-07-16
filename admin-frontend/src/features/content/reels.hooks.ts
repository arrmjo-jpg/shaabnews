import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reelsService } from '@/services/reels.service';
import { useToast } from '@/hooks/useToast';
import type { AnalyticsRangeKey } from '@/types/analytics.types';
import type { NormalizedError } from '@/types/api';
import type { ReelsListParams, ReelUpsertPayload } from '@/types/content.types';

const REELS = ['reels'] as const;

function useReelsInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: REELS });
}

export function useReels(params: ReelsListParams) {
  return useQuery({
    queryKey: [...REELS, params],
    queryFn: ({ signal }) => reelsService.list(params, signal),
  });
}

export function useReel(id: number | null) {
  return useQuery({
    queryKey: [...REELS, 'detail', id],
    queryFn: () => reelsService.get(id as number),
    enabled: id !== null,
  });
}

export function useReelStats() {
  return useQuery({
    queryKey: [...REELS, 'stats'],
    queryFn: () => reelsService.stats(),
  });
}

/** تحليلات أسطول الريلز (مجاميع/متصدّرون) — مدى كامل. */
export function useReelFleetAnalytics() {
  return useQuery({
    queryKey: [...REELS, 'analytics', 'fleet'],
    queryFn: () => reelsService.analytics(),
  });
}

/** تحليلات ريل واحد (سياقيّة) — مفتاح مُعامَل بالمُعرّف + النطاق. */
export function useReelEntityAnalytics(
  id: number | null,
  range: AnalyticsRangeKey,
  from?: string,
  to?: string,
) {
  return useQuery({
    queryKey: [...REELS, 'analytics', 'entity', id, range, from ?? null, to ?? null],
    queryFn: () => reelsService.entityAnalytics(id as number, range, from, to),
    enabled: id !== null,
  });
}

export function useCreateReel() {
  const invalidate = useReelsInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (payload: ReelUpsertPayload) => reelsService.create(payload),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useUpdateReel() {
  const invalidate = useReelsInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; payload: ReelUpsertPayload }) =>
      reelsService.update(v.id, v.payload),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useTransitionReel() {
  const invalidate = useReelsInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; status: string; publishedAt?: string | null }) =>
      reelsService.transition(v.id, v.status, v.publishedAt),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useDeleteReel() {
  const invalidate = useReelsInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => reelsService.remove(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useRestoreReel() {
  const invalidate = useReelsInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => reelsService.restore(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useForceDeleteReel() {
  const invalidate = useReelsInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => reelsService.forceDelete(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}
