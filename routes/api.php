<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\IntermediationController;
  use App\Http\Controllers\Api\MercadoPagoController;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Email verification via link (public routes)
Route::get('/email/verify/{id}/{token}', [AuthController::class, 'verifyEmailLink']);
Route::post('/email/resend-link', [AuthController::class, 'publicResendEmailVerification']);
Route::post('/email/verify-code', [AuthController::class, 'verifyEmailCode']);

// Mercado Pago webhook (public)
Route::post('/payments/mercadopago/webhook', [MercadoPagoController::class, 'webhook']);

Route::middleware('auth:api')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // Email verification - send link
    Route::post('/email/send-verification', [AuthController::class, 'sendEmailVerification']);

    // Busca de usuário por email
    Route::get('/users/search', [AuthController::class, 'searchByEmail']);

    // Intermediation routes
    Route::get('/intermediation', [IntermediationController::class, 'index']);
    Route::post('/intermediation', [IntermediationController::class, 'store']);
    Route::get('/intermediation/admin/all', [IntermediationController::class, 'adminAll']);
    Route::get('/intermediation/admin/pending', [IntermediationController::class, 'adminPending']);
    Route::get('/intermediation/admin/pending/count', [IntermediationController::class, 'adminPendingCount']);
    Route::post('/intermediation/admin/pending/opened', [IntermediationController::class, 'adminPendingOpened']);
    Route::delete('/intermediation/admin/{id}', [IntermediationController::class, 'adminDestroy']);
    Route::get('/intermediation/{id}', [IntermediationController::class, 'show']);
    Route::post('/intermediation/{id}/admin-approve', [IntermediationController::class, 'adminApprove']);
    Route::post('/intermediation/{id}/admin-reject', [IntermediationController::class, 'adminReject']);
    Route::post('/intermediation/{id}/approve', [IntermediationController::class, 'approve']);
    Route::post('/intermediation/{id}/mark-received', [IntermediationController::class, 'markReceived']);
    Route::post('/intermediation/{id}/buyer-confirm', [IntermediationController::class, 'buyerConfirm']);
    Route::post('/intermediation/{id}/seller-feedback', [IntermediationController::class, 'sellerFeedback']);
    Route::post('/intermediation/{id}/intermediary-feedback', [IntermediationController::class, 'intermediaryFeedback']);
    Route::post('/intermediation/{id}/buyer-reject', [IntermediationController::class, 'buyerReject']);
    Route::post('/intermediation/{id}/confirm-payment', [IntermediationController::class, 'confirmPayment']);
    Route::post('/intermediation/{id}/game-account/change-request', [IntermediationController::class, 'submitGameAccountChangeRequest']);
    Route::post('/intermediation/{id}/game-account/seller-info', [IntermediationController::class, 'submitGameAccountSellerInfo']);
    Route::post('/intermediation/{id}/game-account/digital-delivered', [IntermediationController::class, 'markDigitalDelivered']);
    Route::post('/intermediation/{id}/digital/seller-info', [IntermediationController::class, 'submitDigitalDeliveryInfo']);
    Route::post('/intermediation/{id}/digital/delivered', [IntermediationController::class, 'markDigitalDelivered']);

    // Gold/currency delivery scheduling (Moedas / Gold / Créditos)
    Route::post('/intermediation/{id}/gold/buyer-info', [IntermediationController::class, 'submitGoldBuyerInfo']);
    Route::post('/intermediation/{id}/gold/seller-info', [IntermediationController::class, 'submitGoldSellerInfo']);
    Route::post('/intermediation/{id}/gold/confirm-schedule', [IntermediationController::class, 'confirmGoldSchedule']);
    Route::post('/intermediation/{id}/gold/buyer-reschedule', [IntermediationController::class, 'submitGoldBuyerReschedule']);
    Route::post('/intermediation/{id}/gold/buyer-confirm-received', [IntermediationController::class, 'confirmGoldBuyerReceived']);
    Route::post('/intermediation/{id}/gold/seller-confirm-sent', [IntermediationController::class, 'confirmGoldSellerSent']);

    Route::post('/intermediation/{id}/payments/mercadopago/pix', [MercadoPagoController::class, 'generatePix']);
    Route::post('/intermediation/{id}/tracking', [IntermediationController::class, 'tracking']);
    Route::post('/intermediation/{id}/tracking/buyer', [IntermediationController::class, 'trackingBuyer']);
    Route::post('/intermediation/{id}/inspection-report', [IntermediationController::class, 'saveInspectionReport']);
    Route::post('/intermediation/{id}/logs', [IntermediationController::class, 'addLog']);
    Route::get('/intermediation/{id}/timeline', [IntermediationController::class, 'timeline']);
    Route::post('/intermediation/{id}/purge-images', [IntermediationController::class, 'purgeImages']);

    // Admin routes
    Route::get('/admin/users', [AdminController::class, 'users']);
    Route::post('/admin/users', [AdminController::class, 'storeUser']);
    Route::delete('/admin/users/{id}', [AdminController::class, 'destroyUser']);
});
