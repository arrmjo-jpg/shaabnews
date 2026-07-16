import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  ArchiveRestore,
  BarChart3,
  CheckCircle2,
  Clapperboard,
  Clock,
  FileText,
  type LucideIcon,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Send,
  Star,
  Trash2,
  Video,
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
import { DataTable, type Column } from '@/components/data/DataTable';
import { Pagination } from '@/components/data/Pagination';
import { SearchInput } from '@/components/data/SearchInput';
import { cn } from '@/lib/utils';
import { EngagementMetricsButton } from '../components/EngagementMetricsButton';
import { ReelVideoPreviewModal } from '../components/reels/ReelVideoPreviewModal';
import { paths } from '@/router/paths';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import {
  useDeleteReel,
  useForceDeleteReel,
  useReels,
  useReelStats,
  useRestoreReel,
  useTransitionReel,
} from '../reels.hooks';
import type { ReelData, ReelsListParams, ReelStatus } from '@/types/content.types';

const selectCls =
  'h-10 border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const STATUS_TONE: Record<ReelStatus, 'success' | 'muted'> = {
  published: 'success',
  scheduled: 'muted',
  draft: 'muted',
  archived: 'muted',
  submitted: 'muted',
  in_review: 'muted',
  rejected: 'muted',
};

const MEDIA_TONE: Record<string, 'success' | 'muted'> = {
  ready: 'success',
  processing: 'muted',
  queued: 'muted',
  failed: 'muted',
};

const PER_PAGE = 15;

function fmtDuration(s: number | null): string {
  if (!s || s <= 0) return '—';
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
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
        <span className="block text-xl font-bold leading-none">{value}</span>
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
      </span>
    </button>
  );
}

export default function ReelsPage() {
  const { t, i18n } = useTranslation('content');
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { confirm } = useToast();

  const canCreate = hasPermission('reels.create');
  const canEdit = hasPermission('reels.edit');
  const canPublish = hasPermission('reels.publish');
  const canArchive = hasPermission('reels.archive');
  const canDelete = hasPermission('reels.delete');
  const canRestore = hasPermission('reels.restore');
  const canForceDelete = hasPermission('reels.force_delete');
  const canSeeTrash = canRestore || canForceDelete;

  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo<ReelsListParams>(() => {
    return {
      page: Number(searchParams.get('page')) || 1,
      per_page: PER_PAGE,
      search: searchParams.get('search') || '',
      status: (searchParams.get('status') as ReelsListParams['status']) || '',
      locale: (searchParams.get('locale') as ReelsListParams['locale']) || '',
      sort: (searchParams.get('sort') as ReelsListParams['sort']) || '-created_at',
      trashed: (searchParams.get('trashed') as ReelsListParams['trashed']) || '',
    };
  }, [searchParams]);

  const [preview, setPreview] = useState<ReelData | null>(null);

  const q = useReels(params);
  const statsQ = useReelStats();
  const del = useDeleteReel();
  const restore = useRestoreReel();
  const forceDel = useForceDeleteReel();
  const transition = useTransitionReel();

  const patch = (p: Partial<ReelsListParams>) => {
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
  };

  const inTrash = params.trashed === 'only';
  const rows = q.data?.data ?? [];

  const onDelete = async (r: ReelData) => {
    if (
      await confirm({
        title: t('reels.confirm.deleteTitle'),
        text: t('reels.confirm.deleteText', { title: r.title }),
        confirmText: t('reels.confirm.yes'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      del.mutate(r.id);
  };

  const onForceDelete = async (r: ReelData) => {
    if (
      await confirm({
        title: t('reels.confirm.forceTitle'),
        text: t('reels.confirm.forceText', { title: r.title }),
        confirmText: t('reels.confirm.forceYes'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      forceDel.mutate(r.id);
  };

  const onPublish = async (r: ReelData) => {
    if (
      await confirm({
        title: t('reels.confirm.publishTitle'),
        text: t('reels.confirm.publishText'),
        confirmText: t('reels.action.publish'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      transition.mutate({ id: r.id, status: 'published' });
  };

  const onArchive = async (r: ReelData) => {
    if (
      await confirm({
        title: t('reels.confirm.archiveTitle'),
        text: t('reels.confirm.archiveText'),
        confirmText: t('reels.action.archive'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      transition.mutate({ id: r.id, status: 'archived' });
  };

  const activeCard = inTrash ? 'trashed' : params.status || 'total';
  const s = statsQ.data;

  const cards = [
    { key: 'total', label: t('reels.stats.total'), value: s?.total ?? 0, icon: Clapperboard, tone: 'text-primary', onClick: () => patch({ status: '', trashed: '' }) },
    { key: 'draft', label: t('reels.status.draft'), value: s?.draft ?? 0, icon: FileText, tone: 'text-muted-foreground', onClick: () => patch({ status: 'draft', trashed: '' }) },
    { key: 'scheduled', label: t('reels.status.scheduled'), value: s?.scheduled ?? 0, icon: Clock, tone: 'text-muted-foreground', onClick: () => patch({ status: 'scheduled', trashed: '' }) },
    { key: 'published', label: t('reels.status.published'), value: s?.published ?? 0, icon: CheckCircle2, tone: 'text-success', onClick: () => patch({ status: 'published', trashed: '' }) },
    { key: 'archived', label: t('reels.status.archived'), value: s?.archived ?? 0, icon: Archive, tone: 'text-muted-foreground', onClick: () => patch({ status: 'archived', trashed: '' }) },
    ...(canSeeTrash
      ? [{ key: 'trashed', label: t('reels.stats.trashed'), value: s?.trashed ?? 0, icon: Trash2, tone: 'text-destructive', onClick: () => patch({ status: '', trashed: 'only' as const }) }]
      : []),
  ];

  const columns: Column<ReelData>[] = [
    {
      key: 'thumb',
      header: '',
      render: (r) => (
        <div className="flex h-14 w-10 items-center justify-center overflow-hidden border border-border bg-muted">
          {r.share_image ? (
            <img src={r.share_image} alt="" className="h-full w-full object-cover" />
          ) : (
            <Video className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      ),
    },
    {
      key: 'title',
      header: t('reels.col.title'),
      render: (r) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {r.is_featured ? (
              <Star className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" aria-label={t('reels.featured')} />
            ) : null}
            <p className="truncate font-medium">{r.title}</p>
          </div>
          <p className="truncate text-xs text-muted-foreground">/{r.slug}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('reels.col.status'),
      render: (r) => <Badge variant={STATUS_TONE[r.status]}>{t(`reels.status.${r.status}`)}</Badge>,
    },
    {
      key: 'locale',
      header: t('reels.col.locale'),
      render: (r) => <Badge variant="muted">{r.locale.toUpperCase()}</Badge>,
    },
    {
      key: 'media',
      header: t('reels.col.media'),
      render: (r) => {
        const ms = r.media?.processing_status ?? null;
        if (!ms) return <span className="text-xs text-muted-foreground">{t('reels.mediaState.none')}</span>;
        return (
          <Badge variant={MEDIA_TONE[ms] ?? 'muted'} className={ms === 'failed' ? 'text-destructive' : ''}>
            {t(`reels.mediaState.${ms}`, { defaultValue: ms })}
          </Badge>
        );
      },
    },
    {
      key: 'duration',
      header: t('reels.col.duration'),
      align: 'center',
      render: (r) => <span className="text-xs tabular-nums text-muted-foreground">{fmtDuration(r.duration_seconds)}</span>,
    },
    {
      key: 'author',
      header: t('reels.col.author'),
      render: (r) => <span className="truncate text-xs text-muted-foreground">{r.author?.name ?? '—'}</span>,
    },
    {
      key: 'date',
      header: t('reels.col.date'),
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {fmtDate(r.published_at ?? r.created_at, i18n.language)}
        </span>
      ),
    },
    {
      key: 'metrics',
      header: t('reels.col.metrics'),
      align: 'center',
      render: (r) => <EngagementMetricsButton metrics={r.metrics} locale={i18n.language} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'end',
      render: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {r.media?.processing_status === 'ready' ? (
              <DropdownMenuItem onClick={() => setPreview(r)}>
                <Play className="h-4 w-4" />
                {t('reels.action.preview')}
              </DropdownMenuItem>
            ) : null}
            {inTrash ? (
              <>
                {canRestore ? (
                  <DropdownMenuItem onClick={() => restore.mutate(r.id)}>
                    <ArchiveRestore className="h-4 w-4" />
                    {t('reels.action.restore')}
                  </DropdownMenuItem>
                ) : null}
                {canForceDelete ? (
                  <DropdownMenuItem
                    onClick={() => void onForceDelete(r)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('reels.action.forceDelete')}
                  </DropdownMenuItem>
                ) : null}
              </>
            ) : (
              <>
                {canEdit ? (
                  <DropdownMenuItem onClick={() => navigate(paths.reelsEdit.replace(':id', String(r.id)))}>
                    <Pencil className="h-4 w-4" />
                    {t('reels.action.edit')}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={() => navigate(paths.reelAnalytics.replace(':id', String(r.id)))}>
                  <BarChart3 className="h-4 w-4" />
                  {t('reels.action.analytics')}
                </DropdownMenuItem>
                {canPublish && r.status !== 'published' && r.media?.processing_status === 'ready' ? (
                  <DropdownMenuItem onClick={() => void onPublish(r)}>
                    <Send className="h-4 w-4" />
                    {t('reels.action.publish')}
                  </DropdownMenuItem>
                ) : null}
                {canArchive && r.status !== 'archived' ? (
                  <DropdownMenuItem onClick={() => void onArchive(r)}>
                    <Archive className="h-4 w-4" />
                    {t('reels.action.archive')}
                  </DropdownMenuItem>
                ) : null}
                {canDelete ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => void onDelete(r)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      {t('reels.action.delete')}
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

  const hasFilters = Boolean(params.search || params.status || params.locale || params.trashed);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('reels.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('reels.subtitle')}</p>
        </div>
        {canCreate ? (
          <Button onClick={() => navigate(paths.reelsCreate)}>
            <Plus className="h-4 w-4" />
            {t('reels.new')}
          </Button>
        ) : null}
      </header>

      {/* بطاقات الحالة — قابلة للنقر كفلاتر سريعة */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <StatCard
            key={c.key}
            label={c.label}
            value={c.value}
            icon={c.icon}
            tone={c.tone}
            active={activeCard === c.key}
            onClick={c.onClick}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 border border-border bg-background p-3">
        <SearchInput
          value={params.search}
          onDebouncedChange={(v) => patch({ search: v })}
          placeholder={t('reels.filter.search')}
        />
        <select
          className={selectCls}
          value={params.status}
          onChange={(e) => patch({ status: e.target.value as ReelsListParams['status'] })}
        >
          <option value="">{t('reels.filter.statusAll')}</option>
          <option value="draft">{t('reels.status.draft')}</option>
          <option value="scheduled">{t('reels.status.scheduled')}</option>
          <option value="published">{t('reels.status.published')}</option>
          <option value="archived">{t('reels.status.archived')}</option>
        </select>
        <select
          className={selectCls}
          value={params.locale}
          onChange={(e) => patch({ locale: e.target.value as ReelsListParams['locale'] })}
        >
          <option value="">{t('reels.filter.localeAll')}</option>
          <option value="ar">{t('articles.locale.ar')}</option>
          <option value="en">{t('articles.locale.en')}</option>
        </select>
        <select
          className={selectCls}
          value={params.sort}
          onChange={(e) => patch({ sort: e.target.value as ReelsListParams['sort'] })}
        >
          <option value="-created_at">{t('reels.filter.sortNewest')}</option>
          <option value="-published_at">{t('reels.filter.sortPublished')}</option>
          <option value="title">{t('reels.filter.sortTitle')}</option>
          <option value="sort_order">{t('reels.filter.sortOrder')}</option>
        </select>
        {canSeeTrash ? (
          <select
            className={selectCls}
            value={params.trashed}
            onChange={(e) => patch({ trashed: e.target.value as ReelsListParams['trashed'] })}
          >
            <option value="">{t('reels.filter.trashedNone')}</option>
            <option value="only">{t('reels.filter.trashedOnly')}</option>
          </select>
        ) : null}
        {hasFilters ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              patch({
                page: 1,
                search: '',
                status: '',
                locale: '',
                sort: '-created_at',
                trashed: '',
              })
            }
          >
            <X className="h-4 w-4" />
            {t('reels.filter.reset')}
          </Button>
        ) : null}
      </div>

      <div className={cn('transition-opacity duration-200', q.isFetching && 'opacity-70')}>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={q.isLoading}
          emptyTitle={inTrash ? t('reels.empty.trashTitle') : t('reels.empty.title')}
          emptyDescription={inTrash ? t('reels.empty.trashDescription') : t('reels.empty.description')}
        />
      </div>

      {q.data ? <Pagination meta={q.data.pagination} onPage={(page) => patch({ page })} /> : null}

      <ReelVideoPreviewModal
        uuid={preview?.media?.uuid ?? null}
        title={preview?.title ?? t('reels.action.preview')}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}
