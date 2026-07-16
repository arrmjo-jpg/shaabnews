import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlignLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  Eye,
  FileText,
  Image as ImageIcon,
  Layers,
  Loader2,
  Radio,
  Save,
  Send,
  Settings2,
  Sparkles,
  Tags as TagsIcon,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TextField } from '@/components/form/TextField';
import { TextareaField } from '@/components/form/TextareaField';
import { SelectField } from '@/components/form/SelectField';
import { SwitchField } from '@/components/form/SwitchField';
import { PageSkeleton, ErrorState } from '@/components/feedback';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/router/paths';
import { storageUrl } from '@/lib/storage';
import {
  useArticle,
  useCategories,
  useCreateArticle,
  useTransitionArticle,
  useUpdateArticle,
} from '../hooks';
import { articleFormSchema, type ArticleFormValues } from '../schemas';
import { isEditorialUser } from '../lib/workflow';
import { useMediaStaging, stagedFromArticle } from '../lib/useMediaStaging';
import { suggestTags, tiptapText } from '../lib/tagSuggest';
import { excerptFromDoc } from '../lib/excerpt';
import { ArticleWorkflowPanel } from '../components/ArticleWorkflowPanel';
import { DISPLAY_FLAGS } from '../constants';
import { ArticlePreviewModal } from '../components/ArticlePreviewModal';
import { CategoryPicker } from '../components/CategoryPicker';
import { MediaStudio } from '../components/media/MediaStudio';
import { SeoPanel } from '../components/SeoPanel';
import { SlugField } from '../components/SlugField';
import { EntityTagsInput } from '../components/EntityTagsInput';
import { TagsInput } from '../components/TagsInput';
import { WriterPicker } from '../components/WriterPicker';
import { ArticleEditor } from '../editor/ArticleEditor';
import { HeadlineSuggestions } from '../components/ai/HeadlineSuggestions';
import { ExcerptGenerate } from '../components/ai/ExcerptGenerate';
import { TagSuggest } from '../components/ai/TagSuggest';
import { SeoAnalysisCard } from '../components/ai/SeoAnalysisCard';
import { ContentAnalysisCard } from '../components/ai/ContentAnalysisCard';
import type {
  AiEditorialContext,
  ArticleStatus,
  ArticleType,
  ArticleUpsertPayload,
  CategoryData,
  ContentLocale,
} from '@/types/content.types';

const EMPTY_DOC: { type: 'doc'; content: Array<{ type: string }> } = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

const TYPES: ArticleType[] = ['news', 'opinion', 'live'];
const LOCALES: ContentLocale[] = ['ar', 'en'];

/** Workflow status → Badge tone (strong, scannable newsroom state). */
const STATUS_VARIANT: Record<ArticleStatus, 'default' | 'success' | 'muted' | 'destructive'> = {
  draft: 'muted',
  submitted: 'default',
  in_review: 'default',
  scheduled: 'default',
  published: 'success',
  rejected: 'destructive',
  archived: 'muted',
};

// ─── Presentational shells (lighter density, less border noise, square corners) ─

interface SectionProps {
  title?: string;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

function Section({ title, hint, icon: Icon, className, bodyClassName, children }: SectionProps) {
  return (
    <section className={cn('border border-border bg-background', className)}>
      {title ? (
        <header className="flex items-start gap-2 border-b border-border px-4 py-3">
          {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : null}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-tight">{title}</h3>
            {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
          </div>
        </header>
      ) : null}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

interface CollapsibleProps {
  title: string;
  hint?: string;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/** Advanced disclosure — collapsed by default so power features never crowd writers. */
function CollapsibleSection({ title, hint, icon: Icon, defaultOpen = false, children }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border border-border bg-background">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-2 px-4 py-3 text-start transition-colors hover:bg-muted/40"
      >
        {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : null}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-tight">{title}</h3>
          {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <ChevronDown
          className={cn('mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>
      {open ? <div className="border-t border-border p-4">{children}</div> : null}
    </section>
  );
}

/** Coarse relative time for the autosave pill — returns an i18n key + count so the
 *  caller localizes (keeps i18next's TFunction out of this pure helper). */
function relAutosave(savedAt: number, now: number): { key: string; n?: number } {
  const s = Math.max(0, Math.round((now - savedAt) / 1000));
  if (s < 5) return { key: 'articles.form.cockpit.autosave.justNow' };
  if (s < 60) return { key: 'articles.form.cockpit.autosave.secondsAgo', n: s };
  const m = Math.floor(s / 60);
  if (m < 60) return { key: 'articles.form.cockpit.autosave.minutesAgo', n: m };
  return { key: 'articles.form.cockpit.autosave.hoursAgo', n: Math.floor(m / 60) };
}

/**
 * Flatten the category tree to a list, filtered by article type+locale.
 * - opinion → scope must allow opinion (scope='opinion' or 'both')
 * - news / live → scope must allow news (scope='news' or 'both')
 *
 * Defensive: guards every level with Array.isArray so a malformed payload
 * (e.g. missing `children` on a leaf) cannot crash the render.
 */
function flattenAllowedCategories(
  tree: CategoryData[] | undefined,
  type: ArticleType,
  locale: ContentLocale,
): Array<{ id: number; label: string }> {
  if (!Array.isArray(tree) || tree.length === 0) return [];
  const out: Array<{ id: number; label: string }> = [];

  const allowedScope = (scope: CategoryData['scope']): boolean => {
    if (type === 'opinion') return scope === 'opinion' || scope === 'both';
    return scope === 'news' || scope === 'both';
  };

  const walk = (nodes: unknown, depth: number, prefix: string) => {
    if (!Array.isArray(nodes)) return;
    for (const n of nodes) {
      if (!n || typeof n !== 'object') continue;
      const node = n as CategoryData;
      if (node.locale === locale && allowedScope(node.scope) && node.status === 'active') {
        out.push({
          id: node.id,
          label: `${'— '.repeat(depth)}${prefix}${node.name}`,
        });
      }
      walk(node.children, depth + 1, prefix);
    }
  };

  walk(tree, 0, '');
  return out;
}

export default function ArticleFormPage() {
  const { t } = useTranslation('content');
  const { user, hasPermission } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();
  const articleId = id ? Number(id) : null;
  const isEdit = articleId !== null;

  const articleQ = useArticle(articleId);
  const catsQ = useCategories();
  const create = useCreateArticle();
  const update = useUpdateArticle();
  const transition = useTransitionArticle();
  const staging = useMediaStaging();

  const article = articleQ.data ?? null;
  const isEditorial = isEditorialUser(user?.roles ?? []);
  const isOwner = article !== null && user?.id === article.author?.id;
  const canCreateUsers = hasPermission('users.create');

  const { register, handleSubmit, watch, setValue, getValues, control, reset, formState } =
    useForm<ArticleFormValues>({
      resolver: zodResolver(articleFormSchema),
      defaultValues: {
        title: '',
        subtitle: '',
        locale: 'ar',
        type: 'news',
        slug: '',
        excerpt: '',
        content_json: EMPTY_DOC,
        primary_category_id: 0,
        secondary_category_ids: [],
        author_id: null,
        tags: [],
        seo_title: '',
        seo_description: '',
        seo_keywords: '',
        canonical_url: '',
        robots: '',
        is_featured: false,
        is_breaking: false,
        is_pinned: false,
        is_header: false,
        is_editor_pick: false,
        is_squares: false,
        comments_enabled: false,
        views_count: 0,
      },
    });

  // Hydrate from the loaded article (edit mode) — ONCE per article load. Guarding
  // by id prevents a post-save refetch (autosave/manual save invalidates the
  // articles query) from re-running reset() mid-edit, which would clobber staged
  // media and reset the editor cursor. Status/derived reads still reflect refetches
  // directly from `article`.
  const hydratedId = useRef<number | null>(null);
  useEffect(() => {
    if (!article) return;
    if (hydratedId.current === article.id) return;
    hydratedId.current = article.id;
    reset({
      title: article.title,
      subtitle: article.subtitle ?? '',
      locale: article.locale,
      type: article.type,
      slug: article.slug,
      excerpt: article.excerpt ?? '',
      content_json: article.content_json ?? EMPTY_DOC,
      primary_category_id: article.primary_category?.id ?? 0,
      secondary_category_ids: article.secondary_categories?.map((c) => c.id) ?? [],
      author_id: article.author?.id ?? null,
      tags: article.tags ?? [],
      seo_title: article.seo.title ?? '',
      seo_description: article.seo.description ?? '',
      seo_keywords: article.seo.keywords ?? '',
      canonical_url: article.seo.canonical_url ?? '',
      robots: article.seo.robots ?? '',
      is_featured: article.is_featured,
      is_breaking: article.is_breaking,
      is_pinned: article.is_pinned,
      is_header: article.is_header,
      is_editor_pick: article.is_editor_pick,
      is_squares: article.is_squares,
      comments_enabled: article.comments_enabled,
      views_count: article.views_count,
    });
    // Seed the media studio from the saved attachments (client-stage state).
    staging.reset(stagedFromArticle(article));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article, reset]);

  const type = watch('type');
  const locale = watch('locale');
  const primaryId = watch('primary_category_id');

  const allowedCats = useMemo(
    () => flattenAllowedCategories(catsQ.data, type, locale),
    [catsQ.data, type, locale],
  );

  // Prune picks that are no longer allowed — ONLY when the type/locale/category
  // tree changes (the real trigger). Crucially we do NOT depend on the current
  // picks, otherwise the effect re-runs on every selection and can wipe a value
  // the instant the user chooses it. Current picks are read via getValues.
  // Also: never prune before the tree has loaded (edit-mode race would wipe the
  // saved category).
  useEffect(() => {
    if (!catsQ.data) return;
    const allowedIds = new Set(allowedCats.map((c) => c.id));

    const primary = getValues('primary_category_id');
    if (primary && !allowedIds.has(primary)) {
      setValue('primary_category_id', 0, { shouldValidate: false });
    }

    const secondary = getValues('secondary_category_ids') ?? [];
    if (type === 'opinion' && secondary.length > 0) {
      setValue('secondary_category_ids', []);
    } else {
      const filtered = secondary.filter((sid) => allowedIds.has(sid));
      if (filtered.length !== secondary.length) {
        setValue('secondary_category_ids', filtered);
      }
    }
  }, [type, locale, allowedCats, catsQ.data, getValues, setValue]);

  // ⚠️ Rules of Hooks: every hook MUST run before any early return.
  // Keep `useState`/`watch`/autosave effects above the loading/error branches.
  const [previewOpen, setPreviewOpen] = useState(false);
  const watched = watch();

  // Auto-fill the excerpt from the first two body lines while it's still blank — a
  // short summary the editor never types by hand, yet can freely edit. Guarded on the
  // current value, so a manual or previously-saved excerpt is never overwritten.
  useEffect(() => {
    if ((getValues('excerpt') ?? '').trim() !== '') return;
    const auto = excerptFromDoc(watched.content_json);
    if (auto) setValue('excerpt', auto, { shouldValidate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watched.content_json]);

  // Auto tag suggestions from title + subtitle + excerpt + body (Arabic-aware).
  const tagSuggestions = useMemo(() => {
    const source = [
      watched.title,
      watched.subtitle,
      watched.excerpt,
      tiptapText(watched.content_json),
    ]
      .filter(Boolean)
      .join(' ');
    return suggestTags(source, watched.locale ?? 'ar', watched.tags ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watched.title, watched.subtitle, watched.excerpt, watched.content_json, watched.locale, watched.tags]);

  // ─── AI Copilot — مساعدة تحريرية (تُعرض فقط لمن يملك ai.use) ───────────
  const canUseAi = hasPermission('ai.use');

  // يُبنى عند النقر (قيم حيّة) — يرسل سياقاً غنياً للمساعد دون متابعة تفاعلية.
  const buildAiContext = (): AiEditorialContext => {
    const v = getValues();
    const catLabels = [v.primary_category_id, ...(v.secondary_category_ids ?? [])]
      .map((id) => allowedCats.find((c) => c.id === id)?.label)
      .filter((l): l is string => Boolean(l));

    return {
      title: v.title || undefined,
      subtitle: v.subtitle || undefined,
      excerpt: v.excerpt || undefined,
      body: tiptapText(v.content_json) || undefined,
      type: v.type,
      categories: catLabels.length > 0 ? catLabels : undefined,
      locale: v.locale,
    };
  };

  // ─── Unified category selection (multi-select, no primary/secondary in UI) ─
  // Internally the first selected category is stored as `primary_category_id`
  // (kept for the public site/SEO/section) and the rest as `secondary_category_ids`.
  const selectedCategoryIds: number[] = primaryId
    ? [primaryId, ...(watched.secondary_category_ids ?? [])]
    : [...(watched.secondary_category_ids ?? [])];

  const toggleCategory = (id: number): void => {
    const primary = getValues('primary_category_id');
    const rest = getValues('secondary_category_ids') ?? [];
    const selected = primary ? [primary, ...rest] : [...rest];
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];

    setValue('primary_category_id', next[0] ?? 0, { shouldValidate: true, shouldDirty: true });
    setValue('secondary_category_ids', next.slice(1), { shouldDirty: true });
  };

  const clearCategories = (): void => {
    setValue('primary_category_id', 0, { shouldValidate: true, shouldDirty: true });
    setValue('secondary_category_ids', [], { shouldDirty: true });
  };

  // Build the upsert payload. Defined before the early returns so the autosave
  // effect (a hook) can reference it without a Rules-of-Hooks violation.
  const buildPayload = (values: ArticleFormValues): ArticleUpsertPayload => {
    const payload: ArticleUpsertPayload = {
      title: values.title.trim(),
      locale: values.locale,
      type: values.type,
      primary_category_id: values.primary_category_id,
      secondary_category_ids: values.secondary_category_ids,
      subtitle: values.subtitle ? values.subtitle : null,
      slug: values.slug ? values.slug : null,
      // Fallback: derive from the body so a left-blank excerpt is still summarized.
      excerpt: values.excerpt?.trim() ? values.excerpt : excerptFromDoc(values.content_json) || null,
      tags: values.tags,
      seo_title: values.seo_title ? values.seo_title : null,
      seo_description: values.seo_description ? values.seo_description : null,
      seo_keywords: values.seo_keywords ? values.seo_keywords : null,
      canonical_url: values.canonical_url ? values.canonical_url : null,
      robots: values.robots ? values.robots : null,
      is_featured: values.is_featured,
      is_breaking: values.is_breaking,
      is_pinned: values.is_pinned,
      is_header: values.is_header,
      is_editor_pick: values.is_editor_pick,
      is_squares: values.is_squares,
      comments_enabled: values.comments_enabled,
      views_count: values.views_count,
    };

    payload.content_json = values.content_json ?? EMPTY_DOC;

    // Attach-on-save: staged media (cover/gallery/video). Inline images are
    // editor-owned and preserved server-side.
    payload.media = staging.toPayload();

    // Opinion: editorial must pick an author_id (writer). Writers self-assign on backend.
    if (isEditorial && values.author_id) {
      payload.author_id = values.author_id;
    }

    return payload;
  };

  // ─── Autosave (edit mode only) — silent, debounced, uses the existing update
  // mutation. Gated on dirty + valid (handleSubmit runs zod) + the same hard
  // guards as a manual save, so it never fires a request that would 422. Create
  // mode never auto-creates (no surprise drafts) — only the dirty/beforeunload
  // guards apply. The mutation's own onError still surfaces genuine failures.
  const [autosaving, setAutosaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const isDirty = formState.isDirty;

  // Warn on navigation/refresh with unsaved changes (both modes).
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Slow tick to keep the "saved Nm ago" label fresh without per-second renders.
  useEffect(() => {
    if (savedAt === null) return;
    const interval = window.setInterval(() => setNowTick(Date.now()), 20_000);
    return () => window.clearInterval(interval);
  }, [savedAt]);

  useEffect(() => {
    if (!isEdit || articleId === null || !isDirty) return;
    if (create.isPending || update.isPending || transition.isPending) return;

    const handle = window.setTimeout(() => {
      void handleSubmit(
        (values) => {
          // Mirror the manual-save hard guards so autosave never 422s.
          if (values.type === 'opinion' && isEditorial && !values.author_id) return;
          if (!values.primary_category_id) return;

          setAutosaving(true);
          update.mutate(
            { id: articleId, payload: buildPayload(values) },
            {
              onSuccess: () => {
                setAutosaving(false);
                setSavedAt(Date.now());
                setNowTick(Date.now());
                // Reset the dirty baseline to the autosaved values (keeps inputs intact).
                reset(values, { keepValues: true, keepDirty: false, keepErrors: true });
              },
              onError: () => setAutosaving(false),
            },
          );
        },
        () => {
          /* invalid → skip this autosave cycle silently */
        },
      )();
    }, 2500);

    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watched, isDirty, isEdit, articleId]);

  if (isEdit && articleQ.isLoading) return <PageSkeleton />;
  if (isEdit && articleQ.isError) {
    const err = articleQ.error as { message?: string; status?: number } | null;
    const detail = err?.message
      ? err.status
        ? `[${err.status}] ${err.message}`
        : err.message
      : undefined;
    return <ErrorState message={detail} onRetry={() => void articleQ.refetch()} />;
  }

  // Cover comes from the staged media so SEO/preview reflect changes instantly.
  // Cover from staged media; opinion (مقال) falls back to the author avatar.
  const coverUrl =
    staging.cover?.url ??
    staging.cover?.thumb ??
    (watched.type === 'opinion' ? storageUrl(article?.author?.avatar) : null);

  // Publish-now default: editors create-and-publish in one action; "Save as
  // draft" is the secondary path. Writers (non-editorial) submit for review.
  type SubmitIntent = 'save' | 'draft' | 'publish' | 'submit';

  const doSubmit = (values: ArticleFormValues, intent: SubmitIntent) => {
    if (values.type === 'opinion' && isEditorial && !values.author_id) {
      toastError(t('articles.validation.opinionAuthorRequired'));
      return;
    }
    if (!values.primary_category_id) {
      toastError(t('articles.validation.primaryRequired'));
      return;
    }

    const payload = buildPayload(values);

    if (isEdit && articleId !== null) {
      update.mutate(
        { id: articleId, payload },
        {
          onSuccess: () => {
            setSavedAt(Date.now());
            setNowTick(Date.now());
            reset(values, { keepValues: true, keepDirty: false, keepErrors: true });
            toastSuccess(t('articles.savedDraft'));
          },
        },
      );
      return;
    }

    create.mutate(payload, {
      onSuccess: (created) => {
        // After create/publish, return to the listing table (not the form).
        const goList = () => navigate(paths.articles);

        if (intent === 'publish' || intent === 'submit') {
          const status = intent === 'publish' ? 'published' : 'submitted';
          transition.mutate(
            { id: created.id, status },
            {
              onSuccess: () => {
                toastSuccess(
                  intent === 'publish'
                    ? t('articles.savedPublished')
                    : t('articles.savedSubmitted'),
                );
                goList();
              },
              // Article exists as a draft; the transition toast surfaces the error.
              onError: goList,
            },
          );
        } else {
          toastSuccess(t('articles.savedDraft'));
          goList();
        }
      },
    });
  };

  const submit = (intent: SubmitIntent) =>
    handleSubmit(
      (values) => doSubmit(values, intent),
      () => toastError(t('articles.validation.formInvalid')),
    )();

  const saving = create.isPending || update.isPending || transition.isPending;

  /** Find a category by id anywhere in the tree (used for preview labels). */
  const findCategoryName = (id: number | undefined): string | null => {
    if (!id) return null;
    const initial = Array.isArray(catsQ.data) ? catsQ.data : [];
    const stack: CategoryData[] = [...initial];
    while (stack.length > 0) {
      const n = stack.pop();
      if (!n) continue;
      if (n.id === id) return n.name;
      if (Array.isArray(n.children)) stack.push(...n.children);
    }
    return null;
  };

  const categoryError = formState.errors.primary_category_id?.message;

  // Autosave / dirty status pill shown in the header.
  const autosaveNode = autosaving ? (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {t('articles.form.cockpit.autosave.saving')}
    </span>
  ) : savedAt !== null && !isDirty ? (
    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
      <Check className="h-3.5 w-3.5" />
      {t('articles.form.cockpit.autosave.savedAgo', {
        rel: ((r) => t(r.key, { n: r.n }))(relAutosave(savedAt, nowTick)),
      })}
    </span>
  ) : isDirty ? (
    <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
      <CircleAlert className="h-3.5 w-3.5" />
      {isEdit
        ? t('articles.form.cockpit.autosave.unsaved')
        : t('articles.form.cockpit.autosave.draftUnsaved')}
    </span>
  ) : null;

  const primaryActionLabel = isEdit
    ? t('articles.form.save')
    : isEditorial
      ? t('articles.form.publishNow')
      : t('articles.form.submitReview');

  const onPrimary = () => submit(isEdit ? 'save' : isEditorial ? 'publish' : 'submit');

  return (
    <div className="pb-24">
      {/* ─── TOP HEADER (sticky) — breadcrumb, status, autosave, quick actions ─ */}
      <header className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto max-w-screen-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to={paths.articles} className="hover:text-foreground">
                {t('articles.title')}
              </Link>
              <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
              <span className="text-foreground">
                {isEdit ? t('articles.form.editTitle') : t('articles.form.createTitle')}
              </span>
            </nav>
            <div className="flex flex-wrap items-center gap-3">
              {autosaveNode}
              <Badge variant={article ? STATUS_VARIANT[article.status] : 'muted'}>
                {t(`articles.status.${article?.status ?? 'draft'}`)}
              </Badge>
              {isEdit && article?.type === 'live' ? (
                <Button variant="outline" size="sm" asChild>
                  <Link to={paths.articlesLive.replace(':id', String(articleId))}>
                    <Radio className="h-4 w-4 text-destructive" />
                    {t('liveCoverage.manageButton')}
                  </Link>
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="sm" onClick={() => setPreviewOpen(true)}>
                <Eye className="h-4 w-4" />
                {t('articles.form.preview')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onPrimary();
        }}
        className="mx-auto mt-6 max-w-screen-2xl"
        noValidate
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* ─── CENTER COLUMN — the writing workspace dominates ─────────────── */}
          <div className="min-w-0 space-y-5">
            <Section title={t('articles.form.cockpit.summary')} hint={t('articles.form.cockpit.summaryHint')} icon={AlignLeft}>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <TextField
                    label={t('articles.form.title')}
                    placeholder={t('articles.form.cockpit.titlePlaceholder')}
                    error={formState.errors.title}
                    dir="auto"
                    {...register('title')}
                  />
                  {canUseAi ? (
                    <HeadlineSuggestions
                      getContext={buildAiContext}
                      onApply={(headline) =>
                        setValue('title', headline, { shouldDirty: true, shouldValidate: true })
                      }
                    />
                  ) : null}
                </div>
                <TextField
                  label={t('articles.form.subtitle')}
                  error={formState.errors.subtitle}
                  {...register('subtitle')}
                />
                <div className="space-y-2">
                  <TextareaField
                    label={t('articles.form.excerpt')}
                    rows={3}
                    error={formState.errors.excerpt}
                    {...register('excerpt')}
                  />
                  {canUseAi ? (
                    <ExcerptGenerate
                      getContext={buildAiContext}
                      onApply={(excerpt) =>
                        setValue('excerpt', excerpt, { shouldDirty: true, shouldValidate: true })
                      }
                    />
                  ) : null}
                </div>
              </div>
            </Section>

            <Section
              title={t('articles.form.cockpit.body')}
              hint={t('articles.form.cockpit.bodyHint')}
              icon={FileText}
              bodyClassName="p-4 sm:p-5"
            >
              <Controller
                control={control}
                name="content_json"
                render={({ field }) => (
                  <ArticleEditor
                    value={field.value}
                    onChange={field.onChange}
                    articleId={articleId}
                    locale={locale}
                  />
                )}
              />
              {!isEdit ? (
                <p className="mt-2 text-xs text-muted-foreground">{t('articles.form.bodyImageHint')}</p>
              ) : null}
              {canUseAi ? (
                <div className="mt-4">
                  <ContentAnalysisCard getContext={buildAiContext} />
                </div>
              ) : null}
            </Section>

            {/* Advanced — collapsed by default (hide complexity, preserve power) */}
            <CollapsibleSection
              title={t('articles.form.cockpit.advancedSeo')}
              hint={t('articles.form.cockpit.advancedSeoHint')}
              icon={Sparkles}
            >
              <SeoPanel
                title={watched.title ?? ''}
                excerpt={watched.excerpt ?? ''}
                slug={watched.slug ?? ''}
                locale={watched.locale ?? 'ar'}
                seoTitle={watched.seo_title ?? ''}
                seoDescription={watched.seo_description ?? ''}
                seoKeywords={watched.seo_keywords ?? ''}
                canonicalUrl={watched.canonical_url ?? ''}
                robots={watched.robots ?? ''}
                coverUrl={coverUrl}
                sharePath={article?.canonical_path ?? null}
                onChange={(p) => {
                  if (p.seoTitle !== undefined) setValue('seo_title', p.seoTitle, { shouldDirty: true });
                  if (p.seoDescription !== undefined) setValue('seo_description', p.seoDescription, { shouldDirty: true });
                  if (p.seoKeywords !== undefined) setValue('seo_keywords', p.seoKeywords, { shouldDirty: true });
                  if (p.canonicalUrl !== undefined) setValue('canonical_url', p.canonicalUrl, { shouldDirty: true });
                  if (p.robots !== undefined) setValue('robots', p.robots, { shouldDirty: true });
                }}
              />
              {canUseAi ? (
                <div className="mt-4">
                  <SeoAnalysisCard
                    getPayload={() => {
                      const v = getValues();
                      return {
                        title: v.seo_title || v.title || undefined,
                        excerpt: v.seo_description || v.excerpt || undefined,
                        body: tiptapText(v.content_json) || undefined,
                        slug: v.slug || undefined,
                        tags: v.tags ?? [],
                        locale: v.locale,
                      };
                    }}
                  />
                </div>
              ) : null}
            </CollapsibleSection>

            <CollapsibleSection
              title={t('articles.form.cockpit.advancedMeta')}
              hint={t('articles.form.cockpit.advancedMetaHint')}
              icon={Settings2}
            >
              <Controller
                control={control}
                name="slug"
                render={({ field }) => (
                  <SlugField
                    title={watched.title ?? ''}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    error={formState.errors.slug?.message}
                    locale={watched.locale ?? 'ar'}
                    articleId={articleId}
                  />
                )}
              />
            </CollapsibleSection>
          </div>

          {/* ─── RIGHT SIDEBAR (sticky) — editorial controls + publish ──────── */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            {/* Publishing — primary CTA hierarchy (1. Publish/Save, 2. Draft, 3. Preview) */}
            <Section title={t('articles.form.cockpit.publish')}>
              <div className="space-y-2">
                <Button type="button" className="w-full" onClick={onPrimary} disabled={saving}>
                  {isEdit ? <Save className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  {primaryActionLabel}
                </Button>
                {!isEdit ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => submit('draft')}
                    disabled={saving}
                  >
                    {t('articles.form.saveDraft')}
                  </Button>
                ) : null}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1"
                    onClick={() => setPreviewOpen(true)}
                  >
                    <Eye className="h-4 w-4" />
                    {t('articles.form.preview')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1"
                    onClick={() => navigate(paths.articles)}
                  >
                    {t('articles.form.cancel')}
                  </Button>
                </div>
              </div>
            </Section>

            <Section title={t('articles.form.cockpit.settings')} hint={t('articles.form.cockpit.settingsHint')} icon={Settings2}>
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label={t('articles.form.type')}
                  error={formState.errors.type}
                  options={TYPES.map((v) => ({ value: v, label: t(`articles.type.${v}`) }))}
                  {...register('type')}
                />
                <SelectField
                  label={t('articles.form.locale')}
                  error={formState.errors.locale}
                  options={LOCALES.map((v) => ({ value: v, label: t(`articles.locale.${v}`) }))}
                  {...register('locale')}
                />
              </div>
            </Section>

            <Section title={t('articles.form.cockpit.categories')} hint={t('articles.form.categoriesHelp')} icon={Layers}>
              <CategoryPicker
                options={allowedCats}
                selected={selectedCategoryIds}
                onToggle={toggleCategory}
                onClear={clearCategories}
                error={categoryError ? t(String(categoryError)) : undefined}
              />
            </Section>

            <Section title={t('mediaStudio.title')} hint={t('mediaStudio.hint')} icon={ImageIcon}>
              <MediaStudio staging={staging} />
            </Section>

            {type === 'opinion' && isEditorial ? (
              <Section title={t('articles.form.cockpit.author')} hint={t('articles.form.secOpinionAuthorHint')} icon={User}>
                <Controller
                  control={control}
                  name="author_id"
                  render={({ field }) => (
                    <WriterPicker
                      label={t('articles.form.opinionAuthor')}
                      value={field.value}
                      onChange={field.onChange}
                      initialAuthor={
                        article?.author
                          ? { id: article.author.id, name: article.author.name }
                          : null
                      }
                      canCreate={canCreateUsers}
                    />
                  )}
                />
              </Section>
            ) : null}

            <Section title={t('articles.form.cockpit.tagsTitle')} hint={t('articles.form.secTagsHint')} icon={TagsIcon}>
              <Controller
                control={control}
                name="tags"
                render={({ field }) => (
                  <div className="space-y-2">
                    <TagsInput
                      value={field.value}
                      onChange={field.onChange}
                      locale={watched.locale ?? 'ar'}
                      suggested={tagSuggestions}
                    />
                    {canUseAi ? (
                      <TagSuggest
                        getContext={buildAiContext}
                        current={field.value ?? []}
                        onAdd={(tag) => {
                          if (!(field.value ?? []).some((x) => x.toLowerCase() === tag.toLowerCase())) {
                            field.onChange([...(field.value ?? []), tag]);
                          }
                        }}
                      />
                    ) : null}
                  </div>
                )}
              />
            </Section>

            <Section title={t('entities.title')} icon={Users}>
              <EntityTagsInput contentType="article" contentId={article?.id} />
            </Section>

            <Section title={t('articles.form.cockpit.visibility')} hint={t('articles.form.secFlagsHint')} icon={Eye}>
              <div className="space-y-4">
                {isEditorial ? (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-muted-foreground">{t('articles.form.displayGroup')}</p>
                    {DISPLAY_FLAGS.map((flag) => (
                      <Controller
                        key={flag.key}
                        control={control}
                        name={flag.key}
                        render={({ field }) => (
                          <SwitchField
                            label={t(flag.labelKey)}
                            description={t(`${flag.labelKey}Hint`)}
                            checked={!!field.value}
                            onChange={field.onChange}
                          />
                        )}
                      />
                    ))}
                  </div>
                ) : null}

                <div className={isEditorial ? 'space-y-3 border-t border-border pt-4' : 'space-y-3'}>
                  <p className="text-xs font-bold text-muted-foreground">{t('articles.form.interactionGroup')}</p>
                  <Controller
                    control={control}
                    name="comments_enabled"
                    render={({ field }) => (
                      <SwitchField
                        label={t('articles.form.commentsEnabled')}
                        description={t('articles.form.commentsEnabledHint')}
                        checked={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                  {isEditorial ? (
                    <TextField
                      label={t('articles.form.viewsCount')}
                      type="number"
                      min={0}
                      error={formState.errors.views_count}
                      {...register('views_count', { valueAsNumber: true })}
                    />
                  ) : null}
                </div>
              </div>
            </Section>

            {isEdit && article ? (
              <ArticleWorkflowPanel article={article} isEditorial={isEditorial} isOwner={isOwner} />
            ) : null}
          </aside>
        </div>
      </form>

      {/* Mobile-only sticky action bar — keeps the primary CTA reachable when the
          sidebar has stacked below the editor on small screens. */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4" />
            {t('articles.form.preview')}
          </Button>
          {!isEdit ? (
            <Button type="button" variant="outline" onClick={() => submit('draft')} disabled={saving}>
              {t('articles.form.saveDraft')}
            </Button>
          ) : null}
          <Button type="button" className="flex-1" onClick={onPrimary} disabled={saving}>
            {isEdit ? <Save className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {primaryActionLabel}
          </Button>
        </div>
      </div>

      <ArticlePreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        articleId={articleId}
        title={watched.title ?? ''}
        subtitle={watched.subtitle ?? ''}
        excerpt={watched.excerpt ?? ''}
        type={watched.type ?? 'news'}
        status={article?.status ?? null}
        locale={watched.locale ?? 'ar'}
        author={article?.author ?? null}
        primaryCategory={
          watched.primary_category_id
            ? { name: findCategoryName(watched.primary_category_id) ?? '—' }
            : null
        }
        coverUrl={coverUrl}
        tags={watched.tags ?? []}
        flags={{
          featured: watched.is_featured ?? false,
          breaking: watched.is_breaking ?? false,
          header: watched.is_header ?? false,
        }}
        doc={watched.content_json}
      />
    </div>
  );
}
