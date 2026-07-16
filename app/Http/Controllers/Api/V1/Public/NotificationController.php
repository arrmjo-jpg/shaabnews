<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Public;

use App\Actions\Public\Notification\ListMyNotificationsAction;
use App\Actions\Public\Notification\MarkAllNotificationsReadAction;
use App\Actions\Public\Notification\MarkNotificationReadAction;
use App\Http\Controllers\Controller;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * إشعارات داخل التطبيق (database notifications) لكلّ مستخدم مُصادَق — لا «writer» فقط.
 * موصِّل رفيع بلا منطق أعمال — الحصر بالمالك داخل كل Action عبر علاقة Notifiable.
 */
class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return (new ListMyNotificationsAction)->handle($request->user(), $request);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        return ApiResponse::success(data: [
            'unread' => $request->user()->unreadNotifications()->count(),
        ]);
    }

    public function markRead(Request $request, string $notification): JsonResponse
    {
        return (new MarkNotificationReadAction)->handle($request->user(), $notification);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        return (new MarkAllNotificationsReadAction)->handle($request->user());
    }
}
