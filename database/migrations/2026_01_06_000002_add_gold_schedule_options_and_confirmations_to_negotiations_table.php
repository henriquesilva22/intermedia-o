<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            if (! Schema::hasColumn('negotiations', 'gold_buyer_time_options')) {
                $table->json('gold_buyer_time_options')->nullable()->after('gold_buyer_availability');
            }
            if (! Schema::hasColumn('negotiations', 'gold_seller_time_options')) {
                $table->json('gold_seller_time_options')->nullable()->after('gold_seller_availability');
            }
            if (! Schema::hasColumn('negotiations', 'gold_buyer_selected_time')) {
                $table->string('gold_buyer_selected_time', 120)->nullable()->after('gold_seller_time_options');
            }

            if (! Schema::hasColumn('negotiations', 'gold_buyer_received_confirmed_at')) {
                $table->timestamp('gold_buyer_received_confirmed_at')->nullable()->after('gold_schedule_confirmed_at');
            }
            if (! Schema::hasColumn('negotiations', 'gold_seller_sent_confirmed_at')) {
                $table->timestamp('gold_seller_sent_confirmed_at')->nullable()->after('gold_buyer_received_confirmed_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            $columns = [
                'gold_buyer_time_options',
                'gold_seller_time_options',
                'gold_buyer_selected_time',
                'gold_buyer_received_confirmed_at',
                'gold_seller_sent_confirmed_at',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('negotiations', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
