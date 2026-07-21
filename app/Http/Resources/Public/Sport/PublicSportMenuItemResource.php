<?php

declare(strict_types=1);

namespace App\Http\Resources\Public\Sport;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * شكل عامّ مُختزَل — لا `enabled` (كل ما يصل هنا مفعَّل بالتعريف)، لا `parent_id` (متداخل أصلاً
 * عبر `children`)، لا `created_at` (بيانات تدقيق إداريّة، لا حاجة للواجهة العامّة). يبقى `type`/
 * `category_id`/`section_key` لأنّ الواجهة تحتاجها لبناء الرابط الصحيح لكل عنصر.
 */
class PublicSportMenuItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'type' => $this->type,
            'category_id' => $this->category_id,
            'section_key' => $this->section_key,
            'icon' => $this->icon,
            'children' => PublicSportMenuItemResource::collection($this->whenLoaded('children')),
        ];
    }
}
