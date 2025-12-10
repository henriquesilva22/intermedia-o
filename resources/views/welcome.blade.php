<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ config('app.name', 'Intermediacao') }}</title>
    <link rel="icon" href="{{ asset('favicon.ico') }}">
</head>
<body style="margin:0; background:#050b14; color:#e2e8f0;">
    <noscript>Habilite o JavaScript para utilizar o sistema de intermediacao.</noscript>
    <div id="app"></div>
    <script src="{{ asset('app/app.js') }}" defer></script>
</body>
</html>
