<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            // Campos de endereco usados no cadastro e em selects (seller/buyer)
            if (! Schema::hasColumn('users', 'address_zipcode')) {
                $table->string('address_zipcode', 16)->nullable()->after('phone');
            }
            if (! Schema::hasColumn('users', 'address_street')) {
                $table->string('address_street', 255)->nullable()->after('address_zipcode');
            }
            if (! Schema::hasColumn('users', 'address_number')) {
                $table->string('address_number', 20)->nullable()->after('address_street');
            }
            if (! Schema::hasColumn('users', 'address_complement')) {
                $table->string('address_complement', 100)->nullable()->after('address_number');
            }
            if (! Schema::hasColumn('users', 'address_neighborhood')) {
                $table->string('address_neighborhood', 100)->nullable()->after('address_complement');
            }
            if (! Schema::hasColumn('users', 'address_city')) {
                $table->string('address_city', 100)->nullable()->after('address_neighborhood');
            }
            if (! Schema::hasColumn('users', 'address_state')) {
                $table->string('address_state', 2)->nullable()->after('address_city');
            }

            // Alguns bancos antigos podem estar sem colunas de auth que o app usa.
            if (! Schema::hasColumn('users', 'api_token')) {
                $table->string('api_token', 80)->nullable()->unique()->after('password');
            }
            if (! Schema::hasColumn('users', 'last_login_at')) {
                $table->timestamp('last_login_at')->nullable()->after('api_token');
            }
            if (! Schema::hasColumn('users', 'confirmation_code')) {
                $table->string('confirmation_code', 12)->nullable()->after('last_login_at');
            }
            if (! Schema::hasColumn('users', 'confirmation_code_expires_at')) {
                $table->timestamp('confirmation_code_expires_at')->nullable()->after('confirmation_code');
            }
            if (! Schema::hasColumn('users', 'confirmation_code_last_sent_at')) {
                $table->timestamp('confirmation_code_last_sent_at')->nullable()->after('confirmation_code_expires_at');
            }
        });
    }

    public function down(): void
    {
        // Down intencionalmente vazio (nao remover colunas pode evitar perda de dados)
    }
};
