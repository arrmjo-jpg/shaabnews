import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArchiveRestore,
  BookOpen,
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  PinOff,
  Plus,
  SquarePen,
  Star,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable, type Column } from '@/components/data/DataTable';
import { Pagination } from '@/components/data/Pagination';
import { SearchInput } from '@/components/data/SearchInput';
import { ErrorState } from '@/components/feedback';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/router/paths';
import { articlesService } from '@/services/articles.service';
import {
  useArticleStats,
  useArticles,
  useCategories,
  useClearBreaking,
  useClearPinned,
  useDeleteArticle,
  useForceDeleteArticle,
  useRestoreArticle,
  useUpdateArticle,
  useWritersList,
} from '../hooks';
import { ArticleRowShare } from '../components/ArticleRowShare';
import { EngagementMetricsButton } from '../components/EngagementMetricsButton';
import { DISPLAY_FLAGS } from '../constants';
import type {
  ArticleData,
  ArticleStatus,
  ArticleType,
  ArticlesListParams,
  ContentLocale,
} from '@/types/content.types';
import type { NormalizedError } from '@/types/api';

const PER_PAGE = 15;

const selectCls =
  'h-10 border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const STATUS_VARIANTS: Record<
  ArticleStatus,
  'default' | 'success' | 'muted' | 'destructive'
> = {
  draft: 'muted',
  submitted: 'default',
  in_review: 'default',
  scheduled: 'default',
  published: 'success',
  rejected: 'destructive',
  archived: 'muted',
};

// نوع المقال ملوّن: خبر=أخضر، رأي=أزرق (primary)، تغطية حيّة=أحمر
const TYPE_VARIANTS: Record<ArticleType, 'default' | 'success' | 'destructive'> = {
  news: 'success',
  opinion: 'default',
  live: 'destructive',
};

export default function ArticlesPage() {
  const { t, i18n } = useTranslation('content');
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { confirm, error: showError } = useToast();

  const canCreate = hasPermission('articles.create');
  const canEdit = hasPermission('articles.edit');
  const canDelete = hasPermission('articles.delete');
  const canRestore = hasPermission('articles.restore');
  const canForceDelete = hasPermission('articles.force_delete');

  // Deep link and filters synced directly with the browser's URL search parameters
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo<ArticlesListParams>(() => {
    return {
      page: Number(searchParams.get('page')) || 1,
      per_page: PER_PAGE,
      search: searchParams.get('search') || '',
      status: (searchParams.get('status') as ArticlesListParams['status']) || '',
      type: (searchParams.get('type') as ArticlesListParams['type']) || '',
      locale: (searchParams.get('locale') as ArticlesListParams['locale']) || '',
      category: searchParams.get('category') ? Number(searchParams.get('category')) : '',
      author_id: searchParams.get('author_id') ? Number(searchParams.get('author_id')) : '',
      placement: (searchParams.get('placement') as ArticlesListParams['placement']) || '',
      // الأحدث أولًا حسب تاريخ النشر الفعليّ (created_at = وقت الاستيراد، مقلوب لأخبار فيرتكس).
      sort: (searchParams.get('sort') as ArticlesListParams['sort']) || '-published_at',
      trashed: (searchParams.get('trashed') as ArticlesListParams['trashed']) || '',
    };
  }, [searchParams]);

  const q = useArticles(params);
  const statsQ = useArticleStats();
  const catsQ = useCategories();
  const writersQ = useWritersList();
  const del = useDeleteArticle();
  const restore = useRestoreArticle();
  const forceDel = useForceDeleteArticle();
  const update = useUpdateArticle();
  const clearBreaking = useClearBreaking();
  const clearPinned = useClearPinned();

  // إزالة مقال من منطقة عرض (إطفاء العلم) — بعد تأكيد صريح.
  const removeFlag = async (
    a: ArticleData,
    key: (typeof DISPLAY_FLAGS)[number]['key'],
    zoneLabel: string,
  ) => {
    if (
      await confirm({
        title: t('articles.confirm.removePlacementTitle'),
        text: t('articles.confirm.removePlacementText', { zone: zoneLabel }),
        confirmText: t('articles.confirm.removePlacementYes'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      update.mutate({ id: a.id, payload: { [key]: false } });
  };

  const onClearBreaking = async () => {
    if (
      await confirm({
        title: t('articles.confirm.clearBreakingTitle'),
        text: t('articles.confirm.clearBreakingText'),
        confirmText: t('articles.confirm.clearBreakingYes'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      clearBreaking.mutate();
  };

  const onClearPinned = async () => {
    if (
      await confirm({
        title: t('articles.confirm.clearPinnedTitle'),
        text: t('articles.confirm.clearPinnedText'),
        confirmText: t('articles.confirm.clearPinnedYes'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      clearPinned.mutate();
  };

  const patch = useCallback(
    (p: Partial<ArticlesListParams>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(p).forEach(([key, val]) => {
          if (val === undefined || val === null || val === '') {
            next.delete(key);
          } else {
            next.set(key, String(val));
          }
        });
        // Reset to page 1 if changing filters other than page itself
        if (!('page' in p)) {
          next.set('page', '1');
        }
        return next;
      });
    },
    [setSearchParams]
  );

  // صفحة مطلوبة يدوياً (رابط قديم/مُعدَّل) تتجاوز حد الـ Backend (404) — نجلب
  // صفحة 1 بنفس الفلاتر لمعرفة meta.total_pages الفعلي (المُقيَّد بـ maxPage
  // في الـ Backend) وننتقل إليها مباشرة، بدل تخمين رقم ثابت في الواجهة قد
  // ينحرف عن قيمة الـ Backend الحقيقية، وبدل إرجاع المستخدم لصفحة 1 بلا داعٍ.
  useEffect(() => {
    const err = q.error as NormalizedError | null;
    if (!q.isError || err?.status !== 404 || params.page <= 1) return;

    let cancelled = false;
    articlesService
      .list({ ...params, page: 1 })
      .then((res) => {
        if (cancelled) return;
        showError(t('articles.pagination_out_of_range'));
        patch({ page: res.pagination.total_pages || 1 });
      })
      .catch(() => {
        if (!cancelled) patch({ page: 1 });
      });

    return () => {
      cancelled = true;
    };
  }, [q.isError, q.error, params, patch, showError, t]);

  const fmtDate = (v: string | null) =>
    v
      ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
          new Date(v),
        )
      : '—';

  // Flatten the category tree for the filter dropdown (defensive against
  // missing children / non-array payloads).
  const categoriesFlat = useMemo(() => {
    const out: Array<{ id: number; label: string; locale: ContentLocale }> = [];
    const walk = (nodes: unknown, depth = 0): void => {
      if (!Array.isArray(nodes)) return;
      for (const n of nodes) {
        if (!n || typeof n !== 'object') continue;
        const node = n as {
          id: number;
          name: string;
          locale: ContentLocale;
          children?: unknown;
        };
        out.push({
          id: node.id,
          label: `${'— '.repeat(depth)}${node.name}`,
          locale: node.locale,
        });
        walk(node.children, depth + 1);
      }
    };
    walk(catsQ.data);
    return out;
  }, [catsQ.data]);

  const onDelete = async (a: ArticleData) => {
    if (
      await confirm({
        title: t('articles.confirm.deleteTitle'),
        text: t('articles.confirm.deleteText', { title: a.title }),
        confirmText: t('articles.confirm.yes'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      del.mutate(a.id);
  };

  const onForceDelete = async (a: ArticleData) => {
    if (
      await confirm({
        title: t('articles.confirm.forceDeleteTitle'),
        text: t('articles.confirm.forceDeleteText', { title: a.title }),
        confirmText: t('articles.confirm.forceDeleteYes'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      forceDel.mutate(a.id);
  };

  const openEdit = (a: ArticleData) => navigate(paths.articlesEdit.replace(':id', String(a.id)));
  const openLive = (a: ArticleData) => navigate(paths.articlesLive.replace(':id', String(a.id)));
  const openCreate = () => navigate(paths.articlesCreate);

  const columns: Column<ArticleData>[] = [
    {
      key: 'title',
      header: t('articles.col.title'),
      render: (a) => (
        <div className="min-w-0 max-w-md">
          <p className="truncate font-medium">{a.title}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">
              {t('articles.by')} {a.author?.name ?? '—'}
            </span>
            <ArticleRowShare article={a} />
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: t('articles.col.type'),
      render: (a) => {
        const badge = (
          <Badge variant={TYPE_VARIANTS[a.type]}>{t(`articles.type.${a.type}`)}</Badge>
        );
        // التغطية الحيّة: نفس حجم الشارة، لكن قابلة للنقر تفتح كونسول التغطية
        if (a.type === 'live' && canEdit) {
          return (
            <button
              type="button"
              onClick={() => openLive(a)}
              title={t('articles.action.liveCoverage')}
              className="cursor-pointer transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {badge}
            </button>
          );
        }
        return badge;
      },
    },
    {
      key: 'status',
      header: t('articles.col.status'),
      render: (a) => (
        <Badge variant={STATUS_VARIANTS[a.status]}>
          {t(`articles.status.${a.status}`)}
        </Badge>
      ),
    },
    {
      key: 'locale',
      header: t('articles.col.locale'),
      render: (a) => (
        <span className="text-xs uppercase text-muted-foreground">{a.locale}</span>
      ),
    },
    {
      key: 'category',
      header: t('articles.col.category'),
      render: (a) => {
        const cats = [
          ...(a.primary_category ? [{ ...a.primary_category, primary: true }] : []),
          ...(a.secondary_categories ?? []).map((c) => ({ ...c, primary: false })),
        ];
        if (cats.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {cats.map((c) => (
              <span
                key={c.id}
                title={c.primary ? t('articles.col.primaryTag') : undefined}
                className={
                  'inline-flex items-center border px-1.5 py-0.5 text-xs ' +
                  (c.primary
                    ? 'border-primary/40 bg-primary/5 font-medium text-primary'
                    : 'border-border text-muted-foreground')
                }
              >
                {c.name}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'display',
      header: t('articles.col.display'),
      render: (a) => {
        const active = DISPLAY_FLAGS.filter((f) => a[f.key]);
        if (active.length === 0) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {active.map((f) => (
              <Badge key={f.key} variant={f.variant} className="gap-1">
                {t(f.labelKey)}
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => void removeFlag(a, f.key, t(f.labelKey))}
                    title={t('articles.action.removePlacement')}
                    className="-me-1 inline-flex items-center hover:opacity-70"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      key: 'published',
      header: t('articles.col.published'),
      render: (a) => (
        <span className="text-sm text-muted-foreground">{fmtDate(a.published_at)}</span>
      ),
    },
    {
      key: 'metrics',
      header: t('engagement.colHeader'),
      align: 'center',
      render: (a) => <EngagementMetricsButton metrics={a.metrics} locale={i18n.language} />,
    },
    {
      key: 'actions',
      header: t('articles.col.actions'),
      align: 'end',
      render: (a) => {
        const trashed = Boolean(a.deleted_at);
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!trashed && canEdit ? (
                <DropdownMenuItem onClick={() => openEdit(a)}>
                  <Pencil className="h-4 w-4" />
                  {t('articles.action.edit')}
                </DropdownMenuItem>
              ) : null}
              {!trashed && canDelete ? (
                <DropdownMenuItem
                  onClick={() => onDelete(a)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  {t('articles.action.delete')}
                </DropdownMenuItem>
              ) : null}
              {trashed && canRestore ? (
                <DropdownMenuItem onClick={() => restore.mutate(a.id)}>
                  <ArchiveRestore className="h-4 w-4" />
                  {t('articles.action.restore')}
                </DropdownMenuItem>
              ) : null}
              {trashed && canForceDelete ? (
                <DropdownMenuItem
                  onClick={() => onForceDelete(a)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  {t('articles.action.forceDelete')}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (q.isError) {
    const err = q.error as { message?: string; status?: number } | null;
    const detail = err?.message
      ? err.status
        ? `[${err.status}] ${err.message}`
        : err.message
      : undefined;
    return <ErrorState message={detail} onRetry={() => void q.refetch()} />;
  }

  const s = statsQ.data;
  const canSeeTrashed = canRestore || canForceDelete;
  const statCards: Array<{
    key: string;
    label: string;
    value?: number;
    icon: typeof BookOpen;
    color: string;
    tint: string;
    onClick?: () => void;
  }> = [
    { key: 'total', label: t('articles.stats.total'), value: s?.total, icon: BookOpen, color: 'text-primary', tint: 'bg-primary/10' },
    { key: 'published', label: t('articles.stats.published'), value: s?.published, icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', tint: 'bg-emerald-500/12' },
    { key: 'draft', label: t('articles.stats.draft'), value: s?.draft, icon: SquarePen, color: 'text-amber-600 dark:text-amber-400', tint: 'bg-amber-500/12' },
    // بطاقة «العاجل» أُزيلت: عدّادها كان COUNT بلا فهرس (~200ms) يبطّئ كل فتح للصفحة.
    { key: 'featured', label: t('articles.stats.featured'), value: s?.featured, icon: Star, color: 'text-purple-600 dark:text-purple-400', tint: 'bg-purple-500/12' },
    {
      key: 'deleted',
      label: t('articles.stats.deleted'),
      value: s?.deleted,
      icon: Trash2,
      color: 'text-destructive',
      tint: 'bg-destructive/10',
      onClick: canSeeTrashed
        ? () => patch({ trashed: params.trashed === 'only' ? '' : 'only' })
        : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('articles.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('articles.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <Button
              variant="outline"
              onClick={() => void onClearBreaking()}
              disabled={clearBreaking.isPending}
              className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
            >
              <Zap className="h-4 w-4" />
              {t('articles.clearBreaking')}
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              variant="outline"
              onClick={() => void onClearPinned()}
              disabled={clearPinned.isPending}
              className="border-sky-500/50 text-sky-600 hover:bg-sky-500/10 dark:text-sky-400"
            >
              <PinOff className="h-4 w-4" />
              {t('articles.clearPinned')}
            </Button>
          ) : null}
          {canCreate ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t('articles.new')}
            </Button>
          ) : null}
        </div>
      </header>

      {/* Soft article-statistics cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {statCards.map((c) => {
          const Icon = c.icon;
          const active = c.key === 'deleted' && params.trashed === 'only';
          return (
            <button
              key={c.key}
              type="button"
              onClick={c.onClick}
              disabled={!c.onClick}
              className={`flex items-center justify-between gap-2 border bg-background p-4 text-start shadow-soft transition-colors ${
                active ? 'border-destructive' : 'border-border'
              } ${c.onClick ? 'cursor-pointer hover:border-primary' : 'cursor-default'}`}
            >
              <div className="min-w-0">
                <p className={`text-2xl font-bold ${c.color}`}>
                  {c.value != null ? c.value.toLocaleString(i18n.language) : '—'}
                </p>
                <p className="truncate text-xs text-muted-foreground">{c.label}</p>
              </div>
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center ${c.tint} ${c.color}`}
              >
                <Icon className="h-5 w-5" />
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 border border-border bg-background p-3">
        <SearchInput
          value={params.search}
          onDebouncedChange={(v) => patch({ search: v })}
          placeholder={t('articles.searchPlaceholder')}
        />
        <select
          className={selectCls}
          value={params.status}
          onChange={(e) => patch({ status: e.target.value as ArticlesListParams['status'] })}
        >
          <option value="">{t('articles.filter.statusAll')}</option>
          {(
            [
              'draft',
              'submitted',
              'in_review',
              'scheduled',
              'published',
              'rejected',
              'archived',
            ] as ArticleStatus[]
          ).map((s) => (
            <option key={s} value={s}>
              {t(`articles.status.${s}`)}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={params.type}
          onChange={(e) => patch({ type: e.target.value as ArticlesListParams['type'] })}
        >
          <option value="">{t('articles.filter.typeAll')}</option>
          <option value="news">{t('articles.type.news')}</option>
          <option value="opinion">{t('articles.type.opinion')}</option>
          <option value="live">{t('articles.type.live')}</option>
        </select>
        <select
          className={selectCls}
          value={params.placement}
          onChange={(e) =>
            patch({ placement: e.target.value as ArticlesListParams['placement'] })
          }
        >
          <option value="">{t('articles.filter.placementAll')}</option>
          {DISPLAY_FLAGS.map((flag) => (
            <option key={flag.key} value={flag.key}>
              {t(flag.labelKey)}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={params.locale}
          onChange={(e) => patch({ locale: e.target.value as ArticlesListParams['locale'] })}
        >
          <option value="">{t('articles.filter.localeAll')}</option>
          <option value="ar">{t('articles.locale.ar')}</option>
          <option value="en">{t('articles.locale.en')}</option>
        </select>
        <select
          className={selectCls}
          value={params.category}
          onChange={(e) =>
            patch({
              category: e.target.value === '' ? '' : Number(e.target.value),
            })
          }
        >
          <option value="">{t('articles.filter.categoryAll')}</option>
          {categoriesFlat.map((c) => (
            <option key={c.id} value={c.id}>
              [{c.locale}] {c.label}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={params.author_id ?? ''}
          onChange={(e) =>
            patch({
              author_id: e.target.value === '' ? '' : Number(e.target.value),
            })
          }
        >
          <option value="">{t('articles.filter.authorAll')}</option>
          {(writersQ.data?.data ?? []).map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={params.sort}
          onChange={(e) => patch({ sort: e.target.value as ArticlesListParams['sort'] })}
        >
          <option value="-created_at">{t('articles.sort.createdDesc')}</option>
          <option value="-published_at">{t('articles.sort.publishedDesc')}</option>
          <option value="title">{t('articles.sort.titleAsc')}</option>
          <option value="id">{t('articles.sort.idAsc')}</option>
        </select>
        {canRestore || canForceDelete ? (
          <select
            className={selectCls}
            value={params.trashed}
            onChange={(e) => patch({ trashed: e.target.value as ArticlesListParams['trashed'] })}
          >
            <option value="">{t('articles.filter.trashedNone')}</option>
            <option value="only">{t('articles.filter.trashedOnly')}</option>
          </select>
        ) : null}
      </div>

      <div className={q.isFetching && !q.isLoading ? 'opacity-70 transition-opacity duration-200' : ''}>
        <DataTable
          columns={columns}
          rows={q.data?.data ?? []}
          rowKey={(a) => a.id}
          loading={q.isLoading}
        />
      </div>

      {q.data ? <Pagination meta={q.data.pagination} onPage={(page) => patch({ page })} /> : null}
    </div>
  );
}
