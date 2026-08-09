import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { epapersService } from '@/services/epapers.service';
import { useToast } from '@/hooks/useToast';
import type { NormalizedError } from '@/types/api';
import type {
  EpaperCreateFields,
  EpapersListParams,
  EpaperUpdatePayload,
  NewspaperSettingsData,
} from '@/types/epaper.types';

/** مساحة مفاتيح موحّدة للنطاق — إبطال واحد يطال كل قوائم/تفاصيل/إعدادات الجريدة. */
const EP = ['epaper'] as const;

function useEpInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: EP });
}

export function useEpapers(params: EpapersListParams) {
  return useQuery({ queryKey: [...EP, 'list', params], queryFn: () => epapersService.list(params) });
}

export function useEpaper(id: number | null) {
  return useQuery({
    queryKey: [...EP, 'detail', id],
    queryFn: () => epapersService.get(id as number),
    enabled: id !== null,
  });
}

/** تحليلات القارئ لعدد (Phase 5) — تقرير أساسيّ للقراءة فقط (يُفعَّل في وضع التحرير). */
export function useEpaperAnalytics(id: number | null) {
  return useQuery({
    queryKey: [...EP, 'analytics', id],
    queryFn: () => epapersService.analytics(id as number),
    enabled: id !== null,
    staleTime: 30_000,
  });
}

/** لوحة تحليلات القارئ العابرة (Final completion) — تتبدّل مع مرشّح المدى الزمنيّ. */
export function useEpaperDashboard(params: { period: string; from?: string; to?: string }) {
  return useQuery({
    queryKey: [...EP, 'dashboard', params],
    queryFn: () => epapersService.dashboard(params),
    staleTime: 30_000,
  });
}

/** الرؤية التشغيليّة (Final completion — البند C) — تُحدَّث دورياً لعرضٍ تشغيليّ حيّ. */
export function useEpaperOperations() {
  return useQuery({
    queryKey: [...EP, 'operations'],
    queryFn: () => epapersService.operations(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useCreateEpaper() {
  const invalidate = useEpInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (v: { fields: EpaperCreateFields; file: File }) => epapersService.create(v.fields, v.file),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useUpdateEpaper() {
  const invalidate = useEpInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; payload: EpaperUpdatePayload }) => epapersService.update(v.id, v.payload),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useReplaceEpaperPdf() {
  const invalidate = useEpInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; file: File; note?: string }) =>
      epapersService.replacePdf(v.id, v.file, v.note),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useSetEpaperCover() {
  const invalidate = useEpInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; cover: File }) => epapersService.setCover(v.id, v.cover),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useTransitionEpaper() {
  const invalidate = useEpInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; status: string; publishedAt?: string | null }) =>
      epapersService.transition(v.id, v.status, v.publishedAt),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useDuplicateEpaper() {
  const invalidate = useEpInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (id: number) => epapersService.duplicate(id),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useDeleteEpaper() {
  const invalidate = useEpInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => epapersService.remove(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useRestoreEpaper() {
  const invalidate = useEpInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => epapersService.restore(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useForceDeleteEpaper() {
  const invalidate = useEpInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => epapersService.forceDelete(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

// ─── Module settings ─────────────────────────────────────────────────────────

/** يُقرأ من التنقّل (لتقييد ظهور القسم) ومن صفحة الإعدادات؛ معطَّل إن غابت الصلاحية. */
export function useNewspaperSettings(enabled = true) {
  return useQuery({
    queryKey: [...EP, 'settings'],
    queryFn: () => epapersService.getSettings(),
    enabled,
    staleTime: 60_000,
  });
}

export function useUpdateNewspaperSettings() {
  const qc = useQueryClient();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (payload: NewspaperSettingsData) => epapersService.updateSettings(payload),
    onSuccess: (message) => {
      success(message);
      void qc.invalidateQueries({ queryKey: [...EP, 'settings'] });
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}
