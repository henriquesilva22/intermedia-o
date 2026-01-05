<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            if (!Schema::hasColumn('negotiations', 'digital_quantity')) {
                $table->unsignedInteger('digital_quantity')->nullable()->after('category');
            }

            if (!Schema::hasColumn('negotiations', 'digital_game')) {
                $table->string('digital_game', 100)->nullable()->after('digital_quantity');
            }

            if (!Schema::hasColumn('negotiations', 'digital_currency_type')) {
                $table->string('digital_currency_type', 60)->nullable()->after('digital_game');
            }

            if (!Schema::hasColumn('negotiations', 'digital_platform_server')) {
                $table->string('digital_platform_server', 120)->nullable()->after('digital_currency_type');
            }

            if (!Schema::hasColumn('negotiations', 'digital_delivery_method')) {
                $table->string('digital_delivery_method', 30)->nullable()->after('digital_platform_server');
            }
        });
    }

    public function down(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            if (Schema::hasColumn('negotiations', 'digital_delivery_method')) {
                $table->dropColumn('digital_delivery_method');
            }

            if (Schema::hasColumn('negotiations', 'digital_platform_server')) {
                $table->dropColumn('digital_platform_server');
            }

            if (Schema::hasColumn('negotiations', 'digital_currency_type')) {
                $table->dropColumn('digital_currency_type');
            }

            if (Schema::hasColumn('negotiations', 'digital_game')) {
                $table->dropColumn('digital_game');
            }

            if (Schema::hasColumn('negotiations', 'digital_quantity')) {
                $table->dropColumn('digital_quantity');
            }
        });
    }
};
