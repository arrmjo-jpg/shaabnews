import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/form/TextField';
import { useCreateCompetition } from '../hooks';

export function CompetitionFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('sport');
  const create = useCreateCompetition();

  const [provider, setProvider] = useState('365scores');
  const [providerId, setProviderId] = useState('');
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  const reset = () => {
    setProvider('365scores');
    setProviderId('');
    setName('');
    setLogoUrl('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pid = Number(providerId);
    if (!Number.isInteger(pid) || pid <= 0 || name.trim() === '') return;
    create.mutate(
      { provider, provider_id: pid, name: name.trim(), logo_url: logoUrl.trim() || null },
      { onSuccess: close },
    );
  };

  return (
    <Modal open={open} onClose={close} title={t('competitions.form.createTitle')} size="md">
      <form id="competition-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <TextField label={t('competitions.form.provider')} value={provider} onChange={(e) => setProvider(e.target.value)} />
        <TextField
          label={t('competitions.form.providerId')}
          value={providerId}
          onChange={(e) => setProviderId(e.target.value.replace(/[^\d]/g, ''))}
          dir="ltr"
          placeholder="5930"
        />
        <p className="-mt-2 text-xs text-muted-foreground">{t('competitions.form.providerIdHint')}</p>
        <TextField label={t('competitions.form.name')} value={name} onChange={(e) => setName(e.target.value)} maxLength={150} />
        <TextField
          label={t('competitions.form.logoUrl')}
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          type="url"
          dir="ltr"
          placeholder="https://…"
        />
      </form>
      <div className="mt-5 flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={close}>
          {t('competitions.form.cancel')}
        </Button>
        <Button type="submit" form="competition-form" disabled={create.isPending}>
          {create.isPending ? t('competitions.form.saving') : t('competitions.form.save')}
        </Button>
      </div>
    </Modal>
  );
}
