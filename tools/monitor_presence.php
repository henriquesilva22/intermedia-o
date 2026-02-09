#!/usr/bin/env php
<?php

/*
 * Script para monitorar e diagnosticar o sistema de presença online/offline
 * 
 * Uso: php tools/monitor_presence.php [user_id]
 */

require __DIR__ . '/../vendor/autoload.php';

$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$userId = $argv[1] ?? null;

if (!$userId) {
    echo "Uso: php tools/monitor_presence.php [user_id]\n";
    echo "\nListando todos os usuários:\n";
    echo str_repeat("-", 80) . "\n";
    
    $users = \App\Models\User::all();
    foreach ($users as $user) {
        $lastSeen = $user->last_seen_at ? $user->last_seen_at->format('Y-m-d H:i:s') : 'Nunca';
        $diffMinutes = $user->last_seen_at ? now()->diffInMinutes($user->last_seen_at, false) : null;
        $status = $diffMinutes !== null && $diffMinutes >= 0 && $diffMinutes <= 5 ? "✓ ONLINE" : "✗ Offline";
        
        echo sprintf(
            "ID: %-4s | %-20s | %-30s | %s (%s min atrás)\n",
            $user->id,
            substr($user->name, 0, 20),
            $status,
            $lastSeen,
            $diffMinutes !== null ? abs($diffMinutes) : 'N/A'
        );
    }
    echo str_repeat("-", 80) . "\n";
    exit(0);
}

// Monitorar um usuário específico
$user = \App\Models\User::find($userId);
if (!$user) {
    echo "Usuário não encontrado: {$userId}\n";
    exit(1);
}

echo "Monitorando presença do usuário:\n";
echo "  ID: {$user->id}\n";
echo "  Nome: {$user->name}\n";
echo "  Email: {$user->email}\n";
echo str_repeat("-", 80) . "\n";
echo "Pressione Ctrl+C para parar\n\n";

$iteration = 0;
while (true) {
    $user->refresh();
    $iteration++;
    
    $now = now();
    $lastSeen = $user->last_seen_at;
    $diffSeconds = $lastSeen ? $now->diffInSeconds($lastSeen, false) : null;
    $diffMinutes = $lastSeen ? floor(abs($diffSeconds) / 60) : null;
    $isOnline = $diffSeconds !== null && $diffSeconds >= 0 && $diffSeconds <= (5 * 60);
    
    $status = $isOnline ? "✓ ONLINE" : "✗ Offline";
    $lastSeenFormatted = $lastSeen ? $lastSeen->format('H:i:s') : 'Nunca';
    
    echo sprintf(
        "[%02d] %s | %s | Last seen: %s (%d min / %d sec atrás)\n",
        $iteration,
        $now->format('H:i:s'),
        $status,
        $lastSeenFormatted,
        $diffMinutes ?? 0,
        $diffSeconds ?? 0
    );
    
    sleep(5);
}
