import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { videosService } from '@/services/videos.service';
import { videoCategoriesService } from '@/services/videoCategories.service';
import { videoPlaylistsService } from '@/services/videoPlaylists.service';
import { useToast } from '@/hooks/useToast';
import type { AnalyticsRangeKey } from '@/types/analytics.types';
import type { NormalizedError } from '@/types/api';
import type {
  PlaylistsListParams,
  VideoBulkPayload,
  VideoCategoryUpsertPayload,
  VideoPlaylistUpsertPayload,
  VideosListParams,
  VideoUpsertPayload,
} from '@/types/videoLibrary.types';

/** مساحة مفاتيح موحّدة للنطاق — إبطال واحد يطال كل قوائم/إحصاءات الفيديو. */
const VL = ['video-library'] as const;

function useVlInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: VL });
}

// ─── Videos ─────────────────────────────────────────────────────────────────

export function useVideos(params: VideosListParams) {
  return useQuery({
    queryKey: [...VL, 'videos', params],
    queryFn: ({ signal }) => videosService.list(params, signal),
  });
}

export function useVideo(id: number | null) {
  return useQuery({
    queryKey: [...VL, 'videos', 'detail', id],
    queryFn: () => videosService.get(id as number),
    enabled: id !== null,
  });
}

export function useVideoStats() {
  return useQuery({ queryKey: [...VL, 'videos', 'stats'], queryFn: () => videosService.stats() });
}

export function useVideoDashboard() {
  return useQuery({ queryKey: [...VL, 'dashboard'], queryFn: () => videosService.dashboard() });
}

export function useVideoAnalytics() {
  return useQuery({ queryKey: [...VL, 'analytics'], queryFn: () => videosService.analytics() });
}

/** تحليلات فيديو واحد (سياقيّة) — مفتاح مُعامَل بالمُعرّف + النطاق. */
export function useVideoEntityAnalytics(
  id: number | null,
  range: AnalyticsRangeKey,
  from?: string,
  to?: string,
) {
  return useQuery({
    queryKey: [...VL, 'analytics', 'entity', id, range, from ?? null, to ?? null],
    queryFn: () => videosService.entityAnalytics(id as number, range, from, to),
    enabled: id !== null,
  });
}

export function useVideoOperations() {
  return useQuery({ queryKey: [...VL, 'operations'], queryFn: () => videosService.operations() });
}

export function useReprocessVideo() {
  const invalidate = useVlInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => videosService.reprocess(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useCreateVideo() {
  const invalidate = useVlInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (payload: VideoUpsertPayload) => videosService.create(payload),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useUpdateVideo() {
  const invalidate = useVlInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; payload: VideoUpsertPayload }) => videosService.update(v.id, v.payload),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useTransitionVideo() {
  const invalidate = useVlInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; status: string; publishedAt?: string | null }) =>
      videosService.transition(v.id, v.status, v.publishedAt),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useBulkVideos() {
  const invalidate = useVlInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (payload: VideoBulkPayload) => videosService.bulk(payload),
    onSuccess: ({ message }) => {
      success(message);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useDeleteVideo() {
  const invalidate = useVlInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => videosService.remove(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useRestoreVideo() {
  const invalidate = useVlInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => videosService.restore(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useForceDeleteVideo() {
  const invalidate = useVlInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => videosService.forceDelete(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

// ─── Categories (tree) ────────────────────────────────────────────────────

export function useVideoCategoryTree() {
  return useQuery({ queryKey: [...VL, 'categories'], queryFn: () => videoCategoriesService.tree() });
}

export function useCreateVideoCategory() {
  const invalidate = useVlInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (payload: VideoCategoryUpsertPayload) => videoCategoriesService.create(payload),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useUpdateVideoCategory() {
  const invalidate = useVlInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; payload: VideoCategoryUpsertPayload }) =>
      videoCategoriesService.update(v.id, v.payload),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useMoveVideoCategory() {
  const invalidate = useVlInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; direction: 'up' | 'down' }) =>
      videoCategoriesService.move(v.id, v.direction),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useDeleteVideoCategory() {
  const invalidate = useVlInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => videoCategoriesService.remove(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useRestoreVideoCategory() {
  const invalidate = useVlInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => videoCategoriesService.restore(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useForceDeleteVideoCategory() {
  const invalidate = useVlInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => videoCategoriesService.forceDelete(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

// ─── Playlists ──────────────────────────────────────────────────────────────

export function usePlaylists(params: PlaylistsListParams) {
  return useQuery({
    queryKey: [...VL, 'playlists', params],
    queryFn: ({ signal }) => videoPlaylistsService.list(params, signal),
  });
}

export function usePlaylist(id: number | null) {
  return useQuery({
    queryKey: [...VL, 'playlists', 'detail', id],
    queryFn: () => videoPlaylistsService.get(id as number),
    enabled: id !== null,
  });
}

export function useCreatePlaylist() {
  const invalidate = useVlInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (payload: VideoPlaylistUpsertPayload) => videoPlaylistsService.create(payload),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useUpdatePlaylist() {
  const invalidate = useVlInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; payload: VideoPlaylistUpsertPayload }) =>
      videoPlaylistsService.update(v.id, v.payload),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useAttachPlaylistVideos() {
  const invalidate = useVlInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; videoIds: number[] }) =>
      videoPlaylistsService.attach(v.id, v.videoIds),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useDetachPlaylistVideo() {
  const invalidate = useVlInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; videoId: number }) => videoPlaylistsService.detach(v.id, v.videoId),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useReorderPlaylistVideos() {
  const invalidate = useVlInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; orderedIds: number[] }) =>
      videoPlaylistsService.reorder(v.id, v.orderedIds),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useDeletePlaylist() {
  const invalidate = useVlInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => videoPlaylistsService.remove(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useRestorePlaylist() {
  const invalidate = useVlInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => videoPlaylistsService.restore(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useForceDeletePlaylist() {
  const invalidate = useVlInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => videoPlaylistsService.forceDelete(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}
