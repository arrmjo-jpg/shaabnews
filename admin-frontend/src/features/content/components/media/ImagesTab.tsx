import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, Trash2, ImageOff } from 'lucide-react';
import { UploadProgress } from './UploadButton';
import { Dropzone } from './Dropzone';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateMediaAsset } from '../../hooks';
import type { MediaStaging } from '../../lib/useMediaStaging';
import type { StagedMediaItem } from '@/types/content.types';

const ACCEPT = 'image/jpeg,image/png,image/webp';

interface Props {
  staging: MediaStaging;
}

/** Images workspace: batch upload + cover assignment + gallery management. */
export function ImagesTab({ staging }: Props) {
  const { t } = useTranslation('content');
  const { hasPermission } = useAuth();
  const [dragId, setDragId] = useState<number | null>(null);

  const canEditCaption = hasPermission('media.upload');
  const updateCaption = useUpdateMediaAsset();
  const [captionDraft, setCaptionDraft] = useState('');

  // Seed the draft whenever the cover asset changes (new cover, or article load).
  useEffect(() => {
    setCaptionDraft(staging.cover?.caption ?? '');
  }, [staging.cover?.assetId, staging.cover?.caption]);

  const saveCoverCaption = () => {
    const uuid = staging.cover?.uuid;
    if (!uuid) return;
    const trimmed = captionDraft.trim();
    if (trimmed === (staging.cover?.caption ?? '')) return;
    updateCaption.mutate({ uuid, payload: { caption: trimmed || null } });
  };

  const imgUploads = staging.uploading.filter((u) => u.target === 'gallery');

  const onDrop = (overId: number) => {
    if (dragId === null || dragId === overId) return;
    const ids = staging.gallery.map((g) => g.assetId);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(overId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    staging.reorderGallery(ids);
    setDragId(null);
  };

  return (
    <div className="space-y-4">
      <Dropzone
        accept={ACCEPT}
        label={t('mediaStudio.images.drop')}
        hint={t('mediaStudio.images.dropHint')}
        onFiles={staging.uploadImages}
      />

      {/* Cover */}
      <div>
        <p className="mb-2 text-xs font-bold text-muted-foreground">
          {t('mediaStudio.images.cover')}
        </p>
        {staging.cover ? (
          <div className="space-y-2">
            <Tile
              item={staging.cover}
              isCover
              onUnsetCover={staging.unsetCover}
              onRemove={() => staging.remove(staging.cover!.assetId)}
              removeLabel={t('mediaStudio.common.remove')}
              unsetLabel={t('mediaStudio.images.unsetCover')}
            />
            <Input
              value={captionDraft}
              onChange={(e) => setCaptionDraft(e.target.value)}
              onBlur={saveCoverCaption}
              disabled={!canEditCaption || !staging.cover.uuid}
              placeholder={t('mediaStudio.images.captionPlaceholder')}
              className="text-xs"
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t('mediaStudio.images.coverHint')}</p>
        )}
      </div>

      {/* Gallery */}
      <div>
        <p className="mb-2 text-xs font-bold text-muted-foreground">
          {t('mediaStudio.images.gallery')}{' '}
          <span className="font-normal">— {t('mediaStudio.images.galleryHint')}</span>
        </p>

        {staging.gallery.length === 0 && imgUploads.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('mediaStudio.images.empty')}</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {staging.gallery.map((item) => (
              <div
                key={item.assetId}
                draggable
                onDragStart={() => setDragId(item.assetId)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(item.assetId)}
                onDragEnd={() => setDragId(null)}
              >
                <Tile
                  item={item}
                  onSetCover={() => staging.setAsCover(item.assetId)}
                  onRemove={() => staging.remove(item.assetId)}
                  removeLabel={t('mediaStudio.common.remove')}
                  setCoverLabel={t('mediaStudio.images.setCover')}
                />
              </div>
            ))}

            {imgUploads.map((u) => (
              <div key={u.tempId} className="border border-border bg-muted/30 p-1">
                <div className="flex aspect-square items-center justify-center text-xs text-muted-foreground">
                  {u.error ? <ImageOff className="h-5 w-5 text-destructive" /> : `${u.progress}%`}
                </div>
                {!u.error ? <UploadProgress percent={u.progress} /> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface TileProps {
  item: StagedMediaItem;
  isCover?: boolean;
  onSetCover?: () => void;
  onUnsetCover?: () => void;
  onRemove: () => void;
  removeLabel: string;
  setCoverLabel?: string;
  unsetLabel?: string;
}

function Tile({
  item,
  isCover,
  onSetCover,
  onUnsetCover,
  onRemove,
  removeLabel,
  setCoverLabel,
  unsetLabel,
}: TileProps) {
  return (
    <figure className="group relative border border-border bg-background">
      <div className="aspect-square overflow-hidden bg-muted/30">
        {item.thumb || item.url ? (
          <img
            src={item.thumb ?? item.url ?? ''}
            alt={item.name ?? ''}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageOff className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>

      {isCover ? (
        <span className="absolute right-1 top-1 bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
          {/* cover badge */}★
        </span>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-background/85 p-1 opacity-0 transition-opacity group-hover:opacity-100">
        {onSetCover ? (
          <button
            type="button"
            title={setCoverLabel}
            onClick={onSetCover}
            className="text-muted-foreground hover:text-primary"
          >
            <Star className="h-4 w-4" />
          </button>
        ) : null}
        {onUnsetCover ? (
          <button
            type="button"
            title={unsetLabel}
            onClick={onUnsetCover}
            className="text-primary hover:text-muted-foreground"
          >
            <Star className="h-4 w-4 fill-current" />
          </button>
        ) : null}
        <button
          type="button"
          title={removeLabel}
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </figure>
  );
}
