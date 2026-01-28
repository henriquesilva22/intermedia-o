<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class UpdateLastSeenAt
{
    public function handle(Request $request, Closure $next)
    {
        $user = Auth::user();
        if ($user) {
            try {
                $now = now();
                $last = $user->last_seen_at;

                // Throttle writes: update at most once per minute.
                if (!$last || $now->diffInSeconds($last) >= 60) {
                    $user->forceFill(['last_seen_at' => $now])->save();
                }
            } catch (\Throwable $e) {
                // Never block requests due to presence tracking.
            }
        }

        return $next($request);
    }
}
