<?php

namespace App\Support;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class AuditLogger
{
    public static function log(Request $request, string $action, ?Model $subject = null, array $meta = []): void
    {
        try {
            $user = $request->user();

            AuditLog::create([
                'user_id' => $user?->id,
                'action' => $action,
                'subject_type' => $subject ? get_class($subject) : null,
                'subject_id' => $subject?->getKey(),
                'ip' => (string) $request->ip(),
                'user_agent' => substr((string) $request->userAgent(), 0, 255),
                'meta' => $meta ?: null,
                'created_at' => now(),
            ]);
        } catch (\Throwable $exception) {
            // Never break the request due to audit logging.
        }
    }
}
