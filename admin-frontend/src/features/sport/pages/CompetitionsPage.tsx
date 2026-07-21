import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, CircleOff, GripVertical, ListChecks, Plus, Search, Trash2, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/feedback';
import { StatCard } from '@/features/cdn/components/StatCard';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import {
  useCompetitions,
  useDeleteCompetition,
  useUpdateCompetition,
  useToggleCompetitionMatchBar,
  useReorderCompetitionsMatchBar,
} from '../hooks';
import { CompetitionFormModal } from '../components/CompetitionFormModal';
import type { CompetitionData } from '@/types/sport.types';

const COLUMN_COUNT = 8;

/** 🟢 جاهزة (مفعَّلة + عندها مباريات) · 🟡 محدَّدة (مفعَّلة بلا مباريات بعد) · ⚪ غير مفعَّلة. */
function statusOf(c: CompetitionData): { emoji: string; labelKey: string } {
  if (!c.show_in_match_bar) return { emoji: '⚪', labelKey: 'competitions.status.disabled' };
  return c.fixtures_count > 0
    ? { emoji: '🟢', labelKey: 'competitions.status.ready' }
    : { emoji: '🟡', labelKey: 'competitions.status.selected' };
}

/** مفتاح صغير للجدول — نسخة مضغوطة من نمط SwitchField (بلا بطاقة/وصف، لخلية جدول). */
function MiniToggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all',
          checked ? 'start-0.5 translate-x-0 rtl:-translate-x-4 ltr:translate-x-4' : 'start-0.5',
        )}
      />
    </button>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export default function CompetitionsPage() {
  const { t } = useTranslation('sport');
  const { hasPermission } = useAuth();
  const { confirm } = useToast();
  const canManage = hasPermission('competitions.manage');

  const q = useCompetitions();
  const update = useUpdateCompetition();
  const del = useDeleteCompetition();
  const toggleMatchBar = useToggleCompetitionMatchBar();
  const reorderMatchBar = useReorderCompetitionsMatchBar();

  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dragId, setDragId] = useState<number | null>(null);

  const rows = q.data ?? [];

  const stats = useMemo(
    () => ({
      total: rows.length,
      inMatchBar: rows.filter((c) => c.show_in_match_bar).length,
      totalFixtures: rows.reduce((sum, c) => sum + c.fixtures_count, 0),
      withoutFixtures: rows.filter((c) => c.fixtures_count === 0).length,
    }),
    [rows],
  );

  const enabledSorted = useMemo(
    () =>
      rows
        .filter((c) => c.show_in_match_bar)
        .sort((a, b) => (a.match_bar_sort_order ?? 0) - (b.match_bar_sort_order ?? 0)),
    [rows],
  );
  const disabledRows = useMemo(() => rows.filter((c) => !c.show_in_match_bar), [rows]);

  // ترتيب محليّ متفائل للسحب-والإفلات — يُعاد تزامنه من الخادم كلّما تغيّرت البيانات (تفعيل/
  // تعطيل/جلب جديد)، ويُحدَّث فورًا عند الإفلات قبل استجابة الخادم.
  const [orderedEnabledIds, setOrderedEnabledIds] = useState<number[]>([]);
  useEffect(() => {
    setOrderedEnabledIds(enabledSorted.map((c) => c.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const byId = useMemo(() => new Map(rows.map((c) => [c.id, c] as const)), [rows]);
  const orderedEnabled = orderedEnabledIds
    .map((id) => byId.get(id))
    .filter((c): c is CompetitionData => c !== undefined);

  const term = search.trim().toLowerCase();
  const isSearching = term !== '';
  const matches = (c: CompetitionData) =>
    c.name.toLowerCase().includes(term) || c.provider.toLowerCase().includes(term);

  // البحث يعطّل السحب-والإفلات عمداً بدل فلترة قائمة الترتيب جزئيًّا — إعادة ترتيب زوج ظاهر
  // فقط أثناء إخفاء بقيّة المجموعة تنتج مواضع مضلِّلة؛ الأبسط والأصحّ توقّف السحب أثناء الفلترة.
  const visibleEnabled = isSearching ? orderedEnabled.filter(matches) : orderedEnabled;
  const visibleDisabled = isSearching ? disabledRows.filter(matches) : disabledRows;
  const canDrag = canManage && !isSearching;

  const onDelete = async (c: CompetitionData) => {
    if (
      await confirm({
        title: t('competitions.confirm.deleteTitle'),
        text: t('competitions.confirm.deleteText', { name: c.name }),
        confirmText: t('competitions.confirm.yes'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      del.mutate(c.id);
  };

  const onDrop = (overId: number) => {
    if (dragId === null || dragId === overId) return;
    const ids = [...orderedEnabledIds];
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(overId);
    setDragId(null);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setOrderedEnabledIds(ids);
    reorderMatchBar.mutate(ids);
  };

  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('competitions.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('competitions.subtitle')}</p>
        </div>
        {canManage ? (
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('competitions.new')}
          </Button>
        ) : null}
      </header>

      {rows.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Trophy} label={t('competitions.stats.total')} value={stats.total} />
          <StatCard icon={ListChecks} label={t('competitions.stats.inMatchBar')} value={stats.inMatchBar} accent="emerald" />
          <StatCard icon={CalendarDays} label={t('competitions.stats.totalFixtures')} value={stats.totalFixtures} />
          <StatCard
            icon={CircleOff}
            label={t('competitions.stats.withoutFixtures')}
            value={stats.withoutFixtures}
            accent="destructive"
          />
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('competitions.searchPlaceholder')}
            className="h-9 w-full rounded-xl border border-input bg-background ps-9 pe-3 text-sm"
          />
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-border bg-background">
        {q.isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title={t('competitions.empty.title')} description={t('competitions.empty.description')} />
        ) : (
          <table className="w-full min-w-[780px] text-start text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-3 text-start font-medium">{t('competitions.col.inMatchBar')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('competitions.col.sortOrder')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('competitions.col.name')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('competitions.col.coverage')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('competitions.col.lastSynced')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('competitions.col.matches')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('competitions.col.status')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visibleEnabled.length > 0 ? (
                <>
                  <SectionRow label={t('competitions.section.enabled')} />
                  {visibleEnabled.map((c) => (
                    <Row
                      key={c.id}
                      competition={c}
                      canManage={canManage}
                      draggable={canDrag}
                      isDragging={dragId === c.id}
                      onDragStart={() => setDragId(c.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onDrop(c.id)}
                      onDragEnd={() => setDragId(null)}
                      onToggleMatchBar={() => toggleMatchBar.mutate(c.id)}
                      onToggleTracked={(v) => update.mutate({ id: c.id, payload: { is_tracked: v } })}
                      onDelete={() => void onDelete(c)}
                    />
                  ))}
                </>
              ) : null}

              {visibleDisabled.length > 0 ? (
                <>
                  <SectionRow label={t('competitions.section.disabled')} />
                  {visibleDisabled.map((c) => (
                    <Row
                      key={c.id}
                      competition={c}
                      canManage={canManage}
                      draggable={false}
                      isDragging={false}
                      onToggleMatchBar={() => toggleMatchBar.mutate(c.id)}
                      onToggleTracked={(v) => update.mutate({ id: c.id, payload: { is_tracked: v } })}
                      onDelete={() => void onDelete(c)}
                    />
                  ))}
                </>
              ) : null}

              {visibleEnabled.length === 0 && visibleDisabled.length === 0 ? (
                <tr>
                  <td colSpan={COLUMN_COUNT} className="px-4 py-6 text-center text-xs text-muted-foreground">
                    <p>{t('competitions.searchEmpty')}</p>
                    {isSearching ? (
                      <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSearch('')}>
                        {t('competitions.clearSearch')}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>

      <CompetitionFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

function SectionRow({ label }: { label: string }) {
  return (
    <tr className="border-b border-border bg-muted/30">
      <td colSpan={COLUMN_COUNT} className="px-4 py-1.5 text-[11px] font-bold text-muted-foreground">
        {label}
      </td>
    </tr>
  );
}

interface RowProps {
  competition: CompetitionData;
  canManage: boolean;
  draggable: boolean;
  isDragging: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
  onToggleMatchBar: () => void;
  onToggleTracked: (v: boolean) => void;
  onDelete: () => void;
}

function Row({
  competition: c,
  canManage,
  draggable,
  isDragging,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onToggleMatchBar,
  onToggleTracked,
  onDelete,
}: RowProps) {
  const { t } = useTranslation('sport');

  return (
    <tr
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn('border-b border-border last:border-b-0', isDragging && 'opacity-40')}
    >
      <td className="px-4 py-3">
        <MiniToggle checked={c.show_in_match_bar} disabled={!canManage} onChange={onToggleMatchBar} />
      </td>
      <td className="px-4 py-3">
        {draggable ? (
          <span className="flex cursor-grab items-center gap-1.5 text-muted-foreground active:cursor-grabbing">
            <GripVertical className="h-4 w-4" />
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          {c.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.logo_url} alt="" className="h-6 w-6 shrink-0 object-contain" />
          ) : null}
          <div>
            <p className="font-medium">{c.name}</p>
            <p className="text-xs text-muted-foreground" dir="ltr">
              {c.provider} · {c.provider_id}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <MiniToggle checked={c.is_tracked} disabled={!canManage} onChange={onToggleTracked} />
          <Badge variant={c.is_tracked ? 'success' : 'muted'}>
            {c.is_tracked ? t('competitions.coverage.tracked') : t('competitions.coverage.untracked')}
          </Badge>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {c.last_synced_at ? formatDate(c.last_synced_at) : t('competitions.coverage.never')}
      </td>
      <td className="px-4 py-3">
        {c.fixtures_count > 0 ? (
          <span className="text-xs">{c.fixtures_count}</span>
        ) : (
          <Badge variant="muted">{t('competitions.matches.none')}</Badge>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap">
          <span aria-hidden="true">{statusOf(c).emoji}</span>
          {t(statusOf(c).labelKey)}
        </span>
      </td>
      <td className="px-4 py-3">
        {canManage ? (
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label={t('competitions.confirm.yes')}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        ) : null}
      </td>
    </tr>
  );
}
