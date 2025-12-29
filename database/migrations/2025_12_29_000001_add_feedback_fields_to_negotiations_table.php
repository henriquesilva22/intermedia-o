<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            if (!Schema::hasColumn('negotiations', 'buyer_confirmed_at')) {
                $table->timestamp('buyer_confirmed_at')->nullable()->after('sent_to_buyer_at');
            }

            if (!Schema::hasColumn('negotiations', 'buyer_rating')) {
                $table->unsignedTinyInteger('buyer_rating')->nullable()->after('buyer_confirmed_at');
            }

            if (!Schema::hasColumn('negotiations', 'buyer_rating_note')) {
                $table->string('buyer_rating_note', 500)->nullable()->after('buyer_rating');
            }

            if (!Schema::hasColumn('negotiations', 'seller_rating')) {
                $table->unsignedTinyInteger('seller_rating')->nullable()->after('buyer_rating_note');
            }

            if (!Schema::hasColumn('negotiations', 'seller_rating_note')) {
                $table->string('seller_rating_note', 500)->nullable()->after('seller_rating');
            }

            if (!Schema::hasColumn('negotiations', 'intermediary_rating')) {
                $table->unsignedTinyInteger('intermediary_rating')->nullable()->after('seller_rating_note');
            }

            if (!Schema::hasColumn('negotiations', 'intermediary_rating_note')) {
                $table->string('intermediary_rating_note', 500)->nullable()->after('intermediary_rating');
            }
        });
    }

    public function down(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            foreach ([
                'intermediary_rating_note',
                'intermediary_rating',
                'seller_rating_note',
                'seller_rating',
                'buyer_rating_note',
                'buyer_rating',
                'buyer_confirmed_at',
            ] as $column) {
                if (Schema::hasColumn('negotiations', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
