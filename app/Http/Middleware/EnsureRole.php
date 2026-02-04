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

        $isIntermediatorPrincipal = (bool) ($user && $role === 'intermediator' && ($user->is_intermediator_principal ?? false));

        if ($roles) {
            foreach ($roles as $required) {
                if ($required === 'intermediator_principal' && $isIntermediatorPrincipal) {
                    return $next($request);
                }
                if ($required !== 'intermediator_principal' && $role !== null && $required === $role) {
                    return $next($request);
                }
            }
        }

        if (! $user || $role === null) {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        // If roles were specified and none matched.
        if ($roles) {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        return $next($request);
    }
}
