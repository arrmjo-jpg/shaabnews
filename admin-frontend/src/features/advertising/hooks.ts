import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adZonesService } from '@/services/adZones.service';
import { adCampaignsService } from '@/services/adCampaigns.service';
import { adCreativesService } from '@/services/adCreatives.service';
import { adPlacementsService } from '@/services/adPlacements.service';
import { adAnalyticsService } from '@/services/adAnalytics.service';
import { useToast } from '@/hooks/useToast';
import type { AnalyticsRangeKey } from '@/types/analytics.types';
import type { NormalizedError } from '@/types/api';
import type {
  AdCampaignsListParams,
  AdCampaignUpsertPayload,
  AdCreativesListParams,
  AdCreativeUpsertPayload,
  AdPlacementAttachPayload,
  AdPlacementsListParams,
  AdPlacementUpdatePayload,
  AdZoneUpsertPayload,
} from '@/types/advertising.types';

/** مساحة مفاتيح موحّدة للنطاق — إبطال واحد يطال كل قوائم/تفاصيل الإعلانات. */
const ADV = ['advertising'] as const;

function useAdvInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: ADV });
}

// ─── Ad Zones ─────────────────────────────────────────────────────────────────

export function useAdZones() {
  return useQuery({ queryKey: [...ADV, 'zones'], queryFn: () => adZonesService.list() });
}

export function useAdZone(id: number | null) {
  return useQuery({
    queryKey: [...ADV, 'zones', 'detail', id],
    queryFn: () => adZonesService.get(id as number),
    enabled: id !== null,
  });
}

export function useCreateAdZone() {
  const invalidate = useAdvInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (payload: AdZoneUpsertPayload) => adZonesService.create(payload),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useUpdateAdZone() {
  const invalidate = useAdvInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; payload: AdZoneUpsertPayload }) => adZonesService.update(v.id, v.payload),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useDeleteAdZone() {
  const invalidate = useAdvInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => adZonesService.remove(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

// ─── Campaigns ──────────────────────────────────────────────────────────────

export function useAdCampaigns(params: AdCampaignsListParams) {
  return useQuery({
    queryKey: [...ADV, 'campaigns', params],
    queryFn: ({ signal }) => adCampaignsService.list(params, signal),
  });
}

export function useAdCampaign(id: number | null) {
  return useQuery({
    queryKey: [...ADV, 'campaigns', 'detail', id],
    queryFn: () => adCampaignsService.get(id as number),
    enabled: id !== null,
  });
}

export function useCreateAdCampaign() {
  const invalidate = useAdvInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (payload: AdCampaignUpsertPayload) => adCampaignsService.create(payload),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useUpdateAdCampaign() {
  const invalidate = useAdvInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; payload: AdCampaignUpsertPayload }) =>
      adCampaignsService.update(v.id, v.payload),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useTransitionAdCampaign() {
  const invalidate = useAdvInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; status: string }) => adCampaignsService.transition(v.id, v.status),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useDeleteAdCampaign() {
  const invalidate = useAdvInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => adCampaignsService.remove(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useRestoreAdCampaign() {
  const invalidate = useAdvInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => adCampaignsService.restore(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useForceDeleteAdCampaign() {
  const invalidate = useAdvInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => adCampaignsService.forceDelete(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

// ─── Creatives ────────────────────────────────────────────────────────────

export function useAdCreatives(params: AdCreativesListParams) {
  return useQuery({
    queryKey: [...ADV, 'creatives', params],
    queryFn: () => adCreativesService.list(params),
  });
}

export function useAdCreative(id: number | null) {
  return useQuery({
    queryKey: [...ADV, 'creatives', 'detail', id],
    queryFn: () => adCreativesService.get(id as number),
    enabled: id !== null,
  });
}

export function useCreateAdCreative() {
  const invalidate = useAdvInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (payload: AdCreativeUpsertPayload) => adCreativesService.create(payload),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useUpdateAdCreative() {
  const invalidate = useAdvInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; payload: AdCreativeUpsertPayload }) =>
      adCreativesService.update(v.id, v.payload),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useDeleteAdCreative() {
  const invalidate = useAdvInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => adCreativesService.remove(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useRestoreAdCreative() {
  const invalidate = useAdvInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => adCreativesService.restore(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useForceDeleteAdCreative() {
  const invalidate = useAdvInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => adCreativesService.forceDelete(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

// ─── Placements ─────────────────────────────────────────────────────────────

export function useAdPlacements(params: AdPlacementsListParams) {
  return useQuery({
    queryKey: [...ADV, 'placements', params],
    queryFn: ({ signal }) => adPlacementsService.list(params, signal),
  });
}

export function useAttachAdPlacement() {
  const invalidate = useAdvInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (payload: AdPlacementAttachPayload) => adPlacementsService.attach(payload),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useUpdateAdPlacement() {
  const invalidate = useAdvInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; payload: AdPlacementUpdatePayload }) =>
      adPlacementsService.update(v.id, v.payload),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useDetachAdPlacement() {
  const invalidate = useAdvInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => adPlacementsService.detach(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export function useAdAnalytics(range: AnalyticsRangeKey, from?: string, to?: string) {
  return useQuery({
    queryKey: [...ADV, 'analytics', range, from ?? null, to ?? null],
    queryFn: () => adAnalyticsService.get(range, from, to),
  });
}
