import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  CalendarClock,
  Copy,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Send,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { DataTable, type Column } from '@/components/data/DataTable';
import { Pagination } from '@/components/data/Pagination';
import { cn } from '@/lib/utils';
import { paths } from '@/router/paths';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { APP_TZ, fmtAmmanDateTime, fmtDate, toAppWallClock } from '../datetime';
import {
  useDeleteEpaper,
  useDuplicateEpaper,
  useEpapers,
  useForceDeleteEpaper,
  useRestoreEpaper,
  useTransitionEpaper,
} from '../hooks';
import type { EpaperData, EpaperStatus, EpapersListParams } from '@/types/epaper.types';

const selectCls =
  'h-10 border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const PER_PAGE = 15;

const STATUS_TONE: Record<EpaperStatus, 'success' | 'muted'> = {
  published: 'success',
  scheduled: 'muted',
  draft: 'muted',
  archived: 'muted',
};

export default function EpapersPage() {
  const { t, i18n } = useTranslation('epaper');
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { confirm, success } = useToast();

  const canCreate = hasPermission('epapers.create');
  const canEdit = hasPermission('epapers.edit');
  const canPublish = hasPermission('epapers.publish');
  const canArchive = hasPermission('epapers.archive');
  const canDelete = hasPermission('epapers.delete');
  const canRestore = hasPermission('epapers.restore');
  const canForceDelete = hasPermission('epapers.force_delete');
  const canSeeTrash = canRestore || canForceDelete;

  const [params, setParams] = useState<EpapersListParams>({
    page: 1,
    per_page: PER_PAGE,
    search: '',
    status: '',
    locale: '',
    sort: '-publication_date',
    trashed: '',
  });
  const [scheduling, setScheduling] = useState<EpaperData | null>(null);
  const [scheduleAt, setScheduleAt] = useState('');

  const q = useEpapers(params);
  const del = useDeleteEpaper();
  const restore = useRestoreEpaper();
  const forceDel = useForceDeleteEpaper();
  const transition = useTransitionEpaper();
  const duplicate = useDuplicateEpaper();

  const inTrash = params.trashed === 'only';
  const rows = q.data?.data ?? [];

  const patch = (p: Partial<EpapersListParams>) => setParams((prev) => ({ ...prev, ...p, page: p.page ?? 1 }));
  const cancel = () => t('common.cancel', { ns: 'common' });

  const onPublish = async (e: EpaperData) => {
    if (
      await confirm({
        title: t('confirm.publishTitle'),
        text: t('confirm.publishText', { title: e.title }),
        confirmText: t('action.publish'),
        cancelText: cancel(),
      })
    )
      transition.mutate({ id: e.id, status: 'published' });
  };
  const onArchive = async (e: EpaperData) => {
    if (
      await confirm({
        title: t('confirm.archiveTitle'),
        text: t('confirm.archiveText', { title: e.title }),
        confirmText: t('action.archive'),
        cancelText: cancel(),
      })
    )
      transition.mutate({ id: e.id, status: 'archived' });
  };
  const onUnpublish = async (e: EpaperData) => {
    if (
      await confirm({
        title: t('confirm.draftTitle'),
        text: t('confirm.draftText', { title: e.title }),
        confirmText: t('action.toDraft'),
        cancelText: cancel(),
      })
    )
      transition.mutate({ id: e.id, status: 'draft' });
  };
  const onDelete = async (e: EpaperData) => {
    if (
      await confirm({
        title: t('confirm.deleteTitle'),
        text: t('confirm.deleteText', { title: e.title }),
        confirmText: t('action.delete'),
        cancelText: cancel(),
      })
    )
      del.mutate(e.id);
  };
  const onForceDelete = async (e: EpaperData) => {
    if (
      await confirm({
        title: t('confirm.forceTitle'),
        text: t('confirm.forceText', { title: e.title }),
        confirmText: t('confirm.forceYes'),
        cancelText: cancel(),
      })
    )
      forceDel.mutate(e.id);
  };
  const onDuplicate = async (e: EpaperData) => {
    const created = await duplicate.mutateAsync(e.id);
    success(t('duplicated'));
    navigate(paths.epaperIssuesEdit.replace(':id', String(created.id)));
  };
  const submitSchedule = () => {
    if (!scheduling || !scheduleAt) return;
    transition.mutate(
      { id: scheduling.id, status: 'scheduled', publishedAt: toAppWallClock(scheduleAt) },
      { onSuccess: () => setScheduling(null) },
    );
  };

  const columns: Column<EpaperData>[] = [
    {
      key: 'issue',
      header: t('col.issue'),
      render: (e) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="muted" className="tabular-nums">
              #{e.issue_number}
            </Badge>
            <p className="truncate font-medium">{e.title}</p>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {e.subtitle ? `${e.subtitle} · ` : ''}/{e.slug}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('col.status'),
      render: (e) => (
        <div className="space-y-1">
          <Badge variant={STATUS_TONE[e.status]}>{t(`status.${e.status}`)}</Badge>
          {e.status === 'scheduled' && e.published_at ? (
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <CalendarClock className="h-3 w-3" />
              {fmtAmmanDateTime(e.published_at, i18n.language)}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'locale',
      header: t('col.locale'),
      render: (e) => <Badge variant="muted">{e.locale.toUpperCase()}</Badge>,
    },
    {
      key: 'version',
      header: t('col.version'),
      align: 'center',
      render: (e) => <span className="text-xs tabular-nums text-muted-foreground">v{e.current_version}</span>,
    },
    {
      key: 'pdf',
      header: t('col.pdf'),
      render: (e) =>
        e.media.pdf_url ? (
          <a
            href={e.media.pdf_url}
            target="_blank"
            rel="noreferrer"
            onClick={(ev) => ev.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <FileText className="h-3.5 w-3.5" />
            {t('col.pdfOpen')}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: 'date',
      header: t('col.publicationDate'),
      render: (e) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">{fmtDate(e.publication_date, i18n.language)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'end',
      render: (e) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {inTrash ? (
              <>
                {canRestore ? (
                  <DropdownMenuItem onClick={() => restore.mutate(e.id)}>
                    <ArchiveRestore className="h-4 w-4" />
                    {t('action.restore')}
                  </DropdownMenuItem>
                ) : null}
                {canForceDelete ? (
                  <DropdownMenuItem
                    onClick={() => void onForceDelete(e)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('action.forceDelete')}
                  </DropdownMenuItem>
                ) : null}
              </>
            ) : (
              <>
                {canEdit ? (
                  <DropdownMenuItem onClick={() => navigate(paths.epaperIssuesEdit.replace(':id', String(e.id)))}>
                    <Pencil className="h-4 w-4" />
                    {t('action.edit')}
                  </DropdownMenuItem>
                ) : null}
                {canPublish && e.status !== 'published' && e.media.asset_id !== null ? (
                  <DropdownMenuItem onClick={() => void onPublish(e)}>
                    <Send className="h-4 w-4" />
                    {t('action.publish')}
                  </DropdownMenuItem>
                ) : null}
                {canPublish && e.status !== 'published' && e.media.asset_id !== null ? (
                  <DropdownMenuItem
                    onClick={() => {
                      setScheduleAt('');
                      setScheduling(e);
                    }}
                  >
                    <CalendarClock className="h-4 w-4" />
                    {t('action.schedule')}
                  </DropdownMenuItem>
                ) : null}
                {canEdit && (e.status === 'published' || e.status === 'scheduled') ? (
                  <DropdownMenuItem onClick={() => void onUnpublish(e)}>
                    <Undo2 className="h-4 w-4" />
                    {t('action.toDraft')}
                  </DropdownMenuItem>
                ) : null}
                {canArchive && e.status !== 'archived' ? (
                  <DropdownMenuItem onClick={() => void onArchive(e)}>
                    <Archive className="h-4 w-4" />
                    {t('action.archive')}
                  </DropdownMenuItem>
                ) : null}
                {canCreate ? (
                  <DropdownMenuItem onClick={() => void onDuplicate(e)}>
                    <Copy className="h-4 w-4" />
                    {t('action.duplicate')}
                  </DropdownMenuItem>
                ) : null}
                {canDelete ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => void onDelete(e)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      {t('action.delete')}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const hasFilters = Boolean(params.search || params.status || params.locale || params.trashed);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        {canCreate ? (
          <Button onClick={() => navigate(paths.epaperIssuesCreate)}>
            <Plus className="h-4 w-4" />
            {t('new')}
          </Button>
        ) : null}
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 border border-border bg-background p-3">
        <Input
          value={params.search}
          onChange={(e) => patch({ search: e.target.value })}
          placeholder={t('filter.search')}
          className="min-w-[200px] flex-1"
        />
        <select
          className={selectCls}
          value={params.status}
          onChange={(e) => patch({ status: e.target.value as EpapersListParams['status'] })}
        >
          <option value="">{t('filter.statusAll')}</option>
          <option value="draft">{t('status.draft')}</option>
          <option value="scheduled">{t('status.scheduled')}</option>
          <option value="published">{t('status.published')}</option>
          <option value="archived">{t('status.archived')}</option>
        </select>
        <select
          className={selectCls}
          value={params.locale}
          onChange={(e) => patch({ locale: e.target.value as EpapersListParams['locale'] })}
        >
          <option value="">{t('filter.localeAll')}</option>
          <option value="ar">{t('locale.ar')}</option>
          <option value="en">{t('locale.en')}</option>
        </select>
        <select
          className={selectCls}
          value={params.sort}
          onChange={(e) => patch({ sort: e.target.value as EpapersListParams['sort'] })}
        >
          <option value="-publication_date">{t('filter.sortNewest')}</option>
          <option value="publication_date">{t('filter.sortOldest')}</option>
          <option value="issue_number">{t('filter.sortIssue')}</option>
          <option value="-published_at">{t('filter.sortPublished')}</option>
        </select>
        {canSeeTrash ? (
          <select
            className={selectCls}
            value={params.trashed}
            onChange={(e) => patch({ trashed: e.target.value as EpapersListParams['trashed'] })}
          >
            <option value="">{t('filter.trashedNone')}</option>
            <option value="only">{t('filter.trashedOnly')}</option>
          </select>
        ) : null}
        {hasFilters ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => patch({ search: '', status: '', locale: '', sort: '-publication_date', trashed: '' })}
          >
            <X className="h-4 w-4" />
            {t('filter.reset')}
          </Button>
        ) : null}
      </div>

      {q.isError ? (
        <div className="flex items-center justify-between gap-3 border border-destructive bg-destructive/5 p-4 text-sm">
          <span className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {t('error')}
          </span>
          <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
            {t('retry')}
          </Button>
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(e) => e.id}
            loading={q.isLoading}
            emptyTitle={inTrash ? t('empty.trashTitle') : t('empty.title')}
            emptyDescription={inTrash ? t('empty.trashDescription') : t('empty.description')}
          />
          {q.data ? <Pagination meta={q.data.pagination} onPage={(page) => patch({ page })} /> : null}
        </>
      )}

      {/* Schedule modal — توقيت محلّي للتطبيق (Asia/Amman) */}
      <Modal
        open={scheduling !== null}
        onClose={() => setScheduling(null)}
        title={t('schedule.title')}
        description={scheduling?.title}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setScheduling(null)}>
              {cancel()}
            </Button>
            <Button onClick={submitSchedule} disabled={!scheduleAt || transition.isPending}>
              {t('schedule.submit')}
            </Button>
          </>
        }
      >
        <label className="block text-sm font-medium">{t('schedule.label')}</label>
        <input
          type="datetime-local"
          value={scheduleAt}
          onChange={(e) => setScheduleAt(e.target.value)}
          className={cn(selectCls, 'mt-2 w-full')}
        />
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium">
          <CalendarClock className="h-3.5 w-3.5" />
          {t('schedule.tz', { tz: APP_TZ })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{t('schedule.hint')}</p>
      </Modal>
    </div>
  );
}
