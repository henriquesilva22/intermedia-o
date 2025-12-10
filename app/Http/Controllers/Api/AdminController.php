<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    /**
     * List all users (admin only).
     */
    public function users(Request $request): JsonResponse
    {
        $users = User::select(['id', 'name', 'email', 'phone', 'role', 'created_at'])->get();

        return response()->json(['data' => $users]);
    }

    /**
     * Create a new user (admin only).
     */
    public function storeUser(Request $request): JsonResponse
    {
        // TODO: validate and create user
        return response()->json(['data' => null], 201);
    }

    /**
     * Delete a user (admin only).
     */
    public function destroyUser(Request $request, int $id): JsonResponse
    {
        // TODO: delete user
        return response()->json(['success' => true]);
    }
}
