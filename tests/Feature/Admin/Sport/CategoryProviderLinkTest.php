<?php

declare(strict_types=1);

use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
});

function categoryProviderAdminToken(): array
{
    $u = User::factory()->create();
    $u->assignRole('super_admin');

    return [$u, $u->createToken('admin-token', ['admin'])->plainTextToken];
}

it('stores provider/external_id when creating a category', function (): void {
    [, $token] = categoryProviderAdminToken();

    $res = $this->withToken($token)->postJson('/api/v1/admin/categories', [
        'name' => 'كرة القدم',
        'locale' => 'ar',
        'provider' => '365scores',
        'external_id' => '1',
    ])->assertCreated();

    assertSuccessContract($res);
    expect($res->json('data.provider'))->toBe('365scores');
    expect($res->json('data.external_id'))->toBe('1');
    $this->assertDatabaseHas('categories', ['name' => 'كرة القدم', 'provider' => '365scores', 'external_id' => '1']);
});

it('updates provider/external_id on an existing category', function (): void {
    [, $token] = categoryProviderAdminToken();
    $category = Category::create(['name' => 'الرياضة', 'locale' => 'ar', 'status' => 'active']);

    $this->withToken($token)
        ->putJson("/api/v1/admin/categories/{$category->id}", ['provider' => '365scores', 'external_id' => '1'])
        ->assertOk();

    $category->refresh();
    expect($category->provider)->toBe('365scores');
    expect($category->external_id)->toBe('1');
});

it('exposes provider/external_id (but not provider_metadata) on the public categories endpoint', function (): void {
    Category::create([
        'name' => 'كرة القدم', 'locale' => 'ar', 'status' => 'active',
        'provider' => '365scores', 'external_id' => '1', 'provider_metadata' => ['note' => 'internal'],
    ]);

    $res = $this->getJson('/api/v1/ar/categories')->assertOk();
    $first = collect($res->json('data'))->firstWhere('name', 'كرة القدم');

    expect($first['provider'])->toBe('365scores');
    expect($first['external_id'])->toBe('1');
    expect($first)->not->toHaveKey('provider_metadata');
});
