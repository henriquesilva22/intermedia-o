<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('negotiations')) {
            return;
        }

        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        // Only run if the column exists.
        $col = DB::selectOne(
            "SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'negotiations' AND COLUMN_NAME = 'status' LIMIT 1"
        );

        if (! $col) {
            return;
        }

        $columnType = strtolower((string) ($col->COLUMN_TYPE ?? ''));
        $isEnum = str_starts_with($columnType, 'enum(');

        // Even if not enum, this is safe; but we mainly need to escape old ENUM schemas.
        if ($isEnum) {
            DB::statement("ALTER TABLE `negotiations` MODIFY `status` VARCHAR(40) NOT NULL");
            return;
        }

        // If it's already a VARCHAR (or similar), do nothing.
        if (str_contains($columnType, 'varchar')) {
            return;
        }

        // Fallback: force to VARCHAR when type is unexpected (e.g., CHAR).
        DB::statement("ALTER TABLE `negotiations` MODIFY `status` VARCHAR(40) NOT NULL");
    }

    public function down(): void
    {
        // Intentionally no-op: we don't want to reintroduce ENUM truncation.
    }
};
