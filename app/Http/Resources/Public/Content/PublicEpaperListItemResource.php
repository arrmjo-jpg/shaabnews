<?php

declare(strict_types=1);

namespace App\Http\Resources\Public\Content;

use App\Models\Epaper;
use App\Support\Content\EpaperSeoBuilder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * مورد عرض العدد الرقميّ (PDF) في القائمة العامة — حقول مُعقَّمة فقط.
 * رابط الـ PDF من media_asset_id (القرص العام). لا حقول إدارية/وصول.
 *
 * @mixin Epaper
 */
class PublicEpaperListItemResource extends JsonResource
{
    /** @return array<string,mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'issue_number' => $this->issue_number,
            'title' => $this->title,
            'subtitle' => $this->subtitle,
            'summary' => $this->summary,
            'slug' => $this->slug,
            'publication_date' => $this->publication_date?->toDateString(),
            'page_count' => $this->page_count,
            'canonical_path' => $this->canonicalPath(),
            'pdf_url' => $this->whenLoaded('mediaAsset', fn (): ?string => $this->mediaAsset?->url()),
            'cover_url' => $this->whenLoaded('mediaAsset', fn (): ?string => $this->coverUrl()),
            // حقول تحريريّة منتقاة (null للأعداد بلا تحرير ⇒ الواجهة تعرض حالتها الفارغة).
            'brief_points' => $this->brief_points,
            'highlights' => $this->highlights,
            'inside_this_issue' => $this->inside_this_issue,
            'seo' => EpaperSeoBuilder::build($this->resource),
        ];
    }
}
