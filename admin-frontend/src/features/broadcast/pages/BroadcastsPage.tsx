import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Archive,
  Ban,
  BarChart3,
  CalendarClock,
  DoorClosed,
  DoorOpen,
  Eye,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Radio,
  RadioTower,
  ShieldAlert,
  Square,
  Star,
  Trash2,
  Tv,
  UserX,
  WifiOff,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { DataTable, type Column } from '@/components/data/DataTable';
import { Pagination } from '@/components/data/Pagination';
import { SearchInput } from '@/components/data/SearchInput';
import { cn } from '@/lib/utils';
import { paths } from '@/router/paths';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import {
  useBroadcastCategories,
  useBroadcastLifecycle,
  useBroadcastModeration,
  useBroadcasts,
  useDeleteBroadcast,
} from '../hooks';
import { LIFECYCLE_TRANSITIONS } from '../lifecycle';
import { BroadcastModerationModal } from '../components/BroadcastModerationModal';
import type {
  BroadcastData,
  BroadcastKind,
  BroadcastLifecycleAction,
  BroadcastSourceType,
  BroadcastsListParams,
  BroadcastStatus,
} from '@/types/broadcast.types';

const selectCls =
  'h-10 border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const PER_PAGE = 15;

const SOURCE_TYPES: BroadcastSourceType[] = ['hls', 'iptv', 'youtube_live', 'external_provider', 'icecast', 'shoutcast'];
const KINDS: BroadcastKind[] = ['live', 'tv', 'radio'];

const STATUS_TONE: Record<BroadcastStatus, 'default' | 'success' | 'muted' | 'destructive'> = {
  draft: 'muted',
  scheduled: 'muted',
  live: 'success',
  offline: 'muted',
  ended: 'muted',
  failed: 'destructive',
  archived: 'muted',
};

const HEALTH_TONE: Record<string, 'success' | 'muted' | 'destructive'> = {
  healthy: 'success',
  online: 'success',
  up: 'success',
  degraded: 'muted',
  unknown: 'muted',
  down: 'destructive',
  failed: 'destructive',
  offline: 'destructive',
};

const LIFECYCLE_ICON: Record<BroadcastLifecycleAction, typeof Play> = {
  schedule: CalendarClock,
  start: Play,
  offline: WifiOff,
  resume: Play,
  end: Square,
  fail: AlertTriangle,
  archive: Archive,
};

const KIND_ICON: Record<BroadcastKind, typeof Tv> = {
  live: RadioTower,
  tv: Tv,
  radio: Radio,
};

function fmtDateTime(iso: string | null, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BroadcastsPage() {
  const { t, i18n } = useTranslation('broadcast');
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { confirm } = useToast();

  const canCreate = hasPermission('broadcasts.create');
  const canEdit = hasPermission('broadcasts.edit');
  const canDelete = hasPermission('broadcasts.delete');
  const canSchedule = hasPermission('broadcasts.schedule');
  const canControl = hasPermission('broadcasts.control');
  const canArchive = hasPermission('broadcasts.archive');
  const canAudience = hasPermission('broadcasts.audience_control');
  const canEmergency = hasPermission('broadcasts.emergency_shutdown');
  const canKick = hasPermission('broadcasts.viewer_control');
  const canBan = hasPermission('broadcasts.viewer_ban');

  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo<BroadcastsListParams>(() => {
    const catRaw = searchParams.get('category_id');
    return {
      page: Number(searchParams.get('page')) || 1,
      per_page: PER_PAGE,
      search: searchParams.get('search') || '',
      status: (searchParams.get('status') as BroadcastsListParams['status']) || '',
      kind: (searchParams.get('kind') as BroadcastsListParams['kind']) || '',
      source_type: (searchParams.get('source_type') as BroadcastsListParams['source_type']) || '',
      category_id: catRaw ? Number(catRaw) : '',
      is_featured: (searchParams.get('is_featured') as BroadcastsListParams['is_featured']) || '',
      is_public: (searchParams.get('is_public') as BroadcastsListParams['is_public']) || '',
      sort: (searchParams.get('sort') as BroadcastsListParams['sort']) || '-created_at',
      trashed: (searchParams.get('trashed') as BroadcastsListParams['trashed']) || '',
    };
  }, [searchParams]);

  const [scheduling, setScheduling] = useState<BroadcastData | null>(null);
  const [scheduleAt, setScheduleAt] = useState('');
  const [failing, setFailing] = useState<BroadcastData | null>(null);
  const [failReason, setFailReason] = useState('');
  const [modTarget, setModTarget] = useState<{ broadcast: BroadcastData; mode: 'kick' | 'ban' } | null>(null);

  const q = useBroadcasts(params);
  const catQ = useBroadcastCategories();
  const del = useDeleteBroadcast();
  const lifecycle = useBroadcastLifecycle();
  const moderation = useBroadcastModeration();

  const inTrash = params.trashed === 'only';
  const rows = q.data?.data ?? [];
  const categories = catQ.data ?? [];

  const patch = (p: Partial<BroadcastsListParams>) => {
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
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // ─── Lifecycle handlers ───────────────────────────────────────────────────
  const runLifecycle = (b: BroadcastData, action: BroadcastLifecycleAction) => {
    if (action === 'schedule') {
      setScheduleAt('');
      setScheduling(b);
      return;
    }
    if (action === 'fail') {
      setFailReason('');
      setFailing(b);
      return;
    }
    void (async () => {
      if (
        await confirm({
          title: t(`confirm.${action}Title`),
          text: t(`confirm.${action}Text`, { title: b.title }),
          confirmText: t(`action.${action}`),
          cancelText: t('common.cancel', { ns: 'common' }),
        })
      )
        lifecycle.mutate({ id: b.id, action });
    })();
  };

  const submitSchedule = () => {
    if (!scheduling || !scheduleAt) return;
    lifecycle.mutate(
      { id: scheduling.id, action: 'schedule', body: { scheduled_at: new Date(scheduleAt).toISOString() } },
      { onSuccess: () => setScheduling(null) },
    );
  };
  const submitFail = () => {
    if (!failing) return;
    lifecycle.mutate(
      { id: failing.id, action: 'fail', body: failReason.trim() ? { reason: failReason.trim() } : undefined },
      { onSuccess: () => setFailing(null) },
    );
  };

  const onDelete = async (b: BroadcastData) => {
    if (
      await confirm({
        title: t('confirm.deleteTitle'),
        text: t('confirm.deleteText', { title: b.title }),
        confirmText: t('action.delete'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      del.mutate(b.id);
  };

  const onToggleAudience = async (b: BroadcastData, close: boolean) => {
    if (
      await confirm({
        title: close ? t('confirm.closeTitle') : t('confirm.reopenTitle'),
        text: close ? t('confirm.closeText', { title: b.title }) : t('confirm.reopenText', { title: b.title }),
        confirmText: close ? t('moderation.close') : t('moderation.reopen'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      moderation.mutate({ id: b.id, action: close ? 'close' : 'reopen' });
  };
  const onEmergency = async (b: BroadcastData) => {
    if (
      await confirm({
        title: t('confirm.emergencyTitle'),
        text: t('confirm.emergencyText', { title: b.title }),
        confirmText: t('moderation.emergency'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      moderation.mutate({ id: b.id, action: 'emergency-shutdown' });
  };

  // permission gate for a given lifecycle action.
  const canDoLifecycle = (action: BroadcastLifecycleAction): boolean => {
    if (action === 'schedule') return canSchedule;
    if (action === 'archive') return canArchive;
    return canControl; // start/offline/resume/end/fail
  };

  const isLiveish = (b: BroadcastData) => b.status === 'live' || b.status === 'offline';
  const hasModeration = canKick || canBan || canAudience || canEmergency;

  const columns: Column<BroadcastData>[] = [
    {
      key: 'title',
      header: t('col.title'),
      render: (b) => {
        const Icon = KIND_ICON[b.kind];
        return (
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-muted text-muted-foreground">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {b.is_featured ? <Star className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" aria-label={t('col.featured')} /> : null}
                <p className="truncate font-medium">{b.title}</p>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {b.category?.name ?? t('col.noCategory')} · /{b.slug}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'kind',
      header: t('col.kind'),
      render: (b) => <Badge variant="muted">{t(`kind.${b.kind}`)}</Badge>,
    },
    {
      key: 'status',
      header: t('col.status'),
      render: (b) => (
        <div className="space-y-1">
          <Badge variant={STATUS_TONE[b.status]}>{t(`status.${b.status}`)}</Badge>
          {b.status === 'scheduled' && b.scheduled_at ? (
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <CalendarClock className="h-3 w-3" />
              {fmtDateTime(b.scheduled_at, i18n.language)}
            </p>
          ) : null}
          {!b.is_public ? <Badge variant="muted" className="ms-0">{t('col.private')}</Badge> : null}
        </div>
      ),
    },
    {
      key: 'source',
      header: t('col.source'),
      render: (b) => <Badge variant="muted">{t(`source.${b.source_type}`)}</Badge>,
    },
    {
      key: 'health',
      header: t('col.health'),
      render: (b) =>
        b.health.status ? (
          <Badge variant={HEALTH_TONE[b.health.status] ?? 'muted'}>
            {t(`health.status.${b.health.status}`, { defaultValue: b.health.status })}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">{t('health.unknown')}</span>
        ),
    },
    {
      key: 'viewers',
      header: t('col.viewers'),
      align: 'center',
      render: (b) => (
        <span className="flex items-center justify-center gap-1 text-xs tabular-nums text-muted-foreground">
          <Eye className="h-3.5 w-3.5" />
          {b.viewer_count.toLocaleString(i18n.language)}
        </span>
      ),
    },
    {
      key: 'date',
      header: t('col.scheduled'),
      render: (b) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {fmtDateTime(b.scheduled_at ?? b.started_at ?? b.created_at, i18n.language)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'end',
      render: (b) => {
        const transitions = LIFECYCLE_TRANSITIONS[b.status].filter(canDoLifecycle);
        const showAny = inTrash ? false : canEdit || transitions.length > 0 || hasModeration || canDelete;
        if (!showAny) return null;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit ? (
                <DropdownMenuItem onClick={() => navigate(paths.bcBroadcastsEdit.replace(':id', String(b.id)))}>
                  <Pencil className="h-4 w-4" />
                  {t('action.edit')}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={() => navigate(paths.bcBroadcastAnalytics.replace(':id', String(b.id)))}>
                <BarChart3 className="h-4 w-4" />
                {t('action.analytics')}
              </DropdownMenuItem>

              {transitions.length > 0 ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>{t('action.lifecycle')}</DropdownMenuLabel>
                  {transitions.map((action) => {
                    const Icon = LIFECYCLE_ICON[action];
                    return (
                      <DropdownMenuItem
                        key={action}
                        onClick={() => runLifecycle(b, action)}
                        className={action === 'fail' ? 'text-destructive focus:text-destructive' : undefined}
                      >
                        <Icon className="h-4 w-4" />
                        {t(`action.${action}`)}
                      </DropdownMenuItem>
                    );
                  })}
                </>
              ) : null}

              {hasModeration && isLiveish(b) ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>{t('action.moderation')}</DropdownMenuLabel>
                  {canKick ? (
                    <DropdownMenuItem onClick={() => setModTarget({ broadcast: b, mode: 'kick' })}>
                      <UserX className="h-4 w-4" />
                      {t('moderation.kick')}
                    </DropdownMenuItem>
                  ) : null}
                  {canBan ? (
                    <DropdownMenuItem onClick={() => setModTarget({ broadcast: b, mode: 'ban' })}>
                      <Ban className="h-4 w-4" />
                      {t('moderation.ban')}
                    </DropdownMenuItem>
                  ) : null}
                  {canAudience ? (
                    <DropdownMenuItem onClick={() => void onToggleAudience(b, true)}>
                      <DoorClosed className="h-4 w-4" />
                      {t('moderation.close')}
                    </DropdownMenuItem>
                  ) : null}
                  {canAudience ? (
                    <DropdownMenuItem onClick={() => void onToggleAudience(b, false)}>
                      <DoorOpen className="h-4 w-4" />
                      {t('moderation.reopen')}
                    </DropdownMenuItem>
                  ) : null}
                  {canEmergency ? (
                    <DropdownMenuItem onClick={() => void onEmergency(b)} className="text-destructive focus:text-destructive">
                      <ShieldAlert className="h-4 w-4" />
                      {t('moderation.emergency')}
                    </DropdownMenuItem>
                  ) : null}
                </>
              ) : null}

              {canDelete ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void onDelete(b)} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4" />
                    {t('action.delete')}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const hasFilters = Boolean(
    params.search ||
      params.status ||
      params.kind ||
      params.source_type ||
      params.category_id !== '' ||
      params.is_featured ||
      params.is_public ||
      params.trashed,
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('broadcasts.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('broadcasts.subtitle')}</p>
        </div>
        {canCreate ? (
          <Button onClick={() => navigate(paths.bcBroadcastsCreate)}>
            <Plus className="h-4 w-4" />
            {t('broadcasts.new')}
          </Button>
        ) : null}
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 border border-border bg-background p-3">
        <SearchInput
          value={params.search}
          onDebouncedChange={(v) => patch({ search: v })}
          placeholder={t('filter.search')}
        />
        <select className={selectCls} value={params.status} onChange={(e) => patch({ status: e.target.value as BroadcastsListParams['status'] })}>
          <option value="">{t('filter.statusAll')}</option>
          {(['draft', 'scheduled', 'live', 'offline', 'ended', 'failed', 'archived'] as BroadcastStatus[]).map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
        <select className={selectCls} value={params.kind} onChange={(e) => patch({ kind: e.target.value as BroadcastsListParams['kind'] })}>
          <option value="">{t('filter.kindAll')}</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`kind.${k}`)}
            </option>
          ))}
        </select>
        <select className={selectCls} value={params.source_type} onChange={(e) => patch({ source_type: e.target.value as BroadcastsListParams['source_type'] })}>
          <option value="">{t('filter.sourceAll')}</option>
          {SOURCE_TYPES.map((s) => (
            <option key={s} value={s}>
              {t(`source.${s}`)}
            </option>
          ))}
        </select>
        <select className={selectCls} value={params.is_public} onChange={(e) => patch({ is_public: e.target.value as BroadcastsListParams['is_public'] })}>
          <option value="">{t('filter.visibilityAll')}</option>
          <option value="1">{t('filter.public')}</option>
          <option value="0">{t('filter.private')}</option>
        </select>
        <select className={selectCls} value={params.is_featured} onChange={(e) => patch({ is_featured: e.target.value as BroadcastsListParams['is_featured'] })}>
          <option value="">{t('filter.featuredAll')}</option>
          <option value="1">{t('filter.featuredOnly')}</option>
          <option value="0">{t('filter.notFeatured')}</option>
        </select>
        <select
          className={selectCls}
          value={params.category_id === '' ? '' : String(params.category_id)}
          onChange={(e) => patch({ category_id: e.target.value === '' ? '' : Number(e.target.value) })}
        >
          <option value="">{t('filter.categoryAll')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className={selectCls} value={params.sort} onChange={(e) => patch({ sort: e.target.value as BroadcastsListParams['sort'] })}>
          <option value="-created_at">{t('filter.sortNewest')}</option>
          <option value="-scheduled_at">{t('filter.sortScheduled')}</option>
          <option value="-started_at">{t('filter.sortStarted')}</option>
          <option value="title">{t('filter.sortTitle')}</option>
          <option value="sort_order">{t('filter.sortOrder')}</option>
        </select>
        <select className={selectCls} value={params.trashed} onChange={(e) => patch({ trashed: e.target.value as BroadcastsListParams['trashed'] })}>
          <option value="">{t('filter.trashedNone')}</option>
          <option value="only">{t('filter.trashedOnly')}</option>
        </select>
        {hasFilters ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              patch({
                search: '',
                status: '',
                kind: '',
                source_type: '',
                category_id: '',
                is_featured: '',
                is_public: '',
                sort: '-created_at',
                trashed: '',
              })
            }
          >
            <X className="h-4 w-4" />
            {t('filter.reset')}
          </Button>
        ) : null}
      </div>

      {/* Error state */}
      {q.isError ? (
        <div className="flex items-center justify-between gap-3 border border-destructive bg-destructive/5 p-4 text-sm">
          <span className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {t('broadcasts.error')}
          </span>
          <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
            {t('broadcasts.retry')}
          </Button>
        </div>
      ) : (
        <div className={cn('transition-opacity duration-200', q.isFetching && 'opacity-70')}>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(b) => b.id}
            loading={q.isLoading}
            emptyTitle={inTrash ? t('empty.trashTitle') : t('empty.title')}
            emptyDescription={inTrash ? t('empty.trashDescription') : t('empty.description')}
          />
          {q.data ? <Pagination meta={q.data.pagination} onPage={(page) => patch({ page })} /> : null}
        </div>
      )}

      {/* Schedule modal */}
      <Modal
        open={scheduling !== null}
        onClose={() => setScheduling(null)}
        title={t('schedule.title')}
        description={scheduling?.title}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setScheduling(null)}>
              {t('common.cancel', { ns: 'common' })}
            </Button>
            <Button onClick={submitSchedule} disabled={!scheduleAt || lifecycle.isPending}>
              {t('schedule.submit')}
            </Button>
          </>
        }
      >
        <label className="block text-sm font-medium">{t('schedule.label')}</label>
        <input
          type="datetime-local"
          value={scheduleAt}
          onChange={(e) => setScheduleAt(e.target.value)}
          className={cn(selectCls, 'mt-2 w-full')}
        />
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium">
          <CalendarClock className="h-3.5 w-3.5" />
          {t('schedule.tz', { tz })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{t('schedule.hint')}</p>
      </Modal>

      {/* Fail reason modal */}
      <Modal
        open={failing !== null}
        onClose={() => setFailing(null)}
        title={t('failModal.title')}
        description={failing?.title}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setFailing(null)}>
              {t('common.cancel', { ns: 'common' })}
            </Button>
            <Button className="text-destructive" onClick={submitFail} disabled={lifecycle.isPending}>
              {t('action.fail')}
            </Button>
          </>
        }
      >
        <label className="block text-sm font-medium">{t('failModal.reasonLabel')}</label>
        <Input value={failReason} onChange={(e) => setFailReason(e.target.value)} placeholder={t('failModal.reasonPlaceholder')} className="mt-2" />
        <p className="mt-1 text-xs text-muted-foreground">{t('failModal.hint')}</p>
      </Modal>

      {/* Moderation (kick/ban) modal */}
      <BroadcastModerationModal
        open={modTarget !== null}
        onClose={() => setModTarget(null)}
        mode={modTarget?.mode ?? 'kick'}
        broadcast={modTarget?.broadcast ?? null}
      />
    </div>
  );
}
