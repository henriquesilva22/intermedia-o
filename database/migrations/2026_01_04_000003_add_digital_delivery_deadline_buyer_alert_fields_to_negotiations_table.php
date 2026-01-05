<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            $table->timestamp('digital_delivery_overdue_buyer_alerted_at')->nullable()->after('digital_delivery_overdue_alerted_at');
            $table->index('digital_delivery_overdue_buyer_alerted_at');
        });
    }

    public function down(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            $table->dropIndex(['digital_delivery_overdue_buyer_alerted_at']);
            $table->dropColumn(['digital_delivery_overdue_buyer_alerted_at']);
        });
    }
};
