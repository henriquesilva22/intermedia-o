<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            // Colunas de workflow podem estar ausentes em bancos já existentes.
            if (!Schema::hasColumn('negotiations', 'accepted_at')) {
                $table->timestamp('accepted_at')->nullable();
            }
            if (!Schema::hasColumn('negotiations', 'paid_at')) {
                $table->timestamp('paid_at')->nullable();
            }
            if (!Schema::hasColumn('negotiations', 'shipped_at')) {
                $table->timestamp('shipped_at')->nullable();
            }
            if (!Schema::hasColumn('negotiations', 'received_at')) {
                $table->timestamp('received_at')->nullable();
            }
            if (!Schema::hasColumn('negotiations', 'delivered_at')) {
                $table->timestamp('delivered_at')->nullable();
            }
            if (!Schema::hasColumn('negotiations', 'cancelled_at')) {
                $table->timestamp('cancelled_at')->nullable();
            }

            // Flags auxiliares
            if (!Schema::hasColumn('negotiations', 'payment_confirmed_by_buyer')) {
                $table->boolean('payment_confirmed_by_buyer')->default(false);
            }

            // Etapas da intermediadora
            if (!Schema::hasColumn('negotiations', 'intermediary_approval_confirmed_at')) {
                $table->timestamp('intermediary_approval_confirmed_at')->nullable();
            }
            if (!Schema::hasColumn('negotiations', 'sent_to_buyer_at')) {
                $table->timestamp('sent_to_buyer_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        // Down opcional: manter colunas evita perda acidental de dados.
    }
};
