@extends('epaper.layout')

@section('seo')
    <title>{{ $displayName }} — {{ \App\Support\Content\PublicSeoBuilder::getSiteName() }}</title>
    <meta name="description" content="{{ __('epaper.public.tagline') }}">
    <link rel="canonical" href="{{ url()->current() }}">
    <meta name="robots" content="{{ config('seo.robots.default', 'index, follow') }}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="{{ \App\Support\Content\PublicSeoBuilder::getSiteName() }}">
    <meta property="og:locale" content="{{ $locale === 'en' ? 'en_US' : 'ar_AR' }}">
    <meta property="og:title" content="{{ $displayName }}">
    <meta property="og:description" content="{{ __('epaper.public.tagline') }}">
    <meta property="og:url" content="{{ url()->current() }}">
@endsection

@section('content')
    <header class="mb-6 border-b border-zinc-200 pb-6">
        <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">{{ $displayName }}</h1>
        <p class="mt-2 max-w-2xl text-zinc-500">{{ __('epaper.public.tagline') }}</p>
    </header>

    {{-- بحث الأرشيف العابر للأعداد (Phase 6) — تحسين تدريجيّ: بلا JS تبقى شبكة الأعداد
         كاملةً تحته؛ يُركَّب الودجت من epaper.js عبر [data-epaper-archive]. --}}
    @php
        $archiveLabels = [
            'label' => __('epaper.public.search.label'),
            'placeholder' => __('epaper.public.search.placeholder'),
            'filters' => __('epaper.public.search.filters'),
            'issue_number' => __('epaper.public.search.issue_number'),
            'date_from' => __('epaper.public.search.date_from'),
            'date_to' => __('epaper.public.search.date_to'),
            'clear' => __('epaper.public.search.clear'),
            'loading' => __('epaper.public.search.loading'),
            'hint' => __('epaper.public.search.hint'),
            'empty' => __('epaper.public.search.empty'),
            'error' => __('epaper.public.search.error'),
            'count' => __('epaper.public.search.count'),
            'result_page' => __('epaper.public.search.result_page'),
            'pages_matched' => __('epaper.public.search.pages_matched'),
            'more' => __('epaper.public.search.more'),
        ];
    @endphp
    <div
        data-epaper-archive
        data-endpoint="{{ route('epaper.search.archive', ['locale' => $locale]) }}"
        data-locale="{{ $locale }}"
        class="mb-8"
    >
        <script type="application/json" data-epaper-archive-i18n>{!! json_encode($archiveLabels, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) !!}</script>
    </div>

    <div data-epaper-grid>
        @if ($issues->isEmpty())
            <div class="flex flex-col items-center justify-center border border-dashed border-zinc-300 bg-zinc-50 px-6 py-20 text-center">
                <span class="mb-4 flex h-14 w-14 items-center justify-center bg-zinc-100 text-zinc-400">
                    <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                        <path d="M4 5h13v14H6a2 2 0 0 1-2-2V5z"/><path d="M17 8h3v9a2 2 0 0 1-2 2"/>
                    </svg>
                </span>
                <p class="text-sm text-zinc-500">{{ __('epaper.public.empty') }}</p>
            </div>
        @else
            <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                @foreach ($issues as $issue)
                    @include('epaper.partials.card', ['issue' => $issue, 'locale' => $locale])
                @endforeach
            </div>

            @if ($issues->hasPages())
                <div class="mt-10">
                    {{ $issues->links() }}
                </div>
            @endif
        @endif
    </div>
@endsection
