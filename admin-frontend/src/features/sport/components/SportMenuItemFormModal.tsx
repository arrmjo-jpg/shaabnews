import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCategories } from '@/features/content/hooks';
import { useCreateSportMenuItem, useUpdateSportMenuItem } from '../hooks';
import type { SportMenuItemData, SportMenuSectionKey } from '@/types/sport.types';
import type { CategoryData } from '@/types/content.types';

const selectCls =
  'h-10 w-full border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

// Governance فقط (Phase 3.2 Commit 2، يطابق SportMenuSectionKey.php حرفيًّا) — لا يعني ظهور
// العنصر فعليًّا في القائمة العامة؛ ذلك محكوم بـSECTION_ROUTES في sport-primary-nav.tsx (Frontend).
const SPORT_MENU_SECTION_KEYS: readonly SportMenuSectionKey[] = [
  'matches',
  'results',
  'competitions',
  'teams',
  'players',
  'predictions',
];

interface Props {
  open: boolean;
  onClose: () => void;
  /** Edit mode if `item` is provided. */
  item?: SportMenuItemData | null;
  /** Pre-fill parent (e.g. when adding a child to a given root item). */
  parent?: SportMenuItemData | null;
  /** Root-level items only — for the one-level-deep parent selector. */
  rootItems: SportMenuItemData[];
}

interface FormState {
  locale: string;
  title: string;
  type: 'category' | 'section';
  category_id: number | null;
  section_key: SportMenuSectionKey | '';
  parent_id: number | null;
  icon: string;
  enabled: boolean;
}

function emptyState(parent: SportMenuItemData | null | undefined): FormState {
  return {
    locale: parent?.locale ?? 'ar',
    title: '',
    type: 'section',
    category_id: null,
    section_key: '',
    parent_id: parent?.id ?? null,
    icon: '',
    enabled: true,
  };
}

/** يسطّح شجرة التصنيفات مرّة واحدة، لفلترة القائمة المنسدلة حسب اللغة فقط. */
function flattenCategories(nodes: CategoryData[]): CategoryData[] {
  const out: CategoryData[] = [];
  const walk = (list: CategoryData[]) => {
    for (const n of list) {
      out.push(n);
      if (Array.isArray(n.children)) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export function SportMenuItemFormModal({ open, onClose, item, parent, rootItems }: Props) {
  const { t } = useTranslation('sport');
  const create = useCreateSportMenuItem();
  const update = useUpdateSportMenuItem();
  const categoriesQuery = useCategories();

  const isEdit = Boolean(item);
  const [form, setForm] = useState<FormState>(() => emptyState(parent));

  useEffect(() => {
    if (!open) return;
    if (item) {
      setForm({
        locale: item.locale,
        title: item.title,
        type: item.type,
        category_id: item.category_id,
        section_key: item.section_key ?? '',
        parent_id: item.parent_id,
        icon: item.icon ?? '',
        enabled: item.enabled,
      });
    } else {
      setForm(emptyState(parent));
    }
  }, [open, item, parent]);

  const flatCategories = useMemo(() => flattenCategories(categoriesQuery.data ?? []), [categoriesQuery.data]);
  const localeCategories = useMemo(
    () => flatCategories.filter((c) => c.locale === form.locale),
    [flatCategories, form.locale],
  );
  const eligibleParents = useMemo(
    () => rootItems.filter((r) => r.id !== item?.id),
    [rootItems, item?.id],
  );

  const patch = (p: Partial<FormState>) => setForm((prev) => ({ ...prev, ...p }));

  const submit = () => {
    if (form.title.trim().length === 0) return;
    if (form.type === 'category' && form.category_id === null) return;
    if (form.type === 'section' && form.section_key === '') return;

    const payload = {
      locale: form.locale,
      title: form.title.trim(),
      type: form.type,
      category_id: form.type === 'category' ? form.category_id : null,
      section_key: form.type === 'section' && form.section_key !== '' ? form.section_key : null,
      parent_id: form.parent_id,
      icon: form.icon.trim() ? form.icon.trim() : null,
      enabled: form.enabled,
    };

    if (isEdit && item) {
      update.mutate({ id: item.id, payload }, { onSuccess: onClose });
    } else {
      create.mutate(payload, { onSuccess: onClose });
    }
  };

  const saving = create.isPending || update.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('sportMenu.form.editTitle') : t('sportMenu.form.createTitle')}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t('sportMenu.form.cancel')}
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? t('sportMenu.form.saving') : t('sportMenu.form.save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="smi-locale">{t('sportMenu.form.locale')}</Label>
            <select
              id="smi-locale"
              value={form.locale}
              onChange={(e) => patch({ locale: e.target.value, category_id: null })}
              className={selectCls}
            >
              <option value="ar">{t('sportMenu.form.localeAr')}</option>
              <option value="en">{t('sportMenu.form.localeEn')}</option>
            </select>
          </div>
          <div>
            <Label htmlFor="smi-type">{t('sportMenu.form.type')}</Label>
            <select
              id="smi-type"
              value={form.type}
              onChange={(e) => patch({ type: e.target.value as FormState['type'] })}
              className={selectCls}
            >
              <option value="section">{t('sportMenu.form.typeSection')}</option>
              <option value="category">{t('sportMenu.form.typeCategory')}</option>
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor="smi-title">{t('sportMenu.form.title')}</Label>
          <Input id="smi-title" value={form.title} onChange={(e) => patch({ title: e.target.value })} maxLength={150} />
        </div>

        {form.type === 'category' ? (
          <div>
            <Label htmlFor="smi-category">{t('sportMenu.form.category')}</Label>
            <select
              id="smi-category"
              value={form.category_id ?? ''}
              onChange={(e) => patch({ category_id: e.target.value ? Number(e.target.value) : null })}
              className={selectCls}
            >
              <option value="">{t('sportMenu.form.categoryNone')}</option>
              {localeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <Label htmlFor="smi-section-key">{t('sportMenu.form.sectionKey')}</Label>
            <select
              id="smi-section-key"
              value={form.section_key}
              onChange={(e) => patch({ section_key: e.target.value as SportMenuSectionKey | '' })}
              className={selectCls}
            >
              <option value="">{t('sportMenu.form.sectionKeyNone')}</option>
              {SPORT_MENU_SECTION_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t(`sportMenu.form.sectionKeyOptions.${key}`)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">{t('sportMenu.form.sectionKeyHint')}</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="smi-parent">{t('sportMenu.form.parent')}</Label>
            <select
              id="smi-parent"
              value={form.parent_id ?? ''}
              onChange={(e) => patch({ parent_id: e.target.value ? Number(e.target.value) : null })}
              className={selectCls}
            >
              <option value="">{t('sportMenu.form.parentNone')}</option>
              {eligibleParents.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="smi-icon">{t('sportMenu.form.icon')}</Label>
            <Input id="smi-icon" value={form.icon} onChange={(e) => patch({ icon: e.target.value })} dir="ltr" maxLength={100} />
          </div>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 border border-border bg-background px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => patch({ enabled: e.target.checked })}
            className="h-4 w-4"
          />
          <span>{t('sportMenu.form.enabled')}</span>
        </label>
      </div>
    </Modal>
  );
}
