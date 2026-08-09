@extends('epaper.layout')

@section('seo')
    @include('epaper.partials.seo')
@endsection

@section('content')
    @inject('newspaperCfg', \App\Settings\NewspaperSettings::class)

    <nav class="mb-4 text-sm">
        <a href="{{ url('/'.$locale.'/epaper') }}" class="text-zinc-500 transition-colors hover:text-zinc-900">
            <span aria-hidden="true">{{ $locale === 'en' ? '←' : '→' }}</span>
            {{ __('epaper.public.back_to_archive') }}
        </a>
    </nav>

    <header class="mb-6">
        <span class="text-xs font-medium text-zinc-500">
            {{ __('epaper.public.issue_number', ['number' => $epaper->issue_number]) }}
            @if ($epaper->publication_date) · {{ $epaper->publication_date->isoFormat('LL') }} @endif
        </span>
        <h1 class="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{{ $epaper->title }}</h1>
        @if ($epaper->subtitle)
            <p class="mt-1 text-zinc-500">{{ $epaper->subtitle }}</p>
        @endif
    </header>

    {{-- نقطة تركيب القارئ — يُروى عبر PDF.js في المرحلة 2ب من هذه الـ data-attributes.
         حتى ذلك الحين (وبلا جافاسكربت) يظهر بديلٌ صالح: فتح ملف الـ PDF مباشرةً. --}}
    <div
        data-epaper-reader
        data-epaper-id="{{ $epaper->id }}"
        data-doc-endpoint="{{ $docEndpoint }}"
        @if ($canDownload) data-download-endpoint="{{ $downloadEndpoint }}" data-can-download="1" @endif
        @if ($newspaperCfg->subscribe_url !== '') data-subscribe-url="{{ $newspaperCfg->subscribe_url }}" @endif
        data-state-endpoint="{{ $stateEndpoint }}"
        data-progress-endpoint="{{ $progressEndpoint }}"
        data-bookmarks-endpoint="{{ $bookmarksEndpoint }}"
        data-track-endpoint="{{ $trackEndpoint }}"
        data-csrf="{{ csrf_token() }}"
        @if ($authenticated) data-authenticated="1" @endif
        data-initial-page="{{ $initialPage }}"
        data-canonical="{{ url($epaper->canonicalPath()) }}"
        @if ($epaper->page_count) data-total-pages="{{ $epaper->page_count }}" @endif
        class="relative border border-zinc-200 bg-zinc-100"
    >
        @if ($hasDocument)
            {{-- تسميات واجهة القارئ (من ملفات اللغة) — يقرأها PDF.js عند التركيب. --}}
            @php
                $readerLabels = [
                    'prev' => __('epaper.reader.prev'),
                    'next' => __('epaper.reader.next'),
                    'zoomIn' => __('epaper.reader.zoom_in'),
                    'zoomOut' => __('epaper.reader.zoom_out'),
                    'fitWidth' => __('epaper.reader.fit_width'),
                    'fitPage' => __('epaper.reader.fit_page'),
                    'single' => __('epaper.reader.single'),
                    'spread' => __('epaper.reader.spread'),
                    'continuous' => __('epaper.reader.continuous'),
                    'fullscreen' => __('epaper.reader.fullscreen'),
                    'thumbnails' => __('epaper.reader.thumbnails'),
                    'download' => __('epaper.reader.download'),
                    'goToPage' => __('epaper.reader.go_to_page'),
                    'loadError' => __('epaper.reader.load_error'),
                    'denied' => __('epaper.reader.denied'),
                    'deliveryError' => __('epaper.reader.delivery_error'),
                    'retry' => __('epaper.reader.retry'),
                    'subscribe' => __('epaper.reader.subscribe'),
                    'searchPageLabel' => __('epaper.reader.search_page'),
                    'bookmarkAdd' => __('epaper.reader.bookmark_add'),
                    'bookmarkRemove' => __('epaper.reader.bookmark_remove'),
                    'bookmarks' => __('epaper.reader.bookmarks'),
                    'bookmarksEmpty' => __('epaper.reader.bookmarks_empty'),
                    'resumed' => __('epaper.reader.resumed'),
                    'searchOrigin' => __('epaper.reader.search_origin'),
                    'clearHighlight' => __('epaper.reader.clear_highlight'),
                ];
            @endphp
            <script type="application/json" data-epaper-i18n>{!! json_encode($readerLabels, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) !!}</script>

            <div data-epaper-fallback class="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
                <p class="text-sm text-zinc-500">{{ __('epaper.public.loading') }}</p>
                <noscript>
                    <p class="max-w-md text-sm text-zinc-600">{{ __('epaper.public.js_required') }}</p>
                </noscript>
                <a href="{{ $docEndpoint }}" target="_blank" rel="noopener"
                   class="inline-flex items-center gap-2 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700">
                    {{ __('epaper.public.open_pdf') }}
                </a>
            </div>
        @else
            <div class="px-6 py-24 text-center text-sm text-zinc-500">{{ __('epaper.public.unavailable') }}</div>
        @endif
    </div>
@endsection
