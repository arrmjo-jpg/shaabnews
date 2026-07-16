import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { PageSkeleton, ErrorState } from '@/components/feedback';
import { TextField } from '@/components/form/TextField';
import { useAuth } from '@/hooks/useAuth';
import type { GeneralUpdatePayload } from '@/types/settings.types';
import { SettingsSection } from '../components/SettingsSection';
import { SaveBar } from '../components/SaveBar';
import { useGeneralSettings, useUpdateGeneral } from '../hooks';
import { socialSchema, type SocialValues } from '../schemas';

const FIELDS: (keyof SocialValues)[] = [
  'facebook', 'facebook_page_id', 'twitter_x', 'instagram',
  'linkedin', 'youtube', 'tiktok', 'whatsapp', 'whatsapp_channel', 'nabd',
];

const EMPTY = Object.fromEntries(FIELDS.map((k) => [k, ''])) as SocialValues;

export default function SocialSettingsPage() {
  const { t } = useTranslation('settings');
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('settings.edit');
  const q = useGeneralSettings();
  const update = useUpdateGeneral();

  const values: SocialValues = q.data ? { ...EMPTY, ...q.data.social } : EMPTY;

  const { register, handleSubmit, formState } = useForm<SocialValues>({
    resolver: zodResolver(socialSchema),
    values,
  });

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => void q.refetch()} />;

  const onSave = handleSubmit((v) => {
    const payload: GeneralUpdatePayload = {};
    for (const k of FIELDS) payload[`social_${k}`] = v[k];
    update.mutate(payload);
  });

  return (
    <form onSubmit={onSave} className="space-y-5" noValidate>
      <SettingsSection title={t('social.title')} description={t('social.desc')}>
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((k) => (
            <TextField
              key={k}
              label={t(`social.${k}`)}
              error={formState.errors[k]}
              {...register(k)}
            />
          ))}
        </div>
      </SettingsSection>
      <SaveBar saving={update.isPending} disabled={!canEdit} note={!canEdit ? t('common.noEditPermission') : undefined} />
    </form>
  );
}
