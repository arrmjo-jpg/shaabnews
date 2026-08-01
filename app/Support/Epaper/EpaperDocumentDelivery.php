<?php

declare(strict_types=1);

namespace App\Support\Epaper;

use App\Models\Epaper;
use App\Models\MediaAsset;
use App\Support\Media\MediaUrl;
use App\Support\Media\RemoteStorage;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

/**
 * تسليم وثيقة العدد عبر روابط موقَّتة — الحماية من الـ hotlink هي التوقيع + القِصَر.
 * الأساسيّ: رابط R2/S3 موقَّع (presigned) يدعم Range ويُحمِّل من الحافة مباشرةً.
 * الاحتياطيّ الطارئ فقط: بثّ تطبيقيّ بمسار موقَّع (BinaryFileResponse يدعم Range/206)
 * حين يتعذّر التخزين البعيد. لا يفرض هذا الموصِّل الوصول — المتّصِل يفحص السياسة أولاً.
 */
final class EpaperDocumentDelivery
{
    public const VIEW_TTL = 900;     // ~15 دقيقة للقراءة

    public const DOWNLOAD_TTL = 60;  // ~60 ثانية للتنزيل

    /** @return array{url:string,expires_at:string} */
    public function viewUrl(Epaper $epaper): array
    {
        return $this->mint($epaper, self::VIEW_TTL, 'inline');
    }

    /** @return array{url:string,expires_at:string} */
    public function downloadUrl(Epaper $epaper): array
    {
        return $this->mint($epaper, self::DOWNLOAD_TTL, 'attachment');
    }

    public function filename(Epaper $epaper): string
    {
        return "{$epaper->locale}-issue-{$epaper->issue_number}.pdf";
    }

    /** @return array{url:string,expires_at:string} */
    private function mint(Epaper $epaper, int $ttl, string $disposition): array
    {
        $expiresAt = now()->addSeconds($ttl);
        $asset = $epaper->mediaAsset;

        // الأساسيّ: توقيع R2/S3 (presigned). حارس "لم يُمرَّ بعد": لا نوقّع إلا إذا كان
        // الكائن موجوداً فعلاً على البعيد (تفادي رابط يُعيد 404 قبل اكتمال المرآة).
        if ($asset !== null && RemoteStorage::enabled() && $this->remoteHas($asset)) {
            $options = ['ResponseContentType' => 'application/pdf'];
            if ($disposition === 'attachment') {
                $options['ResponseContentDisposition'] = 'attachment; filename="'.$this->filename($epaper).'"';
            }
            try {
                $url = Storage::disk(RemoteStorage::diskName())->temporaryUrl($asset->path, $expiresAt, $options);

                return ['url' => $url, 'expires_at' => $expiresAt->toISOString()];
            } catch (\Throwable) {
                // يرتدّ للبثّ التطبيقيّ الطارئ إن تعذّر التوقيع البعيد.
            }
        }

        // الاحتياطيّ الطارئ فقط: مسار موقَّع داخل التطبيق (يبثّ من القرص المحلّي مع Range).
        // جذر الرابط يُفرَض من MediaUrl::origin() (نفس أصل ملفّات public/storage) لا من مضيف الطلب
        // الوارد — Laravel افتراضياً يعكس ترويسة Host كما هي، وهذا الطلب قد يصل عبر قناة داخليّة
        // (Next.js rewrite/Docker DNS) لا تطابق الدومين العامّ الذي يجب أن يصل إليه متصفّح المستخدم.
        URL::forceRootUrl(MediaUrl::origin());
        $url = URL::temporarySignedRoute('epaper.document.stream', $expiresAt, [
            'epaper' => $epaper->id,
            'disposition' => $disposition,
        ]);

        return ['url' => $url, 'expires_at' => $expiresAt->toISOString()];
    }

    /**
     * هل الكائن موجود فعلاً على القرص البعيد؟ fail-safe: أي تعذّر ⇒ false (يرتدّ للمحلّي).
     *
     * مُخزَّن مؤقّتاً بالمسار (Enterprise — حِمل التسليم): كل تحميل قارئ كان يُطلِق طلب
     * HEAD إلى R2؛ تحت ذُروة عددٍ ساخن (آلاف القرّاء لنفس العدد) يصير ذلك آلاف الطلبات
     * المتطابقة. نُخزّن النتيجة بمدّتين غير متماثلتين: موجود ⇒ طويلاً (لا يختفي)، غير
     * موجود ⇒ قصيراً جداً (نلتقط اكتمال المرآة بعد النشر). المفتاح بالمسار فاستبدال
     * الـ PDF (مسار/نسخة جديدة) يُنتِج فحصاً طازجاً تلقائياً. التوقيع يبقى لكل طلب
     * (عمليّة محلّية رخيصة) فلا روابط مُشتركة ولا تعقيد.
     */
    private function remoteHas(MediaAsset $asset): bool
    {
        if ($asset->path === '') {
            return false;
        }

        $key = 'epaper:remote-exists:'.md5(RemoteStorage::diskName().'|'.$asset->path);
        $cached = Cache::get($key);
        if (is_bool($cached)) {
            return $cached;
        }

        try {
            $exists = Storage::disk(RemoteStorage::diskName())->exists($asset->path);
        } catch (\Throwable) {
            $exists = false;
        }

        Cache::put($key, $exists, $exists ? 1800 : 30);

        return $exists;
    }
}
