<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Adiciona 'intermediator' ao enum de roles
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('buyer', 'seller', 'admin', 'inspector', 'intermediator') DEFAULT 'buyer'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Remove 'intermediator' do enum (se não houver registros com esse valor)
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('buyer', 'seller', 'admin', 'inspector') DEFAULT 'buyer'");
    }
};
