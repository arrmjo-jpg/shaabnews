{{-- The literal 4-char sequence "<?xml" must never appear contiguously in this file: Blade's
     raw-PHP-tag scanner matches it (even inside a string literal) and skips compiling this whole
     line, so it gets required verbatim as PHP at runtime -> "unexpected identifier version".
     Splitting the concatenation breaks that match while producing the exact same output. --}}
{!! '<' . '?xml version="1.0" encoding="UTF-8"?' . '>' . "\n" !!}
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>{{ $channel['title'] }}</title>
    <link>{{ $channel['link'] }}</link>
    <description>{{ $channel['description'] }}</description>
    <language>{{ $channel['language'] }}</language>
    <lastBuildDate>{{ $channel['lastBuildDate'] }}</lastBuildDate>
    <atom:link href="{{ $channel['feedUrl'] }}" rel="self" type="application/rss+xml"/>
@foreach ($items as $item)
    <item>
      <title>{{ $item['title'] }}</title>
      <link>{{ $item['link'] }}</link>
      <guid isPermaLink="true">{{ $item['guid'] }}</guid>
      <pubDate>{{ $item['pubDate'] }}</pubDate>
      <description>{{ $item['description'] }}</description>
    </item>
@endforeach
  </channel>
</rss>
