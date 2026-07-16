<?php

declare(strict_types=1);

use App\Models\Article;
use App\Models\Category;
use App\Models\User;
use App\Settings\GeneralSettings;
use App\Support\Content\PublicSeoBuilder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function createCategory(string $locale): Category
{
    return Category::create([
        'name' => 'Category '.uniqid(),
        'slug' => 'cat-'.uniqid(),
        'locale' => $locale,
        'scope' => 'both',
        'status' => 'active',
    ]);
}

beforeEach(function (): void {
    seedRoles();
});

function getAdminToken(): string
{
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    return $admin->createToken('admin-token', ['admin'])->plainTextToken;
}

it('verifies GeneralSettings model supports multilingual properties', function (): void {
    $settings = app(GeneralSettings::class);

    expect(property_exists($settings, 'site_name_ar'))->toBeTrue();
    expect(property_exists($settings, 'site_name_en'))->toBeTrue();
    expect(property_exists($settings, 'site_description_ar'))->toBeTrue();
    expect(property_exists($settings, 'site_description_en'))->toBeTrue();
});

it('tests fallback and localized resolver logic in GeneralSettings', function (): void {
    $settings = app(GeneralSettings::class);

    // Set mock values
    $settings->site_name_ar = 'القلعة';
    $settings->site_name_en = 'Al Qalah';
    $settings->site_description_ar = 'وصف عربي';
    $settings->site_description_en = 'English Description';
    $settings->save();

    // 1. Correct localization
    expect($settings->getLocalizedName('ar'))->toBe('القلعة');
    expect($settings->getLocalizedName('en'))->toBe('Al Qalah');
    expect($settings->getLocalizedDescription('ar'))->toBe('وصف عربي');
    expect($settings->getLocalizedDescription('en'))->toBe('English Description');

    // 2. English empty fallback to Arabic
    $settings->site_name_en = '';
    $settings->site_description_en = '';
    $settings->save();

    expect($settings->getLocalizedName('en'))->toBe('القلعة');
    expect($settings->getLocalizedDescription('en'))->toBe('وصف عربي');

    // 3. Arabic empty fallback to config(app.name)
    $settings->site_name_ar = '';
    $settings->site_name_en = '';
    $settings->site_name = '';
    $settings->site_description_ar = '';
    $settings->site_description_en = '';
    $settings->site_description = '';
    $settings->save();

    expect($settings->getLocalizedName('ar'))->toBe(config('app.name', 'AlphaCMS'));
    expect($settings->getLocalizedDescription('ar'))->toBe(config('app.name', 'AlphaCMS'));
});

it('updates and reads multilingual fields via Admin API', function (): void {
    $token = getAdminToken();

    // Write settings
    $this->withToken($token)->putJson('/api/v1/admin/settings/general', [
        'site_name_ar' => 'القلعة نيوز الجديدة',
        'site_name_en' => 'Al Qalah New News',
        'site_description_ar' => 'وصف متميز للموقع',
        'site_description_en' => 'Premium site description',
    ])->assertOk();

    // Read settings
    $response = $this->withToken($token)->getJson('/api/v1/admin/settings/general');
    $response->assertOk();
    $response->assertJsonPath('data.site.site_name_ar', 'القلعة نيوز الجديدة');
    $response->assertJsonPath('data.site.site_name_en', 'Al Qalah New News');
    $response->assertJsonPath('data.site.site_description_ar', 'وصف متميز للموقع');
    $response->assertJsonPath('data.site.site_description_en', 'Premium site description');
});

it('returns correct localized values from public site settings API', function (): void {
    $settings = app(GeneralSettings::class);
    $settings->site_name_ar = 'القلعة نيوز';
    $settings->site_name_en = 'Qalah News';
    $settings->site_description_ar = 'البوابة الإخبارية الأولى';
    $settings->site_description_en = 'The premier news gateway';
    $settings->save();

    // Locale = ar
    $this->getJson('/api/v1/site?locale=ar')
        ->assertOk()
        ->assertJsonPath('data.site_name', 'القلعة نيوز')
        ->assertJsonPath('data.description', 'البوابة الإخبارية الأولى');

    // Locale = en
    $this->getJson('/api/v1/site?locale=en')
        ->assertOk()
        ->assertJsonPath('data.site_name', 'Qalah News')
        ->assertJsonPath('data.description', 'The premier news gateway');
});

it('verifies SEO metadata updates based on article locale', function (): void {
    $settings = app(GeneralSettings::class);
    $settings->site_name_ar = 'القلعة';
    $settings->site_name_en = 'Qalah';
    $settings->save();

    // Create Arabic article
    $arArticle = Article::create([
        'title' => 'خبر عاجل',
        'slug' => 'ar-slug-'.uniqid(),
        'locale' => 'ar',
        'type' => 'news',
        'status' => 'published',
        'primary_category_id' => createCategory('ar')->id,
    ]);
    $arSeo = PublicSeoBuilder::build($arArticle);

    // Breadcrumbs list item 1 name should be Qalah (for English) or القلعة (for Arabic)
    expect($arSeo->breadcrumbs['itemListElement'][0]['name'])->toBe('القلعة');

    // Create English article
    $enArticle = Article::create([
        'title' => 'Breaking News',
        'slug' => 'en-slug-'.uniqid(),
        'locale' => 'en',
        'type' => 'news',
        'status' => 'published',
        'primary_category_id' => createCategory('en')->id,
    ]);
    $enSeo = PublicSeoBuilder::build($enArticle);

    expect($enSeo->breadcrumbs['itemListElement'][0]['name'])->toBe('Qalah');
});

it('verifies GeneralSettings model supports multilingual footer properties', function (): void {
    $settings = app(GeneralSettings::class);

    expect(property_exists($settings, 'copyright_text_ar'))->toBeTrue();
    expect(property_exists($settings, 'copyright_text_en'))->toBeTrue();
    expect(property_exists($settings, 'cookie_policy_text_ar'))->toBeTrue();
    expect(property_exists($settings, 'cookie_policy_text_en'))->toBeTrue();
});

it('tests localized resolver + fallback for copyright and cookie policy', function (): void {
    $settings = app(GeneralSettings::class);

    $settings->copyright_text_ar = 'حقوق عربية';
    $settings->copyright_text_en = 'English rights';
    $settings->cookie_policy_text_ar = 'سياسة عربية';
    $settings->cookie_policy_text_en = 'English policy';
    $settings->save();

    // 1. Correct localization
    expect($settings->getLocalizedCopyright('ar'))->toBe('حقوق عربية');
    expect($settings->getLocalizedCopyright('en'))->toBe('English rights');
    expect($settings->getLocalizedCookiePolicy('ar'))->toBe('سياسة عربية');
    expect($settings->getLocalizedCookiePolicy('en'))->toBe('English policy');

    // 2. English empty → fallback to Arabic
    $settings->copyright_text_en = '';
    $settings->cookie_policy_text_en = '';
    $settings->save();

    expect($settings->getLocalizedCopyright('en'))->toBe('حقوق عربية');
    expect($settings->getLocalizedCookiePolicy('en'))->toBe('سياسة عربية');

    // 3. Arabic empty → fallback to the legacy single field
    $settings->copyright_text_ar = '';
    $settings->copyright_text = 'Legacy Copyright';
    $settings->cookie_policy_text_ar = '';
    $settings->cookie_policy_text = 'Legacy Cookie';
    $settings->save();

    expect($settings->getLocalizedCopyright('ar'))->toBe('Legacy Copyright');
    expect($settings->getLocalizedCookiePolicy('ar'))->toBe('Legacy Cookie');
});

it('updates and reads multilingual footer fields via Admin API', function (): void {
    $token = getAdminToken();

    $this->withToken($token)->putJson('/api/v1/admin/settings/general', [
        'copyright_text_ar' => 'حقوق النشر محفوظة',
        'copyright_text_en' => 'All rights reserved',
        'cookie_policy_text_ar' => 'نستخدم الكوكيز',
        'cookie_policy_text_en' => 'We use cookies',
    ])->assertOk();

    $response = $this->withToken($token)->getJson('/api/v1/admin/settings/general');
    $response->assertOk();
    $response->assertJsonPath('data.site.copyright_text_ar', 'حقوق النشر محفوظة');
    $response->assertJsonPath('data.site.copyright_text_en', 'All rights reserved');
    $response->assertJsonPath('data.site.cookie_policy_text_ar', 'نستخدم الكوكيز');
    $response->assertJsonPath('data.site.cookie_policy_text_en', 'We use cookies');
    // Arabic mirrors to the legacy single field (backward compatibility)
    $response->assertJsonPath('data.site.copyright_text', 'حقوق النشر محفوظة');
    $response->assertJsonPath('data.site.cookie_policy_text', 'نستخدم الكوكيز');
});

it('returns correct localized footer values from public site settings API', function (): void {
    $settings = app(GeneralSettings::class);
    $settings->copyright_text_ar = 'جميع الحقوق محفوظة';
    $settings->copyright_text_en = 'All rights reserved';
    $settings->cookie_policy_text_ar = 'سياسة الكوكيز';
    $settings->cookie_policy_text_en = 'Cookie policy';
    $settings->save();

    // Locale = ar
    $this->getJson('/api/v1/site?locale=ar')
        ->assertOk()
        ->assertJsonPath('data.copyright', 'جميع الحقوق محفوظة')
        ->assertJsonPath('data.cookie_policy', 'سياسة الكوكيز');

    // Locale = en
    $this->getJson('/api/v1/site?locale=en')
        ->assertOk()
        ->assertJsonPath('data.copyright', 'All rights reserved')
        ->assertJsonPath('data.cookie_policy', 'Cookie policy');
});

it('serves the english logo on the english locale with fallback to arabic', function (): void {
    $settings = app(GeneralSettings::class);
    $settings->logo_light = 'branding/logos/ar-light.png';
    $settings->logo_dark = 'branding/logos/ar-dark.png';
    $settings->logo_light_en = 'branding/logos/en-light.png';
    $settings->logo_dark_en = 'branding/logos/en-dark.png';
    $settings->save();

    // Arabic locale → Arabic logo
    $ar = $this->getJson('/api/v1/site?locale=ar')->assertOk()->json('data');
    expect($ar['logo_light'])->toContain('ar-light.png');
    expect($ar['logo_dark'])->toContain('ar-dark.png');

    // English locale → English logo
    $en = $this->getJson('/api/v1/site?locale=en')->assertOk()->json('data');
    expect($en['logo_light'])->toContain('en-light.png');
    expect($en['logo_dark'])->toContain('en-dark.png');

    // English missing → falls back to the Arabic logo
    $settings->logo_light_en = null;
    $settings->save();
    $en2 = $this->getJson('/api/v1/site?locale=en')->assertOk()->json('data');
    expect($en2['logo_light'])->toContain('ar-light.png');
});
