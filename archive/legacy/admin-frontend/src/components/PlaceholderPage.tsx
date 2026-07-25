import { useTranslation } from 'react-i18next';

/** صفحة هيكلية مؤقتة — تُستبدل في الخطوات اللاحقة (Auth/Settings/...) */
export function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-3xl border border-border bg-background p-10 shadow-soft">
      <h1 className="text-2xl font-bold">{t(titleKey)}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t('app.name')} — {t('app.tagline')}
      </p>
    </div>
  );
}
