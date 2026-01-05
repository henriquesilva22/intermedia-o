<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            if (! Schema::hasColumn('negotiations', 'battle_pass_game')) {
                $table->string('battle_pass_game', 100)->nullable();
            }
            if (! Schema::hasColumn('negotiations', 'battle_pass_platform')) {
                $table->string('battle_pass_platform', 60)->nullable();
            }
            if (! Schema::hasColumn('negotiations', 'battle_pass_type')) {
                $table->string('battle_pass_type', 120)->nullable();
            }
            if (! Schema::hasColumn('negotiations', 'battle_pass_duration_days')) {
                $table->unsignedInteger('battle_pass_duration_days')->nullable();
            }

            if (! Schema::hasColumn('negotiations', 'game_account_game')) {
                $table->string('game_account_game', 100)->nullable();
            }
            if (! Schema::hasColumn('negotiations', 'game_account_platform')) {
                $table->string('game_account_platform', 60)->nullable();
            }
            if (! Schema::hasColumn('negotiations', 'game_account_level')) {
                $table->string('game_account_level', 60)->nullable();
            }
            if (! Schema::hasColumn('negotiations', 'game_account_rank')) {
                $table->string('game_account_rank', 60)->nullable();
            }
            if (! Schema::hasColumn('negotiations', 'game_account_has_ban')) {
                $table->boolean('game_account_has_ban')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            $columns = [
                'battle_pass_game',
                'battle_pass_platform',
                'battle_pass_type',
                'battle_pass_duration_days',
                'game_account_game',
                'game_account_platform',
                'game_account_level',
                'game_account_rank',
                'game_account_has_ban',
            ];

            foreach ($columns as $col) {
                if (Schema::hasColumn('negotiations', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
