import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { RefreshCw, UploadCloud } from 'lucide-react';
import { PageSkeleton, ErrorState } from '@/components/feedback';
import { FileUploadField } from '@/components/upload/FileUploadField';
import { TextField } from '@/components/form/TextField';
import { SwitchField } from '@/components/form/SwitchField';
import { SelectField } from '@/components/form/SelectField';
import { SliderField } from '@/components/form/SliderField';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { mediaLibraryService } from '@/services/mediaLibrary.service';
import type { NormalizedError } from '@/types/api';
import { SettingsSection } from '../components/SettingsSection';
import { SaveBar } from '../components/SaveBar';
import { storageUrl } from '@/lib/storage';
import { useGeneralSettings, useUploadBranding, useUpdateGeneral } from '../hooks';
import { watermarkSchema, type WatermarkValues } from '../schemas';

type Slot = 'logo_light' | 'logo_dark' | 'logo_light_en' | 'logo_dark_en' | 'favicon' | 'watermark_image';

// أنواع تطابق قيود الـ backend (UploadBrandingMediaRequest)
const SLOTS: { key: Slot; accept: string; hintKey: string }[] = [
  { key: 'logo_light', accept: '.png,.jpg,.jpeg,.webp', hintKey: 'allowedLogos' },
  { key: 'logo_dark', accept: '.png,.jpg,.jpeg,.webp', hintKey: 'allowedLogos' },
  { key: 'logo_light_en', accept: '.png,.jpg,.jpeg,.webp', hintKey: 'allowedLogos' },
  { key: 'logo_dark_en', accept: '.png,.jpg,.jpeg,.webp', hintKey: 'allowedLogos' },
  { key: 'favicon', accept: '.png,.ico', hintKey: 'allowedFavicon' },
  { key: 'watermark_image', accept: '.png,.webp', hintKey: 'allowedWatermark' },
];

const POSITIONS = ['bottom-left', 'bottom-right', 'top-left', 'top-right', 'center'];

const EMPTY_WM: WatermarkValues = {
  watermark_enabled: false,
  watermark_position: 'bottom-left',
  watermark_opacity: 80,
  watermark_width: 100,
  watermark_margin: 20,
};

export default function BrandingSettingsPage() {
  const { t } = useTranslation('settings');
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('settings.edit');
  const q = useGeneralSettings();
  const upload = useUploadBranding();
  const update = useUpdateGeneral();
  const { success, error, confirm } = useToast();
  const [files, setFiles] = useState<Partial<Record<Slot, File>>>({});
  const [regenerating, setRegenerating] = useState(false);

  const regenerateDerivatives = async () => {
    const ok = await confirm({
      title: t('branding.regenerate.confirmTitle'),
      text: t('branding.regenerate.confirmText'),
      confirmText: t('branding.regenerate.confirmYes'),
      cancelText: t('common.cancel', { ns: 'common' }),
    });
    if (!ok) return;
    setRegenerating(true);
    try {
      const r = await mediaLibraryService.regenerateDerivatives();
      success(r.message);
    } catch (e) {
      error((e as NormalizedError)?.message ?? '');
    } finally {
      setRegenerating(false);
    }
  };

  const s = q.data?.site;
  const wmValues: WatermarkValues = s
    ? {
        watermark_enabled: s.watermark_enabled,
        watermark_position: s.watermark_position,
        watermark_opacity: s.watermark_opacity,
        watermark_width: s.watermark_width,
        watermark_margin: s.watermark_margin,
      }
    : EMPTY_WM;

  const { register, handleSubmit, control, formState } = useForm<WatermarkValues>({
    resolver: zodResolver(watermarkSchema),
    values: wmValues,
  });

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => void q.refetch()} />;

  const site = q.data.site;
  const hasSelection = Object.keys(files).length > 0;

  const submitUpload = () => {
    const payload = Object.fromEntries(
      Object.entries(files).filter(([, f]) => f),
    ) as Record<string, File>;
    upload.mutate(payload, {
      onSuccess: () => {
        setFiles({});
        success(t('branding.uploaded'));
      },
    });
  };

  const onSaveWatermark = handleSubmit((v) => update.mutate(v));

  return (
    <div className="space-y-5">
      <SettingsSection title={t('branding.title')} description={t('branding.desc')}>
        <div className="grid gap-5 sm:grid-cols-2">
          {SLOTS.map(({ key, accept, hintKey }) => (
            <FileUploadField
              key={key}
              label={t(`branding.${key}`)}
              accept={accept}
              hint={t(`branding.${hintKey}`)}
              configured={Boolean(site[key])}
              previewUrl={storageUrl(site[key])}
              onSelect={(file) =>
                setFiles((prev) => {
                  const next = { ...prev };
                  if (file) next[key] = file;
                  else delete next[key];
                  return next;
                })
              }
            />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-end gap-3">
          {!canEdit && (
            <span className="text-xs text-muted-foreground">{t('common.noEditPermission')}</span>
          )}
          <Button
            type="button"
            onClick={submitUpload}
            disabled={!hasSelection || upload.isPending || !canEdit}
          >
            <UploadCloud className="h-4 w-4" />
            {upload.isPending ? t('branding.uploading') : t('branding.upload')}
          </Button>
        </div>
      </SettingsSection>

      <form onSubmit={onSaveWatermark} className="space-y-5" noValidate>
        <SettingsSection title={t('general.watermarkCard')}>
          <Controller
            control={control}
            name="watermark_enabled"
            render={({ field }) => (
              <SwitchField
                label={t('general.watermark_enabled')}
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="watermark_position"
            render={({ field }) => (
              <SelectField
                label={t('general.watermark_position')}
                value={field.value}
                onChange={field.onChange}
                options={POSITIONS.map((p) => ({ value: p, label: t(`positions.${p}`) }))}
              />
            )}
          />
          <Controller
            control={control}
            name="watermark_opacity"
            render={({ field }) => (
              <SliderField
                label={t('general.watermark_opacity')}
                value={field.value}
                suffix="%"
                onChange={field.onChange}
              />
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t('general.watermark_width')}
              type="number"
              error={formState.errors.watermark_width}
              {...register('watermark_width', { valueAsNumber: true })}
            />
            <TextField
              label={t('general.watermark_margin')}
              type="number"
              error={formState.errors.watermark_margin}
              {...register('watermark_margin', { valueAsNumber: true })}
            />
          </div>
        </SettingsSection>

        <SaveBar
          saving={update.isPending}
          disabled={!canEdit}
          note={!canEdit ? t('common.noEditPermission') : undefined}
        />
      </form>

      <SettingsSection
        title={t('branding.regenerate.title')}
        description={t('branding.regenerate.description')}
      >
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={regenerateDerivatives}
            disabled={!canEdit || regenerating}
          >
            <RefreshCw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
            {regenerating ? t('branding.regenerate.running') : t('branding.regenerate.button')}
          </Button>
        </div>
      </SettingsSection>
    </div>
  );
}
