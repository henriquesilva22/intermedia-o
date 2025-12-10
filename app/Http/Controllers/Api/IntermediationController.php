<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Negotiation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class IntermediationController extends Controller
{
    /**
     * List negotiations for the authenticated user (as seller or buyer).
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $negotiations = Negotiation::with(['seller:id,name,email,phone', 'buyer:id,name,email,phone'])
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

        $negotiation = Negotiation::with(['seller:id,name,email,phone', 'buyer:id,name,email,phone'])
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
            'product_photos' => !empty($photosPaths) ? json_encode($photosPaths) : null,
            'status' => 'awaiting_admin_approval',
        ]);

        $negotiation->load(['seller:id,name,email,phone', 'buyer:id,name,email,phone']);

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

        $negotiations = Negotiation::with(['seller:id,name,email,phone', 'buyer:id,name,email,phone'])
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn ($n) => $this->transform($n, $user));

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

        $negotiations = Negotiation::with(['seller:id,name,email,phone', 'buyer:id,name,email,phone'])
            ->where('status', 'awaiting_admin_approval')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($n) => $this->transform($n, $user));

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

        $negotiation->update([
            'status' => 'pending_acceptance',
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

        // If no buyer yet, current user becomes buyer by accepting
        if ($negotiation->status === 'pending_acceptance' && ! $negotiation->buyer_id && $negotiation->seller_id !== $user->id) {
            $negotiation->update([
                'buyer_id' => $user->id,
                'status' => 'waiting_payment',
                'accepted_at' => now(),
            ]);
            return response()->json(['success' => true]);
        }

        // Buyer accepts
        if ($negotiation->isBuyer($user) && $negotiation->status === 'pending_acceptance') {
            $negotiation->update([
                'status' => 'waiting_payment',
                'accepted_at' => now(),
            ]);
            return response()->json(['success' => true]);
        }

        return response()->json(['message' => 'Acao nao permitida.'], 400);
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

        $negotiation->update([
            'status' => 'delivered',
            'delivered_at' => now(),
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

        if (! $negotiation->isSeller($user) && $user->role !== 'admin') {
            return response()->json(['message' => 'Apenas o vendedor pode adicionar rastreio.'], 403);
        }

        $data = Validator::make($request->all(), [
            'tracking_code' => ['required', 'string', 'max:100'],
            'tracking_carrier' => ['nullable', 'string', 'max:100'],
        ])->validate();

        $negotiation->update([
            'tracking_code' => $data['tracking_code'],
            'tracking_carrier' => $data['tracking_carrier'] ?? null,
            'status' => 'shipped',
            'shipped_at' => now(),
        ]);

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

        $data = Validator::make($request->all(), [
            'tracking_code' => ['required', 'string', 'max:100'],
            'tracking_carrier' => ['nullable', 'string', 'max:100'],
        ])->validate();

        $negotiation->update([
            'buyer_tracking_code' => $data['tracking_code'],
            'buyer_tracking_carrier' => $data['tracking_carrier'] ?? null,
            'status' => 'approved',
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

        if ($negotiation->buyer_id !== $user->id) {
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
                $path = $photo->store('inspections', 'public');
                $newPhotos[] = $path;
            }
        }

        // Mesclar fotos existentes se estiver editando
        $existingPhotos = $negotiation->intermediary_photos ?? [];
        if (is_string($existingPhotos)) {
            $existingPhotos = json_decode($existingPhotos, true) ?: [];
        }
        $allPhotos = array_merge($existingPhotos, $newPhotos);
        $allPhotos = array_slice($allPhotos, 0, 3); // Máximo 3 fotos

        $negotiation->update([
            'intermediary_checklist' => $checklist,
            'intermediary_notes' => $notes,
            'intermediary_photos' => $allPhotos,
            'inspection_saved_at' => now(),
        ]);

        $negotiation->load(['seller:id,name,email,phone', 'buyer:id,name,email,phone']);

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

        $negotiation->load(['seller:id,name,email,phone', 'buyer:id,name,email,phone']);

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
                'date' => $negotiation->created_at->toIso8601String(),
            ];
        }

        if ($negotiation->accepted_at) {
            $events[] = [
                'type' => 'accepted',
                'label' => 'Aceita pelo comprador',
                'date' => $negotiation->accepted_at->toIso8601String(),
            ];
        }

        if ($negotiation->paid_at) {
            $events[] = [
                'type' => 'paid',
                'label' => 'Pagamento confirmado',
                'date' => $negotiation->paid_at->toIso8601String(),
            ];
        }

        if ($negotiation->shipped_at) {
            $events[] = [
                'type' => 'shipped',
                'label' => 'Enviado para intermediadora',
                'date' => $negotiation->shipped_at->toIso8601String(),
            ];
        }

        if ($negotiation->received_at) {
            $events[] = [
                'type' => 'received',
                'label' => 'Recebido na intermediadora',
                'date' => $negotiation->received_at->toIso8601String(),
            ];
        }

        if ($negotiation->delivered_at) {
            $events[] = [
                'type' => 'delivered',
                'label' => 'Entregue ao comprador',
                'date' => $negotiation->delivered_at->toIso8601String(),
            ];
        }

        return response()->json(['data' => $events]);
    }

    /**
     * Transform negotiation for API response.
     */
    protected function transform(Negotiation $negotiation, $currentUser): array
    {
        // Build product photos URLs
        $productPhotos = [];
        if ($negotiation->product_photos) {
            $photos = is_array($negotiation->product_photos) 
                ? $negotiation->product_photos 
                : json_decode($negotiation->product_photos, true);
            if (is_array($photos)) {
                foreach ($photos as $photo) {
                    $productPhotos[] = asset('storage/' . $photo);
                }
            }
        }

        // Build intermediary photos URLs
        $intermediaryPhotos = [];
        if ($negotiation->intermediary_photos) {
            $photos = is_array($negotiation->intermediary_photos) 
                ? $negotiation->intermediary_photos 
                : json_decode($negotiation->intermediary_photos, true);
            if (is_array($photos)) {
                foreach ($photos as $photo) {
                    $intermediaryPhotos[] = asset('storage/' . $photo);
                }
            }
        }

        return [
            'id' => $negotiation->id,
            'title' => $negotiation->title,
            'description' => $negotiation->description,
            'category' => $negotiation->category,
            'price' => (float) $negotiation->price,
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
            'tracking_code' => $negotiation->tracking_code,
            'tracking_carrier' => $negotiation->tracking_carrier,
            'buyer_tracking_code' => $negotiation->buyer_tracking_code,
            'buyer_tracking_carrier' => $negotiation->buyer_tracking_carrier,
            'rejection_reason' => $negotiation->rejection_reason,
            'buyer_rejection_reason' => $negotiation->buyer_rejection_reason,
            'buyer_rejection_details' => $negotiation->buyer_rejection_details,
            'product_photos' => $productPhotos,
            'intermediary_checklist' => $negotiation->intermediary_checklist,
            'intermediary_notes' => $negotiation->intermediary_notes,
            'intermediary_photos' => $intermediaryPhotos,
            'inspection_saved_at' => $negotiation->inspection_saved_at?->toIso8601String(),
            'internal_logs' => $negotiation->internal_logs ?? [],
            'pix_code' => $negotiation->pix_code,
            'pix_generated_at' => $negotiation->pix_generated_at?->toIso8601String(),
            'accepted_at' => $negotiation->accepted_at?->toIso8601String(),
            'paid_at' => $negotiation->paid_at?->toIso8601String(),
            'shipped_at' => $negotiation->shipped_at?->toIso8601String(),
            'received_at' => $negotiation->received_at?->toIso8601String(),
            'delivered_at' => $negotiation->delivered_at?->toIso8601String(),
            'created_at' => $negotiation->created_at?->toIso8601String(),
            'updated_at' => $negotiation->updated_at?->toIso8601String(),
        ];
    }
}
