import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { PageSkeleton, ErrorState } from '@/components/feedback';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { SettingsSection } from '@/features/settings/components/SettingsSection';
import { SaveBar } from '@/features/settings/components/SaveBar';
import { useMatchBarSettings, useUpdateMatchBarSettings } from '../hooks';
import type { MatchBarSource } from '@/types/sport.types';

const OPTIONS: MatchBarSource[] = ['disabled', 'featured_competitions', 'regular_leagues'];

/**
 * وضع واحد حصريّ (لا دمج) — راديو، لا مفتاحين مستقلّين. اختيار وضع جديد يستبدل السابق فورًا.
 * البطولات المؤهَّلة لكلّ وضع تُدار من صفحة البطولات (أعلامها التحريريّة)، لا هنا.
 */
export default function MatchBarSettingsPage() {
  const { t } = useTranslation('sport');
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('settings.edit');
  const q = useMatchBarSettings();
  const update = useUpdateMatchBarSettings();

  const [source, setSource] = useState<MatchBarSource>('disabled');

  useEffect(() => {
    if (q.data) setSource(q.data.source);
  }, [q.data]);

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => void q.refetch()} />;

  const eligibleCount = source === q.data.source ? q.data.eligible_competitions_count : null;
  const showEmptyWarning = source !== 'disabled' && eligibleCount === 0;

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate(source);
  };

  return (
    <form onSubmit={onSave} className="space-y-5" noValidate>
      <SettingsSection title={t('matchBarSettings.title')} description={t('matchBarSettings.desc')}>
        <div className="space-y-2.5">
          {OPTIONS.map((opt) => (
            <label
              key={opt}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3.5 transition-colors',
                source === opt ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-accent',
                !canEdit && 'cursor-not-allowed opacity-60',
              )}
            >
              <input
                type="radio"
                name="match_bar_source"
                value={opt}
                checked={source === opt}
                onChange={() => setSource(opt)}
                disabled={!canEdit}
                className="mt-1 accent-primary"
              />
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{t(`matchBarSettings.source.${opt}`)}</p>
                <p className="text-xs text-muted-foreground">{t(`matchBarSettings.source.${opt}_desc`)}</p>
              </div>
            </label>
          ))}
        </div>

        {eligibleCount !== null ? (
          <p className="text-xs text-muted-foreground">{t('matchBarSettings.eligibleCount', { count: eligibleCount })}</p>
        ) : null}

        {showEmptyWarning ? (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-xs">{t('matchBarSettings.emptyWarning')}</p>
          </div>
        ) : null}
      </SettingsSection>
      <SaveBar
        saving={update.isPending}
        disabled={!canEdit}
        note={!canEdit ? t('matchBarSettings.noPermission') : undefined}
      />
    </form>
  );
}
