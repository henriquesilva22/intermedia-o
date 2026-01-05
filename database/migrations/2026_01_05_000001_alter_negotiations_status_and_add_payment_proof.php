<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('negotiations')) {
            return;
        }

        // Fix for older schemas where `status` was an ENUM that doesn't include
        // newer values like `waiting_digital_delivery` (causes MySQL warning 1265).
        try {
            $driver = DB::getDriverName();
            if ($driver === 'mysql') {
                DB::statement("ALTER TABLE `negotiations` MODIFY `status` VARCHAR(40) NOT NULL");
            }
        } catch (Throwable $e) {
            // If this fails (permissions/driver), we keep going with column add.
        }

        Schema::table('negotiations', function (Blueprint $table) {
            if (! Schema::hasColumn('negotiations', 'buyer_payment_proof')) {
                $table->string('buyer_payment_proof')->nullable()->after('pix_generated_at');
            }
            if (! Schema::hasColumn('negotiations', 'buyer_payment_proof_uploaded_at')) {
                $table->timestamp('buyer_payment_proof_uploaded_at')->nullable()->after('buyer_payment_proof');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('negotiations')) {
            return;
        }

        Schema::table('negotiations', function (Blueprint $table) {
            if (Schema::hasColumn('negotiations', 'buyer_payment_proof_uploaded_at')) {
                $table->dropColumn('buyer_payment_proof_uploaded_at');
            }
            if (Schema::hasColumn('negotiations', 'buyer_payment_proof')) {
                $table->dropColumn('buyer_payment_proof');
            }
        });
    }
};
