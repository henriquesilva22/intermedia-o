<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\IntermediationController;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:api')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // Busca de usuário por email
    Route::get('/users/search', [AuthController::class, 'searchByEmail']);

    // Intermediation routes
    Route::get('/intermediation', [IntermediationController::class, 'index']);
    Route::post('/intermediation', [IntermediationController::class, 'store']);
    Route::get('/intermediation/admin/all', [IntermediationController::class, 'adminAll']);
    Route::get('/intermediation/admin/pending', [IntermediationController::class, 'adminPending']);
    Route::get('/intermediation/admin/pending/count', [IntermediationController::class, 'adminPendingCount']);
    Route::post('/intermediation/admin/pending/opened', [IntermediationController::class, 'adminPendingOpened']);
    Route::get('/intermediation/{id}', [IntermediationController::class, 'show']);
    Route::post('/intermediation/{id}/admin-approve', [IntermediationController::class, 'adminApprove']);
    Route::post('/intermediation/{id}/admin-reject', [IntermediationController::class, 'adminReject']);
    Route::post('/intermediation/{id}/approve', [IntermediationController::class, 'approve']);
    Route::post('/intermediation/{id}/mark-received', [IntermediationController::class, 'markReceived']);
    Route::post('/intermediation/{id}/buyer-confirm', [IntermediationController::class, 'buyerConfirm']);
    Route::post('/intermediation/{id}/buyer-reject', [IntermediationController::class, 'buyerReject']);
    Route::post('/intermediation/{id}/confirm-payment', [IntermediationController::class, 'confirmPayment']);
    Route::post('/intermediation/{id}/tracking', [IntermediationController::class, 'tracking']);
    Route::post('/intermediation/{id}/tracking/buyer', [IntermediationController::class, 'trackingBuyer']);
    Route::post('/intermediation/{id}/inspection-report', [IntermediationController::class, 'saveInspectionReport']);
    Route::post('/intermediation/{id}/logs', [IntermediationController::class, 'addLog']);
    Route::get('/intermediation/{id}/timeline', [IntermediationController::class, 'timeline']);

    // Admin routes
    Route::get('/admin/users', [AdminController::class, 'users']);
    Route::post('/admin/users', [AdminController::class, 'storeUser']);
    Route::delete('/admin/users/{id}', [AdminController::class, 'destroyUser']);
});
