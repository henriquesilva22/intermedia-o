<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('payments')) {
            return;
        }

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('negotiation_id')->constrained('negotiations')->onDelete('cascade');
            $table->string('type', 40);
            $table->string('description', 255)->nullable();
            $table->decimal('amount', 12, 2);
            $table->string('currency', 3)->default('BRL');
            $table->string('provider', 40)->nullable();
            $table->string('provider_reference', 120)->nullable();
            $table->string('idempotency_key', 80)->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->unique(['negotiation_id', 'type']);
            $table->index(['negotiation_id', 'confirmed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
