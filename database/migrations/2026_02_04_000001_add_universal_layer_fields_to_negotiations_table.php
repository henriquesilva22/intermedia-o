<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            if (! Schema::hasColumn('negotiations', 'schema_version')) {
                $table->unsignedSmallInteger('schema_version')->default(1);
                $table->index('schema_version');
            }

            if (! Schema::hasColumn('negotiations', 'negotiation_type')) {
                $table->string('negotiation_type', 20)->nullable();
                $table->index('negotiation_type');
            }

            // Camada universal (indexável para buscas/listagens)
            if (! Schema::hasColumn('negotiations', 'universal_game')) {
                $table->string('universal_game', 120)->nullable();
                $table->index('universal_game');
            }
            if (! Schema::hasColumn('negotiations', 'universal_platform')) {
                $table->string('universal_platform', 60)->nullable();
                $table->index('universal_platform');
            }
            if (! Schema::hasColumn('negotiations', 'universal_region_server')) {
                $table->string('universal_region_server', 120)->nullable();
                $table->index('universal_region_server');
            }
            if (! Schema::hasColumn('negotiations', 'universal_game_type')) {
                $table->string('universal_game_type', 40)->nullable();
                $table->index('universal_game_type');
            }

            // Comercial
            if (! Schema::hasColumn('negotiations', 'allows_negotiation')) {
                $table->boolean('allows_negotiation')->nullable();
            }
            if (! Schema::hasColumn('negotiations', 'universal_delivery_method')) {
                $table->string('universal_delivery_method', 40)->nullable();
            }
            if (! Schema::hasColumn('negotiations', 'universal_estimated_delivery')) {
                $table->string('universal_estimated_delivery', 80)->nullable();
            }

            // Segurança / automações
            if (! Schema::hasColumn('negotiations', 'form_completeness')) {
                $table->json('form_completeness')->nullable();
            }
            if (! Schema::hasColumn('negotiations', 'risk_assessment')) {
                $table->json('risk_assessment')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('negotiations', function (Blueprint $table) {
            $columns = [
                'schema_version',
                'negotiation_type',
                'universal_game',
                'universal_platform',
                'universal_region_server',
                'universal_game_type',
                'allows_negotiation',
                'universal_delivery_method',
                'universal_estimated_delivery',
                'form_completeness',
                'risk_assessment',
            ];

            foreach ($columns as $col) {
                if (Schema::hasColumn('negotiations', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
