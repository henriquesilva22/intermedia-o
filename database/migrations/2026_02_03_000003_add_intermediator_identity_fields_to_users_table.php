<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'intermediator_code')) {
                $table->unsignedInteger('intermediator_code')->nullable()->unique()->after('role');
            }
            if (!Schema::hasColumn('users', 'is_intermediator_principal')) {
                $table->boolean('is_intermediator_principal')->default(false)->after('intermediator_code');
            }
        });

        // Backfill codes for existing intermediators that don't have one yet.
        try {
            DB::statement('SET @i := 0');
            DB::statement("UPDATE users SET intermediator_code = (@i := @i + 1) WHERE role = 'intermediator' AND intermediator_code IS NULL ORDER BY id");
        } catch (Throwable $e) {
            // Ignore backfill errors; codes can be set via seeder/admin UI.
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'is_intermediator_principal')) {
                $table->dropColumn('is_intermediator_principal');
            }
            if (Schema::hasColumn('users', 'intermediator_code')) {
                $table->dropUnique(['intermediator_code']);
                $table->dropColumn('intermediator_code');
            }
        });
    }
};
