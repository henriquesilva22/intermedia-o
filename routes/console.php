<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('negotiations:purge-old-images --days=5')
    ->dailyAt('02:30')
    ->description('Purge negotiation images 5 days after delivery');
