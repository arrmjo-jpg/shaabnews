<?php

declare(strict_types=1);

use App\Models\User;
use App\Support\Content\Workflow\EditorialWorkflowGuard;
use App\Support\Content\Workflow\WorkflowDefinition;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Spatie\Permission\Models\Permission;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
});

/**
 * تعريف اختباريّ عامّ — لا يمثّل أيّ نوع محتوى حقيقيّ، فقط شكل القواعد.
 */
function ewgDefinition(array $abilityForTarget = []): WorkflowDefinition
{
    return new WorkflowDefinition(
        transitions: [
            'draft' => ['submitted', 'published', 'archived'],
            'submitted' => ['published', 'rejected'],
            'published' => ['archived'],
            'rejected' => ['draft', 'submitted'],
            'archived' => ['draft'],
        ],
        writerAllowed: [
            'draft' => ['submitted'],
            'rejected' => ['submitted'],
        ],
        abilityForTarget: $abilityForTarget,
        messages: [
            'invalid_transition' => 'article.invalid_transition',
            'writer_cannot_edit_others' => 'article.writer_cannot_edit_others',
            'writer_transition_forbidden' => 'article.writer_transition_forbidden',
            'forbidden_transition' => 'video.forbidden_transition',
            'schedule_requires_date' => 'article.schedule_requires_future_date',
        ],
    );
}

it('rejects a no-op transition to the same status', function (): void {
    $actor = User::factory()->create();

    $res = EditorialWorkflowGuard::check(true, true, 'draft', 'draft', null, ewgDefinition(), $actor);

    expect($res?->getStatusCode())->toBe(422);
});

it('rejects a transition not present in the transition table', function (): void {
    $actor = User::factory()->create();

    $res = EditorialWorkflowGuard::check(true, true, 'published', 'submitted', null, ewgDefinition(), $actor);

    expect($res?->getStatusCode())->toBe(422);
});

it('rejects a non-owner non-editorial actor', function (): void {
    $actor = User::factory()->create();

    $res = EditorialWorkflowGuard::check(false, false, 'draft', 'submitted', null, ewgDefinition(), $actor);

    expect($res?->getStatusCode())->toBe(403);
});

it('rejects a writer attempting a transition outside writerAllowed', function (): void {
    $actor = User::factory()->create();

    $res = EditorialWorkflowGuard::check(false, true, 'draft', 'published', null, ewgDefinition(), $actor);

    expect($res?->getStatusCode())->toBe(403);
});

it('allows a writer submitting their own draft', function (): void {
    $actor = User::factory()->create();

    $res = EditorialWorkflowGuard::check(false, true, 'draft', 'submitted', null, ewgDefinition(), $actor);

    expect($res)->toBeNull();
});

it('allows any editorial transition when abilityForTarget is empty (Article shape)', function (): void {
    $actor = User::factory()->create();

    $res = EditorialWorkflowGuard::check(true, false, 'draft', 'published', null, ewgDefinition(abilityForTarget: []), $actor);

    expect($res)->toBeNull();
});

it('rejects an editorial actor lacking the required ability (Video/Reel shape)', function (): void {
    Permission::create(['name' => 'test.publish', 'guard_name' => 'web']);
    $actor = User::factory()->create();

    $res = EditorialWorkflowGuard::check(
        true, false, 'draft', 'published', null,
        ewgDefinition(['published' => 'test.publish']), $actor
    );

    expect($res?->getStatusCode())->toBe(403);
});

it('allows an editorial actor holding the required ability', function (): void {
    Permission::create(['name' => 'test.publish', 'guard_name' => 'web']);
    $actor = User::factory()->create();
    $actor->givePermissionTo('test.publish');

    $res = EditorialWorkflowGuard::check(
        true, false, 'draft', 'published', null,
        ewgDefinition(['published' => 'test.publish']), $actor
    );

    expect($res)->toBeNull();
});

it('rejects scheduling without a date', function (): void {
    $actor = User::factory()->create();
    $def = new WorkflowDefinition(
        transitions: ['draft' => ['scheduled']],
        writerAllowed: [],
        abilityForTarget: [],
        messages: ['invalid_transition' => 'article.invalid_transition', 'schedule_requires_date' => 'article.schedule_requires_future_date'],
    );

    $res = EditorialWorkflowGuard::check(true, false, 'draft', 'scheduled', null, $def, $actor);

    expect($res?->getStatusCode())->toBe(422);
});

it('rejects scheduling with a past date', function (): void {
    $actor = User::factory()->create();
    $def = new WorkflowDefinition(
        transitions: ['draft' => ['scheduled']],
        writerAllowed: [],
        abilityForTarget: [],
        messages: ['invalid_transition' => 'article.invalid_transition', 'schedule_requires_date' => 'article.schedule_requires_future_date'],
    );

    $res = EditorialWorkflowGuard::check(true, false, 'draft', 'scheduled', Carbon::yesterday(), $def, $actor);

    expect($res?->getStatusCode())->toBe(422);
});

it('allows scheduling with a future date', function (): void {
    $actor = User::factory()->create();
    $def = new WorkflowDefinition(
        transitions: ['draft' => ['scheduled']],
        writerAllowed: [],
        abilityForTarget: [],
        messages: ['invalid_transition' => 'article.invalid_transition', 'schedule_requires_date' => 'article.schedule_requires_future_date'],
    );

    $res = EditorialWorkflowGuard::check(true, false, 'draft', 'scheduled', Carbon::tomorrow(), $def, $actor);

    expect($res)->toBeNull();
});
