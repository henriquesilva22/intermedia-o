<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'brevo' => [
        'sms_key' => env('BREVO_SMS_API_KEY'),
        'sms_sender' => env('BREVO_SMS_SENDER'),
    ],

    'mercadopago' => [
        'public_key' => env('MERCADOPAGO_PUBLIC_KEY'),
        'access_token' => env('MERCADOPAGO_ACCESS_TOKEN'),
        // Opcional (OAuth): gere o access_token automaticamente via /oauth/token.
        'client_id' => env('MERCADOPAGO_CLIENT_ID'),
        'client_secret' => env('MERCADOPAGO_CLIENT_SECRET'),
        'test_token' => env('MERCADOPAGO_TEST_TOKEN', false),
        // URL pública para webhooks (ex.: https://seu-dominio.com/api/payments/mercadopago/webhook)
        'webhook_url' => env('MERCADOPAGO_WEBHOOK_URL'),
        // Token compartilhado opcional para validar o webhook.
        // Se definido, envie o mesmo valor no header X-Webhook-Token (ou query ?token=...).
        'webhook_token' => env('MERCADOPAGO_WEBHOOK_TOKEN'),
        // Taxa fixa do comprador (em BRL) somada ao valor do produto.
        'buyer_fee_brl' => (float) env('BUYER_FEE_BRL', 15),
    ],

];
