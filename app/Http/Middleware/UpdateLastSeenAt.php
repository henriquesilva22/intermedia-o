<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class UpdateLastSeenAt
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        if ($user) {
            try {
                $now = now();
                $last = $user->last_seen_at;

                // Throttle writes: update at most once per minute.
                if (!$last || $now->diffInSeconds($last) >= 60) {
                    $user->forceFill(['last_seen_at' => $now])->save();
                    \Log::debug("UpdateLastSeenAt: Updated user {$user->id} ({$user->name}) last_seen_at to {$now}");
                }
            } catch (\Throwable $e) {
                \Log::error("UpdateLastSeenAt: Failed to update user presence: " . $e->getMessage());
                // Never block requests due to presence tracking.
            }
        }

        return $next($request);
    }
}
