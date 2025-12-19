<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Negotiation;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AdminController extends Controller
{
    /**
     * List all users (admin only).
     */
    public function users(Request $request): JsonResponse
    {
        $users = User::select([
            'id',
            'name',
            'email',
            'phone',
            'role',
            'address_city',
            'address_state',
            'created_at',
        ])->get();

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
        $admin = $request->user();
        if (!$admin || $admin->role !== 'admin') {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        if ($admin->id === $id) {
            return response()->json(['message' => 'Você não pode remover seu próprio usuário.'], 422);
        }

        $user = User::find($id);
        if (!$user) {
            return response()->json(['message' => 'Usuário não encontrado.'], 404);
        }

        try {
            DB::transaction(function () use ($id, $user) {
                // Tabelas auxiliares podem ter FK para users (ex: audit_logs)
                if (Schema::hasTable('audit_logs')) {
                    DB::table('audit_logs')->where('user_id', $id)->delete();
                }

                // Evita falhas por constraints antigas (FK sem cascade/set null no banco já existente)
                Negotiation::where('buyer_id', $id)->update(['buyer_id' => null]);
                Negotiation::where('seller_id', $id)->delete();
                $user->delete();
            });
        } catch (\Throwable $exception) {
            report($exception);
            return response()->json([
                'message' => 'Não foi possível remover o usuário. Verifique vínculos ativos e tente novamente.'
            ], 409);
        }

        return response()->json([
            'success' => true,
            'message' => 'Usuário removido com sucesso.'
        ]);
    }
}
