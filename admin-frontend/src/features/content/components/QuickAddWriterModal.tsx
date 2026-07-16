import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Eye, EyeOff, MailCheck, UserPlus } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUploadField } from '@/components/upload/FileUploadField';
import { useToast } from '@/hooks/useToast';
import { usersService } from '@/services/users.service';
import { useQuickCreateWriter, useSendWriterInvite } from '../hooks';
import { generateStrongPassword } from '../lib/randomPassword';
import type { NormalizedError } from '@/types/api';
import type { UserData } from '@/types/users.types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (writer: UserData) => void;
}

/**
 * Inline writer creation, scoped to the editorial author-picker flow.
 *
 * Convention: matches StoreUserRequest — name + email + password (auto-generated
 * client-side to satisfy Password::defaults). `is_writer=true` is forced.
 *
 * Permission boundary lives in the caller (WriterPicker only renders the
 * "+ Add writer" entry when `users.create` is granted).
 */
export function QuickAddWriterModal({ open, onClose, onCreated }: Props) {
  const { t } = useTranslation('content');
  const { success, error: toastError } = useToast();
  const create = useQuickCreateWriter();
  const invite = useSendWriterInvite();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(() => generateStrongPassword());
  const [showPassword, setShowPassword] = useState(false);
  const [sendInvite, setSendInvite] = useState(true);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Regenerate a fresh password each time the modal opens; reset other fields.
  useEffect(() => {
    if (!open) return;
    setName('');
    setEmail('');
    setPassword(generateStrongPassword());
    setShowPassword(false);
    setSendInvite(true);
    setAvatarFile(null);
  }, [open]);

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(password);
      success(t('articles.form.author.quickAdd.passwordCopied'));
    } catch {
      toastError(t('articles.form.author.quickAdd.copyFailed'));
    }
  };

  const submit = async () => {
    if (name.trim().length < 2) {
      toastError(t('articles.form.author.quickAdd.nameRequired'));
      return;
    }
    if (email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toastError(t('articles.form.author.quickAdd.emailInvalid'));
      return;
    }

    // Reuse the shared avatar upload (returns a stored path) before creating.
    let avatar: string | null = null;
    if (avatarFile) {
      setUploadingAvatar(true);
      try {
        avatar = (await usersService.uploadAvatar(avatarFile)).path;
      } catch (e) {
        toastError((e as NormalizedError)?.message ?? t('articles.form.author.quickAdd.avatarFailed'));
        setUploadingAvatar(false);
        return;
      }
      setUploadingAvatar(false);
    }

    create.mutate(
      { name: name.trim(), email: email.trim(), password, avatar },
      {
        onSuccess: (writer) => {
          success(t('articles.form.author.quickAdd.created'));
          if (sendInvite) {
            invite.mutate(writer.id, {
              onSuccess: () => success(t('articles.form.author.quickAdd.inviteSent')),
            });
          }
          onCreated(writer);
        },
      },
    );
  };

  const saving = create.isPending || uploadingAvatar;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('articles.form.author.quickAdd.title')}
      description={t('articles.form.author.quickAdd.hint')}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t('articles.form.cancel')}
          </Button>
          <Button onClick={submit} disabled={saving}>
            <UserPlus className="h-4 w-4" />
            {saving
              ? t('categories.form.saving')
              : t('articles.form.author.quickAdd.save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <FileUploadField
          label={t('articles.form.author.quickAdd.avatar')}
          accept=".png,.jpg,.jpeg,.webp"
          configured={avatarFile !== null}
          hint={t('articles.form.author.quickAdd.avatarHint')}
          onSelect={setAvatarFile}
        />

        <div className="space-y-1.5">
          <Label htmlFor="qa-name">{t('articles.form.author.quickAdd.name')}</Label>
          <Input
            id="qa-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="qa-email">{t('articles.form.author.quickAdd.email')}</Label>
          <Input
            id="qa-email"
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={255}
            placeholder="writer@example.com"
          />
          <p className="text-[11px] text-muted-foreground">
            اتركه فارغاً ليتم توليد بريد مؤسسي تلقائياً من الاسم
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="qa-password">
              {t('articles.form.author.quickAdd.password')}
            </Label>
            <button
              type="button"
              onClick={() => setPassword(generateStrongPassword())}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t('articles.form.author.quickAdd.regenerate')}
            </button>
          </div>
          <div className="flex gap-2">
            <Input
              id="qa-password"
              type={showPassword ? 'text' : 'password'}
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1 font-mono text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowPassword((v) => !v)}
              title={
                showPassword
                  ? t('articles.form.author.quickAdd.hidePassword')
                  : t('articles.form.author.quickAdd.showPassword')
              }
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={copyPassword}
              title={t('articles.form.author.quickAdd.copy')}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('articles.form.author.quickAdd.passwordHint')}
          </p>
        </div>

        <label className="inline-flex cursor-pointer items-start gap-2 border border-border bg-muted/30 p-3 text-sm">
          <input
            type="checkbox"
            checked={sendInvite}
            onChange={(e) => setSendInvite(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span className="space-y-0.5">
            <span className="flex items-center gap-1.5 font-medium">
              <MailCheck className="h-4 w-4 text-primary" />
              {t('articles.form.author.quickAdd.sendInvite')}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t('articles.form.author.quickAdd.sendInviteHint')}
            </span>
          </span>
        </label>
      </div>
    </Modal>
  );
}
