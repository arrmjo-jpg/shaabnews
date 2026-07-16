<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table): void {
            $table->index(['notifiable_type', 'notifiable_id', 'read_at'], 'notifications_notifiable_unread_idx');
        });

        Schema::table('article_url_history', function (Blueprint $table): void {
            $table->index('article_id', 'article_url_history_article_id_idx');
        });

        Schema::table('article_revisions', function (Blueprint $table): void {
            $table->index('editor_id', 'article_revisions_editor_id_idx');
        });
    }

    public function down(): void
    {
        Schema::table('article_revisions', function (Blueprint $table): void {
            $table->dropIndex('article_revisions_editor_id_idx');
        });

        Schema::table('article_url_history', function (Blueprint $table): void {
            $table->dropIndex('article_url_history_article_id_idx');
        });

        Schema::table('notifications', function (Blueprint $table): void {
            $table->dropIndex('notifications_notifiable_unread_idx');
        });
    }
};
