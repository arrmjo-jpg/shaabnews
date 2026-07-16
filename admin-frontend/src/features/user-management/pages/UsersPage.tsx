import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  KeyRound,
  Trash2,
  RotateCcw,
  MailCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable, type Column } from '@/components/data/DataTable';
import { Pagination } from '@/components/data/Pagination';
import { SearchInput } from '@/components/data/SearchInput';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/feedback';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import {
  useUsers,
  useAllRoles,
  useDeleteUser,
  useRestoreUser,
  useSendPasswordReset,
  useSetEmailVerified,
} from '../hooks';
import { paths } from '@/router/paths';
import { storageUrl } from '@/lib/storage';
import type {
  UserData,
  UsersListParams,
  UserAccountType,
} from '@/types/users.types';

const PER_PAGE = 15;

const selectCls =
  'h-10 rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function UsersPage() {
  const { t, i18n } = useTranslation('users');
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { confirm } = useToast();

  const canCreate = hasPermission('users.create');
  const canEdit = hasPermission('users.edit');
  const canDelete = hasPermission('users.delete');

  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo<UsersListParams>(() => ({
    page: Number(searchParams.get('page')) || 1,
    per_page: PER_PAGE,
    search: searchParams.get('search') || '',
    status: (searchParams.get('status') as UsersListParams['status']) || '',
    role: searchParams.get('role') || '',
    trashed: (searchParams.get('trashed') as UsersListParams['trashed']) || 'none',
  }), [searchParams]);
  const [accountType, setAccountType] = useState<UserAccountType>('all');

  const q = useUsers(params);
  const rolesQ = useAllRoles();
  const del = useDeleteUser();
  const restore = useRestoreUser();
  const resetPwd = useSendPasswordReset();
  const verifyEmail = useSetEmailVerified();

  const patch = (p: Partial<UsersListParams>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(p).forEach(([k, v]) => {
      if (v === '' || v == null) next.delete(k);
      else next.set(k, String(v));
    });
    if (p.page === undefined) next.set('page', '1');
    setSearchParams(next);
  };

  const fmtDate = (v: string | null) =>
    v ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(v)) : '—';

  const rows = useMemo(() => {
    const all = q.data?.data ?? [];
    if (accountType === 'admins') return all.filter((u) => u.is_admin);
    if (accountType === 'regular') return all.filter((u) => !u.is_admin);
    return all;
  }, [q.data, accountType]);

  const openCreate = () => navigate(paths.usersCreate);
  const openEdit = (u: UserData) => navigate(`/users/${u.id}/edit`);

  const onDelete = async (u: UserData) => {
    if (
      await confirm({
        title: t('users.confirm.deleteTitle'),
        text: t('users.confirm.deleteText'),
        confirmText: t('users.confirm.yes'),
        cancelText: t('common.cancel'),
      })
    )
      del.mutate(u.id);
  };

  const onRestore = async (u: UserData) => {
    if (
      await confirm({
        title: t('users.confirm.restoreTitle'),
        text: t('users.confirm.restoreText'),
        confirmText: t('users.confirm.yes'),
        cancelText: t('common.cancel'),
      })
    )
      restore.mutate(u.id);
  };

  const onResetPwd = async (u: UserData) => {
    if (
      await confirm({
        title: t('users.confirm.resetTitle'),
        text: t('users.confirm.resetText'),
        confirmText: t('users.confirm.yes'),
        cancelText: t('common.cancel'),
      })
    )
      resetPwd.mutate(u.id);
  };

  const onVerifyEmail = async (u: UserData) => {
    if (
      await confirm({
        title: t('users.confirm.verifyTitle'),
        text: t('users.confirm.verifyText'),
        confirmText: t('users.confirm.yes'),
        cancelText: t('common.cancel'),
      })
    )
      verifyEmail.mutate({ id: u.id, verified: true });
  };

  const columns: Column<UserData>[] = [
    {
      key: 'user',
      header: t('users.col.user'),
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar>
            {u.avatar ? (
              <img
                src={storageUrl(u.avatar) ?? ''}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <AvatarFallback>{u.name.charAt(0).toUpperCase()}</AvatarFallback>
            )}
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">{u.name}</p>
            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: t('users.col.type'),
      render: (u) => (
        <div className="flex flex-wrap gap-1.5">
          {u.is_admin ? <Badge>{t('users.type.admin')}</Badge> : null}
          {u.is_writer ? <Badge variant="muted">{t('users.type.writer')}</Badge> : null}
          {!u.is_admin && !u.is_writer ? (
            <Badge variant="muted">{t('users.type.regular')}</Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: 'roles',
      header: t('users.col.roles'),
      render: (u) => (
        <span className="text-sm text-muted-foreground">
          {u.roles.map((r) => r.display_name).join('، ') || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('users.col.status'),
      render: (u) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant={
              u.status === 'active'
                ? 'success'
                : u.status === 'banned'
                  ? 'destructive'
                  : 'muted'
            }
          >
            {u.status_label}
          </Badge>
          {!u.email_verified ? (
            <Badge variant="muted">{t('users.badge.unverified')}</Badge>
          ) : null}
          {u.deleted_at ? (
            <Badge variant="destructive">{t('users.badge.deleted')}</Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: 'lastLogin',
      header: t('users.col.lastLogin'),
      render: (u) => <span className="text-sm text-muted-foreground">{fmtDate(u.last_login_at)}</span>,
    },
    {
      key: 'created',
      header: t('users.col.created'),
      render: (u) => <span className="text-sm text-muted-foreground">{fmtDate(u.created_at)}</span>,
    },
    {
      key: 'actions',
      header: t('users.col.actions'),
      align: 'end',
      render: (u) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canEdit && !u.deleted_at ? (
              <DropdownMenuItem onClick={() => openEdit(u)}>
                <Pencil className="h-4 w-4" />
                {t('users.action.edit')}
              </DropdownMenuItem>
            ) : null}
            {canEdit && !u.deleted_at && !u.email_verified ? (
              <DropdownMenuItem
                onClick={() => onVerifyEmail(u)}
                className="text-emerald-600 focus:text-emerald-600 dark:text-emerald-400"
              >
                <MailCheck className="h-4 w-4" />
                {t('users.action.verifyEmail')}
              </DropdownMenuItem>
            ) : null}
            {canEdit && !u.deleted_at ? (
              <DropdownMenuItem onClick={() => onResetPwd(u)}>
                <KeyRound className="h-4 w-4" />
                {t('users.action.resetPassword')}
              </DropdownMenuItem>
            ) : null}
            {canDelete && u.deleted_at ? (
              <DropdownMenuItem onClick={() => onRestore(u)}>
                <RotateCcw className="h-4 w-4" />
                {t('users.action.restore')}
              </DropdownMenuItem>
            ) : null}
            {canDelete && !u.deleted_at ? (
              <DropdownMenuItem
                onClick={() => onDelete(u)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                {t('users.action.delete')}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} />;

  const allRoles = rolesQ.data?.data ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('users.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('users.subtitle')}</p>
        </div>
        {canCreate ? (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t('users.new')}
          </Button>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background p-3">
        <SearchInput
          value={params.search}
          onDebouncedChange={(v) => patch({ search: v })}
          placeholder={t('users.searchPlaceholder')}
        />
        <select
          className={selectCls}
          value={accountType}
          onChange={(e) => setAccountType(e.target.value as UserAccountType)}
        >
          <option value="all">{t('users.filter.all')}</option>
          <option value="admins">{t('users.filter.admins')}</option>
          <option value="regular">{t('users.filter.regular')}</option>
        </select>
        <select
          className={selectCls}
          value={params.status}
          onChange={(e) => patch({ status: e.target.value as UsersListParams['status'] })}
        >
          <option value="">{t('users.filter.statusAll')}</option>
          <option value="active">{t('users.status.active')}</option>
          <option value="suspended">{t('users.status.suspended')}</option>
          <option value="banned">{t('users.status.banned')}</option>
        </select>
        <select
          className={selectCls}
          value={params.role}
          onChange={(e) => patch({ role: e.target.value })}
        >
          <option value="">{t('users.filter.roleAll')}</option>
          {allRoles.map((r) => (
            <option key={r.id} value={r.name}>
              {r.display_name}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={params.trashed}
          onChange={(e) =>
            patch({ trashed: e.target.value as UsersListParams['trashed'] })
          }
        >
          <option value="none">{t('users.filter.trashedNone')}</option>
          <option value="with">{t('users.filter.trashedWith')}</option>
          <option value="only">{t('users.filter.trashedOnly')}</option>
        </select>
      </div>

      <div className={cn('transition-opacity duration-200', q.isFetching && 'opacity-70')}>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(u) => u.id}
          loading={q.isLoading}
        />

        {q.data ? <Pagination meta={q.data.pagination} onPage={(page) => patch({ page })} /> : null}
      </div>
    </div>
  );
}
