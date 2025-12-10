<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'phone')) {
                $table->string('phone')->nullable()->after('email');
            }
            if (! Schema::hasColumn('users', 'role')) {
                $table->string('role', 32)->default('buyer')->after('phone');
            }
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
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'confirmation_code_last_sent_at')) {
                $table->dropColumn('confirmation_code_last_sent_at');
            }
            if (Schema::hasColumn('users', 'confirmation_code_expires_at')) {
                $table->dropColumn('confirmation_code_expires_at');
            }
            if (Schema::hasColumn('users', 'confirmation_code')) {
                $table->dropColumn('confirmation_code');
            }
            if (Schema::hasColumn('users', 'last_login_at')) {
                $table->dropColumn('last_login_at');
            }
            if (Schema::hasColumn('users', 'api_token')) {
                $table->dropUnique('users_api_token_unique');
                $table->dropColumn('api_token');
            }
            if (Schema::hasColumn('users', 'role')) {
                $table->dropColumn('role');
            }
            if (Schema::hasColumn('users', 'phone')) {
                $table->dropColumn('phone');
            }
        });
    }
};
