<?php

declare(strict_types=1);

namespace App\Support\Content;

class SeoData
{
    public function __construct(
        public string $title,
        public ?string $description,
        public ?string $keywords,
        public string $canonicalUrl,
        public string $robots,
        public ?string $image,
        public array $hreflang,
        public array $og,
        public array $twitter,
        public array $structuredData,
        public array $breadcrumbs
    ) {}

    /**
     * Serializes the DTO into the backward-compatible array structure.
     */
    public function toArray(): array
    {
        return [
            'title' => $this->title,
            'description' => $this->description,
            'keywords' => $this->keywords,
            'canonical_url' => $this->canonicalUrl,
            'robots' => $this->robots,
            'image' => $this->image,
            'hreflang' => $this->hreflang,
            'og' => $this->og,
            'twitter' => $this->twitter,
            'structured_data' => $this->structuredData,
            'breadcrumbs' => $this->breadcrumbs,
        ];
    }
}
