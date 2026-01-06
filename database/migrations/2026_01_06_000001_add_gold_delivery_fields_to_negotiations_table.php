<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            if (! Schema::hasColumn('negotiations', 'gold_buyer_character_name')) {
                $table->string('gold_buyer_character_name', 120)->nullable()->after('digital_delivery_overdue_buyer_alerted_at');
            }
            if (! Schema::hasColumn('negotiations', 'gold_buyer_server')) {
                $table->string('gold_buyer_server', 120)->nullable()->after('gold_buyer_character_name');
            }
            if (! Schema::hasColumn('negotiations', 'gold_buyer_faction')) {
                $table->string('gold_buyer_faction', 60)->nullable()->after('gold_buyer_server');
            }
            if (! Schema::hasColumn('negotiations', 'gold_buyer_availability')) {
                $table->text('gold_buyer_availability')->nullable()->after('gold_buyer_faction');
            }
            if (! Schema::hasColumn('negotiations', 'gold_buyer_notes')) {
                $table->text('gold_buyer_notes')->nullable()->after('gold_buyer_availability');
            }
            if (! Schema::hasColumn('negotiations', 'gold_buyer_info_submitted_at')) {
                $table->timestamp('gold_buyer_info_submitted_at')->nullable()->after('gold_buyer_notes');
            }

            if (! Schema::hasColumn('negotiations', 'gold_seller_availability')) {
                $table->text('gold_seller_availability')->nullable()->after('gold_buyer_info_submitted_at');
            }
            if (! Schema::hasColumn('negotiations', 'gold_seller_delivery_method')) {
                $table->string('gold_seller_delivery_method', 20)->nullable()->after('gold_seller_availability');
            }
            if (! Schema::hasColumn('negotiations', 'gold_seller_info_submitted_at')) {
                $table->timestamp('gold_seller_info_submitted_at')->nullable()->after('gold_seller_delivery_method');
            }

            if (! Schema::hasColumn('negotiations', 'gold_schedule_confirmed_at')) {
                $table->timestamp('gold_schedule_confirmed_at')->nullable()->after('gold_seller_info_submitted_at');
            }

            if (! Schema::hasColumn('negotiations', 'gold_buyer_reschedule_request')) {
                $table->text('gold_buyer_reschedule_request')->nullable()->after('gold_schedule_confirmed_at');
            }
            if (! Schema::hasColumn('negotiations', 'gold_buyer_reschedule_requested_at')) {
                $table->timestamp('gold_buyer_reschedule_requested_at')->nullable()->after('gold_buyer_reschedule_request');
            }
        });
    }

    public function down(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            $columns = [
                'gold_buyer_character_name',
                'gold_buyer_server',
                'gold_buyer_faction',
                'gold_buyer_availability',
                'gold_buyer_notes',
                'gold_buyer_info_submitted_at',
                'gold_seller_availability',
                'gold_seller_delivery_method',
                'gold_seller_info_submitted_at',
                'gold_schedule_confirmed_at',
                'gold_buyer_reschedule_request',
                'gold_buyer_reschedule_requested_at',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('negotiations', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
