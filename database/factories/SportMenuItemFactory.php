<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\SportMenuItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SportMenuItem>
 */
class SportMenuItemFactory extends Factory
{
    protected $model = SportMenuItem::class;

    public function definition(): array
    {
        return [
            'parent_id' => null,
            'locale' => 'ar',
            'title' => fake()->unique()->words(2, true),
            'type' => 'section',
            'category_id' => null,
            'section_key' => fake()->randomElement(['matches', 'results', 'competitions', 'teams', 'players', 'predictions']),
            'icon' => null,
            'order' => 0,
            'enabled' => true,
        ];
    }

    /** عنصر تحريريّ يشير إلى تصنيف حقيقي بدل مفتاح قسم ثابت. */
    public function category(int $categoryId): static
    {
        return $this->state(fn (): array => [
            'type' => 'category',
            'category_id' => $categoryId,
            'section_key' => null,
        ]);
    }
}
