<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            if (! Schema::hasColumn('negotiations', 'service_seller_start_date_options')) {
                $table->json('service_seller_start_date_options')->nullable()->after('delivery_days');
            }
            if (! Schema::hasColumn('negotiations', 'service_seller_time_range_options')) {
                $table->json('service_seller_time_range_options')->nullable()->after('service_seller_start_date_options');
            }
            if (! Schema::hasColumn('negotiations', 'service_buyer_selected_start_date')) {
                $table->date('service_buyer_selected_start_date')->nullable()->after('service_seller_time_range_options');
            }
            if (! Schema::hasColumn('negotiations', 'service_buyer_selected_time_range')) {
                $table->string('service_buyer_selected_time_range', 120)->nullable()->after('service_buyer_selected_start_date');
            }
            if (! Schema::hasColumn('negotiations', 'service_schedule_confirmed_at')) {
                $table->timestamp('service_schedule_confirmed_at')->nullable()->after('service_buyer_selected_time_range');
            }
        });
    }

    public function down(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            $columns = [
                'service_seller_start_date_options',
                'service_seller_time_range_options',
                'service_buyer_selected_start_date',
                'service_buyer_selected_time_range',
                'service_schedule_confirmed_at',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('negotiations', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
