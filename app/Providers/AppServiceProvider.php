<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('auth-login', function (Request $request) {
            $email = strtolower(trim((string) $request->input('email', '')));
            $ip = (string) $request->ip();
            $key = 'login|' . $ip . '|' . $email;

            return Limit::perMinute(10)
                ->by($key)
                ->response(function (Request $request, array $headers) {
                    return response()->json([
                        'message' => 'Muitas tentativas. Aguarde e tente novamente.',
                    ], 429)->withHeaders($headers);
                });
        });

        RateLimiter::for('auth-register', function (Request $request) {
            $ip = (string) $request->ip();
            return Limit::perMinute(5)
                ->by('register|' . $ip)
                ->response(function (Request $request, array $headers) {
                    return response()->json([
                        'message' => 'Muitas tentativas de cadastro. Aguarde e tente novamente.',
                    ], 429)->withHeaders($headers);
                });
        });

        RateLimiter::for('email-public', function (Request $request) {
            $email = strtolower(trim((string) $request->input('email', '')));
            $ip = (string) $request->ip();
            return Limit::perMinute(5)
                ->by('email-public|' . $ip . '|' . $email)
                ->response(function (Request $request, array $headers) {
                    return response()->json([
                        'message' => 'Muitas tentativas. Aguarde e tente novamente.',
                    ], 429)->withHeaders($headers);
                });
        });

        RateLimiter::for('user-search', function (Request $request) {
            $userId = (string) ($request->user()?->id ?? 'guest');
            return Limit::perMinute(30)
                ->by('user-search|' . $userId)
                ->response(function (Request $request, array $headers) {
                    return response()->json([
                        'message' => 'Muitas buscas. Aguarde e tente novamente.',
                    ], 429)->withHeaders($headers);
                });
        });

        if (app()->environment('production')) {
            URL::forceScheme('https');
        }
    }
}
