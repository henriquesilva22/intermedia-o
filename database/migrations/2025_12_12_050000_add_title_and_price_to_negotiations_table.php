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
            // Alguns bancos legados usam product_title/product_price.
            // O app atual usa title/price.
            if (! Schema::hasColumn('negotiations', 'title')) {
                $table->string('title')->nullable();
            }

            if (! Schema::hasColumn('negotiations', 'price')) {
                $table->decimal('price', 12, 2)->nullable();
            }
        });
    }

    public function down(): void
    {
        // Down intencionalmente vazio.
    }
};
