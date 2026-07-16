<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Search Engine
    |--------------------------------------------------------------------------
    |
    | This option controls the default search connection that gets used while
    | using Laravel Scout. This connection is used when syncing all models
    | to the search service. You should adjust this based on your needs.
    |
    | Supported: "algolia", "meilisearch", "typesense",
    |            "database", "collection", "null"
    |
    */

    'driver' => env('SCOUT_DRIVER', 'collection'),

    /*
    |--------------------------------------------------------------------------
    | Index Prefix
    |--------------------------------------------------------------------------
    |
    | Here you may specify a prefix that will be applied to all search index
    | names used by Scout. This prefix may be useful if you have multiple
    | "tenants" or applications sharing the same search infrastructure.
    |
    */

    'prefix' => env('SCOUT_PREFIX', ''),

    /*
    |--------------------------------------------------------------------------
    | Queue Data Syncing
    |--------------------------------------------------------------------------
    |
    | This option allows you to control if the operations that sync your data
    | with your search engines are queued. When this is set to "true" then
    | all automatic data syncing will get queued for better performance.
    |
    */

    // عند التفعيل (SCOUT_QUEUE=true) تُطابَر مزامنة الفهرسة على طابور «search» المخصّص
    // فلا تَحجب الحفظَ التحريريّ ولا تتنافس مع الوسائط/الافتراضي — موصى به عند المقياس.
    'queue' => env('SCOUT_QUEUE', false) ? [
        'connection' => env('SCOUT_QUEUE_CONNECTION', env('QUEUE_CONNECTION', 'database')),
        'queue' => env('SCOUT_QUEUE_NAME', 'search'),
    ] : false,

    /*
    |--------------------------------------------------------------------------
    | Database Transactions
    |--------------------------------------------------------------------------
    |
    | This configuration option determines if your data will only be synced
    | with your search indexes after every open database transaction has
    | been committed, thus preventing any discarded data from syncing.
    |
    */

    'after_commit' => false,

    /*
    |--------------------------------------------------------------------------
    | Chunk Sizes
    |--------------------------------------------------------------------------
    |
    | These options allow you to control the maximum chunk size when you are
    | mass importing data into the search engine. This allows you to fine
    | tune each of these chunk sizes based on the power of the servers.
    |
    */

    'chunk' => [
        'searchable' => 500,
        'unsearchable' => 500,
    ],

    /*
    |--------------------------------------------------------------------------
    | Soft Deletes
    |--------------------------------------------------------------------------
    |
    | This option allows to control whether to keep soft deleted records in
    | the search indexes. Maintaining soft deleted records can be useful
    | if your application still needs to search for the records later.
    |
    */

    'soft_delete' => false,

    /*
    |--------------------------------------------------------------------------
    | Identify User
    |--------------------------------------------------------------------------
    |
    | This option allows you to control whether to notify the search engine
    | of the user performing the search. This is sometimes useful if the
    | engine supports any analytics based on this application's users.
    |
    | Supported engines: "algolia"
    |
    */

    'identify' => env('SCOUT_IDENTIFY', false),

    /*
    |--------------------------------------------------------------------------
    | Algolia Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your Algolia settings. Algolia is a cloud hosted
    | search engine which works great with Scout out of the box. Just plug
    | in your application ID and admin API key to get started searching.
    |
    */

    'algolia' => [
        'id' => env('ALGOLIA_APP_ID', ''),
        'secret' => env('ALGOLIA_SECRET', ''),
        'index-settings' => [
            // 'users' => [
            //     'searchableAttributes' => ['id', 'name', 'email'],
            //     'attributesForFaceting'=> ['filterOnly(email)'],
            // ],
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Meilisearch Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your Meilisearch settings. Meilisearch is an open
    | source search engine with minimal configuration. Below, you can state
    | the host and key information for your own Meilisearch installation.
    |
    | See: https://www.meilisearch.com/docs/learn/configuration/instance_options#all-instance-options
    |
    */

    'meilisearch' => [
        'host' => env('MEILISEARCH_HOST', 'http://localhost:7700'),
        'key' => env('MEILISEARCH_KEY'),
        'index-settings' => [
            // فهرس المقالات — بحث عربي/إنجليزي بترتيب صلة + تصفية + ترتيب.
            'articles_index' => [
                'searchableAttributes' => ['title', 'subtitle', 'excerpt', 'body', 'category', 'tags'],
                'filterableAttributes' => ['locale', 'type', 'status', 'author_id', 'category_ids', 'tag_names'],
                'sortableAttributes' => ['published_at', 'created_at'],
                // تسامح الأخطاء الإملائية مفعّل افتراضياً في Meilisearch.
                'rankingRules' => ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
            ],
            // فهرس مكتبة الفيديو — بحث متن (عنوان/وصف/مقتطف) بترتيب صلة + حقول تصفية.
            'videos_index' => [
                'searchableAttributes' => ['title', 'description', 'excerpt'],
                'filterableAttributes' => ['locale', 'source_type', 'video_category_id', 'is_featured', 'status', 'visibility', 'author_id'],
                'sortableAttributes' => ['published_at'],
                'rankingRules' => ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
            ],
            // فهرس الريلز — مرآة videos_index دون تصنيف/visibility (الريل نطاق مستقلّ).
            'reels_index' => [
                'searchableAttributes' => ['title', 'description'],
                'filterableAttributes' => ['locale', 'is_featured', 'status', 'author_id'],
                'sortableAttributes' => ['published_at'],
                'rankingRules' => ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
            ],
            // فهرس البثّ — بُعد kind (live|tv|radio) بدل locale (البثّ غير مقسَّم لغوياً).
            'broadcasts_index' => [
                'searchableAttributes' => ['title', 'description', 'excerpt'],
                'filterableAttributes' => ['kind', 'status', 'is_featured', 'is_public', 'category_id'],
                'sortableAttributes' => ['started_at', 'scheduled_at'],
                'rankingRules' => ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
            ],
            // فهرس صفحات الجريدة (بحث الأرشيف العابر — Enterprise). وثيقة لكل صفحة
            // مع نصّ OCR + ميتاداتا العدد المُغناة. الترتيب: العنوان ثمّ المتن (أولوية
            // الصلة). distinctAttribute=epaper_id ⇒ نتيجة واحدة لكل عدد (لا إغراق).
            // الترشيح بـ access_level/locale يفرض الوصول **داخل المحرّك** (صفر تسريب).
            'epaper_pages_index' => [
                'searchableAttributes' => ['issue_title', 'issue_subtitle', 'text'],
                'filterableAttributes' => ['locale', 'access_level', 'epaper_id', 'issue_number', 'publication_date'],
                'sortableAttributes' => ['publication_date', 'issue_number', 'page_number'],
                'distinctAttribute' => 'epaper_id',
                'rankingRules' => ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
            ],
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Typesense Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your Typesense settings. Typesense is an open
    | source search engine using minimal configuration. Below, you will
    | state the host, key, and schema configuration for the instance.
    |
    */

    'typesense' => [
        'client-settings' => [
            'api_key' => env('TYPESENSE_API_KEY', 'xyz'),
            'nodes' => [
                [
                    'host' => env('TYPESENSE_HOST', 'localhost'),
                    'port' => env('TYPESENSE_PORT', '8108'),
                    'path' => env('TYPESENSE_PATH', ''),
                    'protocol' => env('TYPESENSE_PROTOCOL', 'http'),
                ],
            ],
            'nearest_node' => [
                'host' => env('TYPESENSE_HOST', 'localhost'),
                'port' => env('TYPESENSE_PORT', '8108'),
                'path' => env('TYPESENSE_PATH', ''),
                'protocol' => env('TYPESENSE_PROTOCOL', 'http'),
            ],
            'connection_timeout_seconds' => env('TYPESENSE_CONNECTION_TIMEOUT_SECONDS', 2),
            'healthcheck_interval_seconds' => env('TYPESENSE_HEALTHCHECK_INTERVAL_SECONDS', 30),
            'num_retries' => env('TYPESENSE_NUM_RETRIES', 3),
            'retry_interval_seconds' => env('TYPESENSE_RETRY_INTERVAL_SECONDS', 1),
        ],
        // 'max_total_results' => env('TYPESENSE_MAX_TOTAL_RESULTS', 1000),
        'model-settings' => [
            // User::class => [
            //     'collection-schema' => [
            //         'fields' => [
            //             [
            //                 'name' => 'id',
            //                 'type' => 'string',
            //             ],
            //             [
            //                 'name' => 'name',
            //                 'type' => 'string',
            //             ],
            //             [
            //                 'name' => 'created_at',
            //                 'type' => 'int64',
            //             ],
            //         ],
            //         'default_sorting_field' => 'created_at',
            //     ],
            //     'search-parameters' => [
            //         'query_by' => 'name'
            //     ],
            // ],
        ],
        'import_action' => env('TYPESENSE_IMPORT_ACTION', 'upsert'),
    ],

];
