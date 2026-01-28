<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;

class ServiceFormsController
{
    public function config(): JsonResponse
    {
        $config = config('service_forms', []);

        return response()->json([
            'data' => [
                'services' => $config['services'] ?? [],
                'games' => $config['games'] ?? [],
                'serviceGames' => $config['serviceGames'] ?? [],
                'formFields' => $config['formFields'] ?? [],
            ],
        ]);
    }
}
