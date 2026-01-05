<?php

namespace App\Services\Payments;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class MercadoPagoService
{
    private const BASE_URL = 'https://api.mercadopago.com';

    private function accessToken(): string
    {
        $staticToken = (string) config('services.mercadopago.access_token', '');
        if ($staticToken !== '') {
            return $staticToken;
        }

        // OAuth (client_credentials): útil quando você quer gerar/renovar token via API.
        $clientId = (string) config('services.mercadopago.client_id', '');
        $clientSecret = (string) config('services.mercadopago.client_secret', '');
        if ($clientId === '' || $clientSecret === '') {
            return '';
        }

        $cacheKey = 'mercadopago.oauth.access_token.' . sha1($clientId);
        $cached = Cache::get($cacheKey);
        if (is_string($cached) && $cached !== '') {
            return $cached;
        }

        $testTokenRaw = config('services.mercadopago.test_token', false);
        $testToken = filter_var($testTokenRaw, FILTER_VALIDATE_BOOLEAN);

        $response = Http::baseUrl(self::BASE_URL)
            ->acceptJson()
            ->asJson()
            ->post('/oauth/token', [
                'client_id' => $clientId,
                'client_secret' => $clientSecret,
                'grant_type' => 'client_credentials',
                'test_token' => $testToken,
            ]);

        if (! $response->successful()) {
            $details = $response->json();
            $message = 'Falha ao obter access_token via OAuth no Mercado Pago.';
            if (is_array($details)) {
                $message .= ' ' . json_encode($details, JSON_UNESCAPED_UNICODE);
            }
            throw new \RuntimeException($message);
        }

        $json = $response->json();
        $token = is_array($json) ? (string) ($json['access_token'] ?? '') : '';
        $expiresIn = is_array($json) ? (int) ($json['expires_in'] ?? 0) : 0;
        if ($token === '') {
            throw new \RuntimeException('OAuth do Mercado Pago não retornou access_token.');
        }

        // Buffer para evitar usar token no limite.
        $ttlSeconds = $expiresIn > 120 ? ($expiresIn - 60) : max(60, $expiresIn);
        Cache::put($cacheKey, $token, now()->addSeconds($ttlSeconds));

        return $token;
    }

    private function webhookUrl(): ?string
    {
        $url = (string) config('services.mercadopago.webhook_url', '');

        return $url !== '' ? $url : null;
    }

    private function client(?string $idempotencyKey = null): PendingRequest
    {
        $token = $this->accessToken();
        if ($token === '') {
            throw new \RuntimeException('MERCADOPAGO_ACCESS_TOKEN não configurado.');
        }

        $request = Http::baseUrl(self::BASE_URL)
            ->withToken($token)
            ->acceptJson();

        if ($idempotencyKey) {
            $request = $request->withHeaders([
                'X-Idempotency-Key' => $idempotencyKey,
            ]);
        }

        return $request;
    }

    /**
     * Cria um pagamento Pix no Mercado Pago.
     * Retorna: [payment_id, status, pix_code, qr_code_base64]
     */
    public function createPixPayment(array $params): array
    {
        $transactionAmount = (float) ($params['transaction_amount'] ?? 0);
        $description = (string) ($params['description'] ?? 'Pagamento');
        $payerEmail = (string) ($params['payer_email'] ?? '');
        $externalReference = (string) ($params['external_reference'] ?? '');

        if ($transactionAmount <= 0) {
            throw new \InvalidArgumentException('transaction_amount inválido.');
        }
        if ($payerEmail === '') {
            throw new \InvalidArgumentException('payer_email é obrigatório.');
        }

        $idempotencyKey = (string) ($params['idempotency_key'] ?? Str::uuid()->toString());
        $payload = [
            'transaction_amount' => round($transactionAmount, 2),
            'description' => $description,
            'payment_method_id' => 'pix',
            'payer' => [
                'email' => $payerEmail,
            ],
        ];

        if ($externalReference !== '') {
            $payload['external_reference'] = $externalReference;
        }

        $webhookUrl = $this->webhookUrl();
        if ($webhookUrl) {
            $payload['notification_url'] = $webhookUrl;
        }

        $response = $this->client($idempotencyKey)->post('/v1/payments', $payload);
        if (! $response->successful()) {
            $message = 'Falha ao criar pagamento Pix no Mercado Pago.';
            $details = $response->json();
            if (is_array($details)) {
                $message .= ' ' . json_encode($details, JSON_UNESCAPED_UNICODE);
            }
            throw new \RuntimeException($message);
        }

        $json = $response->json();

        $paymentId = $json['id'] ?? null;
        $status = $json['status'] ?? null;
        $transactionData = $json['point_of_interaction']['transaction_data'] ?? [];
        $pixCode = $transactionData['qr_code'] ?? null;
        $qrCodeBase64 = $transactionData['qr_code_base64'] ?? null;

        return [
            'payment_id' => $paymentId,
            'status' => $status,
            'pix_code' => $pixCode,
            'qr_code_base64' => $qrCodeBase64,
            'idempotency_key' => $idempotencyKey,
            'raw' => $json,
        ];
    }

    /**
     * Busca um pagamento por ID.
     */
    public function getPayment(string|int $paymentId): array
    {
        $paymentId = (string) $paymentId;
        if ($paymentId === '') {
            throw new \InvalidArgumentException('paymentId inválido.');
        }

        $response = $this->client()->get('/v1/payments/' . $paymentId);
        if (! $response->successful()) {
            $message = 'Falha ao consultar pagamento no Mercado Pago.';
            $details = $response->json();
            if (is_array($details)) {
                $message .= ' ' . json_encode($details, JSON_UNESCAPED_UNICODE);
            }
            throw new \RuntimeException($message);
        }

        $json = $response->json();
        return is_array($json) ? $json : [];
    }
}
