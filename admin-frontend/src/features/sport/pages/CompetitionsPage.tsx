import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/feedback';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { useCompetitions, useDeleteCompetition, useUpdateCompetition } from '../hooks';
import { CompetitionFormModal } from '../components/CompetitionFormModal';
import type { CompetitionData } from '@/types/sport.types';

/** مفتاح صغير للجدول — نسخة مضغوطة من نمط SwitchField (بلا بطاقة/وصف، لخلية جدول). */
function MiniToggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all',
          checked ? 'start-0.5 translate-x-0 rtl:-translate-x-4 ltr:translate-x-4' : 'start-0.5',
        )}
      />
    </button>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export default function CompetitionsPage() {
  const { t } = useTranslation('sport');
  const { hasPermission } = useAuth();
  const { confirm } = useToast();
  const canManage = hasPermission('competitions.manage');

  const q = useCompetitions();
  const update = useUpdateCompetition();
  const del = useDeleteCompetition();

  const [modalOpen, setModalOpen] = useState(false);

  const onDelete = async (c: CompetitionData) => {
    if (
      await confirm({
        title: t('competitions.confirm.deleteTitle'),
        text: t('competitions.confirm.deleteText', { name: c.name }),
        confirmText: t('competitions.confirm.yes'),
        cancelText: t('common.cancel', { ns: 'common' }),
      })
    )
      del.mutate(c.id);
  };

  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} />;

  const rows = q.data ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('competitions.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('competitions.subtitle')}</p>
        </div>
        {canManage ? (
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('competitions.new')}
          </Button>
        ) : null}
      </header>

      <div className="overflow-x-auto rounded-2xl border border-border bg-background">
        {q.isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title={t('competitions.empty.title')} description={t('competitions.empty.description')} />
        ) : (
          <table className="w-full min-w-[860px] text-start text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-3 text-start font-medium">{t('competitions.col.name')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('competitions.col.coverage')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('competitions.col.lastSynced')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('competitions.col.featured')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('competitions.col.featuredUntil')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('competitions.col.inMatchBar')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('competitions.col.sortOrder')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {c.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.logo_url} alt="" className="h-6 w-6 shrink-0 object-contain" />
                      ) : null}
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground" dir="ltr">
                          {c.provider} · {c.provider_id}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MiniToggle
                        checked={c.is_tracked}
                        disabled={!canManage}
                        onChange={(v) => update.mutate({ id: c.id, payload: { is_tracked: v } })}
                      />
                      <Badge variant={c.is_tracked ? 'success' : 'muted'}>
                        {c.is_tracked ? t('competitions.coverage.tracked') : t('competitions.coverage.untracked')}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {c.last_synced_at ? formatDate(c.last_synced_at) : t('competitions.coverage.never')}
                  </td>
                  <td className="px-4 py-3">
                    <MiniToggle
                      checked={c.is_featured_tournament}
                      disabled={!canManage}
                      onChange={(v) => update.mutate({ id: c.id, payload: { is_featured_tournament: v } })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="date"
                      disabled={!canManage || !c.is_featured_tournament}
                      value={c.featured_until ?? ''}
                      onChange={(e) =>
                        update.mutate({ id: c.id, payload: { featured_until: e.target.value || null } })
                      }
                      className="h-8 rounded-lg border border-input bg-background px-2 text-xs disabled:opacity-50"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <MiniToggle
                      checked={c.show_in_match_bar}
                      disabled={!canManage}
                      onChange={(v) => update.mutate({ id: c.id, payload: { show_in_match_bar: v } })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      max={65535}
                      disabled={!canManage || !c.show_in_match_bar}
                      value={c.match_bar_sort_order ?? ''}
                      onChange={(e) =>
                        update.mutate({
                          id: c.id,
                          payload: { match_bar_sort_order: e.target.value === '' ? null : Number(e.target.value) },
                        })
                      }
                      className="h-8 w-16 rounded-lg border border-input bg-background px-2 text-xs disabled:opacity-50"
                    />
                  </td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <Button variant="ghost" size="sm" onClick={() => void onDelete(c)} aria-label={t('competitions.confirm.yes')}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CompetitionFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
