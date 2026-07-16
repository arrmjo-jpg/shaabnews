import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  Film,
  type LucideIcon,
  MoreHorizontal,
  Pencil,
  Plus,
  Send,
  Star,
  Trash2,
  Video as VideoIcon,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Modal } from '@/components/ui/modal';
import { DataTable, type Column } from '@/components/data/DataTable';
import { Pagination } from '@/components/data/Pagination';
import { SearchInput } from '@/components/data/SearchInput';
import { cn } from '@/lib/utils';
import { paths } from '@/router/paths';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import {
  useBulkVideos,
  useDeleteVideo,
  useForceDeleteVideo,
  usePlaylists,
  useRestoreVideo,
  useTransitionVideo,
  useVideoCategoryTree,
  useVideos,
  useVideoStats,
} from '../hooks';
import type {
  VideoCategoryData,
  VideoData,
  VideosListParams,
  VideoStatus,
  VideoVisibility,
} from '@/types/videoLibrary.types';

const selectCls =
  'h-10 border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const PER_PAGE = 15;

const STATUS_TONE: Record<VideoStatus, 'success' | 'muted'> = {
  published: 'success',
  scheduled: 'muted',
  draft: 'muted',
  archived: 'muted',
  submitted: 'muted',
  in_review: 'muted',
  rejected: 'muted',
};
const VIS_TONE: Record<VideoVisibility, 'default' | 'muted'> = {
  public: 'default',
  unlisted: 'muted',
  private: 'muted',
};
const PROC_TONE: Record<string, 'success' | 'muted' | 'destructive'> = {
  ready: 'success',
  processing: 'muted',
  queued: 'muted',
  failed: 'destructive',
};

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDateTime(iso: string | null, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

/** يسطّح شجرة التصنيفات إلى خيارات بإزاحة للعمق. */
function flattenCategories(nodes: VideoCategoryData[], depth = 0): Array<{ id: number; label: string }> {
  return nodes.flatMap((n) => [
    { id: n.id, label: `${'— '.repeat(depth)}${n.name}` },
    ...flattenCategories(n.children ?? [], depth + 1),
  ]);
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 border bg-background p-3 text-start transition-colors hover:border-primary',
        active ? 'border-primary ring-1 ring-primary' : 'border-border',
      )}
    >
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center bg-muted', tone)}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-bold leading-none tabular-nums">{value}</span>
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
      </span>
    </button>
  );
}

export default function VideosPage() {
  const { t, i18n } = useTranslation('videoLibrary');
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { confirm } = useToast();

  const canCreate = hasPermission('videos.create');
  const canEdit = hasPermission('videos.edit');
  const canPublish = hasPermission('videos.publish');
  const canArchive = hasPermission('videos.archive');
  const canDelete = hasPermission('videos.delete');
  const canRestore = hasPermission('videos.restore');
  const canForceDelete = hasPermission('videos.force_delete');
  const canManagePlaylists = hasPermission('video-playlists.manage');
  const canSeeTrash = canRestore || canForceDelete;

  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo<VideosListParams>(() => {
    const catRaw = searchParams.get('video_category_id');
    return {
      page: Number(searchParams.get('page')) || 1,
      per_page: PER_PAGE,
      search: searchParams.get('search') || '',
      status: (searchParams.get('status') as VideosListParams['status']) || '',
      visibility: (searchParams.get('visibility') as VideosListParams['visibility']) || '',
      source_type: (searchParams.get('source_type') as VideosListParams['source_type']) || '',
      locale: (searchParams.get('locale') as VideosListParams['locale']) || '',
      video_category_id: catRaw ? Number(catRaw) : '',
      sort: (searchParams.get('sort') as VideosListParams['sort']) || '-created_at',
      trashed: (searchParams.get('trashed') as VideosListParams['trashed']) || '',
    };
  }, [searchParams]);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [scheduling, setScheduling] = useState<VideoData | null>(null);
  const [scheduleAt, setScheduleAt] = useState('');
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTo, setMoveTo] = useState<string>('');
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [playlistTo, setPlaylistTo] = useState<string>('');

  const q = useVideos(params);
  const statsQ = useVideoStats();
  const catQ = useVideoCategoryTree();
  const plQ = usePlaylists({ page: 1, per_page: 100, search: '', status: '', locale: '', sort: '-created_at' });
  const del = useDeleteVideo();
  const restore = useRestoreVideo();
  const forceDel = useForceDeleteVideo();
  const transition = useTransitionVideo();
  const bulk = useBulkVideos();

  const inTrash = params.trashed === 'only';
  const selectable = canEdit && !inTrash;
  const rows = q.data?.data ?? [];

  const patch = (p: Partial<VideosListParams>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(p).forEach(([k, v]) => {
      if (v === '' || v == null) {
        next.delete(k);
      } else {
        next.set(k, String(v));
      }
    });
    if (p.page === undefined) {
      next.set('page', '1');
    }
    setSearchParams(next);
    setSelected(new Set());
  };

  const toggleSelect = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someSelected = rows.some((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });

  const ids = [...selected];
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const runBulk = (payload: Parameters<typeof bulk.mutate>[0], after?: () => void) =>
    bulk.mutate(payload, {
      onSuccess: () => {
        setSelected(new Set());
        after?.();
      },
    });
  const confirmBulk = (titleKey: string, confirmKey: string) =>
    confirm({
      title: t(titleKey),
      text: t('videos.bulk.selected', { count: ids.length }),
      confirmText: t(confirmKey),
      cancelText: t('common.cancel', { ns: 'common' }),
    });

  const isReady = (v: VideoData) => v.source_type !== 'uploaded' || v.media?.processing_status === 'ready';

  // ─── Row actions ────────────────────────────────────────────────────────
  const onPublish = async (v: VideoData) => {
    if (
      await confirm({
        title: t('videos.confirm.publishTitle'),
        text: t('videos.confirm.publishText'),
        confirmText: t('videos.action.publish'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      transition.mutate({ id: v.id, status: 'published' });
  };
  const onArchive = async (v: VideoData) => {
    if (
      await confirm({
        title: t('videos.confirm.archiveTitle'),
        text: t('videos.confirm.archiveText'),
        confirmText: t('videos.action.archive'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      transition.mutate({ id: v.id, status: 'archived' });
  };
  const onDelete = async (v: VideoData) => {
    if (
      await confirm({
        title: t('videos.confirm.deleteTitle'),
        text: t('videos.confirm.deleteText', { title: v.title }),
        confirmText: t('videos.action.delete'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      del.mutate(v.id);
  };
  const onForceDelete = async (v: VideoData) => {
    if (
      await confirm({
        title: t('videos.confirm.forceTitle'),
        text: t('videos.confirm.forceText', { title: v.title }),
        confirmText: t('videos.confirm.forceYes'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      forceDel.mutate(v.id);
  };
  const submitSchedule = () => {
    if (!scheduling || !scheduleAt) return;
    transition.mutate(
      { id: scheduling.id, status: 'scheduled', publishedAt: new Date(scheduleAt).toISOString() },
      { onSuccess: () => setScheduling(null) },
    );
  };

  // ─── Bulk handlers ──────────────────────────────────────────────────────
  const bulkPublish = async () => {
    if (
      await confirm({
        title: t('videos.confirm.publishTitle'),
        text: t('videos.bulk.selected', { count: ids.length }),
        confirmText: t('videos.bulk.publish'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      runBulk({ action: 'publish', ids });
  };
  const bulkDelete = async () => {
    if (
      await confirm({
        title: t('videos.confirm.deleteTitle'),
        text: t('videos.bulk.selected', { count: ids.length }),
        confirmText: t('videos.bulk.delete'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      runBulk({ action: 'delete', ids });
  };
  const bulkUnpublish = async () => {
    if (await confirmBulk('videos.confirm.unpublishTitle', 'videos.bulk.unpublish')) runBulk({ action: 'unpublish', ids });
  };
  const bulkFeature = async (value: boolean) => {
    if (
      await confirmBulk(
        value ? 'videos.confirm.featureTitle' : 'videos.confirm.unfeatureTitle',
        value ? 'videos.bulk.feature' : 'videos.bulk.unfeature',
      )
    )
      runBulk({ action: 'feature', ids, value });
  };

  const s = statsQ.data;
  const activeCard = inTrash ? 'trashed' : params.status || 'total';
  const cards = [
    { key: 'total', label: t('videos.stats.total'), value: s?.total ?? 0, icon: Film, tone: 'text-primary', onClick: () => patch({ status: '', trashed: '' }) },
    { key: 'draft', label: t('status.draft'), value: s?.draft ?? 0, icon: FileText, tone: 'text-muted-foreground', onClick: () => patch({ status: 'draft', trashed: '' }) },
    { key: 'scheduled', label: t('status.scheduled'), value: s?.scheduled ?? 0, icon: Clock, tone: 'text-muted-foreground', onClick: () => patch({ status: 'scheduled', trashed: '' }) },
    { key: 'published', label: t('status.published'), value: s?.published ?? 0, icon: CheckCircle2, tone: 'text-emerald-600 dark:text-emerald-400', onClick: () => patch({ status: 'published', trashed: '' }) },
    { key: 'archived', label: t('status.archived'), value: s?.archived ?? 0, icon: Archive, tone: 'text-muted-foreground', onClick: () => patch({ status: 'archived', trashed: '' }) },
  ];

  const columns: Column<VideoData>[] = [
    ...(selectable
      ? [
          {
            key: 'select',
            header: (
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected && !allSelected;
                }}
                onChange={toggleAll}
                aria-label={t('videos.bulk.clear')}
                className="h-4 w-4 cursor-pointer accent-primary"
              />
            ),
            render: (v: VideoData) => (
              <input
                type="checkbox"
                checked={selected.has(v.id)}
                onChange={() => toggleSelect(v.id)}
                onClick={(e) => e.stopPropagation()}
                aria-label={v.title}
                className="h-4 w-4 cursor-pointer accent-primary"
              />
            ),
            className: 'w-10',
          } as Column<VideoData>,
        ]
      : []),
    {
      key: 'thumb',
      header: '',
      render: (v) => (
        <div className="flex h-14 w-10 items-center justify-center overflow-hidden border border-border bg-muted">
          {v.share_image ? (
            <img src={v.share_image} alt="" className="h-full w-full object-cover" />
          ) : (
            <VideoIcon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      ),
    },
    {
      key: 'title',
      header: t('videos.col.title'),
      render: (v) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {v.is_featured ? (
              <Star className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" aria-label={t('videos.featured')} />
            ) : null}
            <p className="truncate font-medium">{v.title}</p>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {v.category?.name ?? t('videos.mediaState.noCategory')} · /{v.slug}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('videos.col.status'),
      render: (v) => (
        <div className="space-y-1">
          <Badge variant={STATUS_TONE[v.status]}>{t(`status.${v.status}`)}</Badge>
          {v.status === 'scheduled' && v.published_at ? (
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <CalendarClock className="h-3 w-3" />
              {t('videos.scheduledFor', { date: fmtDateTime(v.published_at, i18n.language) })}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'visibility',
      header: t('videos.col.visibility'),
      render: (v) => <Badge variant={VIS_TONE[v.visibility]}>{t(`visibility.${v.visibility}`)}</Badge>,
    },
    {
      key: 'source',
      header: t('videos.col.source'),
      render: (v) => {
        const ms = v.media?.processing_status ?? null;
        return (
          <div className="space-y-1">
            <Badge variant="muted">{t(`source.${v.source_type}`)}</Badge>
            {v.source_type === 'uploaded' ? (
              ms ? (
                <Badge variant={PROC_TONE[ms] ?? 'muted'} className="ms-0">
                  {t(`processing.${ms}`, { defaultValue: ms })}
                </Badge>
              ) : (
                <span className="block text-[11px] text-muted-foreground">{t('processing.none')}</span>
              )
            ) : (
              <span className="block text-[11px] text-muted-foreground">{t('videos.mediaState.external')}</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'locale',
      header: t('videos.col.locale'),
      render: (v) => <Badge variant="muted">{v.locale.toUpperCase()}</Badge>,
    },
    {
      key: 'views',
      header: t('videos.col.views'),
      align: 'center',
      render: (v) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {(v.metrics?.views ?? v.views_count).toLocaleString(i18n.language)}
        </span>
      ),
    },
    {
      key: 'date',
      header: t('videos.col.date'),
      render: (v) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {fmtDate(v.published_at ?? v.created_at, i18n.language)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'end',
      render: (v) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {inTrash ? (
              <>
                {canRestore ? (
                  <DropdownMenuItem onClick={() => restore.mutate(v.id)}>
                    <ArchiveRestore className="h-4 w-4" />
                    {t('videos.action.restore')}
                  </DropdownMenuItem>
                ) : null}
                {canForceDelete ? (
                  <DropdownMenuItem onClick={() => void onForceDelete(v)} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4" />
                    {t('videos.action.forceDelete')}
                  </DropdownMenuItem>
                ) : null}
              </>
            ) : (
              <>
                {canEdit ? (
                  <DropdownMenuItem onClick={() => navigate(paths.vlVideosEdit.replace(':id', String(v.id)))}>
                    <Pencil className="h-4 w-4" />
                    {t('videos.action.edit')}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={() => navigate(paths.vlVideoAnalytics.replace(':id', String(v.id)))}>
                  <BarChart3 className="h-4 w-4" />
                  {t('videos.action.analytics')}
                </DropdownMenuItem>
                {canPublish && v.status !== 'published' && isReady(v) ? (
                  <DropdownMenuItem onClick={() => void onPublish(v)}>
                    <Send className="h-4 w-4" />
                    {t('videos.action.publish')}
                  </DropdownMenuItem>
                ) : null}
                {canPublish && v.status !== 'published' ? (
                  <DropdownMenuItem
                    onClick={() => {
                      setScheduleAt('');
                      setScheduling(v);
                    }}
                  >
                    <CalendarClock className="h-4 w-4" />
                    {t('videos.action.schedule')}
                  </DropdownMenuItem>
                ) : null}
                {canArchive && v.status !== 'archived' ? (
                  <DropdownMenuItem onClick={() => void onArchive(v)}>
                    <Archive className="h-4 w-4" />
                    {t('videos.action.archive')}
                  </DropdownMenuItem>
                ) : null}
                {canDelete ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void onDelete(v)} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-4 w-4" />
                      {t('videos.action.delete')}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const hasFilters = Boolean(
    params.search ||
      params.status ||
      params.visibility ||
      params.source_type ||
      params.locale ||
      params.video_category_id ||
      params.trashed,
  );
  const categoryOptions = flattenCategories(catQ.data ?? []);
  const playlistOptions = plQ.data?.data ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('videos.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('videos.subtitle')}</p>
        </div>
        {canCreate ? (
          <Button onClick={() => navigate(paths.vlVideosCreate)}>
            <Plus className="h-4 w-4" />
            {t('videos.new')}
          </Button>
        ) : null}
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <StatCard key={c.key} label={c.label} value={c.value} icon={c.icon} tone={c.tone} active={activeCard === c.key} onClick={c.onClick} />
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 border border-border bg-background p-3">
        <SearchInput
          value={params.search}
          onDebouncedChange={(v) => patch({ search: v })}
          placeholder={t('videos.filter.search')}
        />
        <select className={selectCls} value={params.status} onChange={(e) => patch({ status: e.target.value as VideosListParams['status'] })}>
          <option value="">{t('videos.filter.statusAll')}</option>
          <option value="draft">{t('status.draft')}</option>
          <option value="scheduled">{t('status.scheduled')}</option>
          <option value="published">{t('status.published')}</option>
          <option value="archived">{t('status.archived')}</option>
        </select>
        <select className={selectCls} value={params.visibility} onChange={(e) => patch({ visibility: e.target.value as VideosListParams['visibility'] })}>
          <option value="">{t('videos.filter.visibilityAll')}</option>
          <option value="public">{t('visibility.public')}</option>
          <option value="unlisted">{t('visibility.unlisted')}</option>
          <option value="private">{t('visibility.private')}</option>
        </select>
        <select className={selectCls} value={params.source_type} onChange={(e) => patch({ source_type: e.target.value as VideosListParams['source_type'] })}>
          <option value="">{t('videos.filter.sourceAll')}</option>
          <option value="uploaded">{t('source.uploaded')}</option>
          <option value="youtube">{t('source.youtube')}</option>
          <option value="vimeo">{t('source.vimeo')}</option>
          <option value="direct_mp4">{t('source.direct_mp4')}</option>
        </select>
        <select className={selectCls} value={params.locale} onChange={(e) => patch({ locale: e.target.value as VideosListParams['locale'] })}>
          <option value="">{t('videos.filter.localeAll')}</option>
          <option value="ar">{t('locale.ar')}</option>
          <option value="en">{t('locale.en')}</option>
        </select>
        <select className={selectCls} value={params.video_category_id} onChange={(e) => patch({ video_category_id: e.target.value === '' ? '' : Number(e.target.value) })}>
          <option value="">{t('videos.filter.categoryAll') || 'كل التصنيفات'}</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select className={selectCls} value={params.sort} onChange={(e) => patch({ sort: e.target.value as VideosListParams['sort'] })}>
          <option value="-created_at">{t('videos.filter.sortNewest')}</option>
          <option value="-published_at">{t('videos.filter.sortPublished')}</option>
          <option value="-views_count">{t('videos.filter.sortViews')}</option>
          <option value="title">{t('videos.filter.sortTitle')}</option>
          <option value="sort_order">{t('videos.filter.sortOrder')}</option>
        </select>
        {canSeeTrash ? (
          <select className={selectCls} value={params.trashed} onChange={(e) => patch({ trashed: e.target.value as VideosListParams['trashed'] })}>
            <option value="">{t('videos.filter.trashedNone')}</option>
            <option value="only">{t('videos.filter.trashedOnly')}</option>
          </select>
        ) : null}
        {hasFilters ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              patch({ search: '', status: '', visibility: '', source_type: '', locale: '', video_category_id: '', sort: '-created_at', trashed: '' })
            }
          >
            <X className="h-4 w-4" />
            {t('videos.filter.reset')}
          </Button>
        ) : null}
      </div>

      {/* Bulk action bar */}
      {selectable && selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border border-primary bg-primary/5 p-3">
          <span className="text-sm font-medium">{t('videos.bulk.selected', { count: selected.size })}</span>
          <span className="flex-1" />
          {canPublish ? (
            <Button variant="outline" size="sm" onClick={() => void bulkPublish()} disabled={bulk.isPending}>
              <Send className="h-4 w-4" />
              {t('videos.bulk.publish')}
            </Button>
          ) : null}
          {canPublish ? (
            <Button variant="outline" size="sm" onClick={() => void bulkUnpublish()} disabled={bulk.isPending}>
              {t('videos.bulk.unpublish')}
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => void bulkFeature(true)} disabled={bulk.isPending}>
            <Star className="h-4 w-4" />
            {t('videos.bulk.feature')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void bulkFeature(false)} disabled={bulk.isPending}>
            {t('videos.bulk.unfeature')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setMoveTo(''); setMoveOpen(true); }} disabled={bulk.isPending}>
            {t('videos.bulk.moveCategory')}
          </Button>
          {canManagePlaylists ? (
            <Button variant="outline" size="sm" onClick={() => { setPlaylistTo(''); setPlaylistOpen(true); }} disabled={bulk.isPending}>
              {t('videos.bulk.addPlaylist')}
            </Button>
          ) : null}
          {canDelete ? (
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => void bulkDelete()} disabled={bulk.isPending}>
              <Trash2 className="h-4 w-4" />
              {t('videos.bulk.delete')}
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            {t('videos.bulk.clear')}
          </Button>
        </div>
      ) : null}

      {/* Error state */}
      {q.isError ? (
        <div className="flex items-center justify-between gap-3 border border-destructive bg-destructive/5 p-4 text-sm">
          <span className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {t('videos.error')}
          </span>
          <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
            {t('videos.retry')}
          </Button>
        </div>
      ) : (
        <div className={cn('transition-opacity duration-200', q.isFetching && 'opacity-70')}>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(v) => v.id}
            loading={q.isLoading}
            emptyTitle={inTrash ? t('videos.empty.trashTitle') : t('videos.empty.title')}
            emptyDescription={inTrash ? t('videos.empty.trashDescription') : t('videos.empty.description')}
          />
          {q.data ? <Pagination meta={q.data.pagination} onPage={(page) => patch({ page })} /> : null}
        </div>
      )}

      {/* Schedule modal */}
      <Modal
        open={scheduling !== null}
        onClose={() => setScheduling(null)}
        title={t('videos.schedule.title')}
        description={scheduling?.title}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setScheduling(null)}>
              {t('common.cancel', { ns: 'common' })}
            </Button>
            <Button onClick={submitSchedule} disabled={!scheduleAt || transition.isPending}>
              {t('videos.schedule.submit')}
            </Button>
          </>
        }
      >
        <label className="block text-sm font-medium">{t('videos.schedule.label')}</label>
        <input
          type="datetime-local"
          value={scheduleAt}
          onChange={(e) => setScheduleAt(e.target.value)}
          className={cn(selectCls, 'mt-2 w-full')}
        />
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium">
          <CalendarClock className="h-3.5 w-3.5" />
          {t('videos.schedule.tz', { tz })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{t('videos.schedule.hint')}</p>
      </Modal>

      {/* Bulk: move to category */}
      <Modal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title={t('videos.bulk.moveTitle', { count: selected.size })}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>
              {t('common.cancel', { ns: 'common' })}
            </Button>
            <Button
              onClick={() =>
                runBulk(
                  { action: 'move_category', ids, video_category_id: moveTo === '' ? null : Number(moveTo) },
                  () => setMoveOpen(false),
                )
              }
              disabled={bulk.isPending}
            >
              {t('videos.bulk.moveSubmit')}
            </Button>
          </>
        }
      >
        <label className="block text-sm font-medium">{t('videos.bulk.moveLabel')}</label>
        <select className={cn(selectCls, 'mt-2 w-full')} value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
          <option value="">{t('videos.bulk.moveNone')}</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </Modal>

      {/* Bulk: add to playlist */}
      <Modal
        open={playlistOpen}
        onClose={() => setPlaylistOpen(false)}
        title={t('videos.bulk.playlistTitle', { count: selected.size })}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setPlaylistOpen(false)}>
              {t('common.cancel', { ns: 'common' })}
            </Button>
            <Button
              onClick={() =>
                playlistTo !== '' &&
                runBulk({ action: 'add_to_playlist', ids, playlist_id: Number(playlistTo) }, () => setPlaylistOpen(false))
              }
              disabled={playlistTo === '' || bulk.isPending}
            >
              {t('videos.bulk.playlistSubmit')}
            </Button>
          </>
        }
      >
        <label className="block text-sm font-medium">{t('videos.bulk.playlistLabel')}</label>
        {playlistOptions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t('videos.bulk.playlistEmpty')}</p>
        ) : (
          <select className={cn(selectCls, 'mt-2 w-full')} value={playlistTo} onChange={(e) => setPlaylistTo(e.target.value)}>
            <option value="">—</option>
            {playlistOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        )}
      </Modal>
    </div>
  );
}
