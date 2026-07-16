<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Performance Knobs
|--------------------------------------------------------------------------
| Ø§Ù„Ù…ØµØ¯Ø± Ø§Ù„Ù…ÙˆØ­Ù‘Ø¯ Ù„Ù‚ÙˆØ§Ø¹Ø¯ Ø§Ù„Ø£Ø¯Ø§Ø¡ â€” ØªØªØ¨Ù†Ù‘Ø§Ù‡ ÙƒÙ„ Ø§Ù„ÙˆØ­Ø¯Ø§Øª Ø§Ù„Ù‚Ø§Ø¯Ù…Ø©.
| Ù…Ù„Ø§Ø­Ø¸Ø©: Ø¨Ø§Ø¯Ø¦Ø© Ø§Ù„ÙƒØ§Ø´ ØªØ¹ÙŠØ´ ÙÙŠ config/cache.php (CACHE_PREFIX) â€” Ù„Ø§ ØªÙÙƒØ±ÙŽÙ‘Ø± Ù‡Ù†Ø§.
*/

return [

    'pagination' => [
        'default' => (int) env('PAGINATION_DEFAULT', 15),
        'max' => (int) env('PAGINATION_MAX', 100),
        'max_page' => (int) env('PAGINATION_MAX_PAGE', 100),
        'cursor_threshold' => (int) env('PAGINATION_CURSOR_THRESHOLD', 10000),
    ],

    // Ø³Ù‚Ù Ù…Ø¹Ø¯Ù‘Ù„ Ù‚Ø±Ø§Ø¡Ø© Ø§Ù„Ù…Ø³Ø§Ø±Ø§Øª Ø§Ù„Ø¹Ø§Ù…Ø© Ù„ÙƒÙ„ Ø¹Ù…ÙŠÙ„/Ø¯Ù‚ÙŠÙ‚Ø© (Ø­Ø§Ø±Ø³ Ø¥Ø³Ø§Ø¡Ø©/DoS Ø¹Ù„Ù‰ Ø§Ù„Ø£ØµÙ„).
    // Ø³Ø®ÙŠÙ‘ Ø¹Ù…Ø¯Ø§Ù‹ â€” Ø§Ù„Ù€ CDN ÙŠÙ…ØªØµÙ‘ Ù…Ø¹Ø¸Ù… Ø§Ù„Ù‚Ø±Ø§Ø¡Ø§ØªØ› Ù‡Ø°Ø§ Ø­Ø¯Ù‘ Ø§Ù„Ø£ØµÙ„ Ù„Ù„Ø¹Ù…Ù„Ø§Ø¡ Ø§Ù„Ù…Ø¨Ø§Ø´Ø±ÙŠÙ†.
    // Ù…Ù„Ø§Ø­Ø¸Ø© ØªØ´ØºÙŠÙ„ÙŠØ©: Ø®Ù„Ù CDN ÙŠØ¬Ø¨ Ø¶Ø¨Ø· TrustProxies ÙƒÙŠ ÙŠØ­Ù„Ù‘ $request->ip() Ø¹Ù†ÙˆØ§Ù†
    // Ø§Ù„Ø¹Ù…ÙŠÙ„ Ø§Ù„Ø­Ù‚ÙŠÙ‚ÙŠ Ø¨Ø¯Ù„ Ø¹Ù‚Ø¯Ø© Ø§Ù„Ø­Ø§ÙØ© (ÙˆØ¥Ù„Ø§ Ù‚Ø¯ ÙŠÙØ®Ù†ÙŽÙ‚ Ù…Ù„Ø¡ Ø§Ù„Ù€ CDN Ø¹Ù†Ø¯ Ø§Ù„Ø°Ø±ÙˆØ©).
    'public_read_rate_limit' => (int) env('PERFORMANCE_PUBLIC_READ_RATE_LIMIT', 120),

    // Ø­Ø¯ÙˆØ¯ Ø±ÙØ¹ Ø§Ù„ÙˆØ³Ø§Ø¦Ø· ÙˆÙ…Ø¹Ø§Ù„Ø¬ØªÙ‡Ø§ (ØªØµÙ„Ù‘Ø¨ Ø§Ù„Ø±ÙØ¹ â€” Phase 4). ÙƒÙ„Ù‡Ø§ Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„Ø¶Ø¨Ø· Ø¨ÙŠØ¦ÙŠØ§Ù‹.
    'media' => [
        // Ø³Ù‚Ù Ø­Ø¬Ù… Ø§Ù„ÙÙŠØ¯ÙŠÙˆ Ø§Ù„Ø¹Ø§Ù… (KB) â€” Ø­Ø§Ø±Ø³ Ø¥Ø³Ø§Ø¡Ø© Ø§Ù„ØªØ®Ø²ÙŠÙ† Ø¹Ù†Ø¯ Ø§Ù„Ø±ÙØ¹.
        'video_max_kb' => (int) env('MEDIA_VIDEO_MAX_KB', 256000),
        // Ø³Ù‚Ù Ø£Ø¶ÙŠÙ‚ Ù„ÙÙŠØ¯ÙŠÙˆ Ø§Ù„Ø±ÙŠÙ„ (Ø£Ù‚ØµØ± Ø¨Ø·Ø¨ÙŠØ¹ØªÙ‡) â€” 150MB.
        'reel_video_max_kb' => (int) env('MEDIA_REEL_VIDEO_MAX_KB', 153600),
        // Ø³Ù‚Ù Ø­Ø¬Ù… Ø§Ù„ØµÙˆØ±Ø© (KB) + Ø£Ù‚ØµÙ‰ Ø¨ÙØ¹Ø¯ Ø¨ÙƒØ³Ù„ (Ø­Ø§Ø±Ø³ ØµÙˆØ± Ø¹Ù…Ù„Ø§Ù‚Ø©).
        'image_max_kb' => (int) env('MEDIA_IMAGE_MAX_KB', 5120),
        'image_max_dimension' => (int) env('MEDIA_IMAGE_MAX_DIMENSION', 8000),
        // Ø­Ø¯ÙˆØ¯ Ù…Ø§ Ø¨Ø¹Ø¯ Ø§Ù„Ù€ probe (ØªÙÙØ±ÙŽØ¶ ÙÙŠ ÙˆØ¸ÙŠÙØ© Ø§Ù„ØªØ±Ù…ÙŠØ²): Ù…Ø¯Ù‘Ø© ÙˆØ£Ø¨Ø¹Ø§Ø¯ Ø§Ù„ÙÙŠØ¯ÙŠÙˆ.
        'video_max_duration' => (int) env('MEDIA_VIDEO_MAX_DURATION', 600),  // 10 Ø¯Ù‚Ø§Ø¦Ù‚
        'reel_max_duration' => (int) env('MEDIA_REEL_MAX_DURATION', 180),    // 3 Ø¯Ù‚Ø§Ø¦Ù‚
        'video_max_dimension' => (int) env('MEDIA_VIDEO_MAX_DIMENSION', 8192),
        // Ø¹ØªØ¨Ø§Øª ØµØ­Ù‘Ø© Ø§Ù„Ù…Ø¹Ø§Ù„Ø¬Ø© (Phase 5 â€” Ù…Ø±Ø§Ù‚Ø¨Ø©): Ø£ØµÙ„ Ø¹Ø§Ù„Ù‚ ÙÙŠ processing Ø£Ø·ÙˆÙ„ Ù…Ù†
        // Ù‡Ø°Ø§ = Ø¹Ø§Ù…Ù„ Ù…Ø¹Ø·Ù‘Ù„/Ù…Ù‡Ù…Ø© Ù…Ø¹Ù„Ù‘Ù‚Ø© (ÙØ´Ù„ ØµØ­Ù‘ÙŠ)Ø› ÙˆØ¹Ø¯Ø¯ Ø§Ù„ÙØ´Ù„ Ø®Ù„Ø§Ù„ 24Ø³ ÙÙˆÙ‚ Ø§Ù„Ø¹ØªØ¨Ø©
        // = ØªØ­Ø°ÙŠØ± ØµØ­Ù‘ÙŠ.
        'stuck_processing_minutes' => (int) env('MEDIA_STUCK_PROCESSING_MINUTES', 60),
        'failed_alert_threshold' => (int) env('MEDIA_FAILED_ALERT_THRESHOLD', 10),
        // Ù…Ù‡Ù„Ø© ØªÙ†Ø¸ÙŠÙ Ø§Ù„Ø£ØµÙˆÙ„ Ø§Ù„Ù…Ø±Ø­Ù‘Ù„Ø© Ø§Ù„Ù…Ù‡Ø¬ÙˆØ±Ø© (ØºÙŠØ± Ù…ÙØ³Ù†ÙŽØ¯Ø©) â€” attach-on-save
        'orphan_ttl_hours' => (int) env('MEDIA_ORPHAN_TTL_HOURS', 48),
    ],

    // ØªØ¬Ù…ÙŠØ¹ Ø§Ù„Ù…Ø´Ø§Ù‡Ø¯Ø§Øª (Ù…ÙƒØ§ÙØ­Ø© ØªÙ†Ø§Ø²Ø¹ Ø§Ù„ØµÙÙ‘ Ø§Ù„Ø³Ø§Ø®Ù†): ØªÙØ¬Ù…ÙŽÙ‘Ø¹ Ø§Ù„Ø²ÙŠØ§Ø¯Ø§Øª ÙÙŠ Ù…Ø®Ø²Ù† Ù…Ø¤Ù‚Ù‘Øª
    // (Redis) ÙˆØªÙÙØ±ÙŽÙ‘Øº Ø¯ÙˆØ±ÙŠØ§Ù‹ Ø¹Ø¨Ø± engagement:flush-views Ø¨Ø¯Ù„ UPDATE Ù…ØªØ²Ø§Ù…Ù† Ù„ÙƒÙ„ Ù…Ø´Ø§Ù‡Ø¯Ø©.
    // Ù…ÙØ¹Ù‘Ù„ Ø§ÙØªØ±Ø§Ø¶ÙŠØ§Ù‹ (Ø§Ù„Ø¥Ù†ØªØ§Ø¬ ÙŠØ´ØºÙ‘Ù„ Ø§Ù„Ù…ÙØ¬Ø¯ÙˆÙÙ„)Ø› Ø§Ù„Ø§Ø®ØªØ¨Ø§Ø±Ø§Øª ØªØ¹Ø·Ù‘Ù„Ù‡ Ù„Ø§Ø­ØªØ³Ø§Ø¨ ÙÙˆØ±ÙŠ Ø­ØªÙ…ÙŠ.
    'view_buffer' => [
        'enabled' => (bool) env('ENGAGEMENT_BUFFER_VIEWS', true),
    ],

    // Ù…Ù†Ø§Ø±Ø© Ø§Ù„Ù…Ø´Ø§Ù‡Ø¯Ø© (uncached): Ù†Ù‚Ø·Ø© Ù…Ø³ØªÙ‚Ù„Ù‘Ø© Ø¹Ù† Ø§Ù„ÙƒØ§Ø´ Ù„Ø§Ø­ØªØ³Ø§Ø¨ Ø¯Ù‚ÙŠÙ‚ Ø®Ù„Ù Ø§Ù„Ù€ CDN.
    // ttl: Ø¹Ù…Ø± Ø±Ù…Ø² Ø§Ù„Ù…Ù†Ø§Ø±Ø© Ø§Ù„Ù…ÙˆÙ‚Ù‘Ø¹ (Ø«ÙˆØ§Ù†Ù) â€” ÙŠØºØ·Ù‘ÙŠ Ù†Ø§ÙØ°Ø© ÙƒØ§Ø´ Ø§Ù„Ø­Ø§ÙØ© + ØªØ£Ø®Ù‘Ø± Ø§Ù„Ø¹Ù…ÙŠÙ„.
    // rate_limit: Ø³Ù‚Ù Ù†Ø¨Ø¶Ø§Øª Ø§Ù„Ù…Ù†Ø§Ø±Ø© Ù„ÙƒÙ„ Ø¹Ù…ÙŠÙ„/Ø¯Ù‚ÙŠÙ‚Ø© (Ù…Ù‚Ø§ÙˆÙ…Ø© Ø¥Ø³Ø§Ø¡Ø© Ø§Ù„ØªØ¶Ø®ÙŠÙ…).
    'view_beacon' => [
        'ttl' => (int) env('ENGAGEMENT_BEACON_TTL', 900),
        'rate_limit' => (int) env('ENGAGEMENT_BEACON_RATE_LIMIT', 120),
    ],

    // Ù…Ø±Ø¢Ø© Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„Ø¶Ø¨Ø· Ù„Ù‚ÙŠÙ… App\Support\Cache\CacheTtl (Ø¨Ø§Ù„Ø«ÙˆØ§Ù†ÙŠ)
    'cache' => [
        'settings_ttl' => (int) env('CACHE_SETTINGS_TTL', 86400),
        'short_ttl' => (int) env('CACHE_SHORT_TTL', 300),
        'medium_ttl' => (int) env('CACHE_MEDIUM_TTL', 1800),
        'long_ttl' => (int) env('CACHE_LONG_TTL', 21600),
    ],

    // Ø£Ø³Ù…Ø§Ø¡ Ø§Ù„Ø·ÙˆØ§Ø¨ÙŠØ± Ø§Ù„Ù…Ù†Ø·Ù‚ÙŠØ© â€” ØªÙÙ…Ø±ÙŽÙ‘Ø± Ø¹Ø¨Ø± ->onQueue(config('performance.queues.x'))
    'queues' => [
        'default' => 'default',
        'media' => 'media',
        'search' => 'search',
        'notifications' => 'notifications',
        'analytics' => 'analytics',
        'ai' => 'ai',
    ],

    // Ø­Ø¯ÙˆØ¯ Ø§Ù†Ø­Ø±Ø§Ù ÙØ­Øµ ØµØ­Ù‘Ø© ÙÙ‡Ø§Ø±Ø³ Ø§Ù„Ø¨Ø­Ø« (Article/Video/Reel/Broadcast) â€” Ø±Ø§Ø¬Ø¹
    // App\Health\Checks\ContentSearchHealthCheck. ØªØ­Ø°ÙŠØ± > Ø§Ù„Ù†Ø³Ø¨Ø© Ø§Ù„Ø£ÙˆÙ„Ù‰ØŒ ÙØ´Ù„ > Ø§Ù„Ø«Ø§Ù†ÙŠØ©.
    'search' => [
        'health_warning_drift_percent' => (float) env('SEARCH_HEALTH_WARNING_DRIFT_PERCENT', 10.0),
        'health_failure_drift_percent' => (float) env('SEARCH_HEALTH_FAILURE_DRIFT_PERCENT', 30.0),
    ],
];
