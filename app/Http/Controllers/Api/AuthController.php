<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\BrevoSmsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    public function __construct(private BrevoSmsService $brevoSms)
    {
    }

    /**
     * Handle user registration requests.
     */
    public function register(Request $request): JsonResponse
    {
        $data = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')],
            'phone' => ['nullable', 'string', 'max:32'],
            'zip_code' => ['nullable', 'string', 'max:10'],
            'address' => ['nullable', 'string', 'max:255'],
            'address_number' => ['nullable', 'string', 'max:20'],
            'address_complement' => ['nullable', 'string', 'max:100'],
            'district' => ['nullable', 'string', 'max:100'],
            'city' => ['nullable', 'string', 'max:100'],
            'state' => ['nullable', 'string', 'max:2'],
            'password' => [
                'required',
                'string',
                'min:8',
                'confirmed',
                'regex:/[A-Z]/',
                'regex:/[0-9]/',
            ],
        ])->validate();

        $phone = isset($data['phone']) ? preg_replace('/\D+/', '', $data['phone']) : null;
        $zipCode = isset($data['zip_code']) ? preg_replace('/\D+/', '', $data['zip_code']) : null;

        if ($phone === '') {
            $phone = null;
        }

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $phone,
            'address_zipcode' => $zipCode,
            'address_street' => $data['address'] ?? null,
            'address_number' => $data['address_number'] ?? null,
            'address_complement' => $data['address_complement'] ?? null,
            'address_neighborhood' => $data['district'] ?? null,
            'address_city' => $data['city'] ?? null,
            'address_state' => $data['state'] ?? null,
            'role' => 'buyer',
            'password' => $data['password'],
        ]);

        $smsSent = false;
        $verificationEmailSent = false;

        if ($phone) {
            $code = (string) random_int(100000, 999999);

            $user->forceFill([
                'confirmation_code' => $code,
                'confirmation_code_expires_at' => now()->addMinutes(15),
                'confirmation_code_last_sent_at' => now(),
            ])->save();

            $smsSent = $this->brevoSms->sendVerificationCode($phone, $code);
        }

        try {
            $verificationEmailSent = $this->sendEmailVerificationCode($user);
        } catch (\Throwable $exception) {
            Log::error('Nao foi possivel enviar email de verificacao apos registro', [
                'user_id' => $user->id,
                'error' => $exception->getMessage(),
            ]);
            $verificationEmailSent = false;
        }

        return response()->json([
            'message' => $verificationEmailSent
                ? 'Conta criada! Enviamos um código de confirmação para o seu e-mail.'
                : 'Conta criada! Não conseguimos enviar o código por e-mail, mas você pode solicitar o reenvio.',
            'data' => [
                'id' => $user->id,
                'email' => $user->email,
                'sms_sent' => $smsSent,
                'verification_email_sent' => $verificationEmailSent,
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

        $data['email'] = trim($data['email']);
        $data['password'] = trim($data['password']);

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json([
                'message' => 'Credenciais invalidas.',
            ], 422);
        }

        $plainTextToken = Str::random(60);

        $ttlDays = (int) config('auth.api_token_ttl_days', 30);
        if ($ttlDays < 1) {
            $ttlDays = 30;
        }

        $user->forceFill([
            'api_token' => hash('sha256', $plainTextToken),
            'api_token_expires_at' => now()->addDays($ttlDays),
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
            $user->forceFill([
                'api_token' => null,
                'api_token_expires_at' => null,
            ])->save();
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
        $tag = $request->query('tag');

        if (!$email && !$tag) {
            return response()->json(['message' => 'Informe email ou tag.'], 400);
        }

        $normalize = function (?string $value): string {
            $value = trim((string) $value);
            $value = preg_replace('/\s+/', ' ', $value) ?? $value;
            $value = mb_strtolower($value);
            return Str::ascii($value);
        };

        $abbreviate = function (?string $value): string {
            $value = trim((string) $value);
            $value = preg_replace('/\s+/', ' ', $value) ?? $value;
            if ($value === '') {
                return 'Usuario';
            }
            $parts = preg_split('/\s+/', $value) ?: [];
            if (count($parts) <= 1) {
                return $parts[0] ?? $value;
            }
            $first = array_shift($parts);
            $initials = array_map(static function ($part) {
                $letter = mb_substr((string) $part, 0, 1);
                return $letter ? mb_strtoupper($letter) . '.' : '';
            }, $parts);
            $initials = array_filter($initials);
            return trim($first . ' ' . implode(' ', $initials));
        };

        $user = null;
        if ($email) {
            $user = User::where('email', $email)->first();
        } else {
            $raw = trim((string) $tag);
            $idPart = $raw;
            $namePart = '';
            if (str_contains($raw, '#')) {
                $chunks = explode('#', $raw);
                $idPart = trim((string) end($chunks));
                array_pop($chunks);
                $namePart = trim(implode('#', $chunks));
            }

            $idPart = preg_replace('/\s+/', '', (string) $idPart);
            if (!ctype_digit((string) $idPart)) {
                return response()->json(['user' => null, 'found' => false, 'message' => 'Formato inválido. Use nome#id (ex: henrique#15).']);
            }

            $user = User::find((int) $idPart);
            if ($user && $namePart) {
                $namePartNormalized = $normalize($namePart);
                $fullNameNormalized = $normalize($user->name);
                $firstName = trim(explode(' ', trim((string) $user->name))[0] ?? '');
                $firstNameNormalized = $normalize($firstName);

                if ($namePartNormalized && $namePartNormalized !== $firstNameNormalized && $namePartNormalized !== $fullNameNormalized) {
                    return response()->json(['user' => null, 'found' => false, 'message' => 'Nome não confere com o ID informado.']);
                }
            }
        }

        if (!$user) {
            return response()->json(['user' => null, 'found' => false]);
        }

        // Não retorna se for o próprio usuário logado
        if ($request->user()->id === $user->id) {
            return response()->json(['user' => null, 'found' => false, 'message' => 'Você não pode ser o comprador.']);
        }

        $firstName = trim(explode(' ', trim((string) $user->name))[0] ?? '');
        $displayTag = ($firstName ?: 'usuario') . '#' . $user->id;
        $shortName = $abbreviate($user->name);

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'short_name' => $shortName,
                'tag' => $displayTag,
            ],
            'found' => true
        ]);
    }

    /**
     * Send email verification link.
     */
    public function sendEmailVerification(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->email_verified_at) {
            return response()->json(['message' => 'Email já verificado.'], 400);
        }

        // Rate limiting - max 1 email per 2 minutes
        if ($user->email_verification_sent_at && $user->email_verification_sent_at->diffInSeconds(now()) < 120) {
            $remaining = 120 - $user->email_verification_sent_at->diffInSeconds(now());
            return response()->json([
                'message' => "Aguarde {$remaining} segundos para reenviar.",
                'retry_after' => $remaining
            ], 429);
        }

        try {
            $sent = $this->sendEmailVerificationCode($user);
            if (! $sent) {
                return response()->json(['message' => 'Não foi possível enviar o e-mail agora. Tente novamente.'], 500);
            }
        } catch (\Throwable $exception) {
            Log::error('Falha ao reenviar email de verificacao autenticado', [
                'user_id' => $user->id,
                'error' => $exception->getMessage(),
            ]);

            return response()->json(['message' => 'Erro ao enviar email. Tente novamente.'], 500);
        }

        return response()->json([
            'message' => 'Código de confirmação enviado para seu email.',
            'email' => $this->maskEmail($user->email),
        ]);
    }

    /**
     * Verify email with a code (GET route kept for backwards compatibility).
     */
    public function verifyEmailLink(Request $request, int $id, string $token): JsonResponse
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json(['message' => 'Usuário não encontrado.'], 404);
        }

        if ($user->email_verified_at) {
            return response()->json([
                'message' => 'Email já verificado.',
                'already_verified' => true
            ]);
        }

        if (!$user->email_verification_code) {
            return response()->json(['message' => 'Nenhuma verificação pendente. Solicite um novo código.'], 400);
        }

        if ($user->email_verification_expires_at && $user->email_verification_expires_at->isPast()) {
            return response()->json(['message' => 'Código expirado. Solicite um novo.'], 400);
        }

        if (!hash_equals((string) $user->email_verification_code, (string) $token)) {
            return response()->json(['message' => 'Código inválido.'], 422);
        }

        $user->forceFill([
            'email_verified_at' => now(),
            'email_verification_code' => null,
            'email_verification_expires_at' => null,
        ])->save();

        return response()->json([
            'message' => 'Email verificado com sucesso!',
            'verified' => true
        ]);
    }

    /**
     * Public endpoint to verify email by code.
     */
    public function verifyEmailCode(Request $request): JsonResponse
    {
        $data = Validator::make($request->all(), [
            'email' => ['required', 'string', 'email'],
            'code' => ['required', 'string', 'size:6'],
        ])->validate();

        $user = User::where('email', $data['email'])->first();

        if (! $user) {
            return response()->json(['message' => 'Código inválido.'], 422);
        }

        if ($user->email_verified_at) {
            return response()->json(['message' => 'Email já verificado.', 'already_verified' => true]);
        }

        if (! $user->email_verification_code) {
            return response()->json(['message' => 'Nenhuma verificação pendente. Solicite um novo código.'], 400);
        }

        if ($user->email_verification_expires_at && $user->email_verification_expires_at->isPast()) {
            return response()->json(['message' => 'Código expirado. Solicite um novo.'], 400);
        }

        if (!hash_equals((string) $user->email_verification_code, (string) $data['code'])) {
            return response()->json(['message' => 'Código inválido.'], 422);
        }

        $user->forceFill([
            'email_verified_at' => now(),
            'email_verification_code' => null,
            'email_verification_expires_at' => null,
        ])->save();

        return response()->json([
            'message' => 'Email verificado com sucesso!',
            'verified' => true,
        ]);
    }

    /**
     * Public endpoint to resend verification link based on email.
     */
    public function publicResendEmailVerification(Request $request): JsonResponse
    {
        $data = Validator::make($request->all(), [
            'email' => ['required', 'string', 'email'],
        ])->validate();

        $user = User::where('email', $data['email'])->first();

        if (! $user) {
            return response()->json(['message' => 'Se o e-mail existir, enviaremos um novo link.']);
        }

        if ($user->email_verified_at) {
            return response()->json(['message' => 'Este e-mail já está verificado.'], 400);
        }

        if ($user->email_verification_sent_at && $user->email_verification_sent_at->diffInSeconds(now()) < 120) {
            $remaining = 120 - $user->email_verification_sent_at->diffInSeconds(now());
            return response()->json([
                'message' => "Aguarde {$remaining} segundos para reenviar.",
                'retry_after' => $remaining
            ], 429);
        }

        try {
            $sent = $this->sendEmailVerificationCode($user);
            if (! $sent) {
                return response()->json(['message' => 'Erro ao enviar email. Tente novamente.'], 500);
            }
        } catch (\Throwable $exception) {
            Log::error('Falha ao reenviar email de verificacao publico', [
                'user_id' => $user->id,
                'error' => $exception->getMessage(),
            ]);

            return response()->json(['message' => 'Erro ao enviar email. Tente novamente.'], 500);
        }

        return response()->json([
            'message' => 'Código de confirmação enviado para seu email.',
            'email' => $this->maskEmail($user->email),
        ]);
    }

    /**
     * Mask email for display.
     */
    protected function maskEmail(string $email): string
    {
        $parts = explode('@', $email);
        $name = $parts[0];
        $domain = $parts[1] ?? '';
        
        if (strlen($name) <= 3) {
            $masked = $name[0] . '***';
        } else {
            $masked = substr($name, 0, 2) . str_repeat('*', strlen($name) - 3) . substr($name, -1);
        }
        
        return $masked . '@' . $domain;
    }

    /**
     * Generate and send the verification link email.
     */
    protected function sendEmailVerificationCode(User $user): bool
    {
        $code = (string) random_int(100000, 999999);

        $user->forceFill([
            'email_verification_code' => $code,
            'email_verification_expires_at' => now()->addMinutes(15),
            'email_verification_sent_at' => now(),
        ])->save();

        Mail::send([], [], function ($message) use ($user, $code) {
            $message->to($user->email)
                ->subject('Seu código de confirmação - Intermediação')
                ->html("
                    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
                        <h2 style='color: #7c3aed;'>Confirmação de Email</h2>
                        <p>Olá <strong>{$user->name}</strong>,</p>
                        <p>Use o código abaixo para confirmar seu e-mail:</p>
                        <div style='text-align: center; margin: 24px 0;'>
                            <div style='display: inline-block; padding: 14px 24px; border-radius: 10px; background: #f3f4f6; font-size: 24px; letter-spacing: 6px; font-weight: bold;'>
                                {$code}
                            </div>
                        </div>
                        <p style='color: #6b7280; font-size: 12px;'>Este código expira em <strong>15 minutos</strong>.</p>
                        <p style='color: #6b7280; font-size: 12px;'>Se você não criou esta conta, ignore este email.</p>
                    </div>
                ");
        });

        return true;
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
            'email_verified' => !is_null($user->email_verified_at),
            'phone' => $user->phone,
            'address_zipcode' => $user->address_zipcode,
            'address_street' => $user->address_street,
            'address_number' => $user->address_number,
            'address_complement' => $user->address_complement,
            'address_neighborhood' => $user->address_neighborhood,
            'address_city' => $user->address_city,
            'address_state' => $user->address_state,
            'role' => $user->role,
            'intermediator_code' => $user->intermediator_code ?? null,
            'is_intermediator_principal' => (bool) ($user->is_intermediator_principal ?? false),
        ];
    }
}
