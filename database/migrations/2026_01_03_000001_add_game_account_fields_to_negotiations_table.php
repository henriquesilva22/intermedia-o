<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            if (! Schema::hasColumn('negotiations', 'game_account_seller_info')) {
                $table->text('game_account_seller_info')->nullable();
            }

            if (! Schema::hasColumn('negotiations', 'game_account_buyer_change_request')) {
                $table->text('game_account_buyer_change_request')->nullable();
            }

            if (! Schema::hasColumn('negotiations', 'game_account_buyer_change_requested_at')) {
                $table->timestamp('game_account_buyer_change_requested_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        // Down opcional: manter colunas evita perda acidental de dados.
    }
};
