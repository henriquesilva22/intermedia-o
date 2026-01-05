<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            // Separate non-sensitive seller notes (during creation) from sensitive credentials/info.
            if (! Schema::hasColumn('negotiations', 'game_account_seller_notes')) {
                $table->text('game_account_seller_notes')->nullable();
            }

            // Audit fields for sensitive account credentials/info.
            if (! Schema::hasColumn('negotiations', 'game_account_seller_info_sent_by_user_id')) {
                $table->unsignedBigInteger('game_account_seller_info_sent_by_user_id')->nullable();
            }
            if (! Schema::hasColumn('negotiations', 'game_account_seller_info_sent_at')) {
                $table->timestamp('game_account_seller_info_sent_at')->nullable();
            }
            if (! Schema::hasColumn('negotiations', 'game_account_seller_info_viewed_by_buyer_at')) {
                $table->timestamp('game_account_seller_info_viewed_by_buyer_at')->nullable();
            }

            // Generic digital delivery info for non-account digital categories (Moedas / Chave / DLC).
            if (! Schema::hasColumn('negotiations', 'digital_delivery_info')) {
                $table->text('digital_delivery_info')->nullable();
            }
            if (! Schema::hasColumn('negotiations', 'digital_delivery_info_sent_by_user_id')) {
                $table->unsignedBigInteger('digital_delivery_info_sent_by_user_id')->nullable();
            }
            if (! Schema::hasColumn('negotiations', 'digital_delivery_info_sent_at')) {
                $table->timestamp('digital_delivery_info_sent_at')->nullable();
            }
            if (! Schema::hasColumn('negotiations', 'digital_delivery_info_viewed_by_buyer_at')) {
                $table->timestamp('digital_delivery_info_viewed_by_buyer_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        // Down opcional: manter colunas evita perda acidental de dados.
    }
};
