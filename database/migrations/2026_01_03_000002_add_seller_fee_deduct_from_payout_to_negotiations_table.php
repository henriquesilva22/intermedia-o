<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            if (! Schema::hasColumn('negotiations', 'seller_fee_deduct_from_payout')) {
                $table->boolean('seller_fee_deduct_from_payout')->default(false);
            }
        });
    }

    public function down(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            if (Schema::hasColumn('negotiations', 'seller_fee_deduct_from_payout')) {
                $table->dropColumn('seller_fee_deduct_from_payout');
            }
        });
    }
};
