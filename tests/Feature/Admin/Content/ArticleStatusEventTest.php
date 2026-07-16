<?php

declare(strict_types=1);

use App\Actions\Admin\Content\TransitionArticleStatusAction;
use App\Enums\ArticleStatus;
use App\Events\Content\ArticleStatusChanged;
use App\Models\Article;
use App\Models\Category;
use App\Models\User;
use App\Modules\CDN\Jobs\ProcessCdnPurgeBatch;
use App\Settings\CdnSettings;
use App\Support\Cache\ArticleCacheTags;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
    Cache::flush();
});

function aseEditor(): User
{
    $u = User::factory()->create();
    $u->assignRole('super_admin');

    return $u;
}

function aseArticle(array $attrs = []): Article
{
    $cat = Category::create([
        'name' => 'c-'.uniqid(), 'slug' => 'cat-'.uniqid(), 'locale' => 'ar', 'status' => 'active',
    ]);

    return Article::create(array_merge([
        'title' => 't-'.uniqid(),
        'slug' => 'slug-'.uniqid(),
        'locale' => 'ar',
        'type' => 'news',
        'status' => 'draft',
        'primary_category_id' => $cat->id,
        'author_id' => User::factory()->create()->id,
        'content_json' => tiptapDoc(),
        'content' => '<p>x</p>',
    ], $attrs))->fresh();
}

// ─── Event correctness (ADR-E2) ──────────────────────────────────────────

it('dispatches ArticleStatusChanged exactly once with the correct payload', function (): void {
    Event::fake([ArticleStatusChanged::class]);
    $editor = aseEditor();
    $article = aseArticle();

    (new TransitionArticleStatusAction)->handle($article, ['status' => 'published'], $editor);

    Event::assertDispatchedTimes(ArticleStatusChanged::class, 1);
    Event::assertDispatched(function (ArticleStatusChanged $event) use ($article, $editor): bool {
        return $event->article->id === $article->id
            && $event->from === ArticleStatus::Draft
            && $event->to === ArticleStatus::Published
            && $event->actor->id === $editor->id;
    });
});

it('does not dispatch ArticleStatusChanged when the workflow guard denies the transition', function (): void {
    Event::fake([ArticleStatusChanged::class]);
    $writer = User::factory()->create(['is_writer' => true]);
    $writer->assignRole('contributor');
    $article = aseArticle(['author_id' => $writer->id, 'status' => 'draft']);

    // كاتب لا يستطيع النشر مباشرة (draft→published ليس ضمن WRITER_ALLOWED) — الحارس
    // يرفض *قبل* بدء الـ transaction، فلا حدث إطلاقاً. نفس الضمانة البنيوية التي كانت
    // موجودة للنداءات الأمريّة القديمة (لا كود بعد transaction ينفَّذ دون commit ناجح).
    $response = (new TransitionArticleStatusAction)->handle($article, ['status' => 'published'], $writer);

    expect($response->getStatusCode())->toBe(403);
    Event::assertNotDispatched(ArticleStatusChanged::class);
});

// ─── Behavior parity — real listeners, no Event::fake (ADR-E2: wrap not replace) ──

it('still flushes the article feed cache tag via the real listener chain', function (): void {
    $editor = aseEditor();
    $article = aseArticle();
    $feedKey = 'test:feed:'.uniqid();
    Cache::tags([ArticleCacheTags::feed($article->locale)])->put($feedKey, 'warm', 60);
    expect(Cache::tags([ArticleCacheTags::feed($article->locale)])->has($feedKey))->toBeTrue();

    (new TransitionArticleStatusAction)->handle($article, ['status' => 'published'], $editor);

    expect(Cache::tags([ArticleCacheTags::feed($article->locale)])->has($feedKey))->toBeFalse();
});

it('still pushes a CDN purge batch via the real listener chain', function (): void {
    $s = app(CdnSettings::class);
    $s->cdn_enabled = true;
    $s->cdn_auto_purge = true;
    $s->cdn_plan = 'free';
    $s->cdn_api_token = 'test-token';
    $s->cdn_zone_id = 'test-zone';
    $s->save();
    Queue::fake();
    $editor = aseEditor();
    $article = aseArticle();

    (new TransitionArticleStatusAction)->handle($article, ['status' => 'published'], $editor);

    Queue::assertPushed(ProcessCdnPurgeBatch::class);
});

it('still notifies the writer via the real listener chain', function (): void {
    $writer = User::factory()->create(['is_writer' => true]);
    $article = aseArticle(['author_id' => $writer->id, 'status' => 'submitted']);
    $editor = aseEditor();

    (new TransitionArticleStatusAction)->handle($article, ['status' => 'published'], $editor);

    expect($writer->notifications()->count())->toBe(1);
    expect($writer->notifications()->first()->data['status'])->toBe('published');
});
