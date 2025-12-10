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
            // Basic fields
            if (!Schema::hasColumn('negotiations', 'category')) {
                $table->string('category', 100)->nullable();
            }
            if (!Schema::hasColumn('negotiations', 'product_photos')) {
                $table->json('product_photos')->nullable();
            }
            
            // Buyer rejection fields
            if (!Schema::hasColumn('negotiations', 'buyer_rejection_reason')) {
                $table->string('buyer_rejection_reason', 100)->nullable();
            }
            if (!Schema::hasColumn('negotiations', 'buyer_rejection_details')) {
                $table->text('buyer_rejection_details')->nullable();
            }
            
            // Inspection/Intermediary fields
            if (!Schema::hasColumn('negotiations', 'intermediary_checklist')) {
                $table->json('intermediary_checklist')->nullable();
            }
            if (!Schema::hasColumn('negotiations', 'intermediary_notes')) {
                $table->text('intermediary_notes')->nullable();
            }
            if (!Schema::hasColumn('negotiations', 'intermediary_photos')) {
                $table->json('intermediary_photos')->nullable();
            }
            if (!Schema::hasColumn('negotiations', 'inspection_saved_at')) {
                $table->timestamp('inspection_saved_at')->nullable();
            }
            
            // Internal logs
            if (!Schema::hasColumn('negotiations', 'internal_logs')) {
                $table->json('internal_logs')->nullable();
            }
            
            // PIX payment fields
            if (!Schema::hasColumn('negotiations', 'pix_code')) {
                $table->string('pix_code', 500)->nullable();
            }
            if (!Schema::hasColumn('negotiations', 'pix_generated_at')) {
                $table->timestamp('pix_generated_at')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            $columns = [
                'category',
                'product_photos',
                'buyer_rejection_reason',
                'buyer_rejection_details',
                'intermediary_checklist',
                'intermediary_notes',
                'intermediary_photos',
                'inspection_saved_at',
                'internal_logs',
                'pix_code',
                'pix_generated_at',
            ];
            
            foreach ($columns as $column) {
                if (Schema::hasColumn('negotiations', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
