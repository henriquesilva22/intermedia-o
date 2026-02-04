<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            // intermediator_id: quem está intermediando a negociação
            $table->foreignId('intermediator_id')->nullable()->after('buyer_id')
                ->constrained('users')->nullOnDelete();
            
            // Quando o intermediador assumiu a negociação
            $table->timestamp('intermediator_assigned_at')->nullable()->after('intermediator_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            $table->dropForeign(['intermediator_id']);
            $table->dropColumn(['intermediator_id', 'intermediator_assigned_at']);
        });
    }
};
