<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    /**
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (app()->environment('production') && ! $request->isSecure()) {
            return redirect()->secure($request->getRequestUri(), 301);
        }

        $response = $next($request);

        // Basic hardening headers.
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

        $csp = (string) env('SECURITY_CSP', "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com; script-src 'self' 'unsafe-inline' https://cdn.twind.style https://cdn.jsdelivr.net; script-src-elem 'self' 'unsafe-inline' https://cdn.twind.style https://cdn.jsdelivr.net; connect-src 'self' https://cdn.twind.style https://cdn.jsdelivr.net;");
        if (trim($csp) !== '') {
            $response->headers->set('Content-Security-Policy', $csp);
        }

        if (app()->environment('production')) {
            // 1 year
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        return $response;
    }
}
