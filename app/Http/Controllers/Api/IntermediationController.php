<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Negotiation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class IntermediationController extends Controller
{
    private function toIso8601StringOrNull(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if ($value instanceof \DateTimeInterface) {
            return \Illuminate\Support\Carbon::instance($value)->toIso8601String();
        }

        if (is_string($value)) {
            try {
                return \Illuminate\Support\Carbon::parse($value)->toIso8601String();
            } catch (\Throwable $exception) {
                return $value;
            }
        }

        return null;
    }

    /**
     * List negotiations for the authenticated user (as seller or buyer).
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $negotiations = Negotiation::with(['seller:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state', 'buyer:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state'])
            ->where('seller_id', $user->id)
            ->orWhere('buyer_id', $user->id)
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn ($n) => $this->transform($n, $user));

        return response()->json(['data' => $negotiations]);
    }

    /**
     * Show a single negotiation.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $negotiation = Negotiation::with(['seller:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state', 'buyer:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state'])
            ->find($id);

        if (! $negotiation) {
            return response()->json(['message' => 'Negociacao nao encontrada.'], 404);
        }

        // Allow participant or admin
        if (! $negotiation->isParticipant($user) && $user->role !== 'admin') {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        return response()->json(['data' => $this->transform($negotiation, $user)]);
    }

    /**
     * Create a new negotiation. The authenticated user becomes the seller.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        // Normalize terms_accepted para aceitar vários formatos
        $termsAccepted = $request->input('terms_accepted');
        if (is_string($termsAccepted)) {
            $termsAccepted = in_array(strtolower($termsAccepted), ['true', '1', 'on', 'yes']);
        }
        $request->merge(['terms_accepted' => $termsAccepted ? 'yes' : '']);

        $data = Validator::make($request->all(), [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'price' => ['required', 'numeric', 'min:50', 'max:100000'],
            'category' => ['required', 'string', 'max:100'],
            'buyer_email' => ['nullable', 'email', 'exists:users,email'],
            'photos' => ['nullable', 'array', 'max:8'],
            'photos.*' => ['file', 'image', 'max:5120'], // 5MB max per photo
            'terms_accepted' => ['required', 'accepted'],
        ])->validate();

        $buyerId = null;
        if (! empty($data['buyer_email'])) {
            $buyer = \App\Models\User::where('email', $data['buyer_email'])->first();
            if ($buyer && $buyer->id !== $user->id) {
                $buyerId = $buyer->id;
            }
        }

        // Handle photo uploads
        $photosPaths = [];
        if ($request->hasFile('photos')) {
            foreach ($request->file('photos') as $photo) {
                $path = $photo->store('negotiations/photos', 'public');
                $photosPaths[] = $path;
            }
        }

        $negotiation = Negotiation::create([
            'seller_id' => $user->id,
            'buyer_id' => $buyerId,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'price' => $data['price'],
            'category' => $data['category'],
            'product_photos' => !empty($photosPaths) ? $photosPaths : null,
            'status' => 'pending_acceptance',
        ]);

        $negotiation->load(['seller:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state', 'buyer:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state']);

        return response()->json(['data' => $this->transform($negotiation, $user)], 201);
    }

    /**
     * Admin: list all negotiations.
     */
    public function adminAll(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        $negotiations = Negotiation::with(['seller:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state', 'buyer:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state'])
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn ($n) => $this->transform($n, $user, ['include_photos' => false]));

        return response()->json(['data' => $negotiations]);
    }

    /**
     * Admin: pending negotiations list.
     */
    public function adminPending(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        $negotiations = Negotiation::with(['seller:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state', 'buyer:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state'])
            ->where('status', 'awaiting_admin_approval')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($n) => $this->transform($n, $user, ['include_photos' => false]));

        return response()->json(['data' => $negotiations]);
    }

    /**
     * Admin: pending count.
     */
    public function adminPendingCount(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'admin') {
            return response()->json(['count' => 0]);
        }

        $count = Negotiation::where('status', 'awaiting_admin_approval')->count();

        return response()->json(['count' => $count]);
    }

    /**
     * Admin: mark pending as opened (acknowledge).
     */
    public function adminPendingOpened(Request $request): JsonResponse
    {
        return response()->json(['success' => true]);
    }

    /**
     * Admin: approve a negotiation.
     */
    public function adminApprove(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        $negotiation = Negotiation::find($id);
        if (! $negotiation) {
            return response()->json(['message' => 'Negociacao nao encontrada.'], 404);
        }

        if ($negotiation->status !== 'awaiting_admin_approval') {
            return response()->json(['message' => 'Aprovação não disponível neste status.'], 422);
        }

        $negotiation->update([
            'status' => 'waiting_payment',
        ]);

        return response()->json(['success' => true]);
    }

    /**
     * Admin: reject a negotiation.
     */
    public function adminReject(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        $negotiation = Negotiation::find($id);
        if (! $negotiation) {
            return response()->json(['message' => 'Negociacao nao encontrada.'], 404);
        }

        $reason = $request->input('reason', '');

        $negotiation->update([
            'status' => 'rejected_by_admin',
            'rejection_reason' => $reason,
        ]);

        return response()->json(['success' => true]);
    }

    /**
     * Approve action (buyer accepts the negotiation or other transitions).
     */
    public function approve(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $negotiation = Negotiation::find($id);

        if (! $negotiation) {
            return response()->json(['message' => 'Negociacao nao encontrada.'], 404);
        }

        // Intermediadora/inspector: aprovar/reprovar após inspeção
        if (in_array($user->role, ['admin', 'inspector'], true) && $request->has('approved')) {
            if ($negotiation->status !== 'at_intermediary') {
                return response()->json(['message' => 'Ação disponível apenas quando o produto está na intermediadora.'], 422);
            }
            if (! $negotiation->inspection_saved_at) {
                return response()->json(['message' => 'Envie o relatório de inspeção antes de aprovar/reprovar.'], 422);
            }

            $approvedRaw = $request->input('approved');
            $approved = filter_var($approvedRaw, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($approved === null) {
                return response()->json(['message' => 'Campo approved inválido.'], 422);
            }

            $notes = (string) ($request->input('notes') ?? $request->input('intermediary_notes') ?? '');

            if ($approved) {
                $trackingToBuyer = trim((string) $request->input('tracking_to_buyer'));
                if ($trackingToBuyer === '') {
                    return response()->json(['message' => 'Informe o rastreio para o comprador.'], 422);
                }

                $negotiation->update([
                    'buyer_tracking_code' => $trackingToBuyer,
                    'status' => 'approved',
                    'intermediary_approval_confirmed_at' => now(),
                    'sent_to_buyer_at' => now(),
                    'intermediary_notes' => $notes !== '' ? $notes : $negotiation->intermediary_notes,
                ]);

                return response()->json(['success' => true]);
            }

            $negotiation->update([
                'status' => 'rejected_by_admin',
                'rejection_reason' => $notes !== '' ? $notes : $negotiation->rejection_reason,
                'intermediary_approval_confirmed_at' => now(),
            ]);

            return response()->json(['success' => true]);
        }

        if ($negotiation->status !== 'pending_acceptance') {
            return response()->json(['message' => 'Aceite não disponível neste status.'], 422);
        }

        if ($negotiation->seller_id === $user->id) {
            return response()->json(['message' => 'O vendedor não pode aceitar a própria negociação.'], 403);
        }

        if ($user->role !== 'buyer') {
            return response()->json(['message' => 'Apenas compradores podem aceitar uma negociação.'], 403);
        }

        // If no buyer yet, current user becomes buyer by accepting
        if (! $negotiation->buyer_id) {
            $negotiation->update([
                'buyer_id' => $user->id,
                'status' => 'awaiting_admin_approval',
                'accepted_at' => now(),
            ]);
            return response()->json(['success' => true]);
        }

        // Buyer accepts
        if ($negotiation->isBuyer($user)) {
            $negotiation->update([
                'status' => 'awaiting_admin_approval',
                'accepted_at' => now(),
            ]);
            return response()->json(['success' => true]);
        }

        return response()->json(['message' => 'Acao nao permitida.'], 403);
    }

    /**
     * Mark as received at intermediary.
     */
    public function markReceived(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'admin' && $user->role !== 'inspector') {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        $negotiation = Negotiation::find($id);
        if (! $negotiation) {
            return response()->json(['message' => 'Negociacao nao encontrada.'], 404);
        }

        if ($negotiation->status !== 'shipped') {
            return response()->json(['message' => 'Recebimento disponível apenas após envio (Em Trânsito).'], 422);
        }

        $negotiation->update([
            'status' => 'at_intermediary',
            'received_at' => now(),
        ]);

        return response()->json(['success' => true]);
    }

    /**
     * Buyer confirms delivery.
     */
    public function buyerConfirm(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $negotiation = Negotiation::find($id);

        if (! $negotiation) {
            return response()->json(['message' => 'Negociacao nao encontrada.'], 404);
        }

        if (! $negotiation->isBuyer($user)) {
            return response()->json(['message' => 'Apenas o comprador pode confirmar.'], 403);
        }

        if ($negotiation->status !== 'approved') {
            return response()->json(['message' => 'Confirmação de entrega disponível apenas após aprovação da intermediadora.'], 422);
        }

        $data = Validator::make($request->all(), [
            'rating' => ['nullable', 'integer', 'min:1', 'max:10'],
            'comment' => ['nullable', 'string', 'max:500'],
        ])->validate();

        $rating = array_key_exists('rating', $data) ? $data['rating'] : null;
        $comment = array_key_exists('comment', $data) ? $data['comment'] : null;

        $negotiation->update([
            'status' => 'delivered',
            'delivered_at' => now(),
            'buyer_confirmed_at' => now(),
            'buyer_rating' => $rating ?? $negotiation->buyer_rating,
            'buyer_rating_note' => is_string($comment) ? trim($comment) : $negotiation->buyer_rating_note,
        ]);

        return response()->json(['success' => true]);
    }

    /**
     * Seller feedback (experience rating).
     */
    public function sellerFeedback(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $negotiation = Negotiation::find($id);

        if (! $negotiation) {
            return response()->json(['message' => 'Negociacao nao encontrada.'], 404);
        }

        if (! $negotiation->isSeller($user)) {
            return response()->json(['message' => 'Apenas o vendedor pode enviar feedback.'], 403);
        }

        if ($negotiation->status !== 'delivered') {
            return response()->json(['message' => 'Feedback disponível apenas após a entrega ser confirmada.'], 422);
        }

        $data = Validator::make($request->all(), [
            'rating' => ['required', 'integer', 'min:1', 'max:10'],
            'comment' => ['nullable', 'string', 'max:500'],
        ])->validate();

        $negotiation->update([
            'seller_rating' => $data['rating'],
            'seller_rating_note' => isset($data['comment']) ? trim((string) $data['comment']) : null,
        ]);

        return response()->json(['success' => true]);
    }

    /**
     * Intermediary feedback (admin/inspector experience rating).
     */
    public function intermediaryFeedback(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'admin' && $user->role !== 'inspector') {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        $negotiation = Negotiation::find($id);
        if (! $negotiation) {
            return response()->json(['message' => 'Negociacao nao encontrada.'], 404);
        }

        if ($negotiation->status !== 'delivered') {
            return response()->json(['message' => 'Feedback disponível apenas após a entrega ser confirmada.'], 422);
        }

        $data = Validator::make($request->all(), [
            'rating' => ['required', 'integer', 'min:1', 'max:10'],
            'comment' => ['nullable', 'string', 'max:500'],
        ])->validate();

        $negotiation->update([
            'intermediary_rating' => $data['rating'],
            'intermediary_rating_note' => isset($data['comment']) ? trim((string) $data['comment']) : null,
        ]);

        return response()->json(['success' => true]);
    }

    /**
     * Add tracking info (seller sends to intermediary).
     */
    public function tracking(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $negotiation = Negotiation::find($id);

        if (! $negotiation) {
            return response()->json(['message' => 'Negociacao nao encontrada.'], 404);
        }

        $isAdmin = $user->role === 'admin';

        if (! $negotiation->isSeller($user) && ! $isAdmin) {
            return response()->json(['message' => 'Apenas o vendedor pode adicionar rastreio.'], 403);
        }

        // Vendedor só pode registrar o envio quando estiver em "Aguardando Envio".
        // Admin pode corrigir/editar o código mesmo em outros status (sem alterar o status automaticamente).
        if (! $isAdmin && $negotiation->status !== 'waiting_shipment') {
            return response()->json(['message' => 'Rastreio disponível apenas após confirmação do pagamento (Aguardando Envio).'], 422);
        }

        $data = Validator::make($request->all(), [
            'tracking_code' => ['required', 'string', 'max:100'],
            'tracking_carrier' => ['nullable', 'string', 'max:100'],
        ])->validate();

        $update = [
            'tracking_code' => $data['tracking_code'],
            'tracking_carrier' => $data['tracking_carrier'] ?? null,
        ];

        // Só força transição de status quando estiver no fluxo normal de envio.
        if ($negotiation->status === 'waiting_shipment') {
            $update['status'] = 'shipped';
            $update['shipped_at'] = $negotiation->shipped_at ?? now();
        }

        $negotiation->update($update);

        return response()->json(['success' => true]);
    }

    /**
     * Add buyer tracking info (intermediary sends to buyer).
     */
    public function trackingBuyer(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'admin' && $user->role !== 'inspector') {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        $negotiation = Negotiation::find($id);
        if (! $negotiation) {
            return response()->json(['message' => 'Negociacao nao encontrada.'], 404);
        }

        if ($negotiation->status !== 'at_intermediary' && $negotiation->status !== 'approved') {
            return response()->json(['message' => 'Ação não disponível neste status.'], 422);
        }

        if (! $negotiation->inspection_saved_at) {
            return response()->json(['message' => 'Envie o relatório de inspeção antes de informar o rastreio do comprador.'], 422);
        }

        $data = Validator::make($request->all(), [
            'tracking_code' => ['required', 'string', 'max:100'],
            'tracking_carrier' => ['nullable', 'string', 'max:100'],
        ])->validate();

        $negotiation->update([
            'buyer_tracking_code' => $data['tracking_code'],
            'buyer_tracking_carrier' => $data['tracking_carrier'] ?? null,
            'status' => 'approved',
            'sent_to_buyer_at' => $negotiation->sent_to_buyer_at ?? now(),
            'intermediary_approval_confirmed_at' => $negotiation->intermediary_approval_confirmed_at ?? now(),
        ]);

        return response()->json(['success' => true]);
    }

    /**
     * Buyer rejects the negotiation.
     */
    public function buyerReject(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $negotiation = Negotiation::find($id);

        if (! $negotiation) {
            return response()->json(['message' => 'Negociacao nao encontrada.'], 404);
        }

        if ($negotiation->buyer_id !== $user->id) {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        $data = Validator::make($request->all(), [
            'reason_type' => ['required', 'string', 'max:50'],
            'reason_details' => ['nullable', 'string', 'max:500'],
        ])->validate();

        $negotiation->update([
            'status' => 'cancelled',
            'buyer_rejection_reason' => $data['reason_type'],
            'buyer_rejection_details' => $data['reason_details'] ?? null,
            'cancelled_at' => now(),
        ]);

        return response()->json(['success' => true]);
    }

    /**
     * Buyer confirms payment.
     */
    public function confirmPayment(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $negotiation = Negotiation::find($id);

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

        $negotiation->update([
            'status' => 'waiting_shipment',
            'paid_at' => now(),
            'payment_confirmed_by_buyer' => true,
        ]);

        return response()->json(['success' => true]);
    }

    /**
     * Save inspection report.
     */
    public function saveInspectionReport(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'admin' && $user->role !== 'inspector') {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        $negotiation = Negotiation::find($id);
        if (! $negotiation) {
            return response()->json(['message' => 'Negociacao nao encontrada.'], 404);
        }

        $checklist = json_decode($request->input('checklist'), true) ?: [];
        $notes = $request->input('notes', '');
        
        // Processar novas fotos
        $newPhotos = [];
        if ($request->hasFile('photos')) {
            foreach ($request->file('photos') as $photo) {
                $path = $photo->store("negotiations/{$negotiation->id}/intermediary", 'public');
                $newPhotos[] = $path;
            }
        }

        // Mesclar fotos existentes se estiver editando
        $existingPhotos = $negotiation->intermediary_photos ?? [];
        if (is_string($existingPhotos)) {
            $existingPhotos = json_decode($existingPhotos, true) ?: [];
        }
        $allPhotos = array_merge($existingPhotos, $newPhotos);
        $allPhotos = array_values(array_unique($allPhotos));
        $allPhotos = array_slice($allPhotos, 0, 3); // Máximo 3 fotos

        $negotiation->update([
            'intermediary_checklist' => $checklist,
            'intermediary_notes' => $notes,
            'intermediary_photos' => $allPhotos,
            'inspection_saved_at' => now(),
        ]);

        $negotiation->load(['seller:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state', 'buyer:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state']);

        return response()->json([
            'success' => true,
            'data' => $this->transform($negotiation, $user)
        ]);
    }

    /**
     * Add internal log.
     */
    public function addLog(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'admin' && $user->role !== 'inspector') {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        $negotiation = Negotiation::find($id);
        if (! $negotiation) {
            return response()->json(['message' => 'Negociacao nao encontrada.'], 404);
        }

        $data = Validator::make($request->all(), [
            'message' => ['required', 'string', 'max:500'],
            'type' => ['nullable', 'string', 'in:note,warning,action,system,error'],
        ])->validate();

        $logs = $negotiation->internal_logs ?? [];
        if (is_string($logs)) {
            $logs = json_decode($logs, true) ?: [];
        }
        
        $logs[] = [
            'id' => count($logs) + 1,
            'message' => $data['message'],
            'type' => $data['type'] ?? 'note',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
            ],
            'created_at' => now()->toIso8601String(),
        ];

        $negotiation->update(['internal_logs' => $logs]);

        $negotiation->load(['seller:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state', 'buyer:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state']);

        return response()->json([
            'success' => true, 
            'data' => $this->transform($negotiation, $user)
        ]);
    }

    /**
     * Get negotiation timeline.
     */
    public function timeline(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $negotiation = Negotiation::find($id);

        if (! $negotiation) {
            return response()->json(['message' => 'Negociacao nao encontrada.'], 404);
        }

        if (! $negotiation->isParticipant($user) && $user->role !== 'admin') {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        $events = [];

        if ($negotiation->created_at) {
            $events[] = [
                'type' => 'created',
                'label' => 'Negociação criada',
                'date' => $this->toIso8601StringOrNull($negotiation->created_at),
            ];
        }

        if ($negotiation->accepted_at) {
            $events[] = [
                'type' => 'accepted',
                'label' => 'Aceita pelo comprador',
                'date' => $this->toIso8601StringOrNull($negotiation->accepted_at),
            ];
        }

        if ($negotiation->paid_at) {
            $events[] = [
                'type' => 'paid',
                'label' => 'Pagamento confirmado',
                'date' => $this->toIso8601StringOrNull($negotiation->paid_at),
            ];
        }

        if ($negotiation->shipped_at) {
            $events[] = [
                'type' => 'shipped',
                'label' => 'Enviado para intermediadora',
                'date' => $this->toIso8601StringOrNull($negotiation->shipped_at),
            ];
        }

        if ($negotiation->received_at) {
            $events[] = [
                'type' => 'received',
                'label' => 'Recebido na intermediadora',
                'date' => $this->toIso8601StringOrNull($negotiation->received_at),
            ];
        }

        if ($negotiation->delivered_at) {
            $events[] = [
                'type' => 'delivered',
                'label' => 'Entregue ao comprador',
                'date' => $this->toIso8601StringOrNull($negotiation->delivered_at),
            ];
        }

        return response()->json(['data' => $events]);
    }

    /**
     * Admin: remove stored images from a concluded negotiation to save storage.
     */
    public function purgeImages(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (! $user || $user->role !== 'admin') {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        $negotiation = Negotiation::find($id);
        if (! $negotiation) {
            return response()->json(['message' => 'Negociacao nao encontrada.'], 404);
        }

        if ($negotiation->status !== 'delivered') {
            return response()->json(['message' => 'Ação disponível apenas para pedidos concluídos.'], 422);
        }

        $disk = Storage::disk('public');

        $productPaths = is_array($negotiation->product_photos) ? $negotiation->product_photos : [];
        $inspectionPaths = is_array($negotiation->intermediary_photos) ? $negotiation->intermediary_photos : [];
        $allPaths = array_values(array_unique(array_filter(array_merge($productPaths, $inspectionPaths))));

        $deleted = 0;
        foreach ($allPaths as $path) {
            if (is_string($path) && $path !== '' && $disk->exists($path)) {
                if ($disk->delete($path)) {
                    $deleted += 1;
                }
            }
        }

        $negotiation->update([
            'product_photos' => null,
            'intermediary_photos' => null,
        ]);

        return response()->json([
            'success' => true,
            'deleted' => $deleted,
            'message' => 'Imagens apagadas com sucesso.'
        ]);
    }

    /**
     * Transform negotiation for API response.
     */
    protected function transform(Negotiation $negotiation, $currentUser, array $options = []): array
    {
        $publicDisk = Storage::disk('public');

        $includePhotos = $options['include_photos'] ?? true;

        $buildPhotoUrls = static function ($value) use ($publicDisk): array {
            $items = [];
            if (is_array($value)) {
                $items = $value;
            } elseif (is_string($value) && $value !== '') {
                $decoded = json_decode($value, true);
                if (is_array($decoded)) {
                    $items = $decoded;
                }
            }

            $items = array_filter($items, static fn ($path) => is_string($path) && $path !== '');

            $urls = [];
            foreach ($items as $path) {
                if ($publicDisk->exists($path)) {
                    $urls[] = $publicDisk->url($path);
                }
            }

            return $urls;
        };

        $productPhotos = $includePhotos ? $buildPhotoUrls($negotiation->product_photos) : [];
        if ($includePhotos && empty($productPhotos) && isset($negotiation->product_images)) {
            $productPhotos = $buildPhotoUrls($negotiation->product_images);
        }
        $intermediaryPhotos = $includePhotos ? $buildPhotoUrls($negotiation->intermediary_photos) : [];

        $checklist = $negotiation->intermediary_checklist;
        if (is_string($checklist) && $checklist !== '') {
            $decoded = json_decode($checklist, true);
            if (is_array($decoded)) {
                $checklist = $decoded;
            }
        }
        if (! is_array($checklist)) {
            $checklist = [];
        }

        $internalLogs = $negotiation->internal_logs;
        if (is_string($internalLogs) && $internalLogs !== '') {
            $decoded = json_decode($internalLogs, true);
            if (is_array($decoded)) {
                $internalLogs = $decoded;
            }
        }
        if (! is_array($internalLogs)) {
            $internalLogs = [];
        }

        $hasInspectionData = ! empty($checklist)
            || (is_string($negotiation->intermediary_notes) && trim($negotiation->intermediary_notes) !== '')
            || ! empty($intermediaryPhotos)
            || ! empty($negotiation->inspection_saved_at);

        $inspectionReport = $hasInspectionData ? [
            'checklist' => $checklist,
            'notes' => $negotiation->intermediary_notes ?? '',
            'photos' => $intermediaryPhotos,
            'saved_at' => $this->toIso8601StringOrNull($negotiation->inspection_saved_at),
        ] : null;

        $title = $negotiation->title ?? $negotiation->product_title ?? null;
        $description = $negotiation->description ?? $negotiation->product_description ?? null;
        $rawPrice = $negotiation->price ?? $negotiation->product_price ?? null;
        $price = is_numeric($rawPrice) ? (float) $rawPrice : 0.0;

        $trackingToIntermediary = $negotiation->tracking_code ?? $negotiation->tracking_to_intermediary ?? null;
        $trackingToBuyer = $negotiation->buyer_tracking_code ?? $negotiation->tracking_to_buyer ?? null;

        return [
            'id' => $negotiation->id,
            'title' => $title,
            'description' => $description,
            'category' => $negotiation->category,
            'price' => $price,
            'status' => $negotiation->status,
            'seller' => $negotiation->seller ? [
                'id' => $negotiation->seller->id,
                'name' => $negotiation->seller->name,
                'email' => $negotiation->seller->email,
                'phone' => $negotiation->seller->phone,
            ] : null,
            'buyer' => $negotiation->buyer ? [
                'id' => $negotiation->buyer->id,
                'name' => $negotiation->buyer->name,
                'email' => $negotiation->buyer->email,
                'phone' => $negotiation->buyer->phone,
            ] : null,
            'my_role' => $negotiation->getUserRole($currentUser),
            // Aliases usados no front
            'tracking_to_intermediary' => $trackingToIntermediary,
            'tracking_to_buyer' => $trackingToBuyer,
            'product_price' => $price,
            'buyer_accepted_at' => $this->toIso8601StringOrNull($negotiation->accepted_at),
            'product_paid_at' => $this->toIso8601StringOrNull($negotiation->paid_at),
            'sent_to_intermediary_at' => $this->toIso8601StringOrNull($negotiation->shipped_at),
            'intermediary_received_at' => $this->toIso8601StringOrNull($negotiation->received_at),
            'intermediary_received_status' => (bool) $negotiation->received_at,
            'intermediary_approval_confirmed_at' => $this->toIso8601StringOrNull($negotiation->intermediary_approval_confirmed_at),
            'sent_to_buyer_at' => $this->toIso8601StringOrNull($negotiation->sent_to_buyer_at),
            'buyer_confirmed_at' => $this->toIso8601StringOrNull($negotiation->buyer_confirmed_at ?? $negotiation->delivered_at),
            'buyer_rating' => $negotiation->buyer_rating,
            'buyer_rating_note' => $negotiation->buyer_rating_note,
            'seller_rating' => $negotiation->seller_rating,
            'seller_rating_note' => $negotiation->seller_rating_note,
            'intermediary_rating' => $negotiation->intermediary_rating,
            'intermediary_rating_note' => $negotiation->intermediary_rating_note,
            'tracking_code' => $negotiation->tracking_code,
            'tracking_carrier' => $negotiation->tracking_carrier,
            'buyer_tracking_code' => $negotiation->buyer_tracking_code,
            'buyer_tracking_carrier' => $negotiation->buyer_tracking_carrier,
            'rejection_reason' => $negotiation->rejection_reason,
            'buyer_rejection_reason' => $negotiation->buyer_rejection_reason,
            'buyer_rejection_details' => $negotiation->buyer_rejection_details,
            'product_photos' => $productPhotos,
            'inspection_report' => $inspectionReport,
            'intermediary_checklist' => $checklist,
            'intermediary_notes' => $negotiation->intermediary_notes,
            'intermediary_photos' => $intermediaryPhotos,
            'inspection_saved_at' => $this->toIso8601StringOrNull($negotiation->inspection_saved_at),
            'internal_logs' => $internalLogs,
            'pix_code' => $negotiation->pix_code,
            'pix_generated_at' => $this->toIso8601StringOrNull($negotiation->pix_generated_at),
            'accepted_at' => $this->toIso8601StringOrNull($negotiation->accepted_at),
            'paid_at' => $this->toIso8601StringOrNull($negotiation->paid_at),
            'shipped_at' => $this->toIso8601StringOrNull($negotiation->shipped_at),
            'received_at' => $this->toIso8601StringOrNull($negotiation->received_at),
            'delivered_at' => $this->toIso8601StringOrNull($negotiation->delivered_at),
            'created_at' => $this->toIso8601StringOrNull($negotiation->created_at),
            'updated_at' => $this->toIso8601StringOrNull($negotiation->updated_at),
        ];
    }
}
