<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('negotiations')) {
            return;
        }

        Schema::table('negotiations', function (Blueprint $table) {
            // Esses campos existem na migration de create, mas podem faltar em bancos antigos
            // (porque a create tem early-return quando a tabela ja existe).
            if (! Schema::hasColumn('negotiations', 'description')) {
                $table->text('description')->nullable();
            }

            if (! Schema::hasColumn('negotiations', 'tracking_code')) {
                $table->string('tracking_code')->nullable();
            }
            if (! Schema::hasColumn('negotiations', 'tracking_carrier')) {
                $table->string('tracking_carrier')->nullable();
            }

            if (! Schema::hasColumn('negotiations', 'buyer_tracking_code')) {
                $table->string('buyer_tracking_code')->nullable();
            }
            if (! Schema::hasColumn('negotiations', 'buyer_tracking_carrier')) {
                $table->string('buyer_tracking_carrier')->nullable();
            }

            if (! Schema::hasColumn('negotiations', 'rejection_reason')) {
                $table->text('rejection_reason')->nullable();
            }
        });
    }

    public function down(): void
    {
        // Down intencionalmente vazio.
    }
};
