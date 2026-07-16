<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Contracts;

use App\Modules\Notifications\Enums\AudienceType;
use App\Modules\Notifications\Support\AudienceResult;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * مُحلِّل جمهور — يصف الجمهور **محايداً للقناة** (AudienceResult: سبيك نقيّ قابل للتسلسل). لا يعرف
 * القنوات ولا العنونة. describe() يُعيد السبيك (يعبر الطوابير/الكاش بأمان)؛ userQuery/deviceQuery
 * يبنيان الاستعلام **الحيّ** من السبيك **وقت التنفيذ** (عابر، يُستهلَك فورًا داخل الـjob، لا يُسلسَل
 * أبدًا) — فلا Builder يعبر حدّ تسلسل. ChannelBinder يستهلكهما لإنتاج RecipientBatch لكلّ قناة.
 */
interface AudienceResolver
{
    public function type(): AudienceType;

    /**
     * سبيك الجمهور القابل للتسلسل (+ تقدير العدّ). لا استعلامات حيّة هنا.
     *
     * @param  array<string,mixed>  $params
     */
    public function describe(array $params): AudienceResult;

    /**
     * استعلام المستخدمين الحيّ من السبيك (per-recipient: email/whatsapp/push-لأجهزتهم).
     * null = جمهور topic-only أو غير قائم على مستخدمين. يُبنى وقت التنفيذ، لا يُسلسَل.
     *
     * @return Builder<Model>|null
     */
    public function userQuery(AudienceResult $audience): ?Builder;

    /**
     * استعلام الأجهزة الحيّ من السبيك (cohorts الأجهزة: android/ios/guests ⇒ push tokens).
     * null = غير قائم على أجهزة. يُبنى وقت التنفيذ، لا يُسلسَل.
     *
     * @return Builder<Model>|null
     */
    public function deviceQuery(AudienceResult $audience): ?Builder;
}
