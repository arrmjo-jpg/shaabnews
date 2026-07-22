import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/useToast';
import { useCreateCategory, useUpdateCategory } from '../hooks';
import { OgImagePicker } from './OgImagePicker';
import type {
  CategoryData,
  CategoryScope,
  CategoryStatus,
  ContentLocale,
  SectionLayoutType,
} from '@/types/content.types';

const selectCls =
  'h-10 w-full border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

// معرّف تصنيف "الرياضة" الجذر — نفس الثابت غير المُجرَّد المستخدَم اليوم في الواجهة العامة
// (frontend/src/components/sport/sport-news.tsx). حقول provider/external_id تُعرَض فقط لتصنيف
// تحت هذا الجذر — واجهة مستخدم فقط، لا حد تحقّق خلفيّ (الـ backend يقبلها لأيّ تصنيف).
const SPORT_ROOT_CATEGORY_ID = 4;

const SPORT_PROVIDERS = ['365scores'] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  /** Edit mode if `category` is provided. */
  category?: CategoryData | null;
  /** Pre-fill parent (e.g. when adding a sub-category to a given node). */
  parent?: CategoryData | null;
  /** Used to enforce locale match when creating a child. */
  allCategories: CategoryData[];
}

interface FormState {
  name: string;
  slug: string;
  locale: ContentLocale;
  parent_id: number | null;
  scope: CategoryScope;
  status: CategoryStatus;
  description: string;
  show_in_header: boolean;
  show_in_body: boolean;
  show_in_footer: boolean;
  banner_media_id: number | null;
  banner_url: string | null;
  show_title: boolean;
  layout_type: SectionLayoutType;
  border_enabled: boolean;
  border_width: number;
  border_radius: number;
  border_color: string;
  provider: string;
  external_id: string;
}

function emptyState(parent: CategoryData | null | undefined): FormState {
  return {
    name: '',
    slug: '',
    locale: parent?.locale ?? 'ar',
    parent_id: parent?.id ?? null,
    scope: parent?.scope ?? 'news',
    status: 'active',
    description: '',
    show_in_header: false,
    show_in_body: true,
    show_in_footer: false,
    banner_media_id: null,
    banner_url: null,
    show_title: true,
    layout_type: 'default',
    border_enabled: false,
    border_width: 2,
    border_radius: 0,
    border_color: '#E5E7EB',
    provider: '',
    external_id: '',
  };
}

export function CategoryFormModal({
  open,
  onClose,
  category,
  parent,
  allCategories,
}: Props) {
  const { t } = useTranslation('content');
  const { success, error: toastError } = useToast();
  const create = useCreateCategory();
  const update = useUpdateCategory();

  const isEdit = Boolean(category);
  const [form, setForm] = useState<FormState>(() => emptyState(parent));

  // Hydrate / reset whenever the modal opens
  useEffect(() => {
    if (!open) return;
    if (category) {
      setForm({
        name: category.name,
        slug: category.slug,
        locale: category.locale,
        parent_id: category.parent_id,
        scope: category.scope,
        status: category.status,
        description: category.description ?? '',
        show_in_header: category.show_in_header,
        show_in_body: category.show_in_body,
        show_in_footer: category.show_in_footer,
        banner_media_id: category.banner_media_id,
        banner_url: category.banner_url ?? null,
        show_title: category.show_title,
        layout_type: category.layout_type,
        border_enabled: category.appearance?.border?.enabled ?? false,
        border_width: category.appearance?.border?.width ?? 2,
        border_radius: category.appearance?.border?.radius ?? 0,
        border_color: category.appearance?.border?.color ?? '#E5E7EB',
        provider: category.provider ?? '',
        external_id: category.external_id ?? '',
      });
    } else {
      setForm(emptyState(parent));
    }
  }, [open, category, parent]);

  const eligibleParents = useMemo(() => {
    // Flatten the tree, keep nodes of the matching locale, exclude self + descendants.
    // Defensive: tolerate missing/non-array children at any depth.
    const out: Array<{ id: number; label: string }> = [];

    const walk = (nodes: unknown, depth: number) => {
      if (!Array.isArray(nodes)) return;
      for (const n of nodes) {
        if (!n || typeof n !== 'object') continue;
        const node = n as CategoryData;
        if (node.locale === form.locale && node.id !== category?.id) {
          out.push({ id: node.id, label: `${'— '.repeat(depth)}${node.name}` });
        }
        if (node.id !== category?.id) walk(node.children, depth + 1);
      }
    };
    walk(allCategories, 0);
    return out;
  }, [allCategories, form.locale, category?.id]);

  // خريطة id -> عقدة كاملة (تُسطَّح مرّة واحدة) — لتسلّق سلسلة الآباء وتحديد ما إذا كان هذا
  // التصنيف (أو أبوه المختار) تحت جذر "الرياضة".
  const categoryById = useMemo(() => {
    const map = new Map<number, CategoryData>();
    const walk = (nodes: CategoryData[]) => {
      for (const n of nodes) {
        map.set(n.id, n);
        if (Array.isArray(n.children)) walk(n.children);
      }
    };
    walk(allCategories);
    return map;
  }, [allCategories]);

  const isDescendantOfSportRoot = (id: number | null): boolean => {
    let current = id;
    let guard = 0;
    while (current !== null && guard < 20) {
      if (current === SPORT_ROOT_CATEGORY_ID) return true;
      current = categoryById.get(current)?.parent_id ?? null;
      guard += 1;
    }
    return false;
  };

  const isSportCategory =
    isDescendantOfSportRoot(category?.id ?? null) || isDescendantOfSportRoot(form.parent_id);

  const patch = (p: Partial<FormState>) => setForm((prev) => ({ ...prev, ...p }));

  const submit = () => {
    if (form.name.trim().length < 2) {
      toastError(t('categories.form.validation.nameRequired'));
      return;
    }
    const payload = {
      name: form.name.trim(),
      locale: form.locale,
      parent_id: form.parent_id,
      slug: form.slug.trim() ? form.slug.trim() : null,
      scope: form.scope,
      status: form.status,
      description: form.description.trim() ? form.description.trim() : null,
      show_in_header: form.show_in_header,
      show_in_body: form.show_in_body,
      show_in_footer: form.show_in_footer,
      banner_media_id: form.banner_media_id,
      show_title: form.show_title,
      layout_type: form.layout_type,
      appearance: {
        border: {
          enabled: form.border_enabled,
          width: form.border_width,
          radius: form.border_radius,
          color: form.border_color,
        },
      },
      ...(isSportCategory
        ? {
            provider: form.provider.trim() ? form.provider.trim() : null,
            external_id: form.external_id.trim() ? form.external_id.trim() : null,
          }
        : {}),
    };

    if (isEdit && category) {
      update.mutate(
        { id: category.id, payload },
        {
          onSuccess: () => {
            success(t('categories.form.saved'));
            onClose();
          },
        },
      );
    } else {
      create.mutate(payload, {
        onSuccess: () => {
          success(t('categories.form.saved'));
          onClose();
        },
      });
    }
  };

  const saving = create.isPending || update.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('categories.form.editTitle') : t('categories.form.createTitle')}
      description={isEdit ? undefined : t('categories.form.createHint')}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t('common.cancel', { ns: 'common' })}
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? t('categories.form.saving') : t('categories.form.save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div>
          <Label htmlFor="cat-name">{t('categories.form.name')}</Label>
          <Input
            id="cat-name"
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
            maxLength={150}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="cat-slug">{t('categories.form.slug')}</Label>
            <Input
              id="cat-slug"
              value={form.slug}
              onChange={(e) => patch({ slug: e.target.value })}
              dir="ltr"
              placeholder={t('articles.form.slugPlaceholder')}
              maxLength={160}
            />
          </div>
          <div>
            <Label htmlFor="cat-locale">{t('articles.form.locale')}</Label>
            <select
              id="cat-locale"
              value={form.locale}
              onChange={(e) => patch({ locale: e.target.value as ContentLocale, parent_id: null })}
              className={selectCls}
              disabled={isEdit && (category?.children?.length ?? 0) > 0}
            >
              <option value="ar">{t('articles.locale.ar')}</option>
              <option value="en">{t('articles.locale.en')}</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="cat-parent">{t('categories.form.parent')}</Label>
            <select
              id="cat-parent"
              value={form.parent_id ?? ''}
              onChange={(e) => patch({ parent_id: e.target.value ? Number(e.target.value) : null })}
              className={selectCls}
            >
              <option value="">{t('categories.form.parentNone')}</option>
              {eligibleParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="cat-scope">{t('categories.form.scope')}</Label>
            <select
              id="cat-scope"
              value={form.scope}
              onChange={(e) => patch({ scope: e.target.value as CategoryScope })}
              className={selectCls}
            >
              <option value="news">{t('categories.scope.news')}</option>
              <option value="opinion">{t('categories.scope.opinion')}</option>
              <option value="both">{t('categories.scope.both')}</option>
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor="cat-status">{t('categories.form.status')}</Label>
          <select
            id="cat-status"
            value={form.status}
            onChange={(e) => patch({ status: e.target.value as CategoryStatus })}
            className={selectCls}
          >
            <option value="active">{t('categories.status.active')}</option>
            <option value="hidden">{t('categories.status.hidden')}</option>
          </select>
        </div>

        <div>
          <Label htmlFor="cat-desc">{t('categories.form.description')}</Label>
          <textarea
            id="cat-desc"
            rows={3}
            value={form.description}
            onChange={(e) => patch({ description: e.target.value })}
            maxLength={2000}
            className="flex w-full border border-input bg-background px-3.5 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {(['show_in_header', 'show_in_body', 'show_in_footer'] as const).map((k) => (
            <label
              key={k}
              className="inline-flex cursor-pointer items-center gap-2 border border-border bg-background px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={form[k]}
                onChange={(e) => patch({ [k]: e.target.checked } as Partial<FormState>)}
                className="h-4 w-4"
              />
              <span>{t(`categories.form.${k}`)}</span>
            </label>
          ))}
        </div>

        <div className="space-y-4 border-t border-border pt-4">
          <p className="text-sm font-medium text-foreground">{t('categories.form.design.title')}</p>

          <OgImagePicker
            value={form.banner_url}
            label={t('categories.form.design.banner.label')}
            hint={t('categories.form.design.banner.hint')}
            onChange={(id) =>
              patch({ banner_media_id: id, banner_url: id === null ? null : form.banner_url })
            }
          />

          <label className="inline-flex cursor-pointer items-center gap-2 border border-border bg-background px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={form.show_title}
              onChange={(e) => patch({ show_title: e.target.checked })}
              className="h-4 w-4"
            />
            <span>{t('categories.form.design.showTitle')}</span>
          </label>

          <div>
            <Label htmlFor="cat-layout-type">{t('categories.form.design.layoutType')}</Label>
            <select
              id="cat-layout-type"
              value={form.layout_type}
              onChange={(e) => patch({ layout_type: e.target.value as SectionLayoutType })}
              className={selectCls}
            >
              <option value="default">{t('categories.layoutType.default')}</option>
              <option value="hero">{t('categories.layoutType.hero')}</option>
              <option value="magazine">{t('categories.layoutType.magazine')}</option>
              <option value="featured">{t('categories.layoutType.featured')}</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="inline-flex cursor-pointer items-center gap-2 border border-border bg-background px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.border_enabled}
                onChange={(e) => patch({ border_enabled: e.target.checked })}
                className="h-4 w-4"
              />
              <span>{t('categories.form.design.border.enabled')}</span>
            </label>

            {form.border_enabled ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="cat-border-width">{t('categories.form.design.border.width')}</Label>
                  <Input
                    id="cat-border-width"
                    type="number"
                    min={1}
                    max={20}
                    value={form.border_width}
                    onChange={(e) => patch({ border_width: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="cat-border-radius">{t('categories.form.design.border.radius')}</Label>
                  <Input
                    id="cat-border-radius"
                    type="number"
                    min={0}
                    max={100}
                    value={form.border_radius}
                    onChange={(e) => patch({ border_radius: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="cat-border-color">{t('categories.form.design.border.color')}</Label>
                  <input
                    id="cat-border-color"
                    type="color"
                    value={form.border_color}
                    onChange={(e) => patch({ border_color: e.target.value })}
                    className="h-10 w-full cursor-pointer border border-input bg-background"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {isSportCategory ? (
          <div className="space-y-4 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">{t('categories.form.sport.title')}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="cat-provider">{t('categories.form.sport.provider')}</Label>
                <select
                  id="cat-provider"
                  value={form.provider}
                  onChange={(e) => patch({ provider: e.target.value })}
                  className={selectCls}
                >
                  <option value="">{t('categories.form.sport.providerNone')}</option>
                  {SPORT_PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="cat-external-id">{t('categories.form.sport.externalId')}</Label>
                <Input
                  id="cat-external-id"
                  value={form.external_id}
                  onChange={(e) => patch({ external_id: e.target.value.replace(/[^\d]/g, '') })}
                  dir="ltr"
                  placeholder="1"
                  maxLength={100}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
