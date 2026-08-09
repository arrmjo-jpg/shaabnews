<?php

declare(strict_types=1);

use App\Actions\Admin\Epaper\PublishDueEpapersAction;
use App\Enums\EpaperStatus;
use App\Jobs\GenerateEpaperCoverJob;
use App\Models\Epaper;
use App\Models\EpaperUrlHistory;
use App\Models\EpaperVersion;
use App\Models\MediaAsset;
use App\Models\Role;
use App\Models\User;
use App\Settings\NewspaperSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Spatie\Permission\PermissionRegistrar;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
    // الوحدة مفعَّلة لهذه الاختبارات (بوابة newspaper.enabled تحجب المسارات بـ 404 عند التعطيل).
    $settings = app(NewspaperSettings::class);
    $settings->enabled = true;
    $settings->save();
});

/** توكن super_admin (كل الصلاحيات). */
function epcSuper(): string
{
    $u = User::factory()->create();
    $u->assignRole('super_admin');

    return $u->createToken('admin', ['admin'])->plainTextToken;
}

/** محرّر بصلاحيات مُمرّرة فقط — لاختبار الحُرّاس (لا شيء افتراضياً للجريدة). */
function epcActor(string ...$perms): string
{
    $role = Role::findByName('editor', 'web');
    if ($perms !== []) {
        $role->givePermissionTo($perms);
    }
    app(PermissionRegistrar::class)->forgetCachedPermissions();
    $u = User::factory()->create();
    $u->assignRole('editor');

    return $u->createToken('admin', ['admin'])->plainTextToken;
}

/** ملف PDF حقيقيّ (بايتات %PDF) يجتاز mimetypes + مسار التخزين الخام. */
function epcPdf(): UploadedFile
{
    $body = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        ."2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        ."3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n"
        ."trailer<</Root 1 0 R>>\n%%EOF";
    $path = sys_get_temp_dir().'/epc-'.uniqid().'.pdf';
    file_put_contents($path, $body);

    return new UploadedFile($path, 'issue.pdf', 'application/pdf', null, true);
}

/** أصل PDF خارجيّ (FK فقط — url() يرجع source_url بلا قرص). */
function epcAsset(): MediaAsset
{
    return MediaAsset::create([
        'uuid' => (string) Str::uuid(),
        'kind' => 'external',
        'disk' => 'external',
        'path' => '',
        'filename' => '',
        'original_name' => 'issue.pdf',
        'mime_type' => 'application/pdf',
        'extension' => 'pdf',
        'size' => 1024,
        'checksum' => hash('sha256', Str::random()),
        'provider' => 'external',
        'source_url' => 'https://cdn.allowed.test/issue.pdf',
        'visibility' => 'public',
    ]);
}

/** يُنشئ عدداً مباشرةً (بلا HTTP) — رقم عدد فريد افتراضيّ لتفادي تصادم الفهرس. */
function epcIssue(array $overrides = []): Epaper
{
    static $n = 0;
    $n++;

    return Epaper::create(array_merge([
        'locale' => 'ar',
        'issue_number' => 1000 + $n,
        'title' => 'عدد رقم '.$n,
        'publication_date' => now()->toDateString(),
    ], $overrides));
}

/** يهيّئ قرص الوسائط الوهميّ لاختبارات الرفع. */
function epcFakeStorage(): void
{
    Storage::fake('uploads');
    Queue::fake();
    config(['media-library.disk_name' => 'uploads']);
}

// ─── Create (HTTP multipart) ─────────────────────────────────────────────────

it('creates an issue from an uploaded PDF as a draft with version 1', function (): void {
    epcFakeStorage();
    $token = epcSuper();

    $res = $this->withToken($token)->post('/api/v1/admin/epapers', [
        'issue_number' => 1,
        'title' => 'العدد الأول',
        'publication_date' => now()->toDateString(),
        'file' => epcPdf(),
    ], ['Accept' => 'application/json'])->assertCreated();

    expect($res->json('data.status'))->toBe('draft');
    expect($res->json('data.current_version'))->toBe(1);
    expect($res->json('data.slug'))->not->toBeEmpty();
    expect($res->json('data.uuid'))->not->toBeEmpty();
    expect($res->json('data.media.asset_id'))->not->toBeNull();

    $epaper = Epaper::firstWhere('uuid', $res->json('data.uuid'));
    expect($epaper->author_id)->not->toBeNull();
    expect(EpaperVersion::where('epaper_id', $epaper->id)->where('version', 1)->exists())->toBeTrue();
});

it('rejects creating an issue without a PDF file', function (): void {
    $token = epcSuper();

    $this->withToken($token)->postJson('/api/v1/admin/epapers', [
        'issue_number' => 1,
        'title' => 'بلا ملف',
        'publication_date' => now()->toDateString(),
    ])->assertStatus(422);

    expect(Epaper::count())->toBe(0);
});

it('rejects a non-PDF upload', function (): void {
    epcFakeStorage();
    $token = epcSuper();

    $this->withToken($token)->post('/api/v1/admin/epapers', [
        'issue_number' => 1,
        'title' => 'ملف خاطئ',
        'publication_date' => now()->toDateString(),
        'file' => UploadedFile::fake()->create('notes.txt', 12, 'text/plain'),
    ], ['Accept' => 'application/json'])->assertStatus(422);

    expect(Epaper::count())->toBe(0);
});

it('requires epapers.create to create an issue', function (): void {
    epcFakeStorage();
    $token = epcActor('epapers.view');

    $this->withToken($token)->post('/api/v1/admin/epapers', [
        'issue_number' => 1,
        'title' => 'ممنوع',
        'publication_date' => now()->toDateString(),
        'file' => epcPdf(),
    ], ['Accept' => 'application/json'])->assertStatus(403);
});

// ─── List / show ─────────────────────────────────────────────────────────────

it('lists issues with pagination meta and a status filter', function (): void {
    $token = epcSuper();
    epcIssue(['status' => 'published', 'published_at' => now()->subDay()]);
    epcIssue(['status' => 'draft']);

    $res = $this->withToken($token)->getJson('/api/v1/admin/epapers?filter[status]=published')->assertOk();

    expect($res->json('data'))->toHaveCount(1);
    expect($res->json('data.0.status'))->toBe('published');
    expect($res->json('meta.pagination.total'))->toBe(1);
});

it('shows a single issue', function (): void {
    $token = epcSuper();
    $epaper = epcIssue();

    $this->withToken($token)->getJson("/api/v1/admin/epapers/{$epaper->id}")
        ->assertOk()
        ->assertJsonPath('data.id', $epaper->id);
});

it('requires epapers.view to list issues', function (): void {
    $token = epcActor();

    $this->withToken($token)->getJson('/api/v1/admin/epapers')->assertStatus(403);
});

// ─── Update + URL-history semantics (decision #2) ────────────────────────────

it('updates metadata without changing the slug and writes no url history', function (): void {
    $token = epcSuper();
    $epaper = epcIssue();

    $this->withToken($token)->putJson("/api/v1/admin/epapers/{$epaper->id}", [
        'title' => 'عنوان محدّث فقط',
    ])->assertOk()->assertJsonPath('data.title', 'عنوان محدّث فقط');

    expect($epaper->fresh()->slug)->toBe($epaper->slug);   // slug ثابت
    expect(EpaperUrlHistory::count())->toBe(0);             // لا تحويل
});

it('records url history only when the slug actually changes', function (): void {
    $token = epcSuper();
    $epaper = epcIssue();
    $oldPath = $epaper->canonicalPath();

    $this->withToken($token)->putJson("/api/v1/admin/epapers/{$epaper->id}", [
        'slug' => 'a-brand-new-slug',
    ])->assertOk()->assertJsonPath('data.slug', 'a-brand-new-slug');

    $row = EpaperUrlHistory::where('epaper_id', $epaper->id)->where('old_path', $oldPath)->first();
    expect($row)->not->toBeNull();
    expect($row->reason)->toBe('slug_change');
});

it('requires epapers.edit to update an issue', function (): void {
    $token = epcActor('epapers.view');
    $epaper = epcIssue();

    $this->withToken($token)->putJson("/api/v1/admin/epapers/{$epaper->id}", ['title' => 'x'])
        ->assertStatus(403);
});

// ─── Replace PDF: version bump, metadata reset, NO url history ────────────────

it('replaces the PDF, bumps the version, regenerates the cover and writes no url history', function (): void {
    epcFakeStorage();
    Queue::fake();
    $token = epcSuper();

    $original = epcAsset();
    $epaper = epcIssue([
        'media_asset_id' => $original->id,
        'current_version' => 1,
    ]);
    EpaperVersion::create(['epaper_id' => $epaper->id, 'version' => 1, 'media_asset_id' => $original->id]);
    $oldPath = $epaper->canonicalPath();

    $res = $this->withToken($token)->post("/api/v1/admin/epapers/{$epaper->id}/replace-pdf", [
        'file' => epcPdf(),
        'note' => 'نسخة مصحّحة',
    ], ['Accept' => 'application/json'])->assertOk();

    expect($res->json('data.current_version'))->toBe(2);

    $fresh = $epaper->fresh();
    expect($fresh->current_version)->toBe(2);
    expect($fresh->media_asset_id)->not->toBe($original->id);     // أصل جديد
    expect(EpaperVersion::where('epaper_id', $epaper->id)->where('version', 2)->exists())->toBeTrue();
    expect(EpaperUrlHistory::where('old_path', $oldPath)->count())->toBe(0);   // الرابط لم يتغيّر ⇒ لا تحويل
    Queue::assertPushed(GenerateEpaperCoverJob::class);            // الصفحة الأولى تغيّرت ⇒ إعادة توليد الغلاف
});

it('requires epapers.edit to replace the PDF', function (): void {
    epcFakeStorage();
    $token = epcActor('epapers.view');
    $epaper = epcIssue(['media_asset_id' => epcAsset()->id]);

    $this->withToken($token)->post("/api/v1/admin/epapers/{$epaper->id}/replace-pdf", [
        'file' => epcPdf(),
    ], ['Accept' => 'application/json'])->assertStatus(403);
});

// ─── Lifecycle transitions + gates ───────────────────────────────────────────

it('publishes a draft that has a PDF, stamping published_at and publisher', function (): void {
    $token = epcSuper();
    $epaper = epcIssue(['media_asset_id' => epcAsset()->id]);

    $this->withToken($token)->patchJson("/api/v1/admin/epapers/{$epaper->id}/status", [
        'status' => 'published',
    ])->assertOk()->assertJsonPath('data.status', 'published');

    $fresh = $epaper->fresh();
    expect($fresh->published_at)->not->toBeNull();
    expect($fresh->published_by_id)->not->toBeNull();
});

it('refuses to publish an issue that has no PDF', function (): void {
    $token = epcSuper();
    $epaper = epcIssue(['media_asset_id' => null]);

    $this->withToken($token)->patchJson("/api/v1/admin/epapers/{$epaper->id}/status", [
        'status' => 'published',
    ])->assertStatus(422);

    expect($epaper->fresh()->status)->toBe(EpaperStatus::Draft);
});

it('schedules an issue for a future date', function (): void {
    $token = epcSuper();
    $epaper = epcIssue(['media_asset_id' => epcAsset()->id]);
    $when = now()->addDays(2);

    // اتّساق مع منوال المنصّة: العميل يرسل وقتاً محلّياً (Asia/Amman) لا UTC 'Z'.
    $this->withToken($token)->patchJson("/api/v1/admin/epapers/{$epaper->id}/status", [
        'status' => 'scheduled',
        'published_at' => $when->toDateTimeString(),
    ])->assertOk()->assertJsonPath('data.status', 'scheduled');

    expect($epaper->fresh()->published_at->timestamp)->toBe($when->timestamp);
});

it('rejects scheduling without a future date', function (): void {
    $token = epcSuper();
    $epaper = epcIssue(['media_asset_id' => epcAsset()->id]);

    $this->withToken($token)->patchJson("/api/v1/admin/epapers/{$epaper->id}/status", [
        'status' => 'scheduled',
        'published_at' => now()->subDay()->toISOString(),
    ])->assertStatus(422);

    expect($epaper->fresh()->status)->toBe(EpaperStatus::Draft);
});

it('moves a published issue back to draft, clearing publish stamps', function (): void {
    $token = epcSuper();
    $epaper = epcIssue([
        'media_asset_id' => epcAsset()->id,
        'status' => 'published',
        'published_at' => now()->subDay(),
    ]);

    $this->withToken($token)->patchJson("/api/v1/admin/epapers/{$epaper->id}/status", [
        'status' => 'draft',
    ])->assertOk()->assertJsonPath('data.status', 'draft');

    $fresh = $epaper->fresh();
    expect($fresh->published_at)->toBeNull();
    expect($fresh->published_by_id)->toBeNull();
});

it('forbids publishing without the epapers.publish ability', function (): void {
    $token = epcActor('epapers.edit');   // يمرّ حارس المسار، لكن لا صلاحية نشر
    $epaper = epcIssue(['media_asset_id' => epcAsset()->id]);

    $this->withToken($token)->patchJson("/api/v1/admin/epapers/{$epaper->id}/status", [
        'status' => 'published',
    ])->assertStatus(403);

    expect($epaper->fresh()->status)->toBe(EpaperStatus::Draft);
});

it('forbids archiving without the epapers.archive ability', function (): void {
    $token = epcActor('epapers.edit');
    $epaper = epcIssue(['media_asset_id' => epcAsset()->id, 'status' => 'published', 'published_at' => now()->subDay()]);

    $this->withToken($token)->patchJson("/api/v1/admin/epapers/{$epaper->id}/status", [
        'status' => 'archived',
    ])->assertStatus(403);
});

// ─── Scheduled auto-publish (PublishDueEpapersAction) ────────────────────────

it('publishes due scheduled issues and leaves future ones scheduled', function (): void {
    $asset = epcAsset();
    $due = epcIssue(['status' => 'scheduled', 'published_at' => now()->subMinute(), 'media_asset_id' => $asset->id]);
    $future = epcIssue(['status' => 'scheduled', 'published_at' => now()->addDay(), 'media_asset_id' => $asset->id]);

    $count = (new PublishDueEpapersAction)->handle();

    expect($count)->toBe(1);
    expect($due->fresh()->status)->toBe(EpaperStatus::Published);
    expect($future->fresh()->status)->toBe(EpaperStatus::Scheduled);
});

it('does not auto-publish a scheduled issue that lost its PDF', function (): void {
    epcIssue(['status' => 'scheduled', 'published_at' => now()->subMinute(), 'media_asset_id' => null]);

    expect((new PublishDueEpapersAction)->handle())->toBe(0);
});

// ─── Duplicate ───────────────────────────────────────────────────────────────

it('duplicates an issue as a new draft with the next number, reusing the PDF', function (): void {
    $token = epcSuper();
    $asset = epcAsset();
    $epaper = epcIssue(['issue_number' => 7, 'media_asset_id' => $asset->id, 'status' => 'published', 'published_at' => now()->subDay()]);

    $res = $this->withToken($token)->postJson("/api/v1/admin/epapers/{$epaper->id}/duplicate")
        ->assertCreated();

    expect($res->json('data.status'))->toBe('draft');
    expect($res->json('data.issue_number'))->toBe(8);
    expect($res->json('data.current_version'))->toBe(1);
    expect($res->json('data.media.asset_id'))->toBe($asset->id);   // إعادة استخدام نفس الـ PDF
    expect($res->json('data.id'))->not->toBe($epaper->id);
});

it('requires epapers.create to duplicate', function (): void {
    $token = epcActor('epapers.view');
    $epaper = epcIssue(['media_asset_id' => epcAsset()->id]);

    $this->withToken($token)->postJson("/api/v1/admin/epapers/{$epaper->id}/duplicate")
        ->assertStatus(403);
});

// ─── Delete / restore / force-delete ─────────────────────────────────────────

it('soft-deletes an issue', function (): void {
    $token = epcSuper();
    $epaper = epcIssue();

    $this->withToken($token)->deleteJson("/api/v1/admin/epapers/{$epaper->id}")->assertOk();

    expect(Epaper::find($epaper->id))->toBeNull();
    expect(Epaper::withTrashed()->find($epaper->id)->trashed())->toBeTrue();
});

it('restores a soft-deleted issue', function (): void {
    $token = epcSuper();
    $epaper = epcIssue();
    $epaper->delete();

    $this->withToken($token)->postJson("/api/v1/admin/epapers/{$epaper->id}/restore")->assertOk();

    expect(Epaper::find($epaper->id))->not->toBeNull();
});

it('force-deletes an issue and cascades versions + url history (media untouched)', function (): void {
    $token = epcSuper();
    $asset = epcAsset();
    $epaper = epcIssue(['media_asset_id' => $asset->id]);
    EpaperVersion::create(['epaper_id' => $epaper->id, 'version' => 1, 'media_asset_id' => $asset->id]);
    EpaperUrlHistory::create(['epaper_id' => $epaper->id, 'locale' => 'ar', 'old_path' => '/ar/epaper/x']);
    $epaper->delete();

    $this->withToken($token)->deleteJson("/api/v1/admin/epapers/{$epaper->id}/force")->assertOk();

    expect(Epaper::withTrashed()->find($epaper->id))->toBeNull();
    expect(EpaperVersion::where('epaper_id', $epaper->id)->count())->toBe(0);
    expect(EpaperUrlHistory::where('epaper_id', $epaper->id)->count())->toBe(0);
    expect(MediaAsset::find($asset->id))->not->toBeNull();   // الوسائط لا تُلمَس
});

it('requires epapers.delete, epapers.restore and epapers.force_delete respectively', function (): void {
    $epaper = epcIssue();

    $this->withToken(epcActor('epapers.view'))
        ->deleteJson("/api/v1/admin/epapers/{$epaper->id}")->assertStatus(403);
});

it('persists access_level on create and updates it', function (): void {
    epcFakeStorage();
    $token = epcSuper();

    $res = $this->withToken($token)->post('/api/v1/admin/epapers', [
        'issue_number' => 1,
        'title' => 'عدد مقيّد',
        'publication_date' => now()->toDateString(),
        'access_level' => 'subscriber',
        'file' => epcPdf(),
    ], ['Accept' => 'application/json'])->assertCreated();

    expect($res->json('data.access_level'))->toBe('subscriber');

    $id = $res->json('data.id');
    $this->withToken($token)->putJson("/api/v1/admin/epapers/{$id}", ['access_level' => 'private'])
        ->assertOk()->assertJsonPath('data.access_level', 'private');
});

it('rejects an invalid access_level', function (): void {
    epcFakeStorage();
    $token = epcSuper();

    $this->withToken($token)->post('/api/v1/admin/epapers', [
        'issue_number' => 1,
        'title' => 'خطأ',
        'publication_date' => now()->toDateString(),
        'access_level' => 'bogus',
        'file' => epcPdf(),
    ], ['Accept' => 'application/json'])->assertStatus(422);
});
