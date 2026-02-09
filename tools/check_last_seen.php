<?php

require __DIR__ . '/../vendor/autoload.php';

$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = \App\Models\User::first();

if ($user) {
    echo "User ID: {$user->id}\n";
    echo "Name: {$user->name}\n";
    echo "Last seen (raw): {$user->last_seen_at}\n";
    
    if ($user->last_seen_at) {
        echo "Last seen (ISO): " . $user->last_seen_at->toIso8601String() . "\n";
        
        $now = now();
        $diffSeconds = $now->diffInSeconds($user->last_seen_at);
        $diffMinutes = $now->diffInMinutes($user->last_seen_at);
        
        echo "Difference: {$diffSeconds} seconds ({$diffMinutes} minutes)\n";
        echo "Is online (within 5 min): " . ($diffMinutes <= 5 ? "YES" : "NO") . "\n";
    } else {
        echo "Last seen is NULL\n";
    }
} else {
    echo "No users found\n";
}
