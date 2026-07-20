import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageSkeleton, ErrorState } from '@/components/feedback';
import { useAuth } from '@/hooks/useAuth';
import { SettingsSection } from '@/features/settings/components/SettingsSection';
import { SaveBar } from '@/features/settings/components/SaveBar';
import { SwitchField } from '@/components/form/SwitchField';
import { TextField } from '@/components/form/TextField';
import { useSportSettings, useUpdateSportSettings } from '../hooks';
import type { SportSettingsData } from '@/types/sport.types';

export default function SportSettingsPage() {
  const { t } = useTranslation('sport');
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('settings.edit');

  const q = useSportSettings();
  const update = useUpdateSportSettings();

  const [form, setForm] = useState<SportSettingsData | null>(null);
  useEffect(() => {
    if (q.data) setForm(q.data);
  }, [q.data]);

  if (q.isLoading || !form) return <PageSkeleton />;
  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} />;

  const patch = (p: Partial<SportSettingsData>) => setForm((prev) => (prev ? { ...prev, ...p } : prev));

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate(form);
  };

  return (
    <form onSubmit={onSave} className="space-y-6" noValidate>
      <SettingsSection title={t('sportSettings.theme.title')} description={t('sportSettings.theme.desc')}>
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="ss-theme">
            {t('sportSettings.defaultTheme')}
          </label>
          <select
            id="ss-theme"
            value={form.sport_default_theme}
            onChange={(e) => patch({ sport_default_theme: e.target.value as SportSettingsData['sport_default_theme'] })}
            disabled={!canEdit}
            className="h-10 w-full border border-input bg-background px-3 text-sm disabled:opacity-50"
          >
            <option value="light">{t('sportSettings.themeLight')}</option>
            <option value="dark">{t('sportSettings.themeDark')}</option>
            <option value="system">{t('sportSettings.themeSystem')}</option>
          </select>
        </div>
        <SwitchField
          label={t('sportSettings.allowThemeSwitch')}
          checked={form.sport_allow_theme_switch}
          onChange={(v) => patch({ sport_allow_theme_switch: v })}
          disabled={!canEdit}
        />
        <TextField
          label={t('sportSettings.primaryColor')}
          value={form.sport_primary_color ?? ''}
          onChange={(e) => patch({ sport_primary_color: e.target.value || null })}
          dir="ltr"
          placeholder="#151e22"
          disabled={!canEdit}
        />
        <TextField
          label={t('sportSettings.secondaryColor')}
          value={form.sport_secondary_color ?? ''}
          onChange={(e) => patch({ sport_secondary_color: e.target.value || null })}
          dir="ltr"
          placeholder="#e11d48"
          disabled={!canEdit}
        />
        <TextField
          label={t('sportSettings.themeCookie')}
          value={form.sport_theme_cookie}
          onChange={(e) => patch({ sport_theme_cookie: e.target.value })}
          dir="ltr"
          disabled={!canEdit}
        />
      </SettingsSection>

      <SettingsSection title={t('sportSettings.defaults.title')} description={t('sportSettings.defaults.desc')}>
        <TextField
          label={t('sportSettings.defaultSport')}
          value={form.sport_default_sport ?? ''}
          onChange={(e) => patch({ sport_default_sport: e.target.value || null })}
          dir="ltr"
          disabled={!canEdit}
        />
        <TextField
          label={t('sportSettings.defaultCountry')}
          value={form.sport_default_country ?? ''}
          onChange={(e) => patch({ sport_default_country: e.target.value || null })}
          dir="ltr"
          disabled={!canEdit}
        />
        <TextField
          label={t('sportSettings.defaultCompetition')}
          value={form.sport_default_competition ?? ''}
          onChange={(e) => patch({ sport_default_competition: e.target.value || null })}
          dir="ltr"
          disabled={!canEdit}
        />
      </SettingsSection>

      <SettingsSection title={t('sportSettings.features.title')} description={t('sportSettings.features.desc')}>
        <SwitchField
          label={t('sportSettings.predictionEnabled')}
          checked={form.sport_prediction_enabled}
          onChange={(v) => patch({ sport_prediction_enabled: v })}
          disabled={!canEdit}
        />
        <SwitchField
          label={t('sportSettings.searchEnabled')}
          checked={form.sport_search_enabled}
          onChange={(v) => patch({ sport_search_enabled: v })}
          disabled={!canEdit}
        />
        <SwitchField
          label={t('sportSettings.liveScoresEnabled')}
          checked={form.sport_live_scores_enabled}
          onChange={(v) => patch({ sport_live_scores_enabled: v })}
          disabled={!canEdit}
        />
      </SettingsSection>

      <SaveBar saving={update.isPending} disabled={!canEdit} note={!canEdit ? t('sportSettings.noPermission') : undefined} />
    </form>
  );
}
