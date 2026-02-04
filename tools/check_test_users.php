<?php

require __DIR__ . '/../vendor/autoload.php';

$app = require __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

function dumpUser(?User $user, string $label): void
{
    echo "== {$label} ==\n";

    if (!$user) {
        echo "not_found\n\n";
        return;
    }

    echo "id={$user->id}\n";
    echo "name={$user->name}\n";
    echo "email={$user->email}\n";
    echo "role={$user->role}\n";
    echo "email_verified_at=" . ($user->email_verified_at ? $user->email_verified_at->toDateTimeString() : 'null') . "\n";
    echo "password_hash_prefix=" . substr((string) $user->password, 0, 10) . "...\n";
    echo "\n";
}

try {
    $defaultConnection = config('database.default');
    $databaseName = config('database.connections.' . $defaultConnection . '.database');

    echo "DB_CONNECTION={$defaultConnection}\n";
    echo "DB_DATABASE={$databaseName}\n";

    // Simple ping
    DB::connection()->getPdo();
    echo "DB_STATUS=ok\n\n";

    $admin = User::where('email', 'admin@intermediacaopro.com')->first();
    $intermediator = User::where('email', 'intermediador@intermediacaopro.com')->first();

    dumpUser($admin, 'admin');
    dumpUser($intermediator, 'intermediator');

    $expectedPassword = 'Senha@123';

    echo "== password_check ==\n";
    echo "admin_pass_ok=" . ($admin ? (Hash::check($expectedPassword, (string) $admin->password) ? '1' : '0') : 'n/a') . "\n";
    echo "intermediator_pass_ok=" . ($intermediator ? (Hash::check($expectedPassword, (string) $intermediator->password) ? '1' : '0') : 'n/a') . "\n";

    echo "\nDone.\n";
} catch (Throwable $e) {
    echo "ERROR: {$e->getMessage()}\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
}
