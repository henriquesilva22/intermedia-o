<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('negotiation_fields')) {
            return;
        }

        Schema::create('negotiation_fields', function (Blueprint $table) {
            $table->id();
            $table->foreignId('negotiation_id')->constrained('negotiations')->onDelete('cascade');
            $table->string('field_id', 120);
            $table->text('field_value')->nullable();
            $table->timestamps();

            $table->unique(['negotiation_id', 'field_id']);
            $table->index(['negotiation_id']);
            $table->index(['field_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('negotiation_fields');
    }
};
