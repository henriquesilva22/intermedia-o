<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    /**
     * Usage: role:admin or role:admin,inspector
     */
    public function handle(Request $request, Closure $next, ...$roles): Response
    {
        $user = $request->user();
        $role = $user?->role;

        $roles = array_values(array_filter(array_map(static fn ($r) => trim((string) $r), $roles)));

        if (! $user || $role === null || ($roles && ! in_array($role, $roles, true))) {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        return $next($request);
    }
}
