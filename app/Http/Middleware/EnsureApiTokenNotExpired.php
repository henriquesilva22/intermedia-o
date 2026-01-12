<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureApiTokenNotExpired
{
    /**
     * Reject requests where the authenticated user's API token is expired.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->api_token && $user->api_token_expires_at && $user->api_token_expires_at->isPast()) {
            $user->forceFill([
                'api_token' => null,
                'api_token_expires_at' => null,
            ])->save();

            return response()->json([
                'message' => 'Token expirado. Faça login novamente.',
            ], 401);
        }

        return $next($request);
    }
}
