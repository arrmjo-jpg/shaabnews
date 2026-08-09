<?php

declare(strict_types=1);

return [
    'status' => [
        'draft' => 'Draft',
        'scheduled' => 'Scheduled',
        'published' => 'Published',
        'archived' => 'Archived',
    ],

    'access_level' => [
        'public' => 'Public',
        'subscriber' => 'Subscribers',
        'private' => 'Private',
    ],

    'listed' => 'Issues retrieved successfully.',
    'shown' => 'Issue retrieved successfully.',
    'created' => 'Issue created successfully.',
    'updated' => 'Issue updated successfully.',
    'pdf_replaced' => 'PDF replaced and a new version was created.',
    'cover_set' => 'Issue cover set.',
    'no_document' => 'This issue has no PDF file.',
    'status_changed' => 'Issue status changed successfully.',
    'duplicated' => 'Issue duplicated as a new draft.',
    'deleted' => 'Issue deleted.',
    'restored' => 'Issue restored.',
    'force_deleted' => 'Issue permanently deleted.',

    'forbidden_transition' => 'You are not allowed to change the issue to this status.',
    'media_required' => 'An issue without a PDF file cannot be published or scheduled.',
    'schedule_requires_future_date' => 'Scheduling requires a future publish date.',

    'settings_shown' => 'Digital newspaper settings retrieved.',
    'settings_updated' => 'Digital newspaper settings updated.',

    // Reader analytics (Phase 5)
    'analytics' => [
        'shown' => 'Issue analytics retrieved.',
    ],

    // Operational visibility (Final completion)
    'operations' => [
        'shown' => 'Epaper operational status retrieved.',
    ],

    // Public reader UI (SSR)
    'public' => [
        'tagline' => 'Browse complete digital newspaper issues in PDF.',
        'empty' => 'No published issues yet.',
        'read' => 'Read issue',
        'issue_number' => 'Issue :number',
        'back_to_archive' => 'All issues',
        'loading' => 'Loading issue…',
        'js_required' => 'The reader requires JavaScript. You can open the PDF directly:',
        'open_pdf' => 'Open PDF file',
        'unavailable' => 'This issue is currently unavailable.',
        'subscriber_only' => 'This issue is available to subscribers only.',
        'subscriber_hint' => 'Subscribe to read the full issue and the back-issue archive.',
        'subscribe_cta' => 'Subscribe now',
    ],

    // PDF.js reader UI (passed to JS via JSON)
    'reader' => [
        'prev' => 'Previous page',
        'next' => 'Next page',
        'zoom_in' => 'Zoom in',
        'zoom_out' => 'Zoom out',
        'fit_width' => 'Fit width',
        'fit_page' => 'Fit page',
        'single' => 'Single page',
        'spread' => 'Two-page spread',
        'continuous' => 'Continuous scroll',
        'fullscreen' => 'Fullscreen',
        'thumbnails' => 'Thumbnails',
        'download' => 'Download',
        'go_to_page' => 'Go to page',
        'load_error' => 'Failed to load the PDF file.',
        'denied' => 'Your access to this issue has expired.',
        'delivery_error' => 'The issue could not be loaded right now. Please try again.',
        'retry' => 'Retry',
        'subscribe' => 'Subscribe to read',
        'search_page' => 'Page :page',
        // Bookmarks + resume reading (Phase 5)
        'bookmark_add' => 'Add bookmark',
        'bookmark_remove' => 'Remove bookmark',
        'bookmarks' => 'Bookmarks',
        'bookmarks_empty' => 'No bookmarks yet.',
        'resumed' => 'Resumed from page :page',
        // Search highlight when arriving from the archive (Phase 6)
        'search_origin' => 'Search results for: :q',
        'clear_highlight' => 'Clear highlights',
    ],
];
