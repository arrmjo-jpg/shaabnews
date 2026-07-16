@extends('broadcast.layout')

@php
    use App\Enums\BroadcastKind;
    use App\Enums\BroadcastStatus;

    $kindMeta = [
        'live' => [
            'title' => 'البثّ المباشر',
            'tagline' => 'تابع الأحداث لحظة بلحظة — بثّ مباشر ومواعيد قادمة.',
            'empty' => 'لا يوجد بثّ مباشر أو مجدول حالياً. عُد لاحقاً لمتابعة الأحداث الجديدة.',
        ],
        'tv' => [
            'title' => 'القنوات التلفزيونية',
            'tagline' => 'دليل القنوات — شاهد البثّ الحيّ في أي وقت.',
            'empty' => 'لا توجد قنوات متاحة في الدليل حالياً.',
        ],
        'radio' => [
            'title' => 'المحطات الإذاعية',
            'tagline' => 'استمع للمحطات الإذاعية المباشرة على مدار الساعة.',
            'empty' => 'لا توجد محطات إذاعية متاحة في الدليل حالياً.',
        ],
    ][$kind->value];

    $isLiveKind = $kind === BroadcastKind::Live;

    // For /live we present two editorial sections from the current page's items.
    $liveNow = $isLiveKind
        ? $broadcasts->getCollection()->filter(fn ($b) => $b->status === BroadcastStatus::Live)
        : collect();
    $scheduledSoon = $isLiveKind
        ? $broadcasts->getCollection()->filter(fn ($b) => $b->status === BroadcastStatus::Scheduled)
        : collect();
@endphp

@section('seo')
    <title>{{ $kindMeta['title'] }} — {{ \App\Support\Content\PublicSeoBuilder::getSiteName() }}</title>
    <meta name="description" content="{{ $kindMeta['tagline'] }}">
    <link rel="canonical" href="{{ url()->current() }}">
    <meta name="robots" content="{{ config('seo.robots.default', 'index, follow') }}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="{{ \App\Support\Content\PublicSeoBuilder::getSiteName() }}">
    <meta property="og:locale" content="ar_AR">
    <meta property="og:title" content="{{ $kindMeta['title'] }}">
    <meta property="og:description" content="{{ $kindMeta['tagline'] }}">
    <meta property="og:url" content="{{ url()->current() }}">
@endsection

@section('content')
    <header class="mb-8 border-b border-white/10 pb-6">
        <h1 class="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{{ $kindMeta['title'] }}</h1>
        <p class="mt-2 max-w-2xl text-zinc-400">{{ $kindMeta['tagline'] }}</p>
    </header>

    @if ($broadcasts->isEmpty())
        {{-- Strong, kind-aware empty state --}}
        <div class="flex flex-col items-center justify-center border border-dashed border-white/15 bg-[#13131a] px-6 py-20 text-center">
            <span class="mb-4 flex h-16 w-16 items-center justify-center bg-white/5 text-zinc-500">
                <svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                    <rect x="2" y="4" width="20" height="14" rx="1"/><path d="M8 21h8M12 18v3"/>
                </svg>
            </span>
            <h2 class="text-lg font-semibold text-zinc-200">لا يوجد محتوى بعد</h2>
            <p class="mt-1.5 max-w-md text-sm text-zinc-500">{{ $kindMeta['empty'] }}</p>
        </div>
    @elseif ($isLiveKind)
        {{-- /live: editorial split — live now + scheduled soon --}}
        @if ($liveNow->isNotEmpty())
            <section class="mb-12" aria-labelledby="live-now-heading">
                <h2 id="live-now-heading" class="mb-5 flex items-center gap-2.5 text-xl font-bold text-white">
                    <span class="relative flex h-2.5 w-2.5">
                        <span class="absolute inline-flex h-full w-full animate-ping bg-red-500 opacity-75"></span>
                        <span class="relative inline-flex h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                    مباشر الآن
                </h2>
                <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    @foreach ($liveNow as $broadcast)
                        @include('broadcast.partials.card', ['broadcast' => $broadcast, 'kind' => $kind])
                    @endforeach
                </div>
            </section>
        @endif

        @if ($scheduledSoon->isNotEmpty())
            <section aria-labelledby="scheduled-heading">
                <h2 id="scheduled-heading" class="mb-5 flex items-center gap-2.5 text-xl font-bold text-white">
                    <svg class="h-5 w-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
                    </svg>
                    مجدول قادم
                </h2>
                <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    @foreach ($scheduledSoon as $broadcast)
                        @include('broadcast.partials.card', ['broadcast' => $broadcast, 'kind' => $kind])
                    @endforeach
                </div>
            </section>
        @endif
    @else
        {{-- /tv & /radio: persistent directory grid (offline/failed stay visible) --}}
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            @foreach ($broadcasts as $broadcast)
                @include('broadcast.partials.card', ['broadcast' => $broadcast, 'kind' => $kind])
            @endforeach
        </div>
    @endif

    @if ($broadcasts->hasPages())
        <div class="mt-10">
            {{ $broadcasts->links() }}
        </div>
    @endif
@endsection
