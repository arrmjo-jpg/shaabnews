import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArchiveRestore, MoreHorizontal, Pencil, Plus, Repeat, Trash2, X } from 'lucide-react';
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
import { DataTable, type Column } from '@/components/data/DataTable';
import { Pagination } from '@/components/data/Pagination';
import { SearchInput } from '@/components/data/SearchInput';
import { cn } from '@/lib/utils';
import { paths } from '@/router/paths';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import {
  useAdCampaigns,
  useDeleteAdCampaign,
  useForceDeleteAdCampaign,
  useRestoreAdCampaign,
  useTransitionAdCampaign,
} from '../hooks';
import {
  AD_CAMPAIGN_STATUSES,
  AD_CAMPAIGN_TRANSITIONS,
  AD_PACING_MODES,
  type AdCampaignData,
  type AdCampaignsListParams,
  type AdCampaignStatus,
} from '@/types/advertising.types';

const selectCls =
  'h-10 border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const PER_PAGE = 15;

const STATUS_TONE: Record<AdCampaignStatus, 'default' | 'success' | 'muted'> = {
  draft: 'muted',
  scheduled: 'default',
  active: 'success',
  paused: 'muted',
  completed: 'muted',
  archived: 'muted',
};

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function CampaignsPage() {
  const { t, i18n } = useTranslation('advertising');
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { confirm } = useToast();

  const canCreate = hasPermission('ads.create');
  const canEdit = hasPermission('ads.edit');
  const canPublish = hasPermission('ads.publish');
  const canDelete = hasPermission('ads.delete');
  const canRestore = hasPermission('ads.restore');
  const canForceDelete = hasPermission('ads.force_delete');
  const canSeeTrash = canRestore || canForceDelete;

  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo<AdCampaignsListParams>(() => ({
    page: Number(searchParams.get('page')) || 1,
    per_page: PER_PAGE,
    search: searchParams.get('search') || '',
    status: (searchParams.get('status') as AdCampaignsListParams['status']) || '',
    pacing_mode: (searchParams.get('pacing_mode') as AdCampaignsListParams['pacing_mode']) || '',
    sort: searchParams.get('sort') || '-created_at',
    trashed: (searchParams.get('trashed') as AdCampaignsListParams['trashed']) || '',
  }), [searchParams]);

  const q = useAdCampaigns(params);
  const del = useDeleteAdCampaign();
  const restore = useRestoreAdCampaign();
  const forceDel = useForceDeleteAdCampaign();
  const transition = useTransitionAdCampaign();

  const inTrash = params.trashed === 'only';
  const rows = q.data?.data ?? [];
  const patch = (p: Partial<AdCampaignsListParams>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(p).forEach(([k, v]) => {
      if (v === '' || v == null) next.delete(k);
      else next.set(k, String(v));
    });
    if (p.page === undefined) next.set('page', '1');
    setSearchParams(next);
  };

  /** التفعيل اليدوي ممنوع بعد انتهاء النافذة (مرآة AdCampaignLifecycle::canActivateNow). */
  const canActivate = (c: AdCampaignData) => !c.ends_at || new Date(c.ends_at).getTime() >= Date.now();

  const onTransition = async (c: AdCampaignData, to: AdCampaignStatus) => {
    if (
      await confirm({
        title: t('campaigns.confirm.transitionTitle'),
        text: t('campaigns.confirm.transitionText', { name: c.name, status: t(`campaignStatus.${to}`) }),
        confirmText: t('campaigns.confirm.transition'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      transition.mutate({ id: c.id, status: to });
  };
  const onDelete = async (c: AdCampaignData) => {
    if (
      await confirm({
        title: t('campaigns.confirm.deleteTitle'),
        text: t('campaigns.confirm.deleteText', { name: c.name }),
        confirmText: t('campaigns.confirm.delete'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      del.mutate(c.id);
  };
  const onForceDelete = async (c: AdCampaignData) => {
    if (
      await confirm({
        title: t('campaigns.confirm.forceTitle'),
        text: t('campaigns.confirm.forceText', { name: c.name }),
        confirmText: t('campaigns.confirm.forceYes'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      forceDel.mutate(c.id);
  };

  const columns: Column<AdCampaignData>[] = [
    {
      key: 'name',
      header: t('campaigns.col.name'),
      render: (c) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{c.name}</p>
          {c.advertiser_name ? <p className="truncate text-xs text-muted-foreground">{c.advertiser_name}</p> : null}
        </div>
      ),
    },
    {
      key: 'status',
      header: t('campaigns.col.status'),
      render: (c) => (c.status ? <Badge variant={STATUS_TONE[c.status]}>{t(`campaignStatus.${c.status}`)}</Badge> : '—'),
    },
    {
      key: 'window',
      header: t('campaigns.col.window'),
      render: (c) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {!c.starts_at && !c.ends_at
            ? t('campaigns.noWindow')
            : `${fmtDate(c.starts_at, i18n.language)} – ${fmtDate(c.ends_at, i18n.language)}`}
        </span>
      ),
    },
    {
      key: 'priority',
      header: t('campaigns.col.priority'),
      align: 'center',
      render: (c) => <span className="tabular-nums text-muted-foreground">{c.priority}</span>,
    },
    {
      key: 'creatives',
      header: t('campaigns.col.creatives'),
      align: 'center',
      render: (c) => <span className="tabular-nums text-muted-foreground">{c.creatives_count ?? 0}</span>,
    },
    {
      key: 'date',
      header: t('campaigns.col.date'),
      render: (c) => <span className="whitespace-nowrap text-xs text-muted-foreground">{fmtDate(c.created_at, i18n.language)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'end',
      render: (c) => {
        const targets = c.status ? AD_CAMPAIGN_TRANSITIONS[c.status] : [];
        return (
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
                    <DropdownMenuItem onClick={() => restore.mutate(c.id)}>
                      <ArchiveRestore className="h-4 w-4" />
                      {t('campaigns.action.restore')}
                    </DropdownMenuItem>
                  ) : null}
                  {canForceDelete ? (
                    <DropdownMenuItem onClick={() => void onForceDelete(c)} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-4 w-4" />
                      {t('campaigns.action.forceDelete')}
                    </DropdownMenuItem>
                  ) : null}
                </>
              ) : (
                <>
                  {canEdit ? (
                    <DropdownMenuItem onClick={() => navigate(paths.adCampaignsEdit.replace(':id', String(c.id)))}>
                      <Pencil className="h-4 w-4" />
                      {t('campaigns.action.edit')}
                    </DropdownMenuItem>
                  ) : null}
                  {canPublish && targets.length > 0 ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>{t('campaigns.lifecycle.moveTo')}</DropdownMenuLabel>
                      {targets
                        .filter((to) => to !== 'active' || canActivate(c))
                        .map((to) => (
                          <DropdownMenuItem key={to} onClick={() => void onTransition(c, to)}>
                            <Repeat className="h-4 w-4" />
                            {t(`campaignStatus.${to}`)}
                          </DropdownMenuItem>
                        ))}
                    </>
                  ) : null}
                  {canDelete ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => void onDelete(c)} className="text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4" />
                        {t('campaigns.action.delete')}
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const hasFilters = Boolean(params.search || params.status || params.pacing_mode || params.trashed);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('campaigns.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('campaigns.subtitle')}</p>
        </div>
        {canCreate ? (
          <Button onClick={() => navigate(paths.adCampaignsCreate)}>
            <Plus className="h-4 w-4" />
            {t('campaigns.new')}
          </Button>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-3 border border-border bg-background p-3">
        <SearchInput
          value={params.search}
          onDebouncedChange={(v) => patch({ search: v })}
          placeholder={t('campaigns.filter.search')}
        />
        <select
          className={selectCls}
          value={params.status}
          onChange={(e) => patch({ status: e.target.value as AdCampaignsListParams['status'] })}
        >
          <option value="">{t('campaigns.filter.statusAll')}</option>
          {AD_CAMPAIGN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`campaignStatus.${s}`)}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={params.pacing_mode}
          onChange={(e) => patch({ pacing_mode: e.target.value as AdCampaignsListParams['pacing_mode'] })}
        >
          <option value="">{t('campaigns.filter.pacingAll')}</option>
          {AD_PACING_MODES.map((p) => (
            <option key={p} value={p}>
              {t(`pacingMode.${p}`)}
            </option>
          ))}
        </select>
        <select className={selectCls} value={params.sort} onChange={(e) => patch({ sort: e.target.value })}>
          <option value="-created_at">{t('campaigns.filter.sortNewest')}</option>
          <option value="name">{t('campaigns.filter.sortName')}</option>
          <option value="-priority">{t('campaigns.filter.sortPriority')}</option>
        </select>
        {canSeeTrash ? (
          <select
            className={selectCls}
            value={params.trashed}
            onChange={(e) => patch({ trashed: e.target.value as AdCampaignsListParams['trashed'] })}
          >
            <option value="">{t('campaigns.filter.trashedNone')}</option>
            <option value="only">{t('campaigns.filter.trashedOnly')}</option>
          </select>
        ) : null}
        {hasFilters ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => patch({ search: '', status: '', pacing_mode: '', sort: '-created_at', trashed: '' })}
          >
            <X className="h-4 w-4" />
            {t('campaigns.filter.reset')}
          </Button>
        ) : null}
      </div>

      {q.isError ? (
        <div className="flex items-center justify-between gap-3 border border-destructive bg-destructive/5 p-4 text-sm">
          <span className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {t('campaigns.error')}
          </span>
          <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
            {t('campaigns.retry')}
          </Button>
        </div>
      ) : (
        <div className={cn('transition-opacity duration-200', q.isFetching && 'opacity-70')}>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(c) => c.id}
            loading={q.isLoading}
            emptyTitle={inTrash ? t('campaigns.empty.trashTitle') : t('campaigns.empty.title')}
            emptyDescription={inTrash ? t('campaigns.empty.trashDescription') : t('campaigns.empty.description')}
          />
          {q.data ? <Pagination meta={q.data.pagination} onPage={(page) => patch({ page })} /> : null}
        </div>
      )}
    </div>
  );
}
