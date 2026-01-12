<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('payments')) {
            return;
        }

        // Add missing columns expected by the current Payment model/controller.
        if (! Schema::hasColumn('payments', 'description')) {
            Schema::table('payments', function (Blueprint $table) {
                $table->string('description', 255)->nullable()->after('type');
            });
        }

        if (! Schema::hasColumn('payments', 'currency')) {
            Schema::table('payments', function (Blueprint $table) {
                $table->string('currency', 3)->default('BRL')->after('amount');
            });
        }

        if (! Schema::hasColumn('payments', 'provider_reference')) {
            Schema::table('payments', function (Blueprint $table) {
                $table->string('provider_reference', 120)->nullable()->after('provider');
            });
        }

        if (! Schema::hasColumn('payments', 'meta')) {
            Schema::table('payments', function (Blueprint $table) {
                $table->json('meta')->nullable()->after('raw_payload');
            });
        }

        // Existing schema (from older versions) has stricter constraints that break new manual flows.
        // Make provider_charge_id nullable (unique index will still allow multiple NULLs in MySQL).
        if (Schema::hasColumn('payments', 'provider_charge_id')) {
            try {
                DB::statement("ALTER TABLE `payments` MODIFY `provider_charge_id` varchar(100) NULL");
            } catch (\Throwable $exception) {
                // ignore if the platform doesn't support MODIFY or the column differs
            }
        }

        // Ensure status has a default so inserts that don't set it won't crash.
        if (Schema::hasColumn('payments', 'status')) {
            try {
                DB::statement("ALTER TABLE `payments` MODIFY `status` enum('pending','confirmed','failed','canceled','refunded') NOT NULL DEFAULT 'pending'");
            } catch (\Throwable $exception) {
                // ignore if enum differs
            }
        }
    }

    public function down(): void
    {
        // Best-effort rollback only (do not try to revert column nullability without doctrine/dbal).
        if (! Schema::hasTable('payments')) {
            return;
        }

        Schema::table('payments', function (Blueprint $table) {
            if (Schema::hasColumn('payments', 'meta')) {
                $table->dropColumn('meta');
            }
            if (Schema::hasColumn('payments', 'provider_reference')) {
                $table->dropColumn('provider_reference');
            }
            if (Schema::hasColumn('payments', 'currency')) {
                $table->dropColumn('currency');
            }
            if (Schema::hasColumn('payments', 'description')) {
                $table->dropColumn('description');
            }
        });
    }
};
