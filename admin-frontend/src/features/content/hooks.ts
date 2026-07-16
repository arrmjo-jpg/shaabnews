import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { articlesService } from '@/services/articles.service';
import { mediaLibraryService } from '@/services/mediaLibrary.service';
import { categoriesService } from '@/services/categories.service';
import { entitiesService, type EntityContentType, type EntityType } from '@/services/entities.service';
import { liveUpdatesService } from '@/services/liveUpdates.service';
import { tagsService } from '@/services/tags.service';
import { usersService } from '@/services/users.service';
import { useToast } from '@/hooks/useToast';
import type { AnalyticsRangeKey } from '@/types/analytics.types';
import type { NormalizedError } from '@/types/api';
import type {
  ArticleUpsertPayload,
  ArticlesListParams,
  CategoryBulkPayload,
  CategoryUpsertPayload,
  ContentLocale,
  LiveUpdateCreatePayload,
  LiveUpdateData,
  LiveUpdatesListResult,
  LiveUpdateUpdatePayload,
  MediaLibraryListParams,
  MediaMetadataPayload,
  TagsListParams,
  TagUpdatePayload,
} from '@/types/content.types';

const ARTICLES = ['articles'] as const;
const CATEGORIES = ['categories'] as const;
const WRITERS = ['writers'] as const;
const TAGS = ['tags'] as const;
const LIVE_UPDATES = ['live-updates'] as const;

// ─── Articles ────────────────────────────────────────────────────────────

export function useArticles(params: ArticlesListParams) {
  return useQuery({
    queryKey: [...ARTICLES, params],
    queryFn: ({ signal }) => articlesService.list(params, signal),
    placeholderData: keepPreviousData,
  });
}

/** Fetch up to 100 active writers for the filter dropdown. */
export function useWritersList() {
  return useQuery({
    queryKey: [...WRITERS, 'list-all'],
    queryFn: () =>
      usersService.list({
        page: 1,
        per_page: 100,
        search: '',
        status: 'active',
        role: '',
        trashed: 'none',
        is_writer: 1,
      }),
    staleTime: 60_000,
  });
}

export function useArticleStats() {
  return useQuery({
    queryKey: [...ARTICLES, 'stats'],
    queryFn: () => articlesService.stats(),
    staleTime: 30_000,
  });
}

/** تحليلات أسطول المقالات (مجاميع/متصدّرون) — مدى كامل. */
export function useArticleFleetAnalytics() {
  return useQuery({
    queryKey: [...ARTICLES, 'analytics', 'fleet'],
    queryFn: () => articlesService.analytics(),
  });
}

/** تحليلات مقال واحد (سياقيّة) — مفتاح مُعامَل بالمُعرّف + النطاق. */
export function useArticleEntityAnalytics(
  id: number | null,
  range: AnalyticsRangeKey,
  from?: string,
  to?: string,
) {
  return useQuery({
    queryKey: [...ARTICLES, 'analytics', 'entity', id, range, from ?? null, to ?? null],
    queryFn: () => articlesService.entityAnalytics(id as number, range, from, to),
    enabled: id !== null,
  });
}

export function useArticle(id: number | null) {
  return useQuery({
    queryKey: [...ARTICLES, 'detail', id],
    queryFn: () => articlesService.get(id as number),
    enabled: id !== null,
  });
}

/** True server-rendered preview (+ SEO guidance) — fetched lazily when opened. */
export function useArticlePreview(id: number | null, enabled: boolean) {
  return useQuery({
    queryKey: [...ARTICLES, 'preview', id],
    queryFn: () => articlesService.preview(id as number),
    enabled: enabled && id !== null,
    staleTime: 0, // always reflect the latest saved state
  });
}

function useArticlesInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: ARTICLES });
}

export function useDeleteArticle() {
  const invalidate = useArticlesInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => articlesService.remove(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useRestoreArticle() {
  const invalidate = useArticlesInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => articlesService.restore(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useForceDeleteArticle() {
  const invalidate = useArticlesInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => articlesService.forceDelete(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useCreateArticle() {
  const invalidate = useArticlesInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (payload: ArticleUpsertPayload) => articlesService.create(payload),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

/** Clear the breaking flag across all articles (bulk newsroom action). */
export function useClearBreaking() {
  const invalidate = useArticlesInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: () => articlesService.clearBreaking(),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

/** Clear the pinned flag across all articles (bulk newsroom action). */
export function useClearPinned() {
  const invalidate = useArticlesInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: () => articlesService.clearPinned(),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useUpdateArticle() {
  const invalidate = useArticlesInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; payload: ArticleUpsertPayload }) =>
      articlesService.update(v.id, v.payload),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useTransitionArticle() {
  const invalidate = useArticlesInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; status: string; scheduledAt?: string | null }) =>
      articlesService.transition(v.id, v.status, v.scheduledAt ?? null),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

// ─── Categories ──────────────────────────────────────────────────────────

export function useCategories() {
  return useQuery({
    queryKey: [...CATEGORIES, 'tree'],
    queryFn: () => categoriesService.list(),
  });
}

function useCategoriesInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: CATEGORIES });
}

export function useDeleteCategory() {
  const invalidate = useCategoriesInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => categoriesService.remove(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useCreateCategory() {
  const invalidate = useCategoriesInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (payload: CategoryUpsertPayload) => categoriesService.create(payload),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useUpdateCategory() {
  const invalidate = useCategoriesInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; payload: CategoryUpsertPayload }) =>
      categoriesService.update(v.id, v.payload),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

/** Reorder a category among its siblings (up/down). Silent success (no toast). */
export function useMoveCategory() {
  const invalidate = useCategoriesInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; direction: 'up' | 'down' }) =>
      categoriesService.move(v.id, v.direction),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

/** Apply status/visibility to many categories at once. */
export function useBulkUpdateCategories() {
  const invalidate = useCategoriesInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (v: { ids: number[]; payload: CategoryBulkPayload }) =>
      categoriesService.bulkUpdate(v.ids, v.payload),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useTrashedCategories(enabled = true) {
  return useQuery({
    queryKey: [...CATEGORIES, 'trashed'],
    queryFn: () => categoriesService.listTrashed(),
    enabled,
  });
}

export function useRestoreCategory() {
  const invalidate = useCategoriesInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => categoriesService.restore(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useForceDeleteCategory() {
  const invalidate = useCategoriesInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => categoriesService.forceDelete(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

// ─── Tag suggestions (debounced live search) ─────────────────────────────

export function useTagSuggestions(locale: ContentLocale, query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: [...TAGS, locale, trimmed],
    queryFn: () => tagsService.list(locale, trimmed, 20),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

// ─── Tags management (list + usage count + rename + delete) ────────────────

export function useManagedTags(params: TagsListParams) {
  return useQuery({
    queryKey: [...TAGS, 'managed', params],
    queryFn: () => tagsService.listManaged(params),
    placeholderData: keepPreviousData,
  });
}

function useTagsInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: TAGS });
}

/** Rename a tag — page shows the success toast; hook invalidates + surfaces errors. */
export function useUpdateTag() {
  const invalidate = useTagsInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; payload: TagUpdatePayload }) =>
      tagsService.update(v.id, v.payload),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useDeleteTag() {
  const invalidate = useTagsInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => tagsService.remove(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

// ─── Writers (for opinion author selector) ───────────────────────────────

/**
 * Async search across writers. Hits /admin/users with is_writer=1 and the
 * existing partial search (name OR email). Stays disabled until `enabled` is
 * true (i.e. the picker is open) — avoids prefetching N writers for the
 * majority of edits that don't need this list at all.
 */
export function useWritersSearch(query: string, enabled: boolean) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: [...WRITERS, 'search', trimmed],
    queryFn: () =>
      usersService.list({
        page: 1,
        per_page: 20,
        search: trimmed,
        status: 'active',
        role: '',
        trashed: 'none',
        is_writer: 1,
      }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/**
 * Quick-create a writer from the picker flow. Forces is_writer=true and
 * status='active'. The caller passes a strong random password satisfying
 * Laravel Password::defaults().
 */
export function useQuickCreateWriter() {
  const qc = useQueryClient();
  const { error } = useToast();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      email: string;
      password: string;
      avatar?: string | null;
    }) => {
      const res = await usersService.create({
        name: input.name,
        email: input.email,
        password: input.password,
        password_confirmation: input.password,
        status: 'active',
        is_writer: true,
        email_verified: false,
        avatar: input.avatar ?? null,
      });
      void qc.invalidateQueries({ queryKey: WRITERS });
      return res.data;
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

/** Trigger the existing password-reset (invite) email for a freshly-created writer. */
export function useSendWriterInvite() {
  const { error } = useToast();
  return useMutation({
    mutationFn: (id: number) => usersService.sendPasswordReset(id),
    onError: (e: NormalizedError) => error(e.message),
  });
}

// ─── Live coverage updates (P8.2) ──────────────────────────────────────────

type LiveInfinite = InfiniteData<LiveUpdatesListResult, number>;

/** Paginated timeline (newest first), load-more via infinite query. */
export function useLiveUpdates(articleId: number) {
  return useInfiniteQuery({
    queryKey: [...LIVE_UPDATES, articleId],
    queryFn: ({ pageParam }) => liveUpdatesService.list(articleId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.pagination.current_page < last.pagination.total_pages
        ? last.pagination.current_page + 1
        : undefined,
  });
}

/** Flatten infinite pages into a single ordered list. */
export function flattenLiveUpdates(
  data: { pages: LiveUpdatesListResult[] } | undefined,
): LiveUpdateData[] {
  if (!data) return [];
  return data.pages.flatMap((p) => p.data);
}

export function useCreateLiveUpdate(articleId: number) {
  const qc = useQueryClient();
  const { error } = useToast();
  const key = [...LIVE_UPDATES, articleId];

  return useMutation({
    mutationFn: (payload: LiveUpdateCreatePayload) =>
      liveUpdatesService.create(articleId, payload),
    // Optimistic prepend to the first page so the post appears instantly.
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<LiveInfinite>(key);

      const optimistic: LiveUpdateData = {
        id: -Date.now(), // temporary negative id, replaced on reconcile
        article_id: articleId,
        title: payload.title ?? null,
        content_json: payload.content_json,
        content_html: null,
        is_pinned: payload.is_pinned ?? false,
        is_breaking: payload.is_breaking ?? false,
        is_featured: payload.is_featured ?? false,
        happened_at: payload.happened_at ?? new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (prev) {
        const pages = prev.pages.slice();
        if (pages[0]) {
          pages[0] = { ...pages[0], data: [optimistic, ...pages[0].data] };
          qc.setQueryData<LiveInfinite>(key, { ...prev, pages });
        }
      }
      return { prev };
    },
    onError: (e: NormalizedError, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      error(e.message);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  });
}

export function useUpdateLiveUpdate(articleId: number) {
  const qc = useQueryClient();
  const { error } = useToast();
  const key = [...LIVE_UPDATES, articleId];

  return useMutation({
    mutationFn: (v: { id: number; payload: LiveUpdateUpdatePayload }) =>
      liveUpdatesService.update(articleId, v.id, v.payload),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<LiveInfinite>(key);
      if (prev) {
        const pages = prev.pages.map((p) => ({
          ...p,
          data: p.data.map((u) => {
            if (u.id !== v.id) return u;
            // `media` in the payload is attach-on-save references, not the
            // presented block — skip it optimistically (refreshed on settle).
            const { media: _media, ...rest } = v.payload;
            return { ...u, ...rest };
          }),
        }));
        qc.setQueryData<LiveInfinite>(key, { ...prev, pages });
      }
      return { prev };
    },
    onError: (e: NormalizedError, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      error(e.message);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  });
}

export function useMoveLiveUpdate(articleId: number) {
  const qc = useQueryClient();
  const { error } = useToast();
  const key = [...LIVE_UPDATES, articleId];

  return useMutation({
    mutationFn: (v: { id: number; direction: 'up' | 'down' }) =>
      liveUpdatesService.move(articleId, v.id, v.direction),
    onError: (e: NormalizedError) => error(e.message),
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteLiveUpdate(articleId: number) {
  const qc = useQueryClient();
  const { success, error } = useToast();
  const key = [...LIVE_UPDATES, articleId];

  return useMutation({
    mutationFn: (id: number) => liveUpdatesService.remove(articleId, id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<LiveInfinite>(key);
      if (prev) {
        const pages = prev.pages.map((p) => ({
          ...p,
          data: p.data.filter((u) => u.id !== id),
        }));
        qc.setQueryData<LiveInfinite>(key, { ...prev, pages });
      }
      return { prev };
    },
    onSuccess: (m) => success(m),
    onError: (e: NormalizedError, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      error(e.message);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  });
}

// ─── Media library (central shared assets — unified studio) ─────────────────

const MEDIA_LIBRARY = ['media-library'] as const;

export function useMediaLibrary(params: MediaLibraryListParams, enabled = true) {
  return useQuery({
    queryKey: [...MEDIA_LIBRARY, params],
    queryFn: () => mediaLibraryService.list(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Single-asset detail (incl. where-used). Used by the governance detail panel. */
export function useMediaAsset(uuid: string | null) {
  return useQuery({
    queryKey: [...MEDIA_LIBRARY, 'detail', uuid],
    queryFn: () => mediaLibraryService.get(uuid as string),
    enabled: uuid !== null,
  });
}

function useMediaLibraryInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: MEDIA_LIBRARY });
}

/** Edit editorial metadata (alt/caption/credit/source) without re-uploading. */
export function useUpdateMediaAsset() {
  const invalidate = useMediaLibraryInvalidate();
  const { error } = useToast();
  return useMutation({
    mutationFn: (v: { uuid: string; payload: MediaMetadataPayload }) =>
      mediaLibraryService.update(v.uuid, v.payload),
    onSuccess: () => invalidate(),
    onError: (e: NormalizedError) => error(e.message),
  });
}

/**
 * Delete an asset with the usage guard. The mutation rejects with the
 * NormalizedError (status 409 + errors.usage_count) when the asset is in use
 * and `force` was not set — the page surfaces a force-confirmation.
 */
export function useDeleteMediaAsset() {
  const invalidate = useMediaLibraryInvalidate();
  const { success } = useToast();
  return useMutation({
    mutationFn: (v: { uuid: string; force?: boolean }) =>
      mediaLibraryService.remove(v.uuid, v.force ?? false),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
  });
}

// ─── Entities (canonical registry — Task 12) ─────────────────────────────

const ENTITIES = ['entities'] as const;

/** Search/typeahead, optionally filtered by type. Mirrors useTagSuggestions. */
export function useEntitySuggestions(query: string, type?: EntityType) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: [...ENTITIES, 'search', type, trimmed],
    queryFn: () => entitiesService.search(trimmed, type, 20),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** Create a new canonical entity. Caller merges the result into local widget state. */
export function useCreateEntity() {
  const { error } = useToast();
  return useMutation({
    mutationFn: entitiesService.create,
    onError: (e: NormalizedError) => error(e.message),
  });
}

/**
 * Current entities tagged on a piece of content (GET, read-only) — disabled
 * until the content has an id (a brand-new, unsaved item can't be tagged yet).
 */
export function useContentEntities(contentType: EntityContentType, contentId: number | undefined) {
  return useQuery({
    queryKey: [...ENTITIES, 'for', contentType, contentId],
    queryFn: () => entitiesService.currentFor(contentType, contentId!),
    enabled: contentId !== undefined,
  });
}

/** Replace the full set of entities tagged on a piece of content. */
export function useSyncContentEntities(contentType: EntityContentType, contentId: number | undefined) {
  const qc = useQueryClient();
  const { error } = useToast();
  return useMutation({
    mutationFn: (entityIds: number[]) => entitiesService.sync(contentType, contentId!, entityIds),
    onSuccess: (data) => {
      qc.setQueryData([...ENTITIES, 'for', contentType, contentId], data);
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

