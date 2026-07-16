import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { usersService } from '@/services/users.service';
import { rolesService } from '@/services/roles.service';
import { permissionsService } from '@/services/permissions.service';
import { writerRequestsService } from '@/services/writerRequests.service';
import { activityService } from '@/services/activity.service';
import { useToast } from '@/hooks/useToast';
import type { NormalizedError } from '@/types/api';
import type { UsersListParams, UserUpsertPayload } from '@/types/users.types';
import type { WriterRequestsListParams } from '@/types/writer.types';
import type { ActivityListParams } from '@/types/activity.types';
import type {
  RoleUpsertPayload,
  PermissionGroupUpsertPayload,
} from '@/types/rbac.types';

const ACTIVITY_LOG = ['activity-log'] as const;
const WRITER_REQUESTS = ['writer-requests'] as const;
const USERS = ['users'] as const;
const ROLES = ['roles'] as const;
const PERMISSIONS = ['permissions', 'grouped'] as const;
const PGROUPS = ['permission-groups'] as const;

// ─── Users ───────────────────────────────────────────────────────────────
export function useUsers(params: UsersListParams) {
  return useQuery({
    queryKey: [...USERS, params],
    queryFn: ({ signal }) => usersService.list(params, signal),
    placeholderData: keepPreviousData,
  });
}

export function useUser(id: number | null) {
  return useQuery({
    queryKey: [...USERS, 'detail', id],
    queryFn: () => usersService.get(id as number),
    enabled: id !== null,
  });
}

function useUsersInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: USERS });
}

export function useUploadAvatar() {
  const { error } = useToast();
  return useMutation({
    mutationFn: (file: File) => usersService.uploadAvatar(file),
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useCreateUser() {
  const invalidate = useUsersInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (payload: UserUpsertPayload) => usersService.create(payload),
    onSuccess: (res) => {
      success(res.message);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useUpdateUser() {
  const invalidate = useUsersInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; payload: UserUpsertPayload }) =>
      usersService.update(v.id, v.payload),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useDeleteUser() {
  const invalidate = useUsersInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => usersService.remove(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useRestoreUser() {
  const invalidate = useUsersInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => usersService.restore(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useSetEmailVerified() {
  const invalidate = useUsersInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; verified: boolean }) =>
      usersService.setEmailVerified(v.id, v.verified),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useSendPasswordReset() {
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => usersService.sendPasswordReset(id),
    onSuccess: (m) => success(m),
    onError: (e: NormalizedError) => error(e.message),
  });
}

// ─── Roles ───────────────────────────────────────────────────────────────
export function useRoles(params: { page: number; per_page: number; search: string }) {
  return useQuery({
    queryKey: [...ROLES, params],
    queryFn: () => rolesService.list(params),
    placeholderData: keepPreviousData,
  });
}

/** كل الأدوار (لقوائم الاختيار) — صفحة واحدة كبيرة. */
export function useAllRoles() {
  return useQuery({
    queryKey: [...ROLES, 'all'],
    queryFn: () => rolesService.list({ page: 1, per_page: 100, search: '' }),
  });
}

function useRolesInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ROLES });
    void qc.invalidateQueries({ queryKey: PERMISSIONS });
  };
}

export function useCreateRole() {
  const invalidate = useRolesInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (payload: RoleUpsertPayload) => rolesService.create(payload),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useUpdateRole() {
  const invalidate = useRolesInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; payload: RoleUpsertPayload }) =>
      rolesService.update(v.id, v.payload),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useDeleteRole() {
  const invalidate = useRolesInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => rolesService.remove(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

// ─── Permissions / Groups ────────────────────────────────────────────────
export function usePermissionsGrouped() {
  return useQuery({
    queryKey: PERMISSIONS,
    queryFn: () => permissionsService.listGrouped(),
  });
}

export function usePermissionGroups() {
  return useQuery({
    queryKey: PGROUPS,
    queryFn: () => permissionsService.groups(),
  });
}

function usePGroupsInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: PGROUPS });
    void qc.invalidateQueries({ queryKey: PERMISSIONS });
  };
}

export function useCreatePermissionGroup() {
  const invalidate = usePGroupsInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (payload: PermissionGroupUpsertPayload) =>
      permissionsService.createGroup(payload),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useUpdatePermissionGroup() {
  const invalidate = usePGroupsInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; payload: PermissionGroupUpsertPayload }) =>
      permissionsService.updateGroup(v.id, v.payload),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useDeletePermissionGroup() {
  const invalidate = usePGroupsInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => permissionsService.removeGroup(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

// ─── Activity Log (system-wide) ──────────────────────────────────────────
export function useActivityLog(params: ActivityListParams) {
  return useQuery({
    queryKey: [...ACTIVITY_LOG, params],
    queryFn: () => activityService.list(params),
    placeholderData: keepPreviousData,
  });
}

// ─── Writer Requests ─────────────────────────────────────────────────────
export function useWriterRequests(params: WriterRequestsListParams) {
  return useQuery({
    queryKey: [...WRITER_REQUESTS, params],
    queryFn: () => writerRequestsService.list(params),
    placeholderData: keepPreviousData,
  });
}

function useWriterRequestsInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: WRITER_REQUESTS });
    void qc.invalidateQueries({ queryKey: USERS });
  };
}

export function useApproveWriterRequest() {
  const invalidate = useWriterRequestsInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => writerRequestsService.approve(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useRejectWriterRequest() {
  const invalidate = useWriterRequestsInvalidate();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => writerRequestsService.reject(id),
    onSuccess: (m) => {
      success(m);
      invalidate();
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}
