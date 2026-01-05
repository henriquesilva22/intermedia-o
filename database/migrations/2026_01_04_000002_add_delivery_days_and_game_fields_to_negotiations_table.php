<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            if (!Schema::hasColumn('negotiations', 'delivery_days')) {
                $table->unsignedSmallInteger('delivery_days')->nullable();
            }
            if (!Schema::hasColumn('negotiations', 'game_title')) {
                $table->string('game_title', 120)->nullable();
            }
            if (!Schema::hasColumn('negotiations', 'item_name')) {
                $table->string('item_name', 160)->nullable();
            }
            if (!Schema::hasColumn('negotiations', 'item_general_info')) {
                $table->string('item_general_info', 1000)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            $columns = [
                'delivery_days',
                'game_title',
                'item_name',
                'item_general_info',
            ];

            foreach ($columns as $col) {
                if (Schema::hasColumn('negotiations', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
