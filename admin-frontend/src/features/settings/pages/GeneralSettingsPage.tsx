import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { PageSkeleton, ErrorState } from '@/components/feedback';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TextField } from '@/components/form/TextField';
import { TextareaField } from '@/components/form/TextareaField';
import { SwitchField } from '@/components/form/SwitchField';
import { useAuth } from '@/hooks/useAuth';
import { SettingsSection } from '../components/SettingsSection';
import { SaveBar } from '../components/SaveBar';
import type { ContactPhone } from '@/types/settings.types';
import { useGeneralSettings, useUpdateGeneral } from '../hooks';
import { generalSchema, type GeneralValues } from '../schemas';

const EMPTY: GeneralValues = {
  site_name: '', site_name_ar: '', site_name_en: '', site_email: '', site_url: '', timezone: '', site_phone: '',
  site_description: '', site_description_ar: '', site_description_en: '',
  copyright_text: '', copyright_text_ar: '', copyright_text_en: '', footer_extra_text: '',
  cookie_policy_text: '', cookie_policy_text_ar: '', cookie_policy_text_en: '',
  latitude: '', longitude: '', comments_enabled: false, maintenance_mode: false,
};

export default function GeneralSettingsPage() {
  const { t } = useTranslation('settings');
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('settings.edit');
  const q = useGeneralSettings();
  const update = useUpdateGeneral();

  const s = q.data?.site;
  const values: GeneralValues = s
    ? {
        site_name: s.site_name,
        site_name_ar: s.site_name_ar ?? '',
        site_name_en: s.site_name_en ?? '',
        site_email: s.site_email,
        site_url: s.site_url,
        timezone: s.timezone,
        site_phone: s.site_phone,
        site_description: s.site_description,
        site_description_ar: s.site_description_ar ?? '',
        site_description_en: s.site_description_en ?? '',
        copyright_text: s.copyright_text,
        copyright_text_ar: s.copyright_text_ar ?? '',
        copyright_text_en: s.copyright_text_en ?? '',
        footer_extra_text: s.footer_extra_text,
        cookie_policy_text: s.cookie_policy_text,
        cookie_policy_text_ar: s.cookie_policy_text_ar ?? '',
        cookie_policy_text_en: s.cookie_policy_text_en ?? '',
        latitude: s.latitude ?? '',
        longitude: s.longitude ?? '',
        comments_enabled: s.comments_enabled,
        maintenance_mode: s.maintenance_mode,
      }
    : EMPTY;

  const { register, handleSubmit, control, formState } = useForm<GeneralValues>({
    resolver: zodResolver(generalSchema),
    values,
  });

  // جهات الاتصال تُدار خارج react-hook-form (قائمة ديناميكيّة {name,title,phone}). تُبذَر مرّة عند وصول البيانات.
  const [phones, setPhones] = useState<ContactPhone[]>([{ name: '', title: '', phone: '' }]);
  const [phonesInit, setPhonesInit] = useState(false);
  useEffect(() => {
    if (!s || phonesInit) return;
    const initial: ContactPhone[] = s.site_phones?.length
      ? s.site_phones
      : s.site_phone
        ? [{ name: '', title: '', phone: s.site_phone }]
        : [];
    setPhones(initial.length ? initial : [{ name: '', title: '', phone: '' }]);
    setPhonesInit(true);
  }, [s, phonesInit]);

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => void q.refetch()} />;

  const onSave = handleSubmit((v) => {
    v.site_name = v.site_name_ar; // Sync site_name with site_name_ar for legacy compatibility
    v.site_description = v.site_description_ar; // Sync site_description with site_description_ar
    v.copyright_text = v.copyright_text_ar; // Legacy single-field mirror (Arabic canonical)
    v.cookie_policy_text = v.cookie_policy_text_ar; // Legacy single-field mirror (Arabic canonical)
    const contacts = phones
      .map((c) => ({ name: c.name.trim(), title: c.title.trim(), phone: c.phone.trim() }))
      .filter((c) => c.phone !== '');
    update.mutate({ ...v, site_phones: contacts, site_phone: contacts[0]?.phone ?? '' });
  });

  return (
    <form onSubmit={onSave} className="space-y-5" noValidate>
      {/* هوية الموقع — العربي والإنجليزي جنبًا إلى جنب (اسم بجانب اسم، ووصف بجانب وصف). */}
      <SettingsSection title={t('general.identityCard')} description={t('general.identityCardDesc')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t('general.site_name_ar')} error={formState.errors.site_name_ar} {...register('site_name_ar')} />
          <TextField label={t('general.site_name_en')} error={formState.errors.site_name_en} {...register('site_name_en')} />
          <TextareaField label={t('general.site_description_ar')} error={formState.errors.site_description_ar} {...register('site_description_ar')} />
          <TextareaField label={t('general.site_description_en')} error={formState.errors.site_description_en} {...register('site_description_en')} />
        </div>
      </SettingsSection>

      <SettingsSection title={t('general.siteCard')} description={t('general.desc')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" {...register('site_name')} />
          <input type="hidden" {...register('site_phone')} />
          <TextField label={t('general.site_email')} type="email" error={formState.errors.site_email} {...register('site_email')} />
          <TextField label={t('general.site_url')} error={formState.errors.site_url} {...register('site_url')} />
          <TextField label={t('general.timezone')} error={formState.errors.timezone} {...register('timezone')} />
        </div>

        {/* جهات الاتصال — لكلّ رقم: اسم الشخص + المسمى الوظيفي + الرقم. الأوّل يُزامَن مع الحقل الأحاديّ عند الحفظ. */}
        <div className="mt-4 space-y-3">
          <Label>{t('general.phones')}</Label>
          {phones.map((c, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center">
              <Input
                aria-label={t('general.contactName')}
                placeholder={t('general.contactName')}
                value={c.name}
                onChange={(e) => setPhones((prev) => prev.map((v, j) => (j === i ? { ...v, name: e.target.value } : v)))}
              />
              <Input
                aria-label={t('general.contactTitle')}
                placeholder={t('general.contactTitle')}
                value={c.title}
                onChange={(e) => setPhones((prev) => prev.map((v, j) => (j === i ? { ...v, title: e.target.value } : v)))}
              />
              <Input
                dir="ltr"
                inputMode="tel"
                aria-label={t('general.site_phone')}
                placeholder="+962 6 5000 100"
                value={c.phone}
                onChange={(e) => setPhones((prev) => prev.map((v, j) => (j === i ? { ...v, phone: e.target.value } : v)))}
              />
              <button
                type="button"
                aria-label={t('general.removePhone')}
                onClick={() => setPhones((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : [{ name: '', title: '', phone: '' }]))}
                className="shrink-0 justify-self-start rounded-md border border-input px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPhones((prev) => [...prev, { name: '', title: '', phone: '' }])}
            className="rounded-md border border-dashed border-input px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
          >
            + {t('general.addPhone')}
          </button>
        </div>
      </SettingsSection>

      <SettingsSection title={t('general.footerCard')}>
        {/* الحقول الأحاديّة القديمة مخفيّة ومُزامَنة من النسخة العربية عند الحفظ (توافق خلفيّ). */}
        <input type="hidden" {...register('copyright_text')} />
        <input type="hidden" {...register('cookie_policy_text')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t('general.copyright_text_ar')} error={formState.errors.copyright_text_ar} {...register('copyright_text_ar')} />
          <TextField label={t('general.copyright_text_en')} error={formState.errors.copyright_text_en} {...register('copyright_text_en')} />
        </div>
        <TextareaField label={t('general.footer_extra_text')} {...register('footer_extra_text')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextareaField label={t('general.cookie_policy_text_ar')} error={formState.errors.cookie_policy_text_ar} {...register('cookie_policy_text_ar')} />
          <TextareaField label={t('general.cookie_policy_text_en')} error={formState.errors.cookie_policy_text_en} {...register('cookie_policy_text_en')} />
        </div>
      </SettingsSection>

      <SettingsSection title={t('general.controlsCard')}>
        <Controller
          control={control}
          name="maintenance_mode"
          render={({ field }) => (
            <SwitchField
              label={t('general.maintenance_mode')}
              description={t('general.maintenance_mode_desc')}
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="comments_enabled"
          render={({ field }) => (
            <SwitchField label={t('general.comments_enabled')} checked={field.value} onChange={field.onChange} />
          )}
        />
      </SettingsSection>

      <SettingsSection title={t('general.mapCard')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t('general.latitude')} {...register('latitude')} />
          <TextField label={t('general.longitude')} {...register('longitude')} />
        </div>
      </SettingsSection>

      <SaveBar saving={update.isPending} disabled={!canEdit} note={!canEdit ? t('common.noEditPermission') : undefined} />
    </form>
  );
}
