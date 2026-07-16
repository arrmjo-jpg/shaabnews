<?php

declare(strict_types=1);

namespace App\Support\Responses;

use Illuminate\Http\JsonResponse;

/**
 * المصدر الوحيد لتنسيق استجابات الـ API.
 * يُستخدم من: Controllers, Middleware, Exception Handler.
 *
 * Success: { success: true,  message, data, meta }
 * Error:   { success: false, message, errors }
 */
final class ApiResponse
{
    public static function success(
        string $message = '',
        mixed $data = [],
        int $status = 200,
        array $meta = []
    ): JsonResponse {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
            'meta' => $meta,
        ], $status, [], JSON_UNESCAPED_UNICODE);
    }

    public static function error(
        string $message = '',
        array $errors = [],
        int $status = 400
    ): JsonResponse {
        return response()->json([
            'success' => false,
            'message' => $message,
            'errors' => $errors,
        ], $status, [], JSON_UNESCAPED_UNICODE);
    }
}
