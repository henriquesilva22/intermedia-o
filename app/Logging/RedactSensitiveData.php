<?php

namespace App\Logging;

use Monolog\LogRecord;

class RedactSensitiveData
{
    /**
     * Customize the given logger instance.
     */
    public function __invoke($logger): void
    {
        $logger->pushProcessor(function ($record) {
            // Monolog v3 uses LogRecord objects; older versions may use arrays.
            if ($record instanceof LogRecord) {
                return $record->with(
                    context: $this->redact($record->context),
                    extra: $this->redact($record->extra),
                );
            }

            if (is_array($record)) {
                $record['context'] = $this->redact($record['context'] ?? []);
                $record['extra'] = $this->redact($record['extra'] ?? []);
            }

            return $record;
        });
    }

    private function redact(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }

        $sensitiveKeys = [
            'password',
            'password_confirmation',
            'api_token',
            'token',
            'pix_code',
            'buyer_payment_proof',
            'payment_proof',
            'game_account_seller_info',
            'digital_delivery_info',
            'game_account_buyer_change_request',
            'payload',
            'authorization',
        ];

        $out = [];
        foreach ($value as $key => $item) {
            $normalizedKey = is_string($key) ? strtolower($key) : $key;

            if (is_string($normalizedKey) && in_array($normalizedKey, $sensitiveKeys, true)) {
                $out[$key] = '[REDACTED]';
                continue;
            }

            $out[$key] = is_array($item) ? $this->redact($item) : $item;
        }

        return $out;
    }
}
