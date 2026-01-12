<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Support\AuditLogger;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AuditLoggerTest extends TestCase
{
    public function test_audit_logger_writes_row_when_table_exists(): void
    {
        Schema::dropIfExists('audit_logs');

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('action', 120);
            $table->string('subject_type', 200)->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        $request = Request::create('/test', 'POST');
        $request->setUserResolver(fn () => null);

        AuditLogger::log($request, 'test.action', null, ['foo' => 'bar']);

        $this->assertSame(1, AuditLog::count());
        $this->assertSame('test.action', (string) AuditLog::first()->action);
    }
}
