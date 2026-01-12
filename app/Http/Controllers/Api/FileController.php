<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Negotiation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FileController extends Controller
{
    /**
     * Signed download for buyer payment proof.
     *
     * This route is intentionally public (no auth) but requires a valid signature.
     */
    public function downloadPaymentProof(Request $request, int $id): StreamedResponse
    {
        if (! $request->hasValidSignature()) {
            abort(403, 'Link inválido ou expirado.');
        }

        $negotiation = Negotiation::find($id);
        if (! $negotiation) {
            abort(404, 'Negociação não encontrada.');
        }

        $path = $negotiation->buyer_payment_proof;
        if (! is_string($path) || $path === '') {
            abort(404, 'Comprovante não encontrado.');
        }

        // Prefer private storage; fall back to public for legacy data.
        $disk = Storage::disk('local');
        if (! $disk->exists($path)) {
            $disk = Storage::disk('public');
            if (! $disk->exists($path)) {
                abort(404, 'Comprovante não encontrado.');
            }
        }

        $filename = 'comprovante-pagamento-' . $negotiation->id;
        $ext = pathinfo($path, PATHINFO_EXTENSION);
        if (is_string($ext) && $ext !== '') {
            $filename .= '.' . $ext;
        }

        return $disk->download($path, $filename);
    }
}
