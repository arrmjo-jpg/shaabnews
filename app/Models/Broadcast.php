<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\BroadcastKind;
use App\Enums\BroadcastSourceType;
use App\Enums\BroadcastStatus;
use App\Support\Audit\AuditsChanges;
use App\Support\Broadcast\BroadcastNotifier;
use App\Support\Content\PublicSeoBuilder;
use App\Support\Content\SlugGenerator;
use App\Support\Engagement\HasEngagement;
use App\Support\Search\ResilientSearchable;
use Cviebrock\EloquentSluggable\Sluggable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * البثّ — نطاق مستقل (بثّ خارجي موثوق فقط). kind (live|tv|radio) تحريري منفصل عن
 * source_type التقني. uuid + slug (فريد عام، عربي-المحافظة) تلقائيان. تفاعل/منارة/
 * حضور تُضاف في مراحل لاحقة (B5/B7). عدّاد المشاهدين هنا لقطة فقط (DB snapshot).
 */
class Broadcast extends Model
{
    use AuditsChanges;
    use HasEngagement;
    use HasFactory;
    use ResilientSearchable;
    use Sluggable;
    use SoftDeletes;

    protected string $auditLogName = 'broadcast';

    /** @var array<int,string> يُدقَّق الحالة/الوصف فقط (لا أسرار). */
    protected array $auditAttributes = [
        'status', 'kind', 'source_type', 'source_url', 'title', 'slug',
        'is_featured', 'is_public', 'category_id', 'scheduled_at', 'started_at', 'ended_at', 'sort_order',
        'seo_title', 'seo_description', 'seo_keywords', 'canonical_url', 'robots', 'vod_video_id',
        'cover_media_id',
    ];

    protected $fillable = [
        'uuid', 'title', 'slug', 'excerpt', 'description',
        'kind', 'source_type', 'source_url', 'status', 'category_id', 'vod_video_id',
        'thumbnail_path', 'poster_path', 'cover_media_id',
        'seo_title', 'seo_description', 'seo_keywords', 'canonical_url', 'robots',
        'scheduled_at', 'started_at', 'ended_at',
        'last_health_check_at', 'last_health_status', 'last_health_message', 'health_consecutive_failures',
        'live_notified_at', 'reminder_dispatched_at',
        'viewer_count', 'sort_order', 'is_featured', 'is_public', 'meta',
        'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => BroadcastStatus::class,
            'kind' => BroadcastKind::class,
            'source_type' => BroadcastSourceType::class,
            'is_featured' => 'boolean',
            'is_public' => 'boolean',
            'viewer_count' => 'integer',
            'sort_order' => 'integer',
            'scheduled_at' => 'datetime',
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'last_health_check_at' => 'datetime',
            'live_notified_at' => 'datetime',
            'reminder_dispatched_at' => 'datetime',
            'health_consecutive_failures' => 'integer',
            'meta' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $broadcast): void {
            if (empty($broadcast->uuid)) {
                $broadcast->uuid = (string) Str::uuid();
            }
        });

        // إشعارات البثّ (B8) — منفذٌ وحيد لإطلاق الإشعار يغطّي كل مسارات الانتقال
        // (يدويّ/مجدوَل/استئناف/استرجاع صحّي) بلا تكرار. مانع الارتعاش داخل المنسّق.
        static::updated(function (self $broadcast): void {
            if ($broadcast->wasChanged('status') && $broadcast->status === BroadcastStatus::Live) {
                BroadcastNotifier::dispatchLiveIfNeeded($broadcast);
            }

            if ($broadcast->wasChanged('scheduled_at')) {
                BroadcastNotifier::resetReminderMarker($broadcast);
            }
        });
    }

    /** @return array<string, array<string, mixed>> */
    public function sluggable(): array
    {
        return [
            'slug' => [
                'source' => 'title',
                'unique' => true,
                'includeTrashed' => true,
                'maxLength' => 190,
                'method' => [self::class, 'arabicSlug'],
            ],
        ];
    }

    public static function arabicSlug(string $string, string $separator): string
    {
        return SlugGenerator::makeWithFallback($string, $separator);
    }

    // ─── Relationships ──────────────────────────────────────────────

    public function category(): BelongsTo
    {
        return $this->belongsTo(BroadcastCategory::class, 'category_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /** ربط VOD اختياري — تسجيل نهائي في مكتبة الفيديو (نطاق مستقل, لا اقتران بنيوي). */
    public function vodVideo(): BelongsTo
    {
        return $this->belongsTo(Video::class, 'vod_video_id');
    }

    /** غلاف اختياري من مكتبة الوسائط المركزية (رفع/اختيار) — مرآة BroadcastCategory::cover. */
    public function cover(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'cover_media_id');
    }

    /** اشتراكات تذكير هذا البثّ (B8) — لعدّ مشتركي التذكير في لوحة القيادة. */
    public function notificationSubscriptions(): HasMany
    {
        return $this->hasMany(BroadcastNotificationSubscription::class);
    }

    // ─── Public visibility scopes (B4) ──────────────────────────────
    //
    // قراران منفصلان للسطح العام (موثَّقان عمداً):
    //  • صفحة التفاصيل (slug): تُعرَض لأي بثّ عام ليس مسودّة/مؤرشفاً — أي
    //    live/scheduled/offline/ended/failed كلها لها صفحة (المورد يقرّر ما يُكشَف).
    //  • القوائم: تعتمد على النوع — live أحداث عابرة (scheduled|live)؛ tv/radio وجهات
    //    دليلية دائمة تبقى ظاهرة رغم offline/failed (انظر scopePubliclyListed أدناه).

    /** بوّابة صفحة التفاصيل: عام + ليس مسودّة/مؤرشفاً (كل الأنواع). */
    public function scopePubliclyVisible(Builder $query): Builder
    {
        return $query->where('is_public', true)->whereNotIn('status', [
            BroadcastStatus::Draft->value,
            BroadcastStatus::Archived->value,
        ]);
    }

    /**
     * بوّابة القوائم العامة — تعتمد على النوع:
     *   • live (أحداث عابرة): scheduled|live فقط.
     *   • tv|radio (وجهات دليلية دائمة): scheduled|live|offline|failed — تبقى القناة
     *     ظاهرة في الدليل رغم العُطل المؤقّت. تُستبعَد دائماً draft/archived/ended.
     */
    public function scopePubliclyListed(Builder $query, string $kind): Builder
    {
        $statuses = $kind === BroadcastKind::Live->value
            ? [BroadcastStatus::Scheduled->value, BroadcastStatus::Live->value]
            : [
                BroadcastStatus::Scheduled->value,
                BroadcastStatus::Live->value,
                BroadcastStatus::Offline->value,
                BroadcastStatus::Failed->value,
            ];

        return $query->where('is_public', true)->ofKind($kind)->whereIn('status', $statuses);
    }

    public function scopeOfKind(Builder $query, string $kind): Builder
    {
        return $query->where('kind', $kind);
    }

    // ─── SEO / sharing (نفس نمط المقال/الفيديو) ─────────────────────

    /** المسار القانوني المستقرّ: /{kind}/{slug} (عربي فقط — لا بادئة لغة). */
    public function canonicalPath(): string
    {
        return '/'.trim("{$this->kind->routeSegment()}/{$this->slug}", '/');
    }

    /**
     * صورة المشاركة (OG): غلاف مكتبة الوسائط (مرفوع/مُختار) أولاً، ثم رابط خارجي
     * احتياطي (poster ثم thumbnail) — مطلقاً كما هو أو نسبياً يُجعَل مطلقاً على app.url.
     */
    public function shareImageUrl(): ?string
    {
        // 1) غلاف من مكتبة الوسائط المركزية (رفع/اختيار) — المصدر المُفضَّل. يستخدم
        //    العلاقة المُحمَّلة مسبقاً متى توفّرت (آمن من N+1 في القوائم).
        if ($this->cover_media_id !== null) {
            $asset = $this->relationLoaded('cover') ? $this->cover : $this->cover()->first();
            $url = $asset?->posterUrl() ?? $asset?->url();
            if ($url !== null && $url !== '') {
                return $url;
            }
        }

        // 2) احتياطي رابط خارجي (poster ثم thumbnail) — يبقى دعماً للروابط الخارجية.
        $image = $this->poster_path !== null && $this->poster_path !== ''
            ? $this->poster_path
            : $this->thumbnail_path;

        if ($image === null || $image === '') {
            return null;
        }

        return str_starts_with($image, 'http://') || str_starts_with($image, 'https://')
            ? $image
            : PublicSeoBuilder::absoluteUrl($image);
    }

    // ─── Scout (فهرسة فاشلة-آمنة عبر ResilientSearchable — Task 10) ──

    /** فهرس مستقلّ (إعداداته في config/scout.php → meilisearch.index-settings). */
    public function searchableAs(): string
    {
        return 'broadcasts_index';
    }

    /**
     * يُفهرَس البثّ العامّ المباشر أو المنتهي (VOD) فقط — لا مسودّة/مجدوَل/غير
     * متّصل/فاشل/مؤرشف (حالات غير عامّة أو انتقاليّة).
     */
    public function shouldBeSearchable(): bool
    {
        return $this->deleted_at === null
            && $this->is_public === true
            && in_array($this->status, [BroadcastStatus::Live, BroadcastStatus::Ended], true);
    }

    /** @return array<string,mixed> */
    public function toSearchableArray(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => (string) $this->description,
            'excerpt' => (string) $this->excerpt,
            'kind' => $this->kind->value,
            'status' => $this->status->value,
            'is_featured' => $this->is_featured,
            'is_public' => $this->is_public,
            'category_id' => $this->category_id,
            'started_at' => $this->started_at?->getTimestamp(),
            'scheduled_at' => $this->scheduled_at?->getTimestamp(),
        ];
    }
}
