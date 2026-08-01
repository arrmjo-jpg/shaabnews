<?php

declare(strict_types=1);

namespace App\Support\Content;

use App\Models\MediaAsset;
use Illuminate\Database\Eloquent\Model;

/**
 * مصدر الحقيقة الوحيد لتشكيل وسائط المالك (مقال أو تحديث تغطية حيّة).
 *
 * يستهلك article_media pivot → MediaAsset (P9.2 B.2a + Live Coverage).
 * يُفترض أن `mediaAssets` مُحمَّل مسبقاً على المالك.
 *
 * مُستهلَك من: ArticleResource / LiveUpdateResource / استوديو الوسائط.
 */
final class ArticleMediaPresenter
{
    /** @return array<string,mixed> */
    public static function admin(Model $owner): array
    {
        $byCollection = $owner->mediaAssets
            ->groupBy(fn (MediaAsset $a): string => $a->pivot->collection);

        $cover = $byCollection->get('cover')?->first();
        $gallery = ($byCollection->get('gallery') ?? collect())->sortBy('pivot.position');
        $inline = ($byCollection->get('inline') ?? collect())->sortBy('pivot.position');
        $video = ($byCollection->get('video') ?? collect())->sortBy('pivot.position');

        return [
            'cover' => $cover ? self::imageShape($cover) : null,
            'gallery' => $gallery->map(fn (MediaAsset $a) => self::imageShape($a))->values()->all(),
            'inline' => $inline->map(fn (MediaAsset $a) => self::imageShape($a))->values()->all(),
            'video' => $video->map(fn (MediaAsset $a): array => [
                'id' => $a->id,
                'uuid' => $a->uuid,
                'url' => $a->url(),
                'mime' => $a->mime_type,
                'name' => $a->original_name,
                'is_external' => $a->isExternal(),
                'provider' => $a->provider,
                'poster' => $a->posterUrl(),
                'processing_status' => $a->processing_status,
                'duration' => $a->duration_seconds,
                'hls' => $a->hlsUrl(),
            ])->values()->all(),
        ];
    }

    /** @return array<string,mixed> */
    private static function imageShape(MediaAsset $asset): array
    {
        return [
            'id' => $asset->id,
            'uuid' => $asset->uuid,
            'url' => $asset->url(),
            'thumb' => $asset->conversionUrl('thumb'),
            'medium' => $asset->conversionUrl('medium'),
            'name' => $asset->original_name,
            'alt' => $asset->alt,
            'caption' => $asset->caption,
        ];
    }
}
