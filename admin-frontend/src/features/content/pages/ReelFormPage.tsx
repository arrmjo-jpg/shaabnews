import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowRight, Archive, CalendarClock, Save, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { TextField } from '@/components/form/TextField';
import { TextareaField } from '@/components/form/TextareaField';
import { SelectField } from '@/components/form/SelectField';
import { SwitchField } from '@/components/form/SwitchField';
import { ErrorState } from '@/components/feedback';
import { paths } from '@/router/paths';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import {
  useCreateReel,
  useReel,
  useTransitionReel,
  useUpdateReel,
} from '../reels.hooks';
import { ReelVideoUploader } from '../components/reels/ReelVideoUploader';
import { EntityTagsInput } from '../components/EntityTagsInput';
import { SeoPanel } from '../components/SeoPanel';
import { HeadlineSuggestions } from '../components/ai/HeadlineSuggestions';
import { ExcerptGenerate } from '../components/ai/ExcerptGenerate';
import { ContentAnalysisCard } from '../components/ai/ContentAnalysisCard';
import { SeoAnalysisCard } from '../components/ai/SeoAnalysisCard';
import { EngagementMetricsButton } from '../components/EngagementMetricsButton';
import type {
  AiEditorialContext,
  ContentLocale,
  ReelStatus,
  ReelUpsertPayload,
} from '@/types/content.types';

interface FormState {
  title: string;
  description: string;
  is_featured: boolean;
  locale: ContentLocale;
  media_asset_id: number | null;
  slug: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  canonical_url: string;
  robots: string;
}

const EMPTY: FormState = {
  title: '',
  description: '',
  is_featured: false,
  locale: 'ar',
  media_asset_id: null,
  slug: '',
  seo_title: '',
  seo_description: '',
  seo_keywords: '',
  canonical_url: '',
  robots: '',
};

const STATUS_TONE: Record<ReelStatus, 'success' | 'muted'> = {
  published: 'success',
  scheduled: 'muted',
  draft: 'muted',
  archived: 'muted',
  submitted: 'muted',
  in_review: 'muted',
  rejected: 'muted',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border border-border bg-background p-4">
      <h2 className="text-sm font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default function ReelFormPage() {
  const { t, i18n } = useTranslation('content');
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const reelId = id ? Number(id) : null;
  const isEdit = reelId !== null;

  const { hasPermission } = useAuth();
  const { success, confirm } = useToast();
  const canUseAi = hasPermission('ai.use');
  const canPublish = hasPermission('reels.publish');
  const canArchive = hasPermission('reels.archive');

  const [form, setForm] = useState<FormState>(EMPTY);
  const [baseline, setBaseline] = useState<string>(JSON.stringify(EMPTY));
  const [scheduleAt, setScheduleAt] = useState('');
  const [mediaStatus, setMediaStatus] = useState<string | null>(null);

  const q = useReel(reelId);
  const reel = q.data;
  const create = useCreateReel();
  const update = useUpdateReel();
  const transition = useTransitionReel();

  useEffect(() => {
    if (!reel) return;
    const hydrated: FormState = {
      title: reel.title,
      description: reel.description ?? '',
      is_featured: reel.is_featured,
      locale: reel.locale,
      media_asset_id: reel.media_asset_id,
      slug: reel.slug,
      seo_title: reel.seo.title ?? '',
      seo_description: reel.seo.description ?? '',
      seo_keywords: reel.seo.keywords ?? '',
      canonical_url: reel.seo.canonical_url ?? '',
      robots: reel.seo.robots ?? '',
    };
    setForm(hydrated);
    setBaseline(JSON.stringify(hydrated));
    setMediaStatus(reel.media?.processing_status ?? null);
  }, [reel]);

  const patch = (p: Partial<FormState>) => setForm((prev) => ({ ...prev, ...p }));

  const dirty = JSON.stringify(form) !== baseline;
  const mediaReady = mediaStatus === 'ready';

  // حماية التغييرات غير المحفوظة عند إغلاق/تحديث التبويب.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const goBack = async () => {
    if (
      dirty &&
      !(await confirm({
        title: t('reels.form.unsavedTitle'),
        text: t('reels.form.unsavedText'),
        confirmText: t('reels.form.unsavedLeave'),
        cancelText: t('common.cancel', { ns: 'common' }),
      }))
    ) {
      return;
    }
    navigate(paths.reels);
  };

  const doPublish = async () => {
    if (!reel) return;
    if (
      await confirm({
        title: t('reels.confirm.publishTitle'),
        text: t('reels.confirm.publishText'),
        confirmText: t('reels.action.publish'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    ) {
      transition.mutate({ id: reel.id, status: 'published' });
    }
  };

  const doArchive = async () => {
    if (!reel) return;
    if (
      await confirm({
        title: t('reels.confirm.archiveTitle'),
        text: t('reels.confirm.archiveText'),
        confirmText: t('reels.action.archive'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    ) {
      transition.mutate({ id: reel.id, status: 'archived' });
    }
  };

  const buildAiContext = (): AiEditorialContext => ({
    title: form.title,
    excerpt: form.description,
    body: form.description,
    locale: form.locale,
  });

  const payload = (): ReelUpsertPayload => ({
    title: form.title.trim(),
    is_featured: form.is_featured,
    locale: form.locale,
    description: form.description.trim() || null,
    media_asset_id: form.media_asset_id,
    slug: form.slug.trim() || null,
    seo_title: form.seo_title.trim() || null,
    seo_description: form.seo_description.trim() || null,
    seo_keywords: form.seo_keywords.trim() || null,
    canonical_url: form.canonical_url.trim() || null,
    robots: form.robots.trim() || null,
  });

  const save = async () => {
    if (isEdit && reelId !== null) {
      await update.mutateAsync({ id: reelId, payload: payload() });
      setBaseline(JSON.stringify(form)); // لم يعد هناك تغييرات غير محفوظة
      success(t('reels.form.saved'));
    } else {
      const created = await create.mutateAsync(payload());
      setBaseline(JSON.stringify(form));
      success(t('reels.form.saved'));
      navigate(paths.reelsEdit.replace(':id', String(created.id)));
    }
  };

  const saving = create.isPending || update.isPending;

  if (isEdit && q.isError) {
    return <ErrorState onRetry={() => void q.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => void goBack()}>
            <ArrowRight className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isEdit ? t('reels.form.editTitle') : t('reels.form.createTitle')}
            </h1>
            {reel ? (
              <Badge variant={STATUS_TONE[reel.status]} className="mt-1">
                {t(`reels.status.${reel.status}`)}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEdit && reel ? (
            <EngagementMetricsButton metrics={reel.metrics} locale={i18n.language} />
          ) : null}
          <Button onClick={() => void save()} disabled={saving || form.title.trim().length < 2}>
            <Save className="h-4 w-4" />
            {saving ? t('reels.form.saving') : t('reels.form.save')}
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ─── Main column ─── */}
        <div className="space-y-6 lg:col-span-2">
          <Section title={t('reels.form.basics')}>
            <TextField
              label={t('reels.form.titleLabel')}
              value={form.title}
              onChange={(e) => patch({ title: e.target.value })}
              maxLength={200}
            />
            {canUseAi ? (
              <HeadlineSuggestions getContext={buildAiContext} onApply={(h) => patch({ title: h })} />
            ) : null}

            <TextareaField
              label={t('reels.form.descriptionLabel')}
              rows={4}
              value={form.description}
              onChange={(e) => patch({ description: e.target.value })}
              maxLength={5000}
            />
            {canUseAi ? (
              <ExcerptGenerate getContext={buildAiContext} onApply={(d) => patch({ description: d })} />
            ) : null}

            <SelectField
              label={t('articles.form.locale')}
              value={form.locale}
              onChange={(e) => patch({ locale: e.target.value as ContentLocale })}
              options={[
                { value: 'ar', label: t('articles.locale.ar') },
                { value: 'en', label: t('articles.locale.en') },
              ]}
            />
            <SwitchField
              label={t('reels.form.featured')}
              description={t('reels.form.featuredHint')}
              checked={form.is_featured}
              onChange={(v) => patch({ is_featured: v })}
            />
          </Section>

          <Section title={t('reels.form.video')}>
            <ReelVideoUploader
              initialMedia={reel?.media ?? null}
              onChange={(assetId) => patch({ media_asset_id: assetId })}
              onStatusChange={setMediaStatus}
            />
          </Section>

          <Section title={t('entities.title')}>
            <EntityTagsInput contentType="reel" contentId={reel?.id} />
          </Section>

          {canUseAi ? (
            <Section title={t('reels.form.aiTools')}>
              <ContentAnalysisCard getContext={buildAiContext} />
            </Section>
          ) : null}
        </div>

        {/* ─── Sidebar ─── */}
        <div className="space-y-6">
          {isEdit && reel ? (
            <Section title={t('reels.form.publishing')}>
              {/* حالة مجدوَلة: أظهر وقت النشر المقرّر */}
              {reel.status === 'scheduled' && reel.published_at ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                  {t('reels.form.scheduledFor', {
                    time: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(
                      new Date(reel.published_at),
                    ),
                  })}
                </p>
              ) : null}

              {/* تنبيه صارم: لا نشر/جدولة قبل جاهزية الفيديو */}
              {!mediaReady ? (
                <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {t('reels.form.mediaNotReadyHint')}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {canPublish && reel.status !== 'published' ? (
                  <Button variant="outline" size="sm" disabled={!mediaReady} onClick={() => void doPublish()}>
                    <Send className="h-4 w-4" />
                    {t('reels.action.publish')}
                  </Button>
                ) : null}
                {canArchive && reel.status !== 'archived' ? (
                  <Button variant="outline" size="sm" onClick={() => void doArchive()}>
                    <Archive className="h-4 w-4" />
                    {t('reels.action.archive')}
                  </Button>
                ) : null}
              </div>
              {canPublish ? (
                <div className="space-y-2 border-t border-border pt-3">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t('reels.form.schedule')}
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="datetime-local"
                      value={scheduleAt}
                      onChange={(e) => setScheduleAt(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!scheduleAt || !mediaReady}
                      onClick={() =>
                        transition.mutate({
                          id: reel.id,
                          status: 'scheduled',
                          publishedAt: new Date(scheduleAt).toISOString(),
                        })
                      }
                    >
                      {t('reels.form.scheduleBtn')}
                    </Button>
                  </div>
                </div>
              ) : null}
            </Section>
          ) : null}

          <Section title={t('reels.form.slugSection')}>
            <TextField
              label={t('reels.form.slugLabel')}
              value={form.slug}
              onChange={(e) => patch({ slug: e.target.value })}
              dir="ltr"
              maxLength={190}
              placeholder={t('articles.form.slugPlaceholder')}
            />
          </Section>

          <Section title={t('articles.form.secSeo')}>
            <SeoPanel
              title={form.title}
              seoTitle={form.seo_title}
              seoDescription={form.seo_description}
              seoKeywords={form.seo_keywords}
              canonicalUrl={form.canonical_url}
              robots={form.robots}
              excerpt={form.description}
              slug={form.slug}
              coverUrl={reel?.share_image ?? null}
              locale={form.locale}
              sharePath={reel?.canonical_path ?? null}
              onChange={(p) => {
                if (p.seoTitle !== undefined) patch({ seo_title: p.seoTitle });
                if (p.seoDescription !== undefined) patch({ seo_description: p.seoDescription });
                if (p.seoKeywords !== undefined) patch({ seo_keywords: p.seoKeywords });
                if (p.canonicalUrl !== undefined) patch({ canonical_url: p.canonicalUrl });
                if (p.robots !== undefined) patch({ robots: p.robots });
              }}
            />
            {canUseAi ? (
              <SeoAnalysisCard
                getPayload={() => ({
                  title: form.title,
                  excerpt: form.description,
                  slug: form.slug,
                  locale: form.locale,
                })}
              />
            ) : null}
          </Section>
        </div>
      </div>
    </div>
  );
}
