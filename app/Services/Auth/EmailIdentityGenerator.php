<?php

declare(strict_types=1);

namespace App\Services\Auth;

use App\Models\User;
use App\Settings\GeneralSettings;
use Illuminate\Support\Str;

class EmailIdentityGenerator
{
    /**
     * Generate a unique institutional email based on a name.
     */
    public function generate(string $name): string
    {
        // Resolve domain in order of priority
        $domain = app(GeneralSettings::class)->institutional_email_domain;

        if (empty($domain)) {
            $domain = config('app.institutional_email_domain');
        }

        if (empty($domain)) {
            $siteUrl = app(GeneralSettings::class)->site_url;
            if (! empty($siteUrl)) {
                $domain = parse_url($siteUrl, PHP_URL_HOST);
            }
        }

        if (empty($domain)) {
            $domain = parse_url(config('app.url'), PHP_URL_HOST);
        }

        $domain = preg_replace('/^www\./', '', (string) $domain) ?: 'alqalahnews.net';

        // 1. Transliterate and create a slug (e.g. "mohammad.ahmad")
        $basePrefix = Str::slug($name, '.');

        // Fallback if slug is empty (e.g. name only contains non-transliteratable characters)
        if (empty($basePrefix)) {
            $basePrefix = 'user';
        }

        // 2. Ensure uniqueness
        return $this->ensureUnique($basePrefix.'@'.$domain);
    }

    /**
     * Ensure the given email is unique in the users table by appending numbers if needed.
     */
    public function ensureUnique(string $email): string
    {
        $parts = explode('@', $email);
        $prefix = $parts[0];
        $domain = $parts[1] ?? 'alqalahnews.net';

        // Fast path: if not taken, return immediately
        if (! User::where('email', $email)->exists()) {
            return $email;
        }

        // Slow path: find an available suffix
        $i = 2;
        while (User::where('email', "{$prefix}{$i}@{$domain}")->exists()) {
            $i++;
        }

        return "{$prefix}{$i}@{$domain}";
    }
}
