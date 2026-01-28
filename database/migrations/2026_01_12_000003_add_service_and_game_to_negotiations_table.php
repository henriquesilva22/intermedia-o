<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('negotiations')) {
            return;
        }

        Schema::table('negotiations', function (Blueprint $table) {
            if (! Schema::hasColumn('negotiations', 'service_id')) {
                $table->string('service_id', 80)->nullable()->after('category');
                $table->index('service_id');
            }
            if (! Schema::hasColumn('negotiations', 'game_id')) {
                $table->string('game_id', 80)->nullable()->after('service_id');
                $table->index('game_id');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('negotiations')) {
            return;
        }

        Schema::table('negotiations', function (Blueprint $table) {
            if (Schema::hasColumn('negotiations', 'game_id')) {
                $table->dropIndex(['game_id']);
                $table->dropColumn('game_id');
            }
            if (Schema::hasColumn('negotiations', 'service_id')) {
                $table->dropIndex(['service_id']);
                $table->dropColumn('service_id');
            }
        });
    }
};
