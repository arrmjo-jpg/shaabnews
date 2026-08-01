import { useCallback, useMemo, useRef, useState } from 'react';
import { mediaLibraryService } from '@/services/mediaLibrary.service';
import { useToast } from '@/hooks/useToast';
import type { NormalizedError } from '@/types/api';
import type {
  ArticleData,
  ArticleMediaAttachment,
  MediaAssetData,
  StagedCollection,
  StagedMediaItem,
} from '@/types/content.types';

let tempSeq = 0;
const nextTempId = (): string => `up-${Date.now()}-${tempSeq++}`;

export interface UploadingItem {
  tempId: string;
  name: string;
  progress: number;
  target: 'gallery' | 'video';
  error?: boolean;
}

export interface MediaStaging {
  cover: StagedMediaItem | null;
  gallery: StagedMediaItem[];
  videos: StagedMediaItem[];
  uploading: UploadingItem[];
  busy: boolean;
  hasAsset: (assetId: number) => boolean;
  uploadImages: (files: File[]) => void;
  uploadVideos: (files: File[]) => void;
  addExternalVideo: (asset: MediaAssetData) => void;
  addFromLibrary: (asset: MediaAssetData) => void;
  setAsCover: (assetId: number) => void;
  unsetCover: () => void;
  remove: (assetId: number) => void;
  reorderGallery: (orderedAssetIds: number[]) => void;
  updateItem: (asset: MediaAssetData) => void;
  reset: (items: StagedMediaItem[]) => void;
  toPayload: () => ArticleMediaAttachment[];
}

function assetToStaged(
  asset: MediaAssetData,
  collection: StagedCollection,
  position: number,
): StagedMediaItem {
  return {
    assetId: asset.id,
    uuid: asset.uuid,
    collection,
    position,
    url: asset.url,
    thumb: asset.thumb ?? asset.medium ?? asset.url,
    isImage: asset.is_image,
    mime: asset.mime_type,
    name: asset.original_name,
    external: asset.is_external,
    provider: asset.provider,
    embedUrl: asset.embed_url,
    poster: asset.poster,
    processingStatus: asset.processing_status,
    duration: asset.duration,
    hls: asset.hls,
    caption: asset.caption,
  };
}

/**
 * Auto-cover: if no cover is set and the editor hasn't made a manual choice,
 * promote the first gallery image to cover. The first uploaded/added image
 * becomes the default cover with zero clicks.
 */
function withAutoCover(items: StagedMediaItem[], locked: boolean): StagedMediaItem[] {
  if (locked || items.some((i) => i.collection === 'cover')) return items;
  const firstImage = items
    .filter((i) => i.collection === 'gallery' && i.isImage)
    .sort((a, b) => a.position - b.position)[0];
  if (!firstImage) return items;
  return items.map((i) =>
    i.assetId === firstImage.assetId ? { ...i, collection: 'cover', position: 0 } : i,
  );
}

/** Build the initial staged set from a loaded article (edit mode). */
export function stagedFromArticle(article: ArticleData | null): StagedMediaItem[] {
  return article?.media ? stagedFromMedia(article.media) : [];
}

/** Build staged items from a shared media block (article OR live update). */
export function stagedFromMedia(media: NonNullable<ArticleData['media']>): StagedMediaItem[] {
  const out: StagedMediaItem[] = [];
  if (media.cover) {
    out.push({
      assetId: media.cover.id,
      uuid: media.cover.uuid ?? null,
      collection: 'cover',
      position: 0,
      url: media.cover.url,
      thumb: media.cover.thumb ?? media.cover.url,
      isImage: true,
      mime: null,
      name: media.cover.name ?? null,
      caption: media.cover.caption ?? null,
    });
  }
  media.gallery.forEach((g, i) =>
    out.push({
      assetId: g.id,
      uuid: g.uuid ?? null,
      collection: 'gallery',
      position: i,
      url: g.url,
      thumb: g.thumb ?? g.url,
      isImage: true,
      mime: null,
      name: g.name ?? null,
      caption: g.caption ?? null,
    }),
  );
  media.video.forEach((v, i) =>
    out.push({
      assetId: v.id,
      uuid: v.uuid ?? null,
      collection: 'video',
      position: i,
      url: v.url,
      thumb: v.poster ?? null,
      isImage: false,
      mime: v.mime,
      name: v.name ?? null,
      external: v.is_external ?? false,
      provider: (v.provider as StagedMediaItem['provider']) ?? null,
      embedUrl: v.is_external ? v.url : null,
      poster: v.poster ?? null,
      processingStatus: v.processing_status ?? null,
      duration: v.duration ?? null,
      hls: v.hls ?? null,
    }),
  );
  return out;
}

/**
 * Client-side media staging for the article composer (client-stage → attach
 * on save). Assets are uploaded to the central library immediately; their
 * article attachments live here until the article is saved.
 *
 * The studio manages cover / gallery / video only — inline (body) images are
 * editor-owned and preserved server-side on sync.
 */
export function useMediaStaging(initial: StagedMediaItem[] = []): MediaStaging {
  const { error } = useToast();
  const [items, setItems] = useState<StagedMediaItem[]>(initial);
  const [uploading, setUploading] = useState<UploadingItem[]>([]);
  // True once the editor manually picks/clears a cover — disables auto-cover.
  const coverLocked = useRef(false);

  const hasAsset = useCallback(
    (assetId: number) => items.some((i) => i.assetId === assetId),
    [items],
  );

  const upload = useCallback(
    (files: File[], target: 'gallery' | 'video') => {
      files.forEach((file) => {
        const tempId = nextTempId();
        setUploading((u) => [...u, { tempId, name: file.name, progress: 0, target }]);

        mediaLibraryService
          .upload(file, (p) =>
            setUploading((u) =>
              u.map((it) => (it.tempId === tempId ? { ...it, progress: p } : it)),
            ),
          )
          .then((asset) => {
            setItems((prev) => {
              if (prev.some((i) => i.assetId === asset.id)) return prev; // dedupe
              const count = prev.filter((i) => i.collection === target).length;
              const next = [...prev, assetToStaged(asset, target, count)];
              return target === 'gallery' ? withAutoCover(next, coverLocked.current) : next;
            });
            setUploading((u) => u.filter((it) => it.tempId !== tempId));
          })
          .catch((e: NormalizedError) => {
            setUploading((u) =>
              u.map((it) => (it.tempId === tempId ? { ...it, error: true } : it)),
            );
            error(e?.message ?? 'Upload failed');
          });
      });
    },
    [error],
  );

  const uploadImages = useCallback((files: File[]) => upload(files, 'gallery'), [upload]);
  const uploadVideos = useCallback((files: File[]) => upload(files, 'video'), [upload]);

  const addExternalVideo = useCallback((asset: MediaAssetData) => {
    setItems((prev) => {
      if (prev.some((i) => i.assetId === asset.id)) return prev;
      const count = prev.filter((i) => i.collection === 'video').length;
      return [...prev, assetToStaged(asset, 'video', count)];
    });
  }, []);

  const addFromLibrary = useCallback((asset: MediaAssetData) => {
    setItems((prev) => {
      if (prev.some((i) => i.assetId === asset.id)) return prev;
      const target: StagedCollection = asset.is_image ? 'gallery' : 'video';
      const count = prev.filter((i) => i.collection === target).length;
      const next = [...prev, assetToStaged(asset, target, count)];
      return target === 'gallery' ? withAutoCover(next, coverLocked.current) : next;
    });
  }, []);

  const setAsCover = useCallback((assetId: number) => {
    coverLocked.current = true; // manual choice overrides auto-cover
    setItems((prev) =>
      prev.map((i) => {
        if (i.assetId === assetId) return { ...i, collection: 'cover', position: 0 };
        if (i.collection === 'cover') return { ...i, collection: 'gallery' };
        return i;
      }),
    );
  }, []);

  const unsetCover = useCallback(() => {
    coverLocked.current = true; // explicit clear is a manual choice
    setItems((prev) =>
      prev.map((i) => (i.collection === 'cover' ? { ...i, collection: 'gallery' } : i)),
    );
  }, []);

  const remove = useCallback((assetId: number) => {
    setItems((prev) => prev.filter((i) => i.assetId !== assetId));
  }, []);

  const reorderGallery = useCallback((orderedAssetIds: number[]) => {
    setItems((prev) => {
      const byId = new Map(prev.map((i) => [i.assetId, i]));
      const reordered = orderedAssetIds
        .map((id) => byId.get(id))
        .filter((i): i is StagedMediaItem => Boolean(i) && i!.collection === 'gallery')
        .map((i, idx) => ({ ...i, position: idx }));
      const others = prev.filter((i) => i.collection !== 'gallery');
      return [...others, ...reordered];
    });
  }, []);

  // يطبّق تحديث حالة معالجة (poll) على عنصر موجود دون تغيير ترتيبه/مجموعته.
  const updateItem = useCallback((asset: MediaAssetData) => {
    setItems((prev) =>
      prev.map((i) =>
        i.assetId === asset.id
          ? {
              ...i,
              url: asset.url,
              poster: asset.poster,
              thumb: asset.poster ?? i.thumb,
              processingStatus: asset.processing_status,
              duration: asset.duration,
              hls: asset.hls,
            }
          : i,
      ),
    );
  }, []);

  const reset = useCallback((next: StagedMediaItem[]) => {
    // Seeded covers count as the established choice; new uploads still auto-cover
    // only when none exists.
    coverLocked.current = next.some((i) => i.collection === 'cover');
    setItems(next);
    setUploading([]);
  }, []);

  const cover = useMemo(() => items.find((i) => i.collection === 'cover') ?? null, [items]);
  const gallery = useMemo(
    () => items.filter((i) => i.collection === 'gallery').sort((a, b) => a.position - b.position),
    [items],
  );
  const videos = useMemo(
    () => items.filter((i) => i.collection === 'video').sort((a, b) => a.position - b.position),
    [items],
  );

  const toPayload = useCallback((): ArticleMediaAttachment[] => {
    const out: ArticleMediaAttachment[] = [];
    const coverItem = items.find((i) => i.collection === 'cover');
    if (coverItem) out.push({ asset_id: coverItem.assetId, collection: 'cover', position: 0 });
    items
      .filter((i) => i.collection === 'gallery')
      .sort((a, b) => a.position - b.position)
      .forEach((g, i) => out.push({ asset_id: g.assetId, collection: 'gallery', position: i }));
    items
      .filter((i) => i.collection === 'video')
      .sort((a, b) => a.position - b.position)
      .forEach((v, i) => out.push({ asset_id: v.assetId, collection: 'video', position: i }));
    return out;
  }, [items]);

  return {
    cover,
    gallery,
    videos,
    uploading,
    busy: uploading.length > 0,
    hasAsset,
    uploadImages,
    uploadVideos,
    addExternalVideo,
    addFromLibrary,
    setAsCover,
    unsetCover,
    remove,
    reorderGallery,
    updateItem,
    reset,
    toPayload,
  };
}
