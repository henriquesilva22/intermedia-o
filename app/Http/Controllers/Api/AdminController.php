<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Negotiation;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class AdminController extends Controller
{
    /**
     * List all users (admin only).
     */
    public function users(Request $request): JsonResponse
    {
        $admin = $request->user();
        if (! $admin || $admin->role !== 'admin') {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        $desiredColumns = [
            'id',
            'name',
            'email',
            'phone',
            'role',
            'address_zipcode',
            'address_street',
            'address_number',
            'address_complement',
            'address_neighborhood',
            'address_city',
            'address_state',
            'email_verified_at',
            'last_login_at',
            'created_at',
            'updated_at',
        ];

        $columns = array_values(array_filter($desiredColumns, fn ($column) => Schema::hasColumn('users', $column)));
        if (empty($columns)) {
            $columns = ['id', 'name', 'email', 'role', 'created_at'];
        }

        $users = User::select([
            ...$columns,
        ])
            ->where('email', 'not like', 'deleted+%')
            ->get();

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

        $hasNonDelivered = Negotiation::query()
            ->where(function ($query) use ($id) {
                $query->where('buyer_id', $id)->orWhere('seller_id', $id);
            })
            ->where('status', '!=', 'delivered')
            ->exists();

        if ($hasNonDelivered) {
            return response()->json([
                'message' => 'Só é permitido remover usuários quando todas as negociações estiverem como ENTREGUE.'
            ], 422);
        }

        try {
            DB::transaction(function () use ($id, $user) {
                // Tabelas auxiliares podem ter FK para users (ex: audit_logs)
                if (Schema::hasTable('audit_logs') && Schema::hasColumn('audit_logs', 'user_id')) {
                    DB::table('audit_logs')->where('user_id', $id)->delete();
                }

                // "Remove" o usuário sem apagar fisicamente (evita problemas de FK e remove o email da lista)
                $uniqueEmail = 'deleted+' . $id . '+' . now()->timestamp . '@example.invalid';

                $updates = [
                    'name' => 'Usuário removido',
                    'email' => $uniqueEmail,
                    'phone' => null,
                    'api_token' => null,
                    'last_login_at' => null,
                    'email_verified_at' => null,
                    'confirmation_code' => null,
                    'confirmation_code_expires_at' => null,
                    'confirmation_code_last_sent_at' => null,
                    'remember_token' => null,
                    'password' => Hash::make(Str::random(48)),
                    'address_city' => null,
                    'address_state' => null,
                ];

                // Alguns ambientes podem não ter todas as colunas; filtra para evitar SQL error.
                foreach (array_keys($updates) as $column) {
                    if (!Schema::hasColumn('users', $column)) {
                        unset($updates[$column]);
                    }
                }

                $user->forceFill($updates)->save();
            });
        } catch (\Throwable $exception) {
            report($exception);

            $debugInfo = config('app.debug')
                ? (' Detalhe: ' . $exception->getMessage())
                : '';

            return response()->json([
                'message' => 'Não foi possível remover o usuário. Verifique vínculos ativos e tente novamente.' . $debugInfo
            ], 409);
        }

        return response()->json([
            'success' => true,
            'message' => 'Usuário removido com sucesso.'
        ]);
    }
}
