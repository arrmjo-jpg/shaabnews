import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { PageSkeleton, ErrorState } from '@/components/feedback';
import { useAuth } from '@/hooks/useAuth';
import { SettingsSection } from '@/features/settings/components/SettingsSection';
import { SaveBar } from '@/features/settings/components/SaveBar';
import { SwitchField } from '@/components/form/SwitchField';
import { CompetitionBarPicker } from '../components/CompetitionBarPicker';
import {
  useSportsHomeBarSettings,
  useUpdateSportsHomeBarSettings,
  useCompetitions,
  useToggleCompetitionSportsHomeBar,
  useReorderCompetitionsSportsHomeBar,
} from '../hooks';

/**
 * ميزة مستقلّة تمامًا عن MatchBarSettingsPage — إعداد تفعيل خاصّ بها (SportsHomeBarSettings)
 * وأعلام اختيار/ترتيب خاصّة بها (show_in_sports_home_bar/sports_home_bar_sort_order) على
 * نفس جدول Competition. تشترك مع Match Bar فقط بالكتالوج (useCompetitions) وبمكوّن العرض
 * (CompetitionBarPicker) — لا بأيّ حالة أو منطق اختيار.
 */
export default function SportsHomeBarSettingsPage() {
  const { t } = useTranslation('sport');
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('settings.edit');
  const canManage = hasPermission('competitions.manage');

  const q = useSportsHomeBarSettings();
  const update = useUpdateSportsHomeBarSettings();

  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (q.data) setEnabled(q.data.enabled);
  }, [q.data]);

  const competitionsQuery = useCompetitions();
  const toggleSportsHomeBar = useToggleCompetitionSportsHomeBar();
  const reorderSportsHomeBar = useReorderCompetitionsSportsHomeBar();

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => void q.refetch()} />;

  const eligibleCount = enabled === q.data.enabled ? q.data.eligible_competitions_count : null;
  const showEmptyWarning = enabled && eligibleCount === 0;

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate(enabled);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={onSave} className="space-y-5" noValidate>
        <SettingsSection title={t('sportsHomeBarSettings.title')} description={t('sportsHomeBarSettings.desc')}>
          <SwitchField
            label={t('sportsHomeBarSettings.enable')}
            description={t('sportsHomeBarSettings.enableDesc')}
            checked={enabled}
            onChange={setEnabled}
            disabled={!canEdit}
          />

          {eligibleCount !== null ? (
            <p className="text-xs text-muted-foreground">
              {t('sportsHomeBarSettings.eligibleCount', { count: eligibleCount })}
            </p>
          ) : null}

          {showEmptyWarning ? (
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-xs">{t('sportsHomeBarSettings.emptyWarning')}</p>
            </div>
          ) : null}
        </SettingsSection>
        <SaveBar
          saving={update.isPending}
          disabled={!canEdit}
          note={!canEdit ? t('sportsHomeBarSettings.noPermission') : undefined}
        />
      </form>

      <SettingsSection
        title={t('sportsHomeBarSettings.competitions.title')}
        description={t('sportsHomeBarSettings.competitions.desc')}
      >
        <CompetitionBarPicker
          competitions={competitionsQuery.data ?? []}
          isLoading={competitionsQuery.isLoading}
          canManage={canManage}
          isSelected={(c) => c.show_in_sports_home_bar}
          sortOrder={(c) => c.sports_home_bar_sort_order}
          onToggle={(id) => toggleSportsHomeBar.mutate(id)}
          onReorder={(ids) => reorderSportsHomeBar.mutate(ids)}
        />
      </SettingsSection>
    </div>
  );
}
