import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { broadcastsService } from '@/services/broadcasts.service';
import { broadcastCategoriesService } from '@/services/broadcastCategories.service';
import { useToast } from '@/hooks/useToast';
import type { AnalyticsRangeKey } from '@/types/analytics.types';
import type { NormalizedError } from '@/types/api';
import type {
  BroadcastCategoryUpsertPayload,
  BroadcastLifecycleAction,
  BroadcastLifecycleBody,
  BroadcastModerationAction,
  BroadcastModerationBody,
  BroadcastsListParams,
  BroadcastUpsertPayload,
} from '@/types/broadcast.types';

/** مساحة مفاتيح موحّدة للنطاق — إبطال واحد يطال كل قوائم/لوحة/تفاصيل البثّ. */
const BC = ['broadcasts'] as const;

function useBcInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: BC });
}

// ─── Broadcasts ───────────────────────────────────────────────────────────

export function useBroadcasts(params: BroadcastsListParams) {
  return useQuery({
    queryKey: [...BC, 'list', params],
    queryFn: ({ signal }) => broadcastsService.list(params, signal),
  });
}

export function useBroadcastDashboard() {
  return useQuery({
    queryKey: [...BC, 'dashboard'],
    queryFn: () => broadcastsService.dashboard(),
    // استطلاع دوريّ — مركز العمليات يتطلّب طزاجة (لا websockets، نهج براغماتي).
    refetchInterval: 20000,
  });
}

export function useBroadcast(id: number | null) {
  return useQuery({
    queryKey: [...BC, 'detail', id],
    queryFn: () => broadcastsService.get(id as number),
    enabled: id !== null,
  });
}

/** تحليلات بثّ واحد (سياقيّة) — يستطلع دورياً عند المتابعة الحيّة (poll). */
export function useBroadcastEntityAnalytics(
  id: number | null,
  range: AnalyticsRangeKey,
  from?: string,
  to?: string,
  poll = false,
) {
  return useQuery({
    queryKey: [...BC, 'analytics', id, range, from ?? null, to ?? null],
    queryFn: () => broadcastsService.entityAnalytics(id as number, range, from, to),
    enabled: id !== null,
    refetchInterval: poll ? 20000 : false,
  });
}

export function useCreateBroadcast() {
  const invalidate = useBcInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (payload: BroadcastUpsertPayload) => broadcastsService.create(payload),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useUpdateBroadcast() {
  const invalidate = useBcInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; payload: BroadcastUpsertPayload }) =>
      broadcastsService.update(v.id, v.payload),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useDeleteBroadcast() {
  const invalidate = useBcInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => broadcastsService.remove(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

/** انتقال دورة حياة موحّد — يأخذ {id, action, body?}. */
export function useBroadcastLifecycle() {
  const invalidate = useBcInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; action: BroadcastLifecycleAction; body?: BroadcastLifecycleBody }) =>
      broadcastsService.transition(v.id, v.action, v.body),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

/** إجراء إشراف موحّد — يأخذ {id, action, body?}. */
export function useBroadcastModeration() {
  const invalidate = useBcInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; action: BroadcastModerationAction; body?: BroadcastModerationBody }) =>
      broadcastsService.moderation(v.id, v.action, v.body),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

// ─── Categories (flat) ──────────────────────────────────────────────────────

export function useBroadcastCategories() {
  return useQuery({
    queryKey: [...BC, 'categories'],
    queryFn: () => broadcastCategoriesService.list(),
  });
}

export function useCreateBroadcastCategory() {
  const invalidate = useBcInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (payload: BroadcastCategoryUpsertPayload) => broadcastCategoriesService.create(payload),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useUpdateBroadcastCategory() {
  const invalidate = useBcInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; payload: BroadcastCategoryUpsertPayload }) =>
      broadcastCategoriesService.update(v.id, v.payload),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useDeleteBroadcastCategory() {
  const invalidate = useBcInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => broadcastCategoriesService.remove(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}
