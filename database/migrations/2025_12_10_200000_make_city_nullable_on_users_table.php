<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('users') || ! Schema::hasColumn('users', 'city')) {
            return;
        }

        DB::statement("ALTER TABLE users MODIFY city varchar(100) NULL");
    }

    public function down(): void
    {
        if (! Schema::hasTable('users') || ! Schema::hasColumn('users', 'city')) {
            return;
        }

        DB::statement("ALTER TABLE users MODIFY city varchar(100) NOT NULL");
    }
};
