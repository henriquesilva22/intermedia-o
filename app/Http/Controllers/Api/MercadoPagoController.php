<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Negotiation;
use App\Services\Payments\MercadoPagoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class MercadoPagoController extends Controller
{
    private function isDigitalDeliveryCategory(?string $category): bool
    {
        $category = trim((string) $category);
        return in_array($category, ['Conta de jogo', 'Moedas / Gold / Créditos', 'Chave de jogo / DLC'], true);
    }

    /**
     * Webhook do Mercado Pago.
     * Mercado Pago costuma enviar: {"type":"payment","data":{"id":"123"}} (ou variações)
     */
    public function webhook(Request $request, MercadoPagoService $service): JsonResponse
    {
        $payload = $request->all();

        $paymentId = $payload['data']['id'] ?? $payload['id'] ?? $request->query('data.id') ?? $request->query('id');
        if (! $paymentId) {
            return response()->json(['success' => true]);
        }

        try {
            $payment = $service->getPayment((string) $paymentId);

            $externalReference = (string) ($payment['external_reference'] ?? '');
            $status = (string) ($payment['status'] ?? '');

            // Esperamos external_reference = negotiation:{id} ou apenas {id}
            $negotiationId = null;
            if ($externalReference !== '') {
                if (str_starts_with($externalReference, 'negotiation:')) {
                    $negotiationId = (int) str_replace('negotiation:', '', $externalReference);
                } elseif (ctype_digit($externalReference)) {
                    $negotiationId = (int) $externalReference;
                }
            }

            if ($negotiationId) {
                $negotiation = Negotiation::find($negotiationId);
                if ($negotiation) {
                    // Atualiza Pix code (se vier) e confirma pagamento quando aprovado.
                    $transactionData = $payment['point_of_interaction']['transaction_data'] ?? [];
                    $pixCode = $transactionData['qr_code'] ?? null;

                    $updates = [];
                    if (is_string($pixCode) && $pixCode !== '' && strlen($pixCode) <= 500) {
                        $updates['pix_code'] = $pixCode;
                        $updates['pix_generated_at'] = now();
                    }

                    if ($status === 'approved' && $negotiation->status === 'waiting_payment') {
                        $updates['status'] = $this->isDigitalDeliveryCategory($negotiation->category)
                            ? 'waiting_digital_delivery'
                            : 'waiting_shipment';
                        $updates['paid_at'] = now();
                        $updates['payment_confirmed_by_buyer'] = true;
                    }

                    if (! empty($updates)) {
                        $negotiation->update($updates);
                    }
                }
            }
        } catch (\Throwable $exception) {
            Log::warning('MercadoPago webhook error: ' . $exception->getMessage(), [
                'payload' => $payload,
            ]);
            // Sempre responder 200 para o MP não ficar re-tentando indefinidamente por falhas transitórias.
        }

        return response()->json(['success' => true]);
    }

    /**
     * Gera (ou re-gera) o Pix para o comprador pagar a negociação.
     */
    public function generatePix(Request $request, int $id, MercadoPagoService $service): JsonResponse
    {
        $user = $request->user();
        $negotiation = Negotiation::with(['buyer'])->find($id);

        if (! $negotiation) {
            return response()->json(['message' => 'Negociacao nao encontrada.'], 404);
        }

        $isAdmin = $user && $user->role === 'admin';
        if (! $isAdmin && $negotiation->buyer_id !== $user->id) {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        if ($negotiation->status !== 'waiting_payment') {
            return response()->json(['message' => 'Pagamento nao esperado neste status.'], 400);
        }

        $buyer = $negotiation->buyer;
        if (! $buyer || ! $buyer->email) {
            return response()->json(['message' => 'Comprador nao definido para esta negociacao.'], 422);
        }

        $buyerFee = (float) config('services.mercadopago.buyer_fee_brl', 15);
        $amount = (float) $negotiation->price + $buyerFee;

        try {
            $result = $service->createPixPayment([
                'transaction_amount' => $amount,
                'description' => 'Intermediação segura - ' . (string) $negotiation->title,
                'payer_email' => (string) $buyer->email,
                'external_reference' => 'negotiation:' . (string) $negotiation->id,
                'idempotency_key' => Str::uuid()->toString(),
            ]);

            $pixCode = $result['pix_code'] ?? null;
            if (! is_string($pixCode) || $pixCode === '') {
                return response()->json(['message' => 'Mercado Pago não retornou pix_code.'], 502);
            }

            if (strlen($pixCode) > 500) {
                return response()->json([
                    'message' => 'Pix code maior que 500 caracteres. Ajuste o campo negotiations.pix_code para TEXT ou aumente o tamanho.',
                ], 500);
            }

            $negotiation->update([
                'pix_code' => $pixCode,
                'pix_generated_at' => now(),
            ]);

            return response()->json([
                'success' => true,
                'data' => [
                    'pix_code' => $pixCode,
                    'pix_generated_at' => now()->toIso8601String(),
                ],
            ]);
        } catch (\Throwable $exception) {
            Log::warning('MercadoPago generatePix error: ' . $exception->getMessage(), [
                'negotiation_id' => $negotiation->id,
            ]);

            return response()->json(['message' => 'Falha ao gerar Pix no Mercado Pago.'], 502);
        }
    }
}
