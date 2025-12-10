<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AuthController extends Controller
{
    /**
     * Handle user registration requests.
     */
    public function register(Request $request): JsonResponse
    {
        $data = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')],
            'phone' => ['nullable', 'string', 'max:32'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ])->validate();

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'role' => 'buyer',
            'password' => $data['password'],
        ]);

        return response()->json([
            'message' => 'Conta criada com sucesso.',
            'data' => [
                'id' => $user->id,
                'email' => $user->email,
            ],
        ], 201);
    }

    /**
     * Handle user login requests.
     */
    public function login(Request $request): JsonResponse
    {
        $data = Validator::make($request->all(), [
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ])->validate();

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json([
                'message' => 'Credenciais invalidas.',
            ], 422);
        }

        $plainTextToken = Str::random(60);

        $user->forceFill([
            'api_token' => hash('sha256', $plainTextToken),
            'last_login_at' => now(),
        ])->save();

        return response()->json([
            'token' => $plainTextToken,
            'user' => $this->transformUser($user),
        ]);
    }

    /**
     * Return authenticated user information.
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $this->transformUser($request->user()),
        ]);
    }

    /**
     * Revoke API token for the authenticated user.
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user) {
            $user->forceFill(['api_token' => null])->save();
        }

        return response()->json([
            'message' => 'Sessao encerrada.',
        ]);
    }

    /**
     * Search for user by email.
     */
    public function searchByEmail(Request $request): JsonResponse
    {
        $email = $request->query('email');
        
        if (!$email) {
            return response()->json(['message' => 'Email é obrigatório.'], 400);
        }

        $user = User::where('email', $email)->first();

        if (!$user) {
            return response()->json(['user' => null, 'found' => false]);
        }

        // Não retorna se for o próprio usuário logado
        if ($request->user()->id === $user->id) {
            return response()->json(['user' => null, 'found' => false, 'message' => 'Você não pode ser o comprador.']);
        }

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
            'found' => true
        ]);
    }

    /**
     * Shape the user payload returned to the SPA.
     */
    protected function transformUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'role' => $user->role,
        ];
    }
}
