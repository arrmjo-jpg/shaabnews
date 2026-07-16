# ============================================================================
# AlphaCMS — Runtime Performance Audit (Docker Compose, local)
# ============================================================================
# شغّله من جذر المشروع (F:\website\shaabjo) في PowerShell، بالحاويات كلها Up.
# كل مرحلة تكتب ملفها الخاص داخل results-<timestamp>\ — أرسل المجلد كاملاً بعد
# التشغيل. لا يعدّل هذا السكربت أي كود أو بيانات (باستثناء تفعيل/تعطيل
# slow_query_log المؤقت في Phase 3، الذي يُعاد لوضعه الأصلي تلقائياً في نهاية
# نفس المرحلة — القسم موسوم بوضوح ويمكن تخطيه بـ -SkipSlowLog).
#
# ── تصحيح جوهري (بعد تشغيل فعلي كشف الأخطاء) ────────────────────────────────
# النسخة السابقة مرّرت كود PHP كوسيط سطري واحد عبر --execute="...". على
# Windows، عند استدعاء PowerShell لأداة خارجية (docker.exe)، تُحذَف علامات
# الاقتباس المزدوجة " المضمّنة داخل قيمة الوسيط أثناء إعادة بناء سطر الأوامر —
# مؤكَّد من نتائج تشغيل فعلي: SQL نفّذ كـ "IN (Questions,Slow_queries)" بلا
# علامات اقتباس إطلاقاً حول القيم، رغم وجودها في الكود المصدر. هذا كسر كل أوامر
# Tinker التي تحتوي علامات اقتباس مزدوجة. الحل هنا: كل كود PHP يُكتب لملف مؤقت
# محلي (بلا أي هروب/اقتباس على الإطلاق — here-string حرفي)، يُنسخ عبر
# `docker compose cp` وينفَّذ كملف — يتجاوز مشكلة سطر الأوامر كلياً.
#
# ── تصحيح ثانٍ: تضارب Redis Facade ──────────────────────────────────────────
# صورة الباك-إند تُثبِّت امتداد phpredis (pecl install redis) الذي يُسجِّل صنفاً
# عاماً اسمه \Redis. النتيجة الفعلية: `Redis::connection()` العارية في Tinker
# لم تُحلّ لواجهة Laravel (Illuminate\Support\Facades\Redis) بل لصنف phpredis
# الأصلي (بلا method اسمه connection) — "Call to undefined method Redis::
# connection()" بالضبط كما ظهر. كل استدعاء Redis هنا الآن مؤهَّل بالكامل:
# \Illuminate\Support\Facades\Redis.
#
# ── تصحيح ثالث: مسارات API كانت مفترَضة لا مكتشَفة ──────────────────────────
# المسارات الحقيقية (routes/api/v1/public.php) داخل مجموعة
# Route::prefix('{locale}')->where(['locale'=>'ar|en']) — أي أن
# /api/v1/categories (بلا locale) لا يطابق أي Route فيرجع 404 كما ظهر فعلاً.
# بدل افتراض /ar/ يدوياً، Phase 2 الآن يشغّل `php artisan route:list --json`
# فعلياً ويستخرج المسارات الحقيقية وقت التشغيل.
#
# ── تصحيح رابع: mojibake في استجابات curl العربية ───────────────────────────
# ترميز طرفية PowerShell الافتراضي على Windows (خصوصاً 5.1) ليس UTF-8، فرسائل
# JSON العربية القادمة من curl.exe تُقرأ بترميز خاطئ قبل حتى وصولها لـ
# Out-File. أول السكربت الآن يفرض UTF-8 على الطرفية نفسها.
#
# ── تصحيح خامس: بوّابة جودة تلقائية ──────────────────────────────────────────
# "انتهى التنفيذ" لم يكن يعني "نجح التدقيق" — النسخة السابقة كتبت ملفات تحتوي
# رسائل خطأ PHP/SQL كاملة واعتبرت ذلك نجاحاً لمجرد أن الملف كُتب. آخر السكربت
# الآن يفحص كل ملف نتائج فعلياً ويعلن PASS/FAIL صراحة (00-VERDICT.txt +
# exit code)، لا يكتفي بإتمام الحلقة.
#
# الاستخدام:
#   .\audit.ps1                 # كل المراحل
#   .\audit.ps1 -SkipSlowLog    # بلا لمس إعدادات MySQL العامة إطلاقاً
#   .\audit.ps1 -Only 1,5,6     # مراحل محددة فقط (بالأرقام أدناه)
# ============================================================================
param(
  [switch]$SkipSlowLog,
  [int[]]$Only = @(1,2,3,4,5,6,7,8)
)

$ErrorActionPreference = "Continue"

# فرض UTF-8 على الطرفية (يحل mojibake الرسائل العربية القادمة من curl/docker)
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
try { [Console]::InputEncoding  = [System.Text.Encoding]::UTF8 } catch {}
$OutputEncoding = [System.Text.Encoding]::UTF8
try { chcp 65001 > $null } catch {}

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# لغة افتراضية لمسارات API المكتشَفة ({locale} في route:list) — مُعرَّفة هنا
# (مستوى السكربت) لا داخل Phase 2 فقط، حتى تعمل Phase 3 بشكل صحيح أيضاً عند
# تشغيلها منفردة عبر -Only 3 بلا Phase 2 قبلها.
$locale = "ar"

$stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$outDir = "ops-toolkit\09-runtime-audit-docker\results-$stamp"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
Write-Host "=== النتائج ستُكتب في: $outDir ===" -ForegroundColor Cyan

function Section($title) {
  Write-Host "`n=== $title ===" -ForegroundColor Yellow
}

function Save($name, $content) {
  $path = Join-Path $outDir $name
  $content | Out-File -FilePath $path -Encoding utf8
  Write-Host "  -> $name"
}

# ---------------------------------------------------------------------------
# بوّابة جودة تلقائية — "انتهى التنفيذ" لا يعني "نجح التدقيق". هذه الدالة تفحص
# كل ملف نتائج فعلياً وتحكم PASS/FAIL بلا مراجعة يدوية، حسب أربعة شروط:
# لا استثناءات Tinker، لا تعارض Redis Facade، لا HTTP 404 على المسارات
# المقيسة، وملفات النتائج تحتوي بيانات فعلية لا رسائل خطأ.
#
# استثناء صريح واحد لا يمكن لهذه الدالة (ولا أي كود يعمل *داخل* السكربت)
# التقاطه أبداً: ParserError. خطأ تحليل PowerShell يمنع السكربت من البدء
# أصلاً — لا يوجد "بعد" يُفحص فيه. الضمانة الوحيدة لهذا الشرط هي أن السكربت
# يبدأ وينفّذ حتى نهايته أصلاً (لو كان فيه ParserError لما وصلنا لهذا السطر
# إطلاقاً)، بالإضافة لمدقّق Python البنيوي المستقل الذي رافق كل نسخة من هذا
# الملف قبل تسليمها.
# ---------------------------------------------------------------------------
$ErrorSignaturePattern = 'ParserError|PARSE ERROR|Missing closing|Unexpected token|Unrecognized token|Unexpected end of input|InvalidArgumentException|QueryException|Undefined constant|Call to undefined method|Fatal error|vendor[\\/]psy[\\/]psysh|^\s*Exception\b'

function Get-FileErrorProblem($path, $label) {
  if (-not (Test-Path -LiteralPath $path)) { return "$label -> الملف غير موجود إطلاقاً ($path)" }
  $content = Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue
  if ([string]::IsNullOrWhiteSpace($content)) {
    return "$label -> ملف فارغ تماماً ($path)"
  }
  if ($content -match $ErrorSignaturePattern) {
    return "$label -> يحتوي إشارة خطأ ('$($Matches[0])') بدل بيانات فعلية ($path)"
  }
  return $null
}

function Test-AuditQuality($outDir, $Only) {
  $problems = @()
  $warnings = @()

  if ($Only -contains 3) {
    foreach ($f in @("03-db-connection-info.json","03-db-global-status-before.json","03-explain-articles-listing.json","03-indexes-articles.json")) {
      $r = Get-FileErrorProblem (Join-Path $outDir $f) "Phase 3 / $f"
      if ($r) { $problems += $r }
    }
  }

  if ($Only -contains 5) {
    foreach ($f in @("05-redis-info-full.json","05-redis-dbsize-prefix.json","05-redis-sample-keys.json")) {
      $p = Join-Path $outDir $f
      if (Test-Path -LiteralPath $p) {
        $c = Get-Content -LiteralPath $p -Raw -ErrorAction SilentlyContinue
        if ($c -match 'Redis::connection\(\)' -and $c -match '(Undefined constant|undefined method)') {
          $problems += "Phase 5 / $f -> تعارض Redis Facade ما زال قائماً (Redis:: عارية غير مؤهَّلة بدل \Illuminate\Support\Facades\Redis) ($p)"
          continue
        }
      }
      $r = Get-FileErrorProblem $p "Phase 5 / $f"
      if ($r) { $problems += $r }
    }
  }

  if ($Only -contains 6) {
    foreach ($f in @("06-meilisearch-health.json","06-meilisearch-stats.json","06-meilisearch-indexes.json")) {
      $r = Get-FileErrorProblem (Join-Path $outDir $f) "Phase 6 / $f"
      if ($r) { $problems += $r }
    }
    $healthPath = Join-Path $outDir "06-meilisearch-health.json"
    if (Test-Path -LiteralPath $healthPath) {
      $h = Get-Content -LiteralPath $healthPath -Raw -ErrorAction SilentlyContinue
      if ($h -notmatch '"status"\s*:\s*"available"') {
        $problems += "Phase 6 / 06-meilisearch-health.json -> لا يحتوي status:available ($healthPath)"
      }
    }
  }

  if ($Only -contains 7) {
    foreach ($f in @("07-queue-db-state.json","07-queue-depth-per-queue.json")) {
      $r = Get-FileErrorProblem (Join-Path $outDir $f) "Phase 7 / $f"
      if ($r) { $problems += $r }
    }
  }

  if ($Only -contains 2) {
    $httpTimingPath = Join-Path $outDir "02-http-timing.json"
    if (Test-Path -LiteralPath $httpTimingPath) {
      try {
        $timingData = Get-Content -LiteralPath $httpTimingPath -Raw | ConvertFrom-Json
        foreach ($entry in $timingData) {
          foreach ($sample in $entry.samples) {
            if ($sample -match 'http_code:\s*(\d+)') {
              $code = [int]$Matches[1]
              if ($code -eq 404) {
                $problems += "Phase 2 / $($entry.label) -> HTTP 404 على $($entry.url)"
              } elseif ($code -ge 400) {
                $warnings += "Phase 2 / $($entry.label) -> HTTP $code على $($entry.url) (ليس 404 لكنه غير 2xx، يستحق مراجعة)"
              }
            }
          }
        }
      } catch {
        $problems += "Phase 2 / 02-http-timing.json -> تعذّر تحليله كـ JSON صالح"
      }
    } else {
      $problems += "Phase 2 -> 02-http-timing.json غير موجود إطلاقاً"
    }
  }

  $verdictPath = Join-Path $outDir "00-VERDICT.txt"
  $lines = @()
  $lines += "AlphaCMS Runtime Audit — نتيجة التحقق الذاتي"
  $lines += "التوقيت: $(Get-Date -Format o)"
  $lines += "المراحل المُشغَّلة: $($Only -join ',')"
  $lines += ""
  if ($problems.Count -eq 0) {
    $lines += "الحالة: PASS — كل الشروط الأربعة مستوفاة تلقائياً (لا Tinker exceptions، لا تعارض Redis، لا HTTP 404، الملفات تحتوي بيانات فعلية)."
  } else {
    $lines += "الحالة: FAIL — $($problems.Count) مشكلة."
    $lines += ""
    $lines += "المشاكل:"
    foreach ($p in $problems) { $lines += "  - $p" }
  }
  if ($warnings.Count -gt 0) {
    $lines += ""
    $lines += "تحذيرات (لا تُسقط PASS لكن تستحق مراجعة):"
    foreach ($w in $warnings) { $lines += "  - $w" }
  }
  ($lines -join "`n") | Out-File -FilePath $verdictPath -Encoding utf8

  return [PSCustomObject]@{
    Passed      = ($problems.Count -eq 0)
    Problems    = $problems
    Warnings    = $warnings
    VerdictPath = $verdictPath
  }
}

# ---------------------------------------------------------------------------
# تشغيل كود PHP داخل حاوية backend عبر ملف مؤقت — لا وسائط سطرية، لا اقتباس.
# bootstrap يطابق ما يفعله Laravel نفسه لأي سكربت مستقل خارج artisan/HTTP.
# ---------------------------------------------------------------------------
$PhpBootstrap = @'
<?php
require __DIR__.'/vendor/autoload.php';
$app = require __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

'@

function Invoke-Tinker([string]$PhpBody) {
  $full = $PhpBootstrap + $PhpBody
  $tmpLocal = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "alphacms-audit-" + [System.Guid]::NewGuid().ToString("N") + ".php")
  [System.IO.File]::WriteAllText($tmpLocal, $full, $Utf8NoBom)
  try {
    docker compose cp $tmpLocal "backend:/tmp/alphacms-audit-snippet.php" 2>&1 | Out-Null
    $out = docker compose exec -T backend php /tmp/alphacms-audit-snippet.php 2>&1 | Out-String
    docker compose exec -T backend rm -f /tmp/alphacms-audit-snippet.php 2>&1 | Out-Null
  } finally {
    Remove-Item -LiteralPath $tmpLocal -Force -ErrorAction SilentlyContinue
  }
  return $out
}

# ---------------------------------------------------------------------------
# PHASE 1 — Environment Validation
# ---------------------------------------------------------------------------
if ($Only -contains 1) {
  Section "Phase 1 — Environment Validation"

  $ps = docker compose ps --format json 2>&1 | Out-String
  Save "01-docker-compose-ps.json" $ps

  $psTable = docker compose ps 2>&1 | Out-String
  Save "01-docker-compose-ps.txt" $psTable

  Write-Host "  جارٍ التقاط docker stats (نافذة 15 ثانية، عيّنة كل 3 ثوانٍ)..."
  $statsLines = @()
  for ($i = 0; $i -lt 5; $i++) {
    $statsLines += "--- sample $($i+1) @ $(Get-Date -Format o) ---"
    $statsLines += (docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}\t{{.PIDs}}" 2>&1 | Out-String)
    Start-Sleep -Seconds 3
  }
  Save "01-docker-stats-5-samples.txt" ($statsLines -join "`n")

  # Restart count + health + started-at per service (Docker-level ground truth)
  $services = @("backend","frontend","admin","worker","worker-media","scheduler","meilisearch")
  $inspect = foreach ($s in $services) {
    $cid = (docker compose ps -q $s 2>$null)
    if (-not $cid) { "== $s == (no container found)"; continue }
    $json = docker inspect $cid | ConvertFrom-Json
    $c = $json[0]
    [PSCustomObject]@{
      service       = $s
      status        = $c.State.Status
      health        = $c.State.Health.Status
      restart_count = $c.RestartCount
      started_at    = $c.State.StartedAt
      finished_at   = $c.State.FinishedAt
      exit_code     = $c.State.ExitCode
      oom_killed    = $c.State.OOMKilled
    } | ConvertTo-Json
  }
  Save "01-container-inspect-summary.json" ($inspect -join "`n")
}

# ---------------------------------------------------------------------------
# PHASE 2 + 4 + 9 — HTTP timing: backend API (مسارات مكتشَفة وقت التشغيل)،
# frontend pages, admin, search
# ---------------------------------------------------------------------------
if ($Only -contains 2) {
  Section "Phase 2/4/9 — HTTP Response Timing (backend API + frontend + admin)"

  $fmt = "ops-toolkit\09-runtime-audit-docker\curl-format.txt"
  $results = @()

  function Time-Url($label, $url, [int]$repeats = 5) {
    Write-Host "  قياس: $label -> $url"
    $samples = @()
    for ($i = 0; $i -lt $repeats; $i++) {
      $out = curl.exe -s -o NUL -w "@$fmt" $url 2>&1
      $samples += $out
    }
    return [PSCustomObject]@{ label = $label; url = $url; samples = $samples }
  }

  # --- اكتشاف المسارات الحقيقية وقت التشغيل (لا افتراض) ---
  Write-Host "  اكتشاف مسارات API الفعلية عبر route:list..."
  $routeListRaw = docker compose exec -T backend php artisan route:list --path=api/v1 --json 2>&1 | Out-String
  Save "02-raw-route-list.json" $routeListRaw

  $routes = $null
  try { $routes = $routeListRaw | ConvertFrom-Json } catch {
    Write-Host "  تعذّر تحليل route:list كـ JSON — راجع 02-raw-route-list.json يدوياً." -ForegroundColor Red
  }

  function Find-Route($routes, $pattern) {
    if (-not $routes) { return $null }
    return ($routes | Where-Object {
      ($_.method -match "GET") -and ($_.uri -match $pattern)
    } | Select-Object -First 1)
  }

  $homepageRoute = Find-Route $routes '^api/v1/\{locale\}/homepage$'
  $categoriesRoute = Find-Route $routes '^api/v1/\{locale\}/categories$'
  $categoryShowRoute = Find-Route $routes '^api/v1/\{locale\}/categories/\{slug\}$'
  $articlesRoute = Find-Route $routes '^api/v1/\{locale\}/articles$'
  $articleShowRoute = Find-Route $routes '^api/v1/\{locale\}/articles/\{slug\}$'

  $discovered = [PSCustomObject]@{
    homepage      = $(if ($homepageRoute) { $homepageRoute.uri } else { $null })
    categories    = $(if ($categoriesRoute) { $categoriesRoute.uri } else { $null })
    category_show = $(if ($categoryShowRoute) { $categoryShowRoute.uri } else { $null })
    articles      = $(if ($articlesRoute) { $articlesRoute.uri } else { $null })
    article_show  = $(if ($articleShowRoute) { $articleShowRoute.uri } else { $null })
  }
  Save "02-discovered-routes.json" ($discovered | ConvertTo-Json)

  $locale = "ar"
  function Build-Url($routeUriTemplate) {
    if (-not $routeUriTemplate) { return $null }
    $path = $routeUriTemplate -replace '\{locale\}', $locale
    return "http://localhost:8080/$path"
  }

  $homepageUrl   = Build-Url $homepageRoute.uri
  $categoriesUrl = Build-Url $categoriesRoute.uri
  $articlesUrl   = Build-Url $articlesRoute.uri

  if ($homepageUrl)   { $results += Time-Url "backend: $($homepageRoute.uri)" $homepageUrl }
  else                { Write-Host "  تخطّي homepage — لم يُعثر على Route مطابق GET api/v1/{locale}/homepage." -ForegroundColor DarkYellow }

  if ($categoriesUrl) { $results += Time-Url "backend: $($categoriesRoute.uri)" $categoriesUrl }
  else                { Write-Host "  تخطّي categories — لم يُعثر على Route مطابق." -ForegroundColor DarkYellow }

  if ($articlesUrl)   { $results += Time-Url "backend: $($articlesRoute.uri)" $articlesUrl }
  else                { Write-Host "  تخطّي articles — لم يُعثر على Route مطابق." -ForegroundColor DarkYellow }

  # اكتشاف slug فعلي من استجابة قائمة المقالات/التصنيفات (بعد إصلاح المسار)
  $catSlug = $null; $artSlug = $null
  if ($categoriesUrl) {
    $catJson = curl.exe -s $categoriesUrl 2>&1
    Save "02-raw-categories-sample.json" $catJson
    try { $catSlug = (($catJson | ConvertFrom-Json).data[0].slug) } catch {}
  }
  if ($articlesUrl) {
    $artJson = curl.exe -s $articlesUrl 2>&1
    Save "02-raw-articles-sample.json" $artJson
    try { $artSlug = (($artJson | ConvertFrom-Json).data[0].slug) } catch {}
  }
  Write-Host "  slug تصنيف مُكتشَف: $catSlug   |  slug مقال مُكتشَف: $artSlug"

  if ($artSlug -and $articleShowRoute) {
    $u = Build-Url ($articleShowRoute.uri -replace '\{slug\}', $artSlug)
    $results += Time-Url "backend: $($articleShowRoute.uri)" $u
  }
  if ($catSlug -and $categoryShowRoute) {
    $u = Build-Url ($categoryShowRoute.uri -replace '\{slug\}', $catSlug)
    $results += Time-Url "backend: $($categoryShowRoute.uri)" $u
  }

  $results += Time-Url "frontend: / (homepage)" "http://localhost:3000/"
  if ($catSlug) { $results += Time-Url "frontend: /category/{slug}" "http://localhost:3000/category/$catSlug" }
  if ($artSlug) { $results += Time-Url "frontend: /articles/{slug}" "http://localhost:3000/articles/$artSlug" }
  $results += Time-Url "frontend: /search?q=test" "http://localhost:3000/search?q=test"
  $results += Time-Url "admin: /" "http://localhost:8081/"

  Save "02-http-timing.json" ($results | ConvertTo-Json -Depth 5)
  Write-Host "  ملاحظة: هذا يقيس TTFB/الزمن الكلي لكل مسار — لا يفكّك الزمن داخل Laravel"
  Write-Host "  (middleware/controller/view منفصلة) لأن لا Telescope/Pulse/Debugbar مثبَّت."
  Write-Host "  راجع README.md في نفس المجلد لخيار تفعيل ذلك."
}

# ---------------------------------------------------------------------------
# PHASE 3 — Database
# ---------------------------------------------------------------------------
if ($Only -contains 3) {
  Section "Phase 3 — Database Profiling"

  $body = @'
echo json_encode([
    "driver" => DB::connection()->getDriverName(),
    "database" => DB::connection()->getDatabaseName(),
    "tables_approx" => count(DB::select("SHOW TABLE STATUS")),
]);
'@
  Save "03-db-connection-info.json" (Invoke-Tinker $body)

  $body = @'
$rows = DB::select(
    "SHOW GLOBAL STATUS WHERE Variable_name IN (?,?,?,?,?,?,?,?)",
    ["Questions","Slow_queries","Threads_connected","Uptime","Com_select","Com_insert","Com_update","Com_delete"]
);
echo json_encode($rows);
'@
  Save "03-db-global-status-before.json" (Invoke-Tinker $body)

  # EXPLAIN على استعلام قائمة المقالات (الأكثر ترجيحاً للمسح الكامل حسب التقارير السابقة)
  $body = @'
if (Schema::hasTable("articles") && Schema::hasColumn("articles", "status")) {
    $q = DB::table("articles")->where("status", "published")->orderByDesc("published_at")->limit(20);
    $sql = "EXPLAIN " . $q->toSql();
    echo json_encode(DB::select($sql, $q->getBindings()));
} else {
    echo json_encode(["error" => "articles table or status column not found"]);
}
'@
  Save "03-explain-articles-listing.json" (Invoke-Tinker $body)

  $body = @'
echo json_encode(
    Schema::hasTable("articles")
        ? DB::select("SHOW INDEX FROM articles")
        : ["error" => "no articles table"]
);
'@
  Save "03-indexes-articles.json" (Invoke-Tinker $body)

  if (-not $SkipSlowLog) {
    Write-Host "  تفعيل مؤقت لـ slow_query_log (long_query_time=0 لالتقاط كل استعلام) لمدة قياس واحدة فقط..."
    Invoke-Tinker @'
DB::statement("SET GLOBAL slow_query_log = 1");
DB::statement("SET GLOBAL long_query_time = 0");
echo "enabled";
'@ | Out-Null

    $questionsBody = @'
echo DB::selectOne("SHOW GLOBAL STATUS LIKE ?", ["Questions"])->Value;
'@

    # قياس عدد الاستعلامات لكل طلب: Questions قبل/بعد N طلبات على نفس المسار
    $rawBefore = (Invoke-Tinker $questionsBody).Trim()
    1..10 | ForEach-Object { curl.exe -s -o NUL "http://localhost:8080/api/v1/$locale/homepage" }
    Start-Sleep -Seconds 1
    $rawAfter = (Invoke-Tinker $questionsBody).Trim()

    $before = 0; $after = 0
    $beforeOk = [int]::TryParse($rawBefore, [ref]$before)
    $afterOk  = [int]::TryParse($rawAfter, [ref]$after)
    if ($beforeOk -and $afterOk) {
      $perRequest = [math]::Round(($after - $before) / 10, 1)
      Save "03-avg-queries-per-homepage-request.txt" "Questions before=$before after=$after delta=$($after-$before) avg_per_request(10 calls)=$perRequest"
    } else {
      Save "03-avg-queries-per-homepage-request.txt" "تعذّر تحليل الناتج كرقم — raw_before='$rawBefore' raw_after='$rawAfter'"
    }

    Write-Host "  إعادة تعطيل slow_query_log (لن يبقى مفعّلاً بعد هذا السكربت)..."
    Invoke-Tinker @'
DB::statement("SET GLOBAL slow_query_log = 0");
echo "disabled";
'@ | Out-Null
  } else {
    Write-Host "  تم تخطي قسم slow_query_log (-SkipSlowLog)."
  }
}

# ---------------------------------------------------------------------------
# PHASE 5 — Redis  (Redis:: مؤهَّل بالكامل — امتداد phpredis يسجّل \Redis عاماً
# يتصادم مع اسم واجهة Laravel القصير، فالعاري Redis:: يحل لصنف phpredis لا
# لواجهة Laravel؛ مؤكَّد من تشغيل فعلي: "Call to undefined method Redis::
# connection()")
# ---------------------------------------------------------------------------
if ($Only -contains 5) {
  Section "Phase 5 — Redis"

  $body = @'
echo json_encode(\Illuminate\Support\Facades\Redis::connection()->info());
'@
  Save "05-redis-info-full.json" (Invoke-Tinker $body)

  $body = @'
echo json_encode([
    "dbsize" => \Illuminate\Support\Facades\Redis::connection()->dbsize(),
    "prefix" => config("database.redis.options.prefix"),
]);
'@
  Save "05-redis-dbsize-prefix.json" (Invoke-Tinker $body)

  # مفاتيح كبيرة (عيّنة — SCAN آمن، لا KEYS *)
  $body = @'
$scan = \Illuminate\Support\Facades\Redis::connection()->scan(0, ["count" => 200]);
echo json_encode($scan[1] ?? []);
'@
  Save "05-redis-sample-keys.json" (Invoke-Tinker $body)
}

# ---------------------------------------------------------------------------
# PHASE 6 — Meilisearch
# ---------------------------------------------------------------------------
if ($Only -contains 6) {
  Section "Phase 6 — Meilisearch"

  $envLine = Get-Content ".env" | Where-Object { $_ -match "^MEILISEARCH_KEY=" }
  $key = ($envLine -split "=",2)[1]

  $health = curl.exe -s "http://localhost:7700/health" 2>&1
  Save "06-meilisearch-health.json" $health

  $stats = curl.exe -s -H "Authorization: Bearer $key" "http://localhost:7700/stats" 2>&1
  Save "06-meilisearch-stats.json" $stats

  $indexes = curl.exe -s -H "Authorization: Bearer $key" "http://localhost:7700/indexes" 2>&1
  Save "06-meilisearch-indexes.json" $indexes

  Write-Host "  قياس زمن بحث فعلي (5 عيّنات) على فهرس articles_index (إن وُجد)..."
  $searchTimes = @()
  for ($i = 0; $i -lt 5; $i++) {
    $t = curl.exe -s -o NUL -w "%{time_total}" -H "Authorization: Bearer $key" -H "Content-Type: application/json" -d '{"q":"test"}' "http://localhost:7700/indexes/articles_index/search"
    $searchTimes += "${t}s"
  }
  Save "06-meilisearch-search-timing.txt" ($searchTimes -join "`n")
}

# ---------------------------------------------------------------------------
# PHASE 7 — Workers / Queue
# ---------------------------------------------------------------------------
if ($Only -contains 7) {
  Section "Phase 7 — Workers"

  $body = @'
echo json_encode([
    "failed_jobs" => Schema::hasTable("failed_jobs") ? DB::table("failed_jobs")->count() : "n/a",
    "jobs_table_pending" => Schema::hasTable("jobs") ? DB::table("jobs")->count() : "n/a",
]);
'@
  Save "07-queue-db-state.json" (Invoke-Tinker $body)

  $body = @'
$names = ["default","notifications","mail","search","sitemap","ai","analytics","media"];
$depths = [];
foreach ($names as $n) {
    $depths[$n] = \Illuminate\Support\Facades\Redis::connection()->llen("queues:" . $n);
}
echo json_encode($depths);
'@
  Save "07-queue-depth-per-queue.json" (Invoke-Tinker $body)

  $failed = docker compose exec -T worker php artisan queue:failed 2>&1 | Out-String
  Save "07-queue-failed-list.txt" $failed

  Save "07-worker-logs-tail.txt" (docker compose logs worker --tail=100 2>&1 | Out-String)
  Save "07-worker-media-logs-tail.txt" (docker compose logs worker-media --tail=100 2>&1 | Out-String)
}

# ---------------------------------------------------------------------------
# PHASE 8 — Docker Runtime
# ---------------------------------------------------------------------------
if ($Only -contains 8) {
  Section "Phase 8 — Docker Runtime"

  Save "08-docker-system-df.txt" (docker system df -v 2>&1 | Out-String)
  Save "08-docker-compose-top.txt" (docker compose top 2>&1 | Out-String)

  $vols = docker volume ls --format json 2>&1 | Out-String
  Save "08-docker-volumes.json" $vols
}

# ---------------------------------------------------------------------------
# التحقق الذاتي من الجودة — "انتهى" لا يعني "نجح". انظر التعليق أعلى الدالة.
# ---------------------------------------------------------------------------
Write-Host "`n=== فحص جودة النتائج تلقائياً... ===" -ForegroundColor Cyan
$verdict = Test-AuditQuality $outDir $Only

Write-Host ""
if ($verdict.Passed) {
  Write-Host "=== PASS — كل شروط الجودة الأربعة مستوفاة تلقائياً. ===" -ForegroundColor Green
  Write-Host "أرسل مجلد $outDir كاملاً للتحليل." -ForegroundColor Green
} else {
  Write-Host "=== FAIL — $($verdict.Problems.Count) مشكلة لم تُحل بعد: ===" -ForegroundColor Red
  foreach ($p in $verdict.Problems) { Write-Host "  - $p" -ForegroundColor Red }
}
if ($verdict.Warnings.Count -gt 0) {
  Write-Host "تحذيرات (لا تُسقط PASS):" -ForegroundColor DarkYellow
  foreach ($w in $verdict.Warnings) { Write-Host "  - $w" -ForegroundColor DarkYellow }
}
Write-Host "التقرير الكامل: $($verdict.VerdictPath)"

if (-not $verdict.Passed) { exit 1 }
