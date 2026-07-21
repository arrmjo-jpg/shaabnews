import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  competitionsService,
  matchBarSettingsService,
  sportMenuItemsService,
  sportSettingsService,
  sportsHomeBarSettingsService,
} from '@/services/sport.service';
import { useToast } from '@/hooks/useToast';
import type {
  BarSettingsData,
  CompetitionCreatePayload,
  CompetitionUpdatePayload,
  SportMenuItemPayload,
  SportSettingsPayload,
} from '@/types/sport.types';
import type { NormalizedError } from '@/types/api';

const SPORT = ['sport'] as const;

export function useCompetitions() {
  return useQuery({ queryKey: [...SPORT, 'competitions'], queryFn: () => competitionsService.list() });
}

export function useCreateCompetition() {
  const qc = useQueryClient();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (payload: CompetitionCreatePayload) => competitionsService.create(payload),
    onSuccess: (message) => {
      success(message);
      void qc.invalidateQueries({ queryKey: [...SPORT, 'competitions'] });
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useUpdateCompetition() {
  const qc = useQueryClient();
  const { error } = useToast();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CompetitionUpdatePayload }) =>
      competitionsService.update(id, payload),
    onSuccess: () => {
      // بلا توست هنا عمداً: تبديل متكرّر لأعلام (is_tracked/is_featured_tournament/...)
      // على صفّ الجدول لا يستحقّ توست في كلّ مرّة — الأعمدة نفسها تعكس الحالة فورًا.
      void qc.invalidateQueries({ queryKey: [...SPORT, 'competitions'] });
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useDeleteCompetition() {
  const qc = useQueryClient();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => competitionsService.remove(id),
    onSuccess: (message) => {
      success(message);
      void qc.invalidateQueries({ queryKey: [...SPORT, 'competitions'] });
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

/** مشترك بين toggle Match Bar وSports Home Bar — نفس منطق invalidate/error. */
function useToggleCompetitionBar(mutationFn: (id: number) => Promise<string>) {
  const qc = useQueryClient();
  const { error } = useToast();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...SPORT, 'competitions'] });
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

/** مشترك بين reorder Match Bar وSports Home Bar. */
function useReorderCompetitionsBar(mutationFn: (ids: number[]) => Promise<string>) {
  const qc = useQueryClient();
  const { error } = useToast();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...SPORT, 'competitions'] });
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useToggleCompetitionMatchBar() {
  return useToggleCompetitionBar((id) => competitionsService.toggleMatchBar(id));
}

export function useReorderCompetitionsMatchBar() {
  return useReorderCompetitionsBar((ids) => competitionsService.reorderMatchBar(ids));
}

export function useToggleCompetitionSportsHomeBar() {
  return useToggleCompetitionBar((id) => competitionsService.toggleSportsHomeBar(id));
}

export function useReorderCompetitionsSportsHomeBar() {
  return useReorderCompetitionsBar((ids) => competitionsService.reorderSportsHomeBar(ids));
}

/** مشترك بين قراءة إعدادات Match Bar وSports Home Bar. */
function useBarSettings(queryKey: string, queryFn: () => Promise<BarSettingsData>) {
  return useQuery({ queryKey: [...SPORT, queryKey], queryFn });
}

/** مشترك بين تحديث إعدادات Match Bar وSports Home Bar. */
function useUpdateBarSettings(queryKey: string, mutationFn: (enabled: boolean) => Promise<string>) {
  const qc = useQueryClient();
  const { success, error } = useToast();
  return useMutation({
    mutationFn,
    onSuccess: (message) => {
      success(message);
      void qc.invalidateQueries({ queryKey: [...SPORT, queryKey] });
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useMatchBarSettings() {
  return useBarSettings('match-bar-settings', () => matchBarSettingsService.get());
}

export function useUpdateMatchBarSettings() {
  return useUpdateBarSettings('match-bar-settings', (enabled) => matchBarSettingsService.update(enabled));
}

export function useSportsHomeBarSettings() {
  return useBarSettings('sports-home-bar-settings', () => sportsHomeBarSettingsService.get());
}

export function useUpdateSportsHomeBarSettings() {
  return useUpdateBarSettings('sports-home-bar-settings', (enabled) => sportsHomeBarSettingsService.update(enabled));
}

export function useSportMenuItems() {
  return useQuery({ queryKey: [...SPORT, 'menu-items'], queryFn: () => sportMenuItemsService.list() });
}

export function useCreateSportMenuItem() {
  const qc = useQueryClient();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (payload: SportMenuItemPayload) => sportMenuItemsService.create(payload),
    onSuccess: (message) => {
      success(message);
      void qc.invalidateQueries({ queryKey: [...SPORT, 'menu-items'] });
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useUpdateSportMenuItem() {
  const qc = useQueryClient();
  const { error } = useToast();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: SportMenuItemPayload }) =>
      sportMenuItemsService.update(id, payload),
    onSuccess: () => {
      // بلا توست عمداً — يطابق useUpdateCompetition: تعديلات/تبديلات متكرّرة لا تستحقّ توستاً كلّ مرّة.
      void qc.invalidateQueries({ queryKey: [...SPORT, 'menu-items'] });
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useDeleteSportMenuItem() {
  const qc = useQueryClient();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (id: number) => sportMenuItemsService.remove(id),
    onSuccess: (message) => {
      success(message);
      void qc.invalidateQueries({ queryKey: [...SPORT, 'menu-items'] });
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useReorderSportMenuItems() {
  const qc = useQueryClient();
  const { error } = useToast();
  return useMutation({
    mutationFn: (ids: number[]) => sportMenuItemsService.reorder(ids),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...SPORT, 'menu-items'] });
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}

export function useSportSettings() {
  return useQuery({ queryKey: [...SPORT, 'settings'], queryFn: () => sportSettingsService.get() });
}

export function useUpdateSportSettings() {
  const qc = useQueryClient();
  const { success, error } = useToast();
  return useMutation({
    mutationFn: (payload: SportSettingsPayload) => sportSettingsService.update(payload),
    onSuccess: (message) => {
      success(message);
      void qc.invalidateQueries({ queryKey: [...SPORT, 'settings'] });
    },
    onError: (e: NormalizedError) => error(e.message),
  });
}
