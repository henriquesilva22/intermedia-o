<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            if (! Schema::hasColumn('negotiations', 'game_account_first_owner')) {
                $table->boolean('game_account_first_owner')->nullable();
            }
            if (! Schema::hasColumn('negotiations', 'game_account_has_original_email')) {
                $table->boolean('game_account_has_original_email')->nullable();
            }
            if (! Schema::hasColumn('negotiations', 'game_account_linked_providers')) {
                $table->json('game_account_linked_providers')->nullable();
            }
            if (! Schema::hasColumn('negotiations', 'game_account_region')) {
                $table->string('game_account_region', 80)->nullable();
            }
            if (! Schema::hasColumn('negotiations', 'game_account_extras')) {
                $table->json('game_account_extras')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            if (Schema::hasColumn('negotiations', 'game_account_extras')) {
                $table->dropColumn('game_account_extras');
            }
            if (Schema::hasColumn('negotiations', 'game_account_region')) {
                $table->dropColumn('game_account_region');
            }
            if (Schema::hasColumn('negotiations', 'game_account_linked_providers')) {
                $table->dropColumn('game_account_linked_providers');
            }
            if (Schema::hasColumn('negotiations', 'game_account_has_original_email')) {
                $table->dropColumn('game_account_has_original_email');
            }
            if (Schema::hasColumn('negotiations', 'game_account_first_owner')) {
                $table->dropColumn('game_account_first_owner');
            }
        });
    }
};
