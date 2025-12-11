<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class BrevoSmsService
{
    public function sendVerificationCode(string $phoneNumber, string $code): bool
    {
        $message = "Seu codigo de verificacao Intermediacao Pro: {$code}.";

        return $this->sendMessage($phoneNumber, $message);
    }

    public function sendMessage(string $phoneNumber, string $message): bool
    {
        $apiKey = config('services.brevo.sms_key');
        $sender = config('services.brevo.sms_sender');

        if (! $apiKey || ! $sender) {
            Log::warning('Brevo SMS skipped because credentials are missing.');

            return false;
        }

        $recipient = $this->formatRecipient($phoneNumber);

        if (! $recipient) {
            Log::warning('Brevo SMS skipped because phone number is invalid.', ['phone' => $phoneNumber]);

            return false;
        }

        try {
            $response = Http::withHeaders([
                'accept' => 'application/json',
                'api-key' => $apiKey,
                'content-type' => 'application/json',
            ])->post('https://api.brevo.com/v3/transactionalSMS/sms', [
                'type' => 'transactional',
                'sender' => $sender,
                'recipient' => $recipient,
                'content' => $message,
            ]);

            if ($response->successful()) {
                return true;
            }

            Log::error('Brevo SMS request failed.', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
        } catch (\Throwable $exception) {
            Log::error('Brevo SMS request threw an exception.', [
                'message' => $exception->getMessage(),
            ]);
        }

        return false;
    }

    private function formatRecipient(string $phoneNumber): ?string
    {
        $digits = preg_replace('/\D+/', '', $phoneNumber);

        if (! $digits) {
            return null;
        }

        if (str_starts_with($digits, '55') && strlen($digits) >= 12 && strlen($digits) <= 13) {
            return $digits;
        }

        $normalized = ltrim($digits, '0');

        if (strlen($normalized) >= 10 && strlen($normalized) <= 11) {
            return '55' . $normalized;
        }

        return null;
    }
}
