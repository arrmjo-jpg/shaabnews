import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, Link2, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data/DataTable';
import { Pagination } from '@/components/data/Pagination';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import {
  useAdCreatives,
  useAdPlacements,
  useAdZones,
  useAttachAdPlacement,
  useDetachAdPlacement,
  useUpdateAdPlacement,
} from '../hooks';
import {
  AD_DEVICE_CLASSES,
  isPlacementCompatible,
  type AdCreativeType,
  type AdPlacementData,
  type AdPlacementsListParams,
} from '@/types/advertising.types';

const selectCls =
  'h-10 border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const PER_PAGE = 15;

interface AttachForm {
  ad_creative_id: string;
  ad_zone_id: string;
  weight: string;
  is_active: boolean;
  device_targets: string[];
}
const EMPTY_ATTACH: AttachForm = { ad_creative_id: '', ad_zone_id: '', weight: '', is_active: true, device_targets: [] };

export default function PlacementsPage() {
  const { t } = useTranslation('advertising');
  const { hasPermission } = useAuth();
  const { confirm } = useToast();

  const canCreate = hasPermission('ads.create');
  const canEdit = hasPermission('ads.edit');
  const canDelete = hasPermission('ads.delete');

  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo<AdPlacementsListParams>(() => ({
    page: Number(searchParams.get('page')) || 1,
    per_page: PER_PAGE,
    ad_zone_id: searchParams.get('ad_zone_id') || '',
    ad_creative_id: searchParams.get('ad_creative_id') || '',
    is_active: (searchParams.get('is_active') as AdPlacementsListParams['is_active']) || '',
    sort: searchParams.get('sort') || '-created_at',
  }), [searchParams]);
  const [attach, setAttach] = useState<AttachForm | null>(null);
  const [editing, setEditing] = useState<AdPlacementData | null>(null);
  const [editForm, setEditForm] = useState<{ weight: string; is_active: boolean; device_targets: string[] }>({
    weight: '',
    is_active: true,
    device_targets: [],
  });

  const q = useAdPlacements(params);
  const zonesQ = useAdZones();
  const creativesQ = useAdCreatives({ page: 1, per_page: 100, search: '', ad_campaign_id: '', type: '', is_active: '1', sort: 'title', trashed: '' });
  const attachM = useAttachAdPlacement();
  const updateM = useUpdateAdPlacement();
  const detachM = useDetachAdPlacement();

  const rows = q.data?.data ?? [];
  const zones = zonesQ.data ?? [];
  const creatives = creativesQ.data?.data ?? [];
  const patch = (p: Partial<AdPlacementsListParams>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(p).forEach(([k, v]) => {
      if (v === '' || v == null) next.delete(k);
      else next.set(k, String(v));
    });
    if (p.page === undefined) next.set('page', '1');
    setSearchParams(next);
  };

  // ─── Attach modal compatibility (مرآة AdPlacementCompatibility) ───────────
  const attachCreative = useMemo(
    () => creatives.find((c) => String(c.id) === attach?.ad_creative_id) ?? null,
    [creatives, attach?.ad_creative_id],
  );
  const attachZone = useMemo(
    () => zones.find((z) => String(z.id) === attach?.ad_zone_id) ?? null,
    [zones, attach?.ad_zone_id],
  );
  const compat =
    attachCreative?.type && attachZone?.placement_type
      ? isPlacementCompatible(attachZone.placement_type, attachCreative.type)
      : null;
  const allowedTypes = attachZone?.placement_type
    ? (attachZone.placement_type === 'preroll' ? (['video'] as AdCreativeType[]) : (['image', 'html'] as AdCreativeType[]))
        .map((ty) => t(`creativeType.${ty}`))
        .join('، ')
    : '';

  const toggleDevice = (set: string[], d: string): string[] =>
    set.includes(d) ? set.filter((x) => x !== d) : [...set, d];

  const submitAttach = () => {
    if (!attach || attach.ad_creative_id === '' || attach.ad_zone_id === '' || compat === false) return;
    attachM.mutate(
      {
        ad_creative_id: Number(attach.ad_creative_id),
        ad_zone_id: Number(attach.ad_zone_id),
        weight: attach.weight ? Number(attach.weight) : null,
        is_active: attach.is_active,
        device_targets: attach.device_targets.length > 0 ? attach.device_targets : null,
      },
      { onSuccess: () => setAttach(null) },
    );
  };

  const openEdit = (p: AdPlacementData) => {
    setEditForm({
      weight: p.weight != null ? String(p.weight) : '',
      is_active: p.is_active,
      device_targets: p.device_targets ?? [],
    });
    setEditing(p);
  };
  const submitEdit = () => {
    if (!editing) return;
    updateM.mutate(
      {
        id: editing.id,
        payload: {
          weight: editForm.weight ? Number(editForm.weight) : null,
          is_active: editForm.is_active,
          device_targets: editForm.device_targets.length > 0 ? editForm.device_targets : null,
        },
      },
      { onSuccess: () => setEditing(null) },
    );
  };
  const onDetach = async (p: AdPlacementData) => {
    if (
      await confirm({
        title: t('placements.confirm.detachTitle'),
        text: t('placements.confirm.detachText', { creative: p.creative?.title ?? '#' + p.ad_creative_id, zone: p.zone?.name ?? '#' + p.ad_zone_id }),
        confirmText: t('placements.confirm.detach'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      detachM.mutate(p.id);
  };

  const deviceLabels = (targets: string[] | null): string =>
    !targets || targets.length === 0
      ? t('placements.allDevices')
      : targets.map((d) => t(`deviceClass.${d}`, { defaultValue: d })).join('، ');

  const columns: Column<AdPlacementData>[] = [
    {
      key: 'creative',
      header: t('placements.col.creative'),
      render: (p) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{p.creative?.title ?? '—'}</p>
          {p.creative?.type ? <Badge variant="muted">{t(`creativeType.${p.creative.type}`)}</Badge> : null}
        </div>
      ),
    },
    {
      key: 'zone',
      header: t('placements.col.zone'),
      render: (p) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{p.zone?.name ?? '—'}</p>
          {p.zone?.placement_type ? (
            <span className="text-xs text-muted-foreground">{t(`placementType.${p.zone.placement_type}`)}</span>
          ) : null}
        </div>
      ),
    },
    { key: 'weight', header: t('placements.col.weight'), align: 'center', render: (p) => <span className="tabular-nums text-muted-foreground">{p.effective_weight}</span> },
    { key: 'devices', header: t('placements.col.devices'), render: (p) => <span className="text-xs text-muted-foreground">{deviceLabels(p.device_targets)}</span> },
    { key: 'status', header: t('placements.col.status'), render: (p) => <Badge variant={p.is_active ? 'success' : 'muted'}>{t(p.is_active ? 'active' : 'inactive')}</Badge> },
    ...(canEdit || canDelete
      ? [
          {
            key: 'actions',
            header: '',
            align: 'end',
            render: (p: AdPlacementData) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canEdit ? (
                    <DropdownMenuItem onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                      {t('placements.action.edit')}
                    </DropdownMenuItem>
                  ) : null}
                  {canDelete ? (
                    <DropdownMenuItem onClick={() => void onDetach(p)} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-4 w-4" />
                      {t('placements.action.detach')}
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          } as Column<AdPlacementData>,
        ]
      : []),
  ];

  const hasFilters = Boolean(params.ad_zone_id || params.ad_creative_id || params.is_active);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('placements.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('placements.subtitle')}</p>
        </div>
        {canCreate ? (
          <Button onClick={() => setAttach(EMPTY_ATTACH)}>
            <Link2 className="h-4 w-4" />
            {t('placements.new')}
          </Button>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-3 border border-border bg-background p-3">
        <select className={selectCls} value={params.ad_zone_id} onChange={(e) => patch({ ad_zone_id: e.target.value })}>
          <option value="">{t('placements.filter.zoneAll')}</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
        <select className={selectCls} value={params.ad_creative_id} onChange={(e) => patch({ ad_creative_id: e.target.value })}>
          <option value="">{t('placements.filter.creativeAll')}</option>
          {creatives.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <select className={selectCls} value={params.is_active} onChange={(e) => patch({ is_active: e.target.value as AdPlacementsListParams['is_active'] })}>
          <option value="">{t('placements.filter.activeAll')}</option>
          <option value="1">{t('placements.filter.activeOnly')}</option>
          <option value="0">{t('placements.filter.inactiveOnly')}</option>
        </select>
        {hasFilters ? (
          <Button variant="outline" size="sm" onClick={() => patch({ ad_zone_id: '', ad_creative_id: '', is_active: '' })}>
            <X className="h-4 w-4" />
            {t('placements.filter.reset')}
          </Button>
        ) : null}
      </div>

      {q.isError ? (
        <div className="flex items-center justify-between gap-3 border border-destructive bg-destructive/5 p-4 text-sm">
          <span className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {t('placements.error')}
          </span>
          <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
            {t('placements.retry')}
          </Button>
        </div>
      ) : (
        <div className={cn('transition-opacity duration-200', q.isFetching && 'opacity-70')}>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(p) => p.id}
            loading={q.isLoading}
            emptyTitle={t('placements.empty.title')}
            emptyDescription={t('placements.empty.description')}
          />
          {q.data ? <Pagination meta={q.data.pagination} onPage={(page) => patch({ page })} /> : null}
        </div>
      )}

      {/* Attach modal */}
      <Modal
        open={attach !== null}
        onClose={() => setAttach(null)}
        title={t('placements.attach.title')}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setAttach(null)}>
              {t('common.cancel', { ns: 'common' })}
            </Button>
            <Button
              onClick={submitAttach}
              disabled={!attach || attach.ad_creative_id === '' || attach.ad_zone_id === '' || compat === false || attachM.isPending}
            >
              {t('placements.attach.submit')}
            </Button>
          </>
        }
      >
        {attach ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('placements.attach.creative')}</label>
              <select className={cn(selectCls, 'w-full')} value={attach.ad_creative_id} onChange={(e) => setAttach({ ...attach, ad_creative_id: e.target.value })}>
                <option value="">{t('placements.attach.creativePlaceholder')}</option>
                {creatives.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} · {c.type ? t(`creativeType.${c.type}`) : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('placements.attach.zone')}</label>
              <select className={cn(selectCls, 'w-full')} value={attach.ad_zone_id} onChange={(e) => setAttach({ ...attach, ad_zone_id: e.target.value })}>
                <option value="">{t('placements.attach.zonePlaceholder')}</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} · {z.placement_type ? t(`placementType.${z.placement_type}`) : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* مؤشّر التوافق (config-time) — يُعرَض بوضوح ويمنع الإرسال عند عدم التوافق. */}
            {compat === true ? (
              <p className="flex items-center gap-1.5 border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-xs text-emerald-700 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                {t('placements.attach.compatible')}
              </p>
            ) : compat === false ? (
              <p className="flex items-center gap-1.5 border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t('placements.attach.incompatible', { zone: attachZone?.name ?? '', allowed: allowedTypes })}
              </p>
            ) : attachZone ? (
              <p className="text-xs text-muted-foreground">{t('placements.attach.allowedTypes', { allowed: allowedTypes })}</p>
            ) : null}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('placements.weight')}</label>
              <input type="number" min={1} value={attach.weight} onChange={(e) => setAttach({ ...attach, weight: e.target.value })} className={cn(selectCls, 'w-full')} />
              <p className="text-xs text-muted-foreground">{t('placements.weightHint')}</p>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">{t('placements.devices')}</p>
              <div className="flex flex-wrap gap-2">
                {AD_DEVICE_CLASSES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setAttach({ ...attach, device_targets: toggleDevice(attach.device_targets, d) })}
                    className={cn(
                      'border px-3 py-1.5 text-xs transition-colors',
                      attach.device_targets.includes(d) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground',
                    )}
                  >
                    {t(`deviceClass.${d}`, { defaultValue: d })}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{t('placements.devicesHint')}</p>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Edit modal */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={t('placements.edit.title')}
        description={editing?.creative?.title}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t('common.cancel', { ns: 'common' })}
            </Button>
            <Button onClick={submitEdit} disabled={updateM.isPending}>
              {t('common.save', { ns: 'common' })}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('placements.weight')}</label>
            <input type="number" min={1} value={editForm.weight} onChange={(e) => setEditForm((f) => ({ ...f, weight: e.target.value }))} className={cn(selectCls, 'w-full')} />
            <p className="text-xs text-muted-foreground">{t('placements.weightHint')}</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t('placements.devices')}</p>
            <div className="flex flex-wrap gap-2">
              {AD_DEVICE_CLASSES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setEditForm((f) => ({ ...f, device_targets: toggleDevice(f.device_targets, d) }))}
                  className={cn(
                    'border px-3 py-1.5 text-xs transition-colors',
                    editForm.device_targets.includes(d) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground',
                  )}
                >
                  {t(`deviceClass.${d}`, { defaultValue: d })}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t('placements.devicesHint')}</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))} className="h-4 w-4 accent-primary" />
            {t('placements.isActive')}
          </label>
        </div>
      </Modal>
    </div>
  );
}
