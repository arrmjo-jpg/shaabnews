<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\MediaVisibility;
use App\Models\Article;
use App\Models\Category;
use App\Models\MediaAsset;
use App\Models\User;
use App\Settings\GeneralSettings;
use App\Support\Content\PublicSeoBuilder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Str;
use Tests\TestCase;

class PublicArticleSeoTest extends TestCase
{
    use RefreshDatabase;

    private GeneralSettings $settings;

    protected function setUp(): void
    {
        parent::setUp();

        $this->settings = app(GeneralSettings::class);
        $this->settings->site_name = 'القلعة نيوز';
        $this->settings->logo_light = 'branding/logos/logo.png';
        $this->settings->save();

        Config::set('frontend.public_url', 'http://localhost:3000');
        Config::set('seo.publisher.name', 'القلعة نيوز');
        Config::set('seo.publisher.logo', '');
    }

    /**
     * Helper to create a media asset.
     */
    private function createMediaAsset(array $attributes = []): MediaAsset
    {
        return MediaAsset::create(array_merge([
            'uuid' => (string) Str::uuid(),
            'kind' => 'image',
            'disk' => 'uploads',
            'path' => 'assets/image.jpg',
            'filename' => 'image.jpg',
            'original_name' => 'image.jpg',
            'mime_type' => 'image/jpeg',
            'extension' => 'jpg',
            'size' => 1024,
            'checksum' => md5(uniqid()),
            'visibility' => MediaVisibility::Public,
            'width' => 1200,
            'height' => 630,
        ], $attributes));
    }

    /**
     * Helper to create a published article.
     */
    private function createPublishedArticle(array $attributes = []): Article
    {
        $author = User::factory()->create();
        $category = Category::create([
            'name' => 'برلمانيات',
            'slug' => 'parliament',
            'locale' => 'ar',
            'status' => 'active',
            'scope' => 'news',
        ]);

        return Article::create(array_merge([
            'author_id' => $author->id,
            'primary_category_id' => $category->id,
            'type' => 'news',
            'status' => 'published',
            'locale' => 'ar',
            'title' => 'سؤال نيابي عن زيادة الرواتب',
            'slug' => 'parliament-slug-'.uniqid(),
            'excerpt' => 'موجز تفصيلي عن السؤال النيابي الموجه للحكومة.',
            'content' => 'محتوى المقال التفصيلي هنا.',
            'published_at' => now()->subDay(),
            'seo_keywords' => 'رواتب، نواب، برلمان',
        ], $attributes));
    }

    public function test_article_with_custom_og_image(): void
    {
        $article = $this->createPublishedArticle();

        $media = $this->createMediaAsset([
            'path' => 'assets/custom-og.jpg',
            'width' => 1200,
            'height' => 630,
            'mime_type' => 'image/jpeg',
        ]);
        $article->og_image_id = $media->id;
        $article->save();

        $seo = PublicSeoBuilder::build($article)->toArray();

        $expectedUrl = 'http://localhost:8000/uploads/assets/custom-og.jpg';

        $this->assertEquals($expectedUrl, $seo['image']);
        $this->assertEquals($expectedUrl, $seo['og']['image']);
        $this->assertEquals(1200, $seo['og']['image_width']);
        $this->assertEquals(630, $seo['og']['image_height']);
        $this->assertEquals('image/jpeg', $seo['og']['image_type']);
        $this->assertEquals($expectedUrl, $seo['twitter']['image']);
        $this->assertEquals($expectedUrl, $seo['structured_data']['image']['url']);
    }

    public function test_article_with_cover_only(): void
    {
        $article = $this->createPublishedArticle();

        $media = $this->createMediaAsset([
            'path' => 'assets/cover.png',
            'width' => 800,
            'height' => 450,
            'mime_type' => 'image/png',
        ]);

        $article->mediaAssets()->attach($media->id, [
            'collection' => 'cover',
            'position' => 1,
        ]);

        $seo = PublicSeoBuilder::build($article)->toArray();

        $expectedUrl = 'http://localhost:8000/uploads/assets/cover.png';

        $this->assertEquals($expectedUrl, $seo['image']);
        $this->assertEquals($expectedUrl, $seo['og']['image']);
        $this->assertEquals(800, $seo['og']['image_width']);
        $this->assertEquals(450, $seo['og']['image_height']);
        $this->assertEquals('image/png', $seo['og']['image_type']);
        $this->assertEquals($expectedUrl, $seo['twitter']['image']);
        $this->assertEquals($expectedUrl, $seo['structured_data']['image']['url']);
    }

    public function test_article_using_fallback_image(): void
    {
        Config::set('seo.image.fallback', 'branding/social-fallback.jpg');

        $article = $this->createPublishedArticle();
        $seo = PublicSeoBuilder::build($article)->toArray();

        $expectedUrl = 'http://localhost:8000/storage/branding/social-fallback.jpg';

        $this->assertEquals($expectedUrl, $seo['image']);
        $this->assertEquals($expectedUrl, $seo['og']['image']);
        $this->assertEquals('image/jpeg', $seo['og']['image_type']);
        $this->assertEquals($expectedUrl, $seo['twitter']['image']);
        $this->assertEquals($expectedUrl, $seo['structured_data']['image']['url']);
    }

    public function test_article_without_any_image(): void
    {
        Config::set('seo.image.fallback', null);

        $article = $this->createPublishedArticle();
        $seo = PublicSeoBuilder::build($article)->toArray();

        $this->assertNull($seo['image']);
        $this->assertArrayNotHasKey('image', $seo['og']);
        $this->assertArrayNotHasKey('image', $seo['twitter']);
        $this->assertArrayNotHasKey('image', $seo['structured_data']);
    }

    public function test_publisher_logo_fallback(): void
    {
        $article = $this->createPublishedArticle();
        $seo = PublicSeoBuilder::build($article)->toArray();

        $expectedLogoUrl = 'http://localhost:8000/storage/branding/logos/logo.png';

        $this->assertEquals($expectedLogoUrl, $seo['structured_data']['publisher']['logo']['url']);
    }

    public function test_canonical_url_and_og_url_consistency(): void
    {
        $article = $this->createPublishedArticle();
        $seo = PublicSeoBuilder::build($article)->toArray();

        $expectedCanonical = 'http://localhost:3000/ar/articles/'.$article->id.'-'.$article->slug;

        $this->assertEquals($expectedCanonical, $seo['canonical_url']);
        $this->assertEquals($expectedCanonical, $seo['og']['url']);
        $this->assertEquals($expectedCanonical, $seo['structured_data']['mainEntityOfPage']['@id']);
    }

    public function test_twitter_metadata(): void
    {
        Config::set('seo.twitter.@username', 'alqalahnews');

        $article = $this->createPublishedArticle();
        $seo = PublicSeoBuilder::build($article)->toArray();

        $this->assertEquals('summary', $seo['twitter']['card']);
        $this->assertEquals('@alqalahnews', $seo['twitter']['site']);
        $this->assertEquals('@alqalahnews', $seo['twitter']['creator']);
        $this->assertEquals('سؤال نيابي عن زيادة الرواتب', $seo['twitter']['title']);
        $this->assertEquals('موجز تفصيلي عن السؤال النيابي الموجه للحكومة.', $seo['twitter']['description']);
    }

    public function test_site_name_consistency(): void
    {
        $article = $this->createPublishedArticle();
        $seo = PublicSeoBuilder::build($article)->toArray();

        $expectedSiteName = 'القلعة نيوز';

        $this->assertEquals($expectedSiteName, $seo['og']['site_name']);
        $this->assertEquals($expectedSiteName, $seo['structured_data']['publisher']['name']);
        $this->assertEquals($expectedSiteName, $seo['breadcrumbs']['itemListElement'][0]['name']);
    }

    public function test_https_secure_url_generation(): void
    {
        $article = $this->createPublishedArticle();

        $media = $this->createMediaAsset([
            'path' => 'assets/secure.jpg',
            'width' => 1200,
            'height' => 630,
            'mime_type' => 'image/jpeg',
        ]);
        $article->og_image_id = $media->id;
        $article->save();

        // Temporarily swap config to mock S3/R2 remote CDN HTTPS delivery
        Config::set('filesystems.disks.uploads.url', 'https://cdn.alqalahnews.net/uploads');

        $seo = PublicSeoBuilder::build($article)->toArray();

        $expectedUrl = 'https://cdn.alqalahnews.net/uploads/assets/secure.jpg';

        $this->assertEquals($expectedUrl, $seo['og']['image']);
        $this->assertEquals($expectedUrl, $seo['og']['image_secure_url']);
    }
}
