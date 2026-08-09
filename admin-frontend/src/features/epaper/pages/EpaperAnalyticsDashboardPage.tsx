import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Bookmark,
  Clock,
  Download,
  Eye,
  FileSearch,
  Layers,
  RotateCcw,
  Search,
  Server,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  BarRow,
  DeferredNotice,
  fmtDuration,
  fmtNum,
  MetricCard,
  Panel,
  RangeFilter,
  type RangeValue,
  TrendChart,
} from '@/components/analytics/AnalyticsKit';
import type { AnalyticsRangeKey } from '@/types/analytics.types';
import { useEpaperDashboard, useEpaperOperations } from '../hooks';

/** نطاق عُدّة التحليلات (24h/7d/30d/custom) → فترة الواجهة الخلفية (today/7d/30d/custom). */
const PERIOD: Record<AnalyticsRangeKey, string> = { '24h': 'today', '7d': '7d', '30d': '30d', custom: 'custom' };

export default function EpaperAnalyticsDashboardPage() {
  const { t } = useTranslation('epaper');
  const [range, setRange] = useState<RangeValue>({ range: '30d' });

  const period = PERIOD[range.range];
  const dash = useEpaperDashboard({ period, from: range.from, to: range.to });
  const ops = useEpaperOperations();

  const rangeLabels: Record<string, string> = {
    '24h': t('analyticsDash.range.today'),
    '7d': t('analyticsDash.range.7d'),
    '30d': t('analyticsDash.range.30d'),
    custom: t('analyticsDash.range.custom'),
  };

  const Header = (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{t('analyticsDash.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('analyticsDash.subtitle')}</p>
      </div>
      <RangeFilter value={range} onChange={setRange} labels={rangeLabels} />
    </header>
  );

  if (dash.isError) {
    return (
      <div className="space-y-6">
        {Header}
        <div className="flex items-center justify-between gap-3 border border-destructive bg-destructive/5 p-4 text-sm">
          <span className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {t('analyticsDash.error')}
          </span>
          <Button variant="outline" size="sm" onClick={() => void dash.refetch()}>
            {t('analyticsDash.retry')}
          </Button>
        </div>
      </div>
    );
  }

  if (dash.isLoading || !dash.data) {
    return (
      <div className="space-y-6">
        {Header}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] w-full" />
          ))}
        </div>
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  const o = dash.data.overview;
  const series = dash.data.series;

  return (
    <div className="space-y-6">
      {Header}

      {/* Global overview — KPIs للفترة المختارة */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard label={t('analyticsDash.kpi.opens')} value={fmtNum(o.opens)} icon={BookOpen} tone="text-primary" />
        <MetricCard label={t('analyticsDash.kpi.sessions')} value={fmtNum(o.sessions)} icon={Users} tone="text-sky-600 dark:text-sky-400" />
        <MetricCard label={t('analyticsDash.kpi.readingTime')} value={fmtDuration(o.total_duration_seconds)} icon={Clock} tone="text-indigo-600 dark:text-indigo-400" />
        <MetricCard label={t('analyticsDash.kpi.avgSession')} value={fmtDuration(o.avg_session_seconds)} icon={Activity} tone="text-indigo-600 dark:text-indigo-400" />
        <MetricCard label={t('analyticsDash.kpi.activeIssues')} value={fmtNum(o.active_issues)} icon={Layers} tone="text-muted-foreground" />
        <MetricCard label={t('analyticsDash.kpi.archiveSearches')} value={fmtNum(o.archive_searches)} icon={FileSearch} tone="text-amber-600 dark:text-amber-400" />
        <MetricCard label={t('analyticsDash.kpi.searches')} value={fmtNum(o.searches)} icon={Search} tone="text-amber-600 dark:text-amber-400" />
        <MetricCard label={t('analyticsDash.kpi.bookmarks')} value={fmtNum(o.bookmarks_used)} icon={Bookmark} tone="text-emerald-600 dark:text-emerald-400" />
        <MetricCard label={t('analyticsDash.kpi.resumes')} value={fmtNum(o.resumes_used)} icon={RotateCcw} tone="text-emerald-600 dark:text-emerald-400" />
        <MetricCard label={t('analyticsDash.kpi.downloads')} value={fmtNum(o.downloads)} icon={Download} tone="text-sky-600 dark:text-sky-400" />
      </div>

      {/* Sessions trend */}
      <Panel title={t('analyticsDash.trend.title')} subtitle={t('analyticsDash.trend.subtitle')} icon={TrendingUp}>
        <TrendChart
          points={series.map((s) => ({ label: s.date, value: s.sessions }))}
          emptyLabel={t('analyticsDash.trend.empty')}
        />
      </Panel>

      {/* Per-issue ranking */}
      <Panel title={t('analyticsDash.topIssues.title')} subtitle={t('analyticsDash.topIssues.subtitle')} icon={Eye}>
        {dash.data.top_issues.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('analyticsDash.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-start text-xs text-muted-foreground">
                  <th className="px-2 py-2 text-start font-medium">#</th>
                  <th className="px-2 py-2 text-start font-medium">{t('analyticsDash.col.issue')}</th>
                  <th className="px-2 py-2 text-end font-medium">{t('analyticsDash.col.sessions')}</th>
                  <th className="px-2 py-2 text-end font-medium">{t('analyticsDash.col.avgSession')}</th>
                  <th className="px-2 py-2 text-end font-medium">{t('analyticsDash.col.searches')}</th>
                  <th className="px-2 py-2 text-end font-medium">{t('analyticsDash.col.bookmarks')}</th>
                  <th className="px-2 py-2 text-end font-medium">{t('analyticsDash.col.resumes')}</th>
                  <th className="px-2 py-2 text-end font-medium">{t('analyticsDash.col.downloads')}</th>
                  <th className="px-2 py-2 text-end font-medium">{t('analyticsDash.col.score')}</th>
                </tr>
              </thead>
              <tbody>
                {dash.data.top_issues.map((row, i) => (
                  <tr key={row.id} className="border-b border-border/60 last:border-0">
                    <td className="px-2 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="px-2 py-2">
                      <span className="block truncate font-medium">{row.title}</span>
                      <span className="text-xs text-muted-foreground">#{row.issue_number}</span>
                    </td>
                    <td className="px-2 py-2 text-end tabular-nums">{fmtNum(row.sessions)}</td>
                    <td className="px-2 py-2 text-end tabular-nums text-muted-foreground">{fmtDuration(row.avg_session_seconds)}</td>
                    <td className="px-2 py-2 text-end tabular-nums">{fmtNum(row.searches)}</td>
                    <td className="px-2 py-2 text-end tabular-nums">{fmtNum(row.bookmarks_used)}</td>
                    <td className="px-2 py-2 text-end tabular-nums">{fmtNum(row.resumes_used)}</td>
                    <td className="px-2 py-2 text-end tabular-nums">{fmtNum(row.downloads)}</td>
                    <td className="px-2 py-2 text-end font-semibold tabular-nums">{fmtNum(row.engagement_score)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Trending */}
        <Panel title={t('analyticsDash.trending.title')} subtitle={t('analyticsDash.trending.subtitle')} icon={TrendingUp}>
          {dash.data.trending.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('analyticsDash.empty')}</p>
          ) : (
            <ol className="space-y-2">
              {dash.data.trending.map((v, i) => (
                <li key={v.id} className="flex items-center gap-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{v.title}</span>
                  <span className={cn('shrink-0 text-xs font-medium tabular-nums', v.growth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
                    {v.growth >= 0 ? '+' : ''}
                    {fmtNum(v.growth)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        {/* Top search terms */}
        <Panel title={t('analyticsDash.topTerms.title')} subtitle={t('analyticsDash.topTerms.subtitle')} icon={Search}>
          {dash.data.reader_behavior.top_terms.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('analyticsDash.empty')}</p>
          ) : (
            <ol className="space-y-2">
              {dash.data.reader_behavior.top_terms.map((term) => (
                <li key={term.term} className="flex items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium" dir="auto">{term.term}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{fmtNum(term.count)}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      {/* Most viewed pages (reading depth) */}
      <Panel title={t('analyticsDash.topPages.title')} subtitle={t('analyticsDash.topPages.subtitle')} icon={Eye}>
        {dash.data.reader_behavior.top_pages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('analyticsDash.empty')}</p>
        ) : (
          <div className="space-y-3">
            {dash.data.reader_behavior.top_pages.map((p) => (
              <BarRow
                key={p.page}
                label={t('analyticsDash.pageN', { n: p.page })}
                value={p.views}
                total={dash.data!.reader_behavior.top_pages[0]?.views ?? 1}
              />
            ))}
          </div>
        )}
      </Panel>

      {/* Operations — البند C */}
      <Panel title={t('analyticsDash.ops.title')} subtitle={t('analyticsDash.ops.subtitle')} icon={Server}>
        {ops.isLoading || !ops.data ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">{t('analyticsDash.ops.queuesTitle')}</p>
            <p className="text-xs text-muted-foreground">
              {t('analyticsDash.ops.queues')}: media <span className="tabular-nums">{fmtNum(ops.data.queues.media)}</span>
              {' · '}analytics <span className="tabular-nums">{fmtNum(ops.data.queues.analytics)}</span>
              {' · '}{t('analyticsDash.ops.failed')} <span className={cn('tabular-nums', ops.data.queues.failed > 0 && 'text-destructive')}>{fmtNum(ops.data.queues.failed)}</span>
            </p>
          </div>
        )}
      </Panel>

      {/* Honest deferral — privacy-conscious, not tracked */}
      <DeferredNotice title={t('analyticsDash.deferred.title')} note={t('analyticsDash.deferred.note')} />
    </div>
  );
}
