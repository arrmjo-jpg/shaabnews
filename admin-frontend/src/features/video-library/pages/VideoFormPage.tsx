import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  CalendarClock,
  ChevronDown,
  Save,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { TextField } from '@/components/form/TextField';
import { TextareaField } from '@/components/form/TextareaField';
import { SelectField } from '@/components/form/SelectField';
import { SwitchField } from '@/components/form/SwitchField';
import { ErrorState } from '@/components/feedback';
import { cn } from '@/lib/utils';
import { paths } from '@/router/paths';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { SeoPanel } from '@/features/content/components/SeoPanel';
import { HeadlineSuggestions } from '@/features/content/components/ai/HeadlineSuggestions';
import { ExcerptGenerate } from '@/features/content/components/ai/ExcerptGenerate';
import { ContentAnalysisCard } from '@/features/content/components/ai/ContentAnalysisCard';
import { SeoAnalysisCard } from '@/features/content/components/ai/SeoAnalysisCard';
import { EngagementMetricsButton } from '@/features/content/components/EngagementMetricsButton';
import { EntityTagsInput } from '@/features/content/components/EntityTagsInput';
import { VideoSourceManager } from '../components/VideoSourceManager';
import { useCreateVideo, useTransitionVideo, useUpdateVideo, useVideo, useVideoCategoryTree } from '../hooks';
import type { AiEditorialContext, ContentLocale } from '@/types/content.types';
import type { VideoCategoryData, VideoStatus, VideoUpsertPayload, VideoVisibility } from '@/types/videoLibrary.types';

interface FormState {
  title: string;
  description: string;
  excerpt: string;
  locale: ContentLocale;
  visibility: VideoVisibility;
  is_featured: boolean;
  video_category_id: number | null;
  media_asset_id: number | null;
  source_url: string | null;
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
  excerpt: '',
  locale: 'ar',
  visibility: 'public',
  is_featured: false,
  video_category_id: null,
  media_asset_id: null,
  source_url: null,
  slug: '',
  seo_title: '',
  seo_description: '',
  seo_keywords: '',
  canonical_url: '',
  robots: '',
};

const STATUS_TONE: Record<VideoStatus, 'success' | 'muted'> = {
  published: 'success',
  scheduled: 'muted',
  draft: 'muted',
  archived: 'muted',
  submitted: 'muted',
  in_review: 'muted',
  rejected: 'muted',
};

function flatten(nodes: VideoCategoryData[], depth = 0): Array<{ id: number; label: string }> {
  return nodes.flatMap((n) => [
    { id: n.id, label: `${'— '.repeat(depth)}${n.name}` },
    ...flatten(n.children ?? [], depth + 1),
  ]);
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="space-y-4 border border-border bg-background p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function VideoFormPage() {
  const { t, i18n } = useTranslation('videoLibrary');
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const videoId = id ? Number(id) : null;
  const isEdit = videoId !== null;

  const { hasPermission } = useAuth();
  const { success, confirm } = useToast();
  const canUseAi = hasPermission('ai.use');
  const canPublish = hasPermission('videos.publish');
  const canArchive = hasPermission('videos.archive');

  const [form, setForm] = useState<FormState>(EMPTY);
  const [baseline, setBaseline] = useState<string>(JSON.stringify(EMPTY));
  const [sourceTouched, setSourceTouched] = useState(false);
  const [mediaStatus, setMediaStatus] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState('');
  const [seoOpen, setSeoOpen] = useState(false);

  const q = useVideo(videoId);
  const video = q.data;
  const catQ = useVideoCategoryTree();
  const create = useCreateVideo();
  const update = useUpdateVideo();
  const transition = useTransitionVideo();

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    if (!video) return;
    const hydrated: FormState = {
      title: video.title,
      description: video.description ?? '',
      excerpt: video.excerpt ?? '',
      locale: video.locale,
      visibility: video.visibility,
      is_featured: video.is_featured,
      video_category_id: video.video_category_id,
      media_asset_id: video.media_asset_id,
      source_url: null,
      slug: video.slug,
      seo_title: video.seo.title ?? '',
      seo_description: video.seo.description ?? '',
      seo_keywords: video.seo.keywords ?? '',
      canonical_url: video.seo.canonical_url ?? '',
      robots: video.seo.robots ?? '',
    };
    setForm(hydrated);
    setBaseline(JSON.stringify(hydrated));
    setMediaStatus(video.source_type !== 'uploaded' ? 'ready' : video.media?.processing_status ?? null);
  }, [video]);

  const patch = (p: Partial<FormState>) => setForm((prev) => ({ ...prev, ...p }));

  const dirty = JSON.stringify(form) !== baseline || sourceTouched;
  const mediaReady = mediaStatus === 'ready';
  const hasSource = form.media_asset_id != null || (form.source_url != null && form.source_url !== '');

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
        title: t('form.unsavedTitle'),
        text: t('form.unsavedText'),
        confirmText: t('form.unsavedLeave'),
        cancelText: t('common.cancel', { ns: 'common' }),
      }))
    )
      return;
    navigate(paths.vlVideos);
  };

  const doPublish = async () => {
    if (!video) return;
    if (
      await confirm({
        title: t('videos.confirm.publishTitle'),
        text: t('videos.confirm.publishText'),
        confirmText: t('videos.action.publish'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      transition.mutate({ id: video.id, status: 'published' });
  };

  const doArchive = async () => {
    if (!video) return;
    if (
      await confirm({
        title: t('videos.confirm.archiveTitle'),
        text: t('videos.confirm.archiveText'),
        confirmText: t('videos.action.archive'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      transition.mutate({ id: video.id, status: 'archived' });
  };

  const buildAiContext = (): AiEditorialContext => ({
    title: form.title,
    excerpt: form.excerpt || form.description,
    body: form.description,
    locale: form.locale,
  });

  const payload = (): VideoUpsertPayload => {
    const base: VideoUpsertPayload = {
      title: form.title.trim(),
      locale: form.locale,
      visibility: form.visibility,
      is_featured: form.is_featured,
      video_category_id: form.video_category_id,
      description: form.description.trim() || null,
      excerpt: form.excerpt.trim() || null,
      slug: form.slug.trim() || null,
      seo_title: form.seo_title.trim() || null,
      seo_description: form.seo_description.trim() || null,
      seo_keywords: form.seo_keywords.trim() || null,
      canonical_url: form.canonical_url.trim() || null,
      robots: form.robots.trim() || null,
    };
    // المصدر يُرسَل عند الإنشاء دائماً، وعند التعديل فقط إذا غُيّر (تفادي إعادة ربط لا لزوم لها).
    if (!isEdit || sourceTouched) {
      if (form.source_url) base.source_url = form.source_url;
      else if (form.media_asset_id) base.media_asset_id = form.media_asset_id;
    }
    return base;
  };

  const save = async () => {
    if (isEdit && videoId !== null) {
      await update.mutateAsync({ id: videoId, payload: payload() });
      setBaseline(JSON.stringify(form));
      setSourceTouched(false);
      success(t('form.saved'));
    } else {
      const created = await create.mutateAsync(payload());
      setBaseline(JSON.stringify(form));
      setSourceTouched(false);
      success(t('form.saved'));
      navigate(paths.vlVideosEdit.replace(':id', String(created.id)));
    }
  };

  const saving = create.isPending || update.isPending;
  const categoryOptions = flatten(catQ.data ?? []);

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
            <h1 className="text-2xl font-bold">{isEdit ? t('form.editTitle') : t('form.createTitle')}</h1>
            {video ? (
              <Badge variant={STATUS_TONE[video.status]} className="mt-1">
                {t(`status.${video.status}`)}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEdit && video ? <EngagementMetricsButton metrics={video.metrics} locale={i18n.language} /> : null}
          <Button
            onClick={() => void save()}
            disabled={saving || form.title.trim().length < 2 || (!isEdit && !hasSource)}
          >
            <Save className="h-4 w-4" />
            {saving ? t('form.saving') : t('form.save')}
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <Section title={t('form.basics')}>
            <TextField label={t('form.titleLabel')} value={form.title} onChange={(e) => patch({ title: e.target.value })} maxLength={200} />
            {canUseAi ? <HeadlineSuggestions getContext={buildAiContext} onApply={(h) => patch({ title: h })} /> : null}

            <TextareaField label={t('form.descriptionLabel')} rows={5} value={form.description} onChange={(e) => patch({ description: e.target.value })} maxLength={5000} />
            {canUseAi ? <ExcerptGenerate getContext={buildAiContext} onApply={(d) => patch({ excerpt: d })} /> : null}

            <TextareaField label={t('form.excerptLabel')} rows={2} value={form.excerpt} onChange={(e) => patch({ excerpt: e.target.value })} maxLength={500} />

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label={t('form.locale')}
                value={form.locale}
                onChange={(e) => patch({ locale: e.target.value as ContentLocale })}
                options={[
                  { value: 'ar', label: t('locale.ar') },
                  { value: 'en', label: t('locale.en') },
                ]}
              />
              <SelectField
                label={t('form.visibility')}
                value={form.visibility}
                onChange={(e) => patch({ visibility: e.target.value as VideoVisibility })}
                options={[
                  { value: 'public', label: t('visibility.public') },
                  { value: 'unlisted', label: t('visibility.unlisted') },
                  { value: 'private', label: t('visibility.private') },
                ]}
              />
            </div>

            <SelectField
              label={t('form.category')}
              value={form.video_category_id == null ? '' : String(form.video_category_id)}
              onChange={(e) => patch({ video_category_id: e.target.value === '' ? null : Number(e.target.value) })}
              options={[
                { value: '', label: t('form.categoryNone') },
                ...categoryOptions.map((c) => ({ value: String(c.id), label: c.label })),
              ]}
            />

            <SwitchField label={t('form.featured')} description={t('form.featuredHint')} checked={form.is_featured} onChange={(v) => patch({ is_featured: v })} />
          </Section>

          <Section title={t('form.sourceSection')}>
            <VideoSourceManager
              initialMedia={video?.media ?? null}
              initialSourceType={video?.source_type ?? null}
              onChange={(src) => {
                patch({ media_asset_id: src.mediaAssetId, source_url: src.sourceUrl });
                setSourceTouched(true);
              }}
              onStatusChange={setMediaStatus}
            />
          </Section>

          <Section title={t('entities.title', { ns: 'content' })}>
            <EntityTagsInput contentType="video" contentId={video?.id} />
          </Section>

          {canUseAi ? (
            <Section title={t('form.aiTools')}>
              <ContentAnalysisCard getContext={buildAiContext} />
            </Section>
          ) : null}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {isEdit && video ? (
            <Section title={t('form.publishing')}>
              {video.status === 'scheduled' && video.published_at ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                  {t('form.scheduledFor', {
                    time: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short', timeZoneName: 'short' }).format(new Date(video.published_at)),
                  })}
                </p>
              ) : null}

              {!mediaReady ? (
                <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {t('form.mediaNotReadyHint')}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {canPublish && video.status !== 'published' ? (
                  <Button variant="outline" size="sm" disabled={!mediaReady} onClick={() => void doPublish()}>
                    <Send className="h-4 w-4" />
                    {t('videos.action.publish')}
                  </Button>
                ) : null}
                {canArchive && video.status !== 'archived' ? (
                  <Button variant="outline" size="sm" onClick={() => void doArchive()}>
                    <Archive className="h-4 w-4" />
                    {t('videos.action.archive')}
                  </Button>
                ) : null}
              </div>

              {canPublish ? (
                <div className="space-y-2 border-t border-border pt-3">
                  <label className="text-xs font-medium text-muted-foreground">{t('form.schedule')}</label>
                  <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
                  <p className="flex items-center gap-1.5 text-xs font-medium">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {t('videos.schedule.tz', { tz })}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!scheduleAt || !mediaReady}
                    onClick={() => transition.mutate({ id: video.id, status: 'scheduled', publishedAt: new Date(scheduleAt).toISOString() })}
                  >
                    {t('form.scheduleBtn')}
                  </Button>
                </div>
              ) : null}
            </Section>
          ) : null}

          <Section title={t('form.slugSection')}>
            <TextField label={t('form.slugLabel')} value={form.slug} onChange={(e) => patch({ slug: e.target.value })} dir="ltr" maxLength={190} placeholder={t('form.slugPlaceholder')} />
          </Section>

          <Section
            title={t('form.seoSection')}
            action={
              <button type="button" onClick={() => setSeoOpen((v) => !v)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                {seoOpen ? t('form.seoCollapse') : t('form.seoExpand')}
                <ChevronDown className={cn('h-4 w-4 transition-transform', seoOpen && 'rotate-180')} />
              </button>
            }
          >
            {seoOpen ? (
              <>
                <SeoPanel
                  title={form.title}
                  seoTitle={form.seo_title}
                  seoDescription={form.seo_description}
                  seoKeywords={form.seo_keywords}
                  canonicalUrl={form.canonical_url}
                  robots={form.robots}
                  excerpt={form.excerpt || form.description}
                  slug={form.slug}
                  coverUrl={video?.share_image ?? null}
                  locale={form.locale}
                  sharePath={video?.canonical_path ?? null}
                  onChange={(p) => {
                    if (p.seoTitle !== undefined) patch({ seo_title: p.seoTitle });
                    if (p.seoDescription !== undefined) patch({ seo_description: p.seoDescription });
                    if (p.seoKeywords !== undefined) patch({ seo_keywords: p.seoKeywords });
                    if (p.canonicalUrl !== undefined) patch({ canonical_url: p.canonicalUrl });
                    if (p.robots !== undefined) patch({ robots: p.robots });
                  }}
                />
                {canUseAi ? (
                  <SeoAnalysisCard getPayload={() => ({ title: form.title, excerpt: form.excerpt || form.description, slug: form.slug, locale: form.locale })} />
                ) : null}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">{t('form.seoHint')}</p>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
