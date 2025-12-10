<?php

namespace App\Support;

use App\Models\User;
use App\Notifications\EmailConfirmationCodeNotification;

class EmailConfirmation
{
    /**
     * Generate a new confirmation code and persist it for the given user.
     */
    public static function issue(User $user): string
    {
        $code = self::generateCode();

        $user->forceFill([
            'confirmation_code' => $code,
            'confirmation_code_expires_at' => now()->addMinutes(self::expiresMinutes()),
            'confirmation_code_last_sent_at' => now(),
        ])->save();

        return $code;
    }

    /**
     * Generate and dispatch the confirmation code notification.
     */
    public static function generateAndSend(User $user): string
    {
        $code = self::issue($user);

        $user->notify(new EmailConfirmationCodeNotification($code, self::expiresMinutes()));

        return $code;
    }

    /**
     * Determine if the user can request a resend based on cooldown.
     */
    public static function canResend(User $user): bool
    {
        if (! $user->confirmation_code_last_sent_at) {
            return true;
        }

        $elapsed = now()->diffInSeconds($user->confirmation_code_last_sent_at, false);
        return abs($elapsed) >= self::resendCooldownSeconds();
    }

    /**
     * Seconds remaining until the user can request another code.
     */
    public static function secondsUntilResend(User $user): int
    {
        if (! $user->confirmation_code_last_sent_at) {
            return 0;
        }

        $elapsed = abs(now()->diffInSeconds($user->confirmation_code_last_sent_at, false));
        $remaining = self::resendCooldownSeconds() - $elapsed;

        return max($remaining, 0);
    }

    /**
     * Clear confirmation-related fields for the user.
     */
    public static function clear(User $user): void
    {
        $user->forceFill([
            'confirmation_code' => null,
            'confirmation_code_expires_at' => null,
            'confirmation_code_last_sent_at' => null,
        ])->save();
    }

    /**
     * Get configured expiration minutes.
     */
    public static function expiresMinutes(): int
    {
        return (int) config('confirmation.expires_minutes', 15);
    }

    /**
     * Get expiration in seconds.
     */
    public static function expiresInSeconds(): int
    {
        return self::expiresMinutes() * 60;
    }

    /**
     * Get cooldown in seconds.
     */
    public static function resendCooldownSeconds(): int
    {
        return (int) config('confirmation.resend_cooldown_seconds', 60);
    }

    /**
     * Generate a numeric confirmation code with the configured length.
     */
    protected static function generateCode(): string
    {
        $length = max(4, (int) config('confirmation.code_length', 6));
        $min = (int) pow(10, $length - 1);
        $max = (int) pow(10, $length) - 1;

        return str_pad((string) random_int($min, $max), $length, '0', STR_PAD_LEFT);
    }
}
