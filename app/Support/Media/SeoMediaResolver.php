<?php

declare(strict_types=1);

namespace App\Support\Media;

use App\Models\MediaAsset;

class SeoMediaResolver
{
    /**
     * Resolves any media asset, path, or URL to a standardized SEO image array.
     *
     * @param  mixed  $input  MediaAsset model, relative path, absolute URL, or null.
     * @return array{url: string, secure_url: ?string, width: ?int, height: ?int, type: ?string}|null
     */
    public static function resolve(mixed $input): ?array
    {
        if ($input === null || $input === '') {
            return null;
        }

        $url = null;
        $width = null;
        $height = null;
        $type = null;

        if ($input instanceof MediaAsset) {
            $url = $input->url();
            $width = $input->width;
            $height = $input->height;
            $type = $input->mime_type;
        } elseif (is_string($input)) {
            if (preg_match('/^https?:\/\//i', $input)) {
                $url = $input;
            } else {
                // If it is a relative path, assume it belongs to the public storage disk
                $url = MediaUrl::forPublic($input);
            }

            if ($url) {
                $type = self::guessMimeType($url);
            }
        }

        if (! $url) {
            return null;
        }

        $secureUrl = str_starts_with($url, 'https://') ? $url : null;

        return [
            'url' => $url,
            'secure_url' => $secureUrl,
            'width' => $width,
            'height' => $height,
            'type' => $type,
        ];
    }

    /**
     * Guesses the MIME type based on the file extension.
     */
    private static function guessMimeType(string $url): ?string
    {
        $path = parse_url($url, PHP_URL_PATH);
        if (! $path) {
            return null;
        }

        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        return match ($extension) {
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
            'svg' => 'image/svg+xml',
            default => null,
        };
    }
}
