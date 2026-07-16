<?php

declare(strict_types=1);

namespace App\Actions\Admin\Settings\Media;

use App\Enums\MediaVisibility;
use App\Http\Resources\Admin\Settings\MediaResource;
use App\Models\MediaAsset;
use App\Models\User;
use App\Settings\GeneralSettings;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class UploadBrandingMediaAction
{
    private const FIELD_DIR = [
        'logo_light' => 'branding/logos',
        'logo_dark' => 'branding/logos',
        'logo_light_en' => 'branding/logos',
        'logo_dark_en' => 'branding/logos',
        'favicon' => 'branding/favicon',
        'watermark_image' => 'branding/watermarks',
    ];

    /**
     * @param  array<string, UploadedFile>  $files
     */
    public function handle(array $files, User $actor): JsonResponse
    {
        $settings = app(GeneralSettings::class);
        $created = [];
        $oldFiles = [];

        // كتابات الـ DB ذرّية؛ حذف ملفات الأصول القديمة يؤجَّل لما بعد الالتزام
        // حتى لا يُفقد ملف قديم بينما لا يزال مرجَعاً في حال التراجع.
        DB::transaction(function () use ($files, $actor, $settings, &$created, &$oldFiles): void {
            foreach (self::FIELD_DIR as $field => $dir) {
                if (! isset($files[$field])) {
                    continue;
                }

                $file = $files[$field];

                // حذف سجلّات الأصل السابق (DB فقط) وجمع مسارات ملفاتها
                $oldFiles = array_merge($oldFiles, $this->purgePreviousRows($field));

                $uuid = (string) Str::uuid();
                $extension = strtolower($file->getClientOriginalExtension());
                $path = Storage::disk('public')->putFileAs($dir, $file, "{$uuid}.{$extension}");

                [$width, $height] = $this->dimensions($file);

                MediaAsset::create([
                    'uuid' => $uuid,
                    'disk' => 'public',
                    'path' => $path,
                    'filename' => "{$uuid}.{$extension}",
                    'original_name' => $file->getClientOriginalName(),
                    'mime_type' => $file->getClientMimeType(),
                    'extension' => $extension,
                    'size' => $file->getSize(),
                    'width' => $width,
                    'height' => $height,
                    'metadata' => ['collection' => 'branding', 'field' => $field],
                    'visibility' => MediaVisibility::Public,
                    'uploaded_by' => $actor->id,
                ]);

                $settings->{$field} = $path;
                $created[] = MediaAsset::where('uuid', $uuid)->first();
            }

            $settings->save();
        });

        // بعد الالتزام: احذف ملفات الأصول القديمة وأبطل كاش الإعدادات
        foreach ($oldFiles as [$disk, $oldPath]) {
            Storage::disk($disk)->delete($oldPath);
        }
        Cache::tags(['settings'])->flush();

        return ApiResponse::success(
            __('media.branding_uploaded'),
            MediaResource::collection(collect($created))->resolve()
        );
    }

    /**
     * يحذف سجلّات الأصل السابق (DB فقط) ويُرجع [disk, path] لملفاتها
     * كي تُحذف بعد الالتزام بأمان.
     *
     * @return array<int, array{0:string,1:string}>
     */
    private function purgePreviousRows(string $field): array
    {
        $old = [];

        MediaAsset::query()
            ->where('metadata->collection', 'branding')
            ->where('metadata->field', $field)
            ->get()
            ->each(function (MediaAsset $asset) use (&$old): void {
                $old[] = [$asset->disk, $asset->path];
                $asset->delete();
            });

        return $old;
    }

    /**
     * @return array{0: ?int, 1: ?int}
     */
    private function dimensions(UploadedFile $file): array
    {
        $info = @getimagesize($file->getRealPath());

        return $info === false ? [null, null] : [$info[0] ?? null, $info[1] ?? null];
    }
}
