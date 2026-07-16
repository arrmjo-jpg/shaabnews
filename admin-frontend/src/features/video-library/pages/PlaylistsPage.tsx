import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArchiveRestore,
  ListVideo,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
  Trash2,
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
import { paths } from '@/router/paths';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import {
  useDeletePlaylist,
  useForceDeletePlaylist,
  usePlaylists,
  useRestorePlaylist,
} from '../hooks';
import type { PlaylistsListParams, VideoPlaylistData, VideoStatus, VideoVisibility } from '@/types/videoLibrary.types';

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

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function PlaylistsPage() {
  const { t, i18n } = useTranslation('videoLibrary');
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { confirm } = useToast();

  const canManage = hasPermission('video-playlists.manage');

  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo<PlaylistsListParams>(() => {
    return {
      page: Number(searchParams.get('page')) || 1,
      per_page: PER_PAGE,
      search: searchParams.get('search') || '',
      status: (searchParams.get('status') as PlaylistsListParams['status']) || '',
      locale: (searchParams.get('locale') as PlaylistsListParams['locale']) || '',
      sort: (searchParams.get('sort') as PlaylistsListParams['sort']) || '-created_at',
      trashed: (searchParams.get('trashed') as PlaylistsListParams['trashed']) || '',
    };
  }, [searchParams]);

  const q = usePlaylists(params);
  const del = useDeletePlaylist();
  const restore = useRestorePlaylist();
  const forceDel = useForceDeletePlaylist();

  const inTrash = params.trashed === 'only';
  const patch = (p: Partial<PlaylistsListParams>) => {
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

  const onDelete = async (p: VideoPlaylistData) => {
    if (
      await confirm({
        title: t('playlists.confirm.deleteTitle'),
        text: t('playlists.confirm.deleteText', { title: p.title }),
        confirmText: t('playlists.action.delete'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      del.mutate(p.id);
  };
  const onForceDelete = async (p: VideoPlaylistData) => {
    if (
      await confirm({
        title: t('playlists.confirm.forceTitle'),
        text: t('playlists.confirm.forceText', { title: p.title }),
        confirmText: t('playlists.confirm.forceYes'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      forceDel.mutate(p.id);
  };

  const columns: Column<VideoPlaylistData>[] = [
    {
      key: 'title',
      header: t('playlists.col.title'),
      render: (p) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {p.is_featured ? <Star className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" /> : null}
            <p className="truncate font-medium">{p.title}</p>
          </div>
          <p className="truncate text-xs text-muted-foreground">/{p.slug}</p>
        </div>
      ),
    },
    { key: 'status', header: t('playlists.col.status'), render: (p) => <Badge variant={STATUS_TONE[p.status]}>{t(`status.${p.status}`)}</Badge> },
    { key: 'visibility', header: t('playlists.col.visibility'), render: (p) => <Badge variant={VIS_TONE[p.visibility]}>{t(`visibility.${p.visibility}`)}</Badge> },
    {
      key: 'videos',
      header: t('playlists.col.videos'),
      align: 'center',
      render: (p) => (
        <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
          <ListVideo className="h-3.5 w-3.5" />
          {p.videos_count ?? 0}
        </span>
      ),
    },
    { key: 'locale', header: t('playlists.col.locale'), render: (p) => <Badge variant="muted">{p.locale.toUpperCase()}</Badge> },
    {
      key: 'date',
      header: t('playlists.col.date'),
      render: (p) => <span className="whitespace-nowrap text-xs text-muted-foreground">{fmtDate(p.published_at ?? p.created_at, i18n.language)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'end',
      render: (p) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {inTrash ? (
              canManage ? (
                <>
                  <DropdownMenuItem onClick={() => restore.mutate(p.id)}>
                    <ArchiveRestore className="h-4 w-4" />
                    {t('playlists.action.restore')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void onForceDelete(p)} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4" />
                    {t('playlists.action.forceDelete')}
                  </DropdownMenuItem>
                </>
              ) : null
            ) : canManage ? (
              <>
                <DropdownMenuItem onClick={() => navigate(paths.vlPlaylistsEdit.replace(':id', String(p.id)))}>
                  <Pencil className="h-4 w-4" />
                  {t('playlists.action.edit')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void onDelete(p)} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4" />
                  {t('playlists.action.delete')}
                </DropdownMenuItem>
              </>
            ) : null}
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
          <h1 className="text-2xl font-bold">{t('playlists.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('playlists.subtitle')}</p>
        </div>
        {canManage ? (
          <Button onClick={() => navigate(paths.vlPlaylistsCreate)}>
            <Plus className="h-4 w-4" />
            {t('playlists.new')}
          </Button>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-3 border border-border bg-background p-3">
        <SearchInput value={params.search} onDebouncedChange={(v) => patch({ search: v })} placeholder={t('playlists.filter.search')} />
        <select className={selectCls} value={params.status} onChange={(e) => patch({ status: e.target.value as PlaylistsListParams['status'] })}>
          <option value="">{t('playlists.filter.statusAll')}</option>
          <option value="draft">{t('status.draft')}</option>
          <option value="published">{t('status.published')}</option>
          <option value="archived">{t('status.archived')}</option>
        </select>
        <select className={selectCls} value={params.locale} onChange={(e) => patch({ locale: e.target.value as PlaylistsListParams['locale'] })}>
          <option value="">{t('playlists.filter.localeAll')}</option>
          <option value="ar">{t('locale.ar')}</option>
          <option value="en">{t('locale.en')}</option>
        </select>
        <select className={selectCls} value={params.sort} onChange={(e) => patch({ sort: e.target.value as PlaylistsListParams['sort'] })}>
          <option value="-created_at">{t('playlists.filter.sortNewest')}</option>
          <option value="-published_at">{t('playlists.filter.sortPublished')}</option>
          <option value="title">{t('playlists.filter.sortTitle')}</option>
          <option value="sort_order">{t('playlists.filter.sortOrder')}</option>
        </select>
        {canManage ? (
          <select className={selectCls} value={params.trashed} onChange={(e) => patch({ trashed: e.target.value as PlaylistsListParams['trashed'] })}>
            <option value="">{t('playlists.filter.trashedNone')}</option>
            <option value="only">{t('playlists.filter.trashedOnly')}</option>
          </select>
        ) : null}
        {hasFilters ? (
          <Button variant="outline" size="sm" onClick={() => patch({ search: '', status: '', locale: '', sort: '-created_at', trashed: '' })}>
            <X className="h-4 w-4" />
            {t('playlists.filter.reset')}
          </Button>
        ) : null}
      </div>

      {q.isError ? (
        <div className="flex items-center justify-between gap-3 border border-destructive bg-destructive/5 p-4 text-sm">
          <span className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {t('playlists.error')}
          </span>
          <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
            {t('playlists.retry')}
          </Button>
        </div>
      ) : (
        <div className={cn('transition-opacity duration-200', q.isFetching && 'opacity-70')}>
          <DataTable
            columns={columns}
            rows={q.data?.data ?? []}
            rowKey={(p) => p.id}
            loading={q.isLoading}
            emptyTitle={inTrash ? t('playlists.empty.trashTitle') : t('playlists.empty.title')}
            emptyDescription={inTrash ? t('playlists.empty.trashDescription') : t('playlists.empty.description')}
          />
          {q.data ? <Pagination meta={q.data.pagination} onPage={(page) => patch({ page })} /> : null}
        </div>
      )}
    </div>
  );
}
