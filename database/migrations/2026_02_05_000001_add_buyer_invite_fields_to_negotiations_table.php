<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('negotiations', function (Blueprint $table): void {
            if (!Schema::hasColumn('negotiations', 'buyer_invite_inputs')) {
                $table->json('buyer_invite_inputs')->nullable()->after('buyer_rejection_details');
            }
            if (!Schema::hasColumn('negotiations', 'buyer_invite_confirmations')) {
                $table->json('buyer_invite_confirmations')->nullable()->after('buyer_invite_inputs');
            }
            if (!Schema::hasColumn('negotiations', 'buyer_invite_availability')) {
                $table->json('buyer_invite_availability')->nullable()->after('buyer_invite_confirmations');
            }
            if (!Schema::hasColumn('negotiations', 'buyer_invite_access')) {
                $table->json('buyer_invite_access')->nullable()->after('buyer_invite_availability');
            }
            if (!Schema::hasColumn('negotiations', 'buyer_invite_proofs')) {
                $table->json('buyer_invite_proofs')->nullable()->after('buyer_invite_access');
            }
            if (!Schema::hasColumn('negotiations', 'buyer_invite_notes')) {
                $table->text('buyer_invite_notes')->nullable()->after('buyer_invite_proofs');
            }
            if (!Schema::hasColumn('negotiations', 'buyer_invite_submitted_at')) {
                $table->timestamp('buyer_invite_submitted_at')->nullable()->after('buyer_invite_notes');
            }
            if (!Schema::hasColumn('negotiations', 'buyer_request_changes')) {
                $table->text('buyer_request_changes')->nullable()->after('buyer_invite_submitted_at');
            }
            if (!Schema::hasColumn('negotiations', 'buyer_request_changes_at')) {
                $table->timestamp('buyer_request_changes_at')->nullable()->after('buyer_request_changes');
            }
            if (!Schema::hasColumn('negotiations', 'buyer_report_reason')) {
                $table->text('buyer_report_reason')->nullable()->after('buyer_request_changes_at');
            }
            if (!Schema::hasColumn('negotiations', 'buyer_reported_at')) {
                $table->timestamp('buyer_reported_at')->nullable()->after('buyer_report_reason');
            }
        });
    }

    public function down(): void
    {
        Schema::table('negotiations', function (Blueprint $table): void {
            $columns = [
                'buyer_invite_inputs',
                'buyer_invite_confirmations',
                'buyer_invite_availability',
                'buyer_invite_access',
                'buyer_invite_proofs',
                'buyer_invite_notes',
                'buyer_invite_submitted_at',
                'buyer_request_changes',
                'buyer_request_changes_at',
                'buyer_report_reason',
                'buyer_reported_at',
            ];

            foreach ($columns as $col) {
                if (Schema::hasColumn('negotiations', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
