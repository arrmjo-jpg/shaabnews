import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/feedback';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { useSportMenuItems, useDeleteSportMenuItem, useReorderSportMenuItems } from '../hooks';
import { SportMenuItemFormModal } from '../components/SportMenuItemFormModal';
import type { SportMenuItemData } from '@/types/sport.types';

/** يعيد ترتيب مصفوفة معرّفات — سحب-وإفلات ضمن نفس المستوى (نفس الأب) فقط. */
function reorderIds(ids: number[], dragId: number, overId: number): number[] {
  const next = [...ids];
  const from = next.indexOf(dragId);
  const to = next.indexOf(overId);
  if (from < 0 || to < 0) return ids;
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

export default function SportMenuPage() {
  const { t } = useTranslation('sport');
  const { hasPermission } = useAuth();
  const { confirm } = useToast();
  const canManage = hasPermission('sport_menu.manage');

  const q = useSportMenuItems();
  const del = useDeleteSportMenuItem();
  const reorder = useReorderSportMenuItems();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SportMenuItemData | null>(null);
  const [newParent, setNewParent] = useState<SportMenuItemData | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [drag, setDrag] = useState<{ id: number; parentId: number | null } | null>(null);

  const rootItems = q.data ?? [];

  // ترتيب محليّ متفائل للجذور — نفس نمط CompetitionsPage: يُعاد تزامنه من الخادم عند كلّ جلب،
  // ويُحدَّث فورًا عند الإفلات قبل استجابة الخادم.
  const [orderedRootIds, setOrderedRootIds] = useState<number[]>([]);
  useEffect(() => {
    setOrderedRootIds(rootItems.map((r) => r.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootItems]);

  const rootById = useMemo(() => new Map(rootItems.map((r) => [r.id, r] as const)), [rootItems]);
  const orderedRoots = orderedRootIds.map((id) => rootById.get(id)).filter((r): r is SportMenuItemData => r !== undefined);

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCreate = (parent: SportMenuItemData | null) => {
    setEditing(null);
    setNewParent(parent);
    setModalOpen(true);
  };
  const openEdit = (item: SportMenuItemData) => {
    setEditing(item);
    setNewParent(null);
    setModalOpen(true);
  };

  const onDelete = async (item: SportMenuItemData) => {
    if (
      await confirm({
        title: t('sportMenu.confirm.deleteTitle'),
        text: t('sportMenu.confirm.deleteText', { title: item.title }),
        confirmText: t('sportMenu.confirm.yes'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      del.mutate(item.id);
  };

  const onDropRoot = (overId: number) => {
    if (!drag || drag.parentId !== null || drag.id === overId) return;
    const next = reorderIds(orderedRootIds, drag.id, overId);
    setDrag(null);
    setOrderedRootIds(next);
    reorder.mutate(next);
  };

  const onDropChild = (parent: SportMenuItemData, overId: number) => {
    if (!drag || drag.parentId !== parent.id || drag.id === overId) return;
    const children = parent.children ?? [];
    const ids = children.map((c) => c.id);
    const next = reorderIds(ids, drag.id, overId);
    setDrag(null);
    reorder.mutate(next);
  };

  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('sportMenu.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('sportMenu.subtitle')}</p>
        </div>
        {canManage ? (
          <Button onClick={() => openCreate(null)}>
            <Plus className="h-4 w-4" />
            {t('sportMenu.new')}
          </Button>
        ) : null}
      </header>

      <div className="overflow-x-auto rounded-2xl border border-border bg-background">
        {q.isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rootItems.length === 0 ? (
          <EmptyState title={t('sportMenu.empty.title')} description={t('sportMenu.empty.description')} />
        ) : (
          <ul className="divide-y divide-border">
            {orderedRoots.map((root) => (
              <li key={root.id}>
                <Row
                  item={root}
                  depth={0}
                  canManage={canManage}
                  draggable={canManage}
                  isDragging={drag?.id === root.id}
                  expanded={expanded.has(root.id)}
                  hasChildren={(root.children?.length ?? 0) > 0}
                  onToggleExpand={() => toggleExpanded(root.id)}
                  onDragStart={() => setDrag({ id: root.id, parentId: null })}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDropRoot(root.id)}
                  onDragEnd={() => setDrag(null)}
                  onAddChild={() => openCreate(root)}
                  onEdit={() => openEdit(root)}
                  onDelete={() => void onDelete(root)}
                />
                {expanded.has(root.id) && root.children
                  ? [...root.children]
                      .sort((a, b) => a.order - b.order)
                      .map((child) => (
                        <Row
                          key={child.id}
                          item={child}
                          depth={1}
                          canManage={canManage}
                          draggable={canManage}
                          isDragging={drag?.id === child.id}
                          expanded={false}
                          hasChildren={false}
                          onDragStart={() => setDrag({ id: child.id, parentId: root.id })}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => onDropChild(root, child.id)}
                          onDragEnd={() => setDrag(null)}
                          onEdit={() => openEdit(child)}
                          onDelete={() => void onDelete(child)}
                        />
                      ))
                  : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <SportMenuItemFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        item={editing}
        parent={newParent}
        rootItems={rootItems}
      />
    </div>
  );
}

interface RowProps {
  item: SportMenuItemData;
  depth: number;
  canManage: boolean;
  draggable: boolean;
  isDragging: boolean;
  expanded: boolean;
  hasChildren: boolean;
  onToggleExpand?: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onAddChild?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function Row({
  item,
  depth,
  canManage,
  draggable,
  isDragging,
  expanded,
  hasChildren,
  onToggleExpand,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onAddChild,
  onEdit,
  onDelete,
}: RowProps) {
  const { t } = useTranslation('sport');

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn('flex items-center gap-3 px-4 py-3', isDragging && 'opacity-40')}
      style={{ paddingInlineStart: `${1 + depth * 1.5}rem` }}
    >
      {draggable ? (
        <span className="flex cursor-grab items-center text-muted-foreground active:cursor-grabbing">
          <GripVertical className="h-4 w-4" />
        </span>
      ) : (
        <span className="w-4" />
      )}

      {hasChildren ? (
        <button type="button" onClick={onToggleExpand} className="text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      ) : (
        <span className="w-4" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.title}</p>
        <p className="text-xs text-muted-foreground" dir="ltr">
          {item.type === 'category' ? `category:${item.category_id}` : `section:${item.section_key}`} · {item.locale}
        </p>
      </div>

      <Badge variant={item.enabled ? 'success' : 'muted'}>
        {item.enabled ? t('sportMenu.status.enabled') : t('sportMenu.status.disabled')}
      </Badge>

      {canManage ? (
        <div className="flex items-center gap-1">
          {depth === 0 && onAddChild ? (
            <Button variant="ghost" size="sm" onClick={onAddChild} aria-label={t('sportMenu.addChild')}>
              <Plus className="h-4 w-4" />
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onEdit} aria-label={t('sportMenu.form.editTitle')}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label={t('sportMenu.confirm.yes')}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
