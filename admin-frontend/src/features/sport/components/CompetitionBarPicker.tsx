import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical, Search, Trophy } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { CompetitionData } from '@/types/sport.types';

interface CompetitionBarPickerProps {
  competitions: CompetitionData[];
  isLoading: boolean;
  canManage: boolean;
  isSelected: (c: CompetitionData) => boolean;
  sortOrder: (c: CompetitionData) => number | null;
  onToggle: (id: number) => void;
  onReorder: (ids: number[]) => void;
}

/**
 * منتقي بطولات "شريط" (بحث + بطاقات مقسَّمة مفعَّلة/معطَّلة + سحب-وإفلات للمفعَّلة فقط) — مشترك
 * بين Match Bar وSports Home Bar وأيّ شريط مماثل لاحقًا. لا يعرف الميزة المستضيفة شيئًا عنها؛
 * isSelected/sortOrder/onToggle/onReorder هي كامل نقطة التخصيص. البحث يعطّل السحب-والإفلات عمداً
 * بدل فلترة قائمة الترتيب جزئيًّا — إعادة ترتيب زوج ظاهر فقط أثناء إخفاء بقيّة المجموعة تنتج
 * مواضع مضلِّلة.
 */
export function CompetitionBarPicker({
  competitions: rows,
  isLoading,
  canManage,
  isSelected,
  sortOrder,
  onToggle,
  onReorder,
}: CompetitionBarPickerProps) {
  const { t } = useTranslation('sport');
  const [search, setSearch] = useState('');
  const [dragId, setDragId] = useState<number | null>(null);

  const selectedSorted = useMemo(
    () => rows.filter(isSelected).sort((a, b) => (sortOrder(a) ?? 0) - (sortOrder(b) ?? 0)),
    [rows, isSelected, sortOrder],
  );
  const unselectedRows = useMemo(() => rows.filter((c) => !isSelected(c)), [rows, isSelected]);

  // ترتيب محليّ متفائل للسحب-والإفلات — يُعاد تزامنه من الخادم كلّما تغيّرت البيانات.
  const [orderedSelectedIds, setOrderedSelectedIds] = useState<number[]>([]);
  useEffect(() => {
    setOrderedSelectedIds(selectedSorted.map((c) => c.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const byId = useMemo(() => new Map(rows.map((c) => [c.id, c] as const)), [rows]);
  const orderedSelected = orderedSelectedIds
    .map((id) => byId.get(id))
    .filter((c): c is CompetitionData => c !== undefined);

  const term = search.trim().toLowerCase();
  const isSearching = term !== '';
  const nameMatches = (c: CompetitionData) => c.name.toLowerCase().includes(term);

  const visibleSelected = isSearching ? orderedSelected.filter(nameMatches) : orderedSelected;
  const visibleUnselected = isSearching ? unselectedRows.filter(nameMatches) : unselectedRows;
  const canDrag = canManage && !isSearching;

  const onDrop = (overId: number) => {
    if (dragId === null || dragId === overId) return;
    const ids = [...orderedSelectedIds];
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(overId);
    setDragId(null);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setOrderedSelectedIds(ids);
    onReorder(ids);
  };

  return (
    <div className="space-y-4">
      {rows.length > 0 ? (
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('competitions.picker.searchPlaceholder')}
            className="h-9 w-full rounded-xl border border-input bg-background ps-9 pe-3 text-sm"
          />
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('competitions.picker.empty')}</p>
      ) : visibleSelected.length === 0 && visibleUnselected.length === 0 ? (
        <div className="space-y-2 text-center">
          <p className="text-xs text-muted-foreground">{t('competitions.searchEmpty')}</p>
          <button
            type="button"
            onClick={() => setSearch('')}
            className="text-xs font-medium text-primary hover:underline"
          >
            {t('competitions.clearSearch')}
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {visibleSelected.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-muted-foreground">{t('competitions.section.enabled')}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleSelected.map((c) => (
                  <CompetitionCard
                    key={c.id}
                    competition={c}
                    selected
                    canManage={canManage}
                    draggable={canDrag}
                    isDragging={dragId === c.id}
                    onDragStart={() => setDragId(c.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDrop(c.id)}
                    onDragEnd={() => setDragId(null)}
                    onToggle={() => onToggle(c.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {visibleUnselected.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-muted-foreground">{t('competitions.section.disabled')}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleUnselected.map((c) => (
                  <CompetitionCard
                    key={c.id}
                    competition={c}
                    selected={false}
                    canManage={canManage}
                    draggable={false}
                    isDragging={false}
                    onToggle={() => onToggle(c.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

interface CardProps {
  competition: CompetitionData;
  selected: boolean;
  canManage: boolean;
  draggable: boolean;
  isDragging: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
  onToggle: () => void;
}

function CompetitionCard({
  competition: c,
  selected,
  canManage,
  draggable,
  isDragging,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onToggle,
}: CardProps) {
  const { t } = useTranslation('sport');

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        'flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-colors',
        selected ? 'border-primary bg-primary/5' : 'border-border bg-background',
        isDragging && 'opacity-40',
        draggable && 'cursor-grab active:cursor-grabbing',
      )}
    >
      {draggable ? <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}

      <input
        type="checkbox"
        checked={selected}
        disabled={!canManage}
        onChange={onToggle}
        className="h-4 w-4 shrink-0 accent-primary disabled:opacity-50"
      />

      {c.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.logo_url} alt="" className="h-8 w-8 shrink-0 object-contain" />
      ) : (
        <Trophy className="h-8 w-8 shrink-0 text-muted-foreground" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{c.name}</p>
        <p className="text-xs text-muted-foreground">
          {t('competitions.picker.fixtureCount', { count: c.fixtures_count })}
        </p>
      </div>
    </div>
  );
}
