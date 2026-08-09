<?php

declare(strict_types=1);

use App\Models\Epaper;
use App\Models\EpaperArchiveSearchDaily;
use App\Models\EpaperDailyStat;
use App\Models\EpaperIssueStat;
use App\Models\EpaperPageView;
use App\Models\EpaperSearchTerm;
use App\Models\Role;
use App\Models\User;
use App\Settings\NewspaperSettings;
use App\Support\Epaper\EpaperUsageRecorder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\PermissionRegistrar;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
    $s = app(NewspaperSettings::class);
    $s->enabled = true;
    $s->save();
});

function epdaAdmin(): User
{
    $u = User::factory()->create();
    $u->assignRole('super_admin');

    return $u;
}

function epdaIssue(array $attrs = []): Epaper
{
    static $n = 0;
    $n++;

    return Epaper::create(array_merge([
        'locale' => 'ar',
        'issue_number' => 9000 + $n,
        'title' => 'لوحة '.$n,
        'slug' => 'dash-'.$n,
        'publication_date' => now()->subDay()->toDateString(),
        'status' => 'published',
        'published_at' => now()->subDay(),
    ], $attrs));
}

function epdaDaily(int $epaperId, string $date, array $attrs = []): EpaperDailyStat
{
    return EpaperDailyStat::create(array_merge([
        'epaper_id' => $epaperId,
        'stat_date' => $date,
        'opens' => 0, 'sessions' => 0, 'total_duration_seconds' => 0, 'pages_viewed' => 0,
        'searches' => 0, 'bookmarks_used' => 0, 'resumes_used' => 0, 'downloads' => 0,
    ], $attrs));
}

// ─── Global overview (period-filtered from daily rollups) ────────────────────

it('returns a global overview for the selected period', function (): void {
    $e = epdaIssue();
    epdaDaily($e->id, now()->toDateString(), [
        'opens' => 5, 'sessions' => 5, 'total_duration_seconds' => 300,
        'searches' => 2, 'bookmarks_used' => 1, 'resumes_used' => 1, 'downloads' => 3, 'pages_viewed' => 10,
    ]);
    epdaDaily($e->id, now()->subDays(40)->toDateString(), ['sessions' => 100]); // خارج نافذة 30 يوماً
    EpaperArchiveSearchDaily::create(['stat_date' => now()->toDateString(), 'locale' => 'ar', 'count' => 7]);

    $res = $this->actingAs(epdaAdmin())->getJson('/api/v1/admin/epapers/analytics?period=30d')->assertOk();

    expect($res->json('data.overview.sessions'))->toBe(5); // العدد القديم مُستبعَد
    expect($res->json('data.overview.avg_session_seconds'))->toBe(60);
    expect($res->json('data.overview.downloads'))->toBe(3);
    expect($res->json('data.overview.archive_searches'))->toBe(7);
    expect($res->json('data.overview.active_issues'))->toBe(1);
    expect($res->json('data.range.period'))->toBe('30d');
});

it('ranks top issues by engagement score', function (): void {
    $low = epdaIssue(['title' => 'منخفض']);
    $high = epdaIssue(['title' => 'مرتفع']);
    epdaDaily($low->id, now()->toDateString(), ['sessions' => 10]);
    epdaDaily($high->id, now()->toDateString(), ['sessions' => 5, 'bookmarks_used' => 20, 'downloads' => 10]);

    $res = $this->actingAs(epdaAdmin())->getJson('/api/v1/admin/epapers/analytics?period=7d')->assertOk();

    expect($res->json('data.top_issues.0.id'))->toBe($high->id); // الإشارات/التنزيلات ترفع الدرجة
    expect($res->json('data.top_issues.0.engagement_score'))
        ->toBeGreaterThan($res->json('data.top_issues.1.engagement_score'));
});

it('returns reader behavior: top pages + top terms (all-time)', function (): void {
    $e = epdaIssue();
    EpaperPageView::create(['epaper_id' => $e->id, 'page_number' => 1, 'views' => 50]);
    EpaperPageView::create(['epaper_id' => $e->id, 'page_number' => 2, 'views' => 30]);
    EpaperSearchTerm::create(['epaper_id' => $e->id, 'term' => 'اقتصاد', 'count' => 12]);

    $res = $this->actingAs(epdaAdmin())->getJson('/api/v1/admin/epapers/analytics')->assertOk();

    expect($res->json('data.reader_behavior.top_pages.0.page'))->toBe(1);
    expect($res->json('data.reader_behavior.top_pages.0.views'))->toBe(50);
    expect($res->json('data.reader_behavior.top_terms.0.term'))->toBe('اقتصاد');
});

it('builds a daily series for the trend chart', function (): void {
    $e = epdaIssue();
    epdaDaily($e->id, now()->toDateString(), ['sessions' => 4]);
    epdaDaily($e->id, now()->subDays(1)->toDateString(), ['sessions' => 6]);

    $res = $this->actingAs(epdaAdmin())->getJson('/api/v1/admin/epapers/analytics?period=7d')->assertOk();

    expect($res->json('data.series'))->toHaveCount(2);
});

// ─── Validation + gating ─────────────────────────────────────────────────────

it('422s a custom range without from/to', function (): void {
    $this->actingAs(epdaAdmin())->getJson('/api/v1/admin/epapers/analytics?period=custom')->assertStatus(422);
});

it('requires epapers.view for the dashboard', function (): void {
    Role::findByName('editor', 'web');
    app(PermissionRegistrar::class)->forgetCachedPermissions();
    $u = User::factory()->create();
    $u->assignRole('editor');

    $this->actingAs($u)->getJson('/api/v1/admin/epapers/analytics')->assertStatus(403);
});

it('404s the dashboard when the module is disabled', function (): void {
    $s = app(NewspaperSettings::class);
    $s->enabled = false;
    $s->save();

    $this->actingAs(epdaAdmin())->getJson('/api/v1/admin/epapers/analytics')->assertNotFound();
});

// ─── Operations panel (item C) ───────────────────────────────────────────────

it('returns operational visibility: queues + delivery', function (): void {
    $res = $this->actingAs(epdaAdmin())->getJson('/api/v1/admin/epapers/operations')->assertOk();

    expect($res->json('data.queues'))->toHaveKeys(['pending', 'failed', 'media', 'analytics']);
    expect($res->json('data.delivery'))->toHaveKey('remote_enabled');
});

it('requires epapers.view for operations', function (): void {
    Role::findByName('editor', 'web');
    app(PermissionRegistrar::class)->forgetCachedPermissions();
    $u = User::factory()->create();
    $u->assignRole('editor');

    $this->actingAs($u)->getJson('/api/v1/admin/epapers/operations')->assertStatus(403);
});

// ─── Usage recorder (downloads + archive search) ─────────────────────────────

it('records downloads cumulatively and per day', function (): void {
    $e = epdaIssue();

    EpaperUsageRecorder::recordDownload($e->id);
    EpaperUsageRecorder::recordDownload($e->id);

    expect(EpaperIssueStat::where('epaper_id', $e->id)->value('downloads'))->toBe(2);
    expect(EpaperDailyStat::where('epaper_id', $e->id)->where('stat_date', now()->toDateString())->value('downloads'))->toBe(2);
});

it('records archive search usage per day and locale', function (): void {
    EpaperUsageRecorder::recordArchiveSearch('ar');
    EpaperUsageRecorder::recordArchiveSearch('ar');
    EpaperUsageRecorder::recordArchiveSearch('en');

    expect(EpaperArchiveSearchDaily::where('stat_date', now()->toDateString())->where('locale', 'ar')->value('count'))->toBe(2);
    expect(EpaperArchiveSearchDaily::where('stat_date', now()->toDateString())->where('locale', 'en')->value('count'))->toBe(1);
});
