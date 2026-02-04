<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Negotiation;
use App\Models\NegotiationField;
use App\Models\Payment;
use App\Support\AuditLogger;
use App\Services\Payments\MercadoPagoService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class IntermediationController extends Controller
{
    private const GAME_ACCOUNT_CATEGORY = 'Conta de jogo';
    private const CURRENCY_CATEGORY = 'Moedas / Gold / Créditos';
    private const KEY_DLC_CATEGORY = 'Chave de jogo / DLC';

    // Back-compat (older category label)
    private const LEGACY_SERVICE_CATEGORY = 'Serviço (boosting / rank / leveling)';
    private const SERVICE_EXCHANGE_CATEGORY = 'Troca de serviço';

    // Service taxonomy categories (category implies service_id)
    private const SERVICE_BOOST_RANK_CATEGORY = 'Boost de Rank';
    private const SERVICE_CARRY_PVE_CATEGORY = 'Carry de Conteúdo (PvE)';
    private const SERVICE_LEVELING_CATEGORY = 'Leveling';
    private const SERVICE_CURRENCY_CATEGORY = 'Venda de Moeda';
    private const SERVICE_COLLECTIBLES_CATEGORY = 'Conquistas / Colecionáveis';
    private const SERVICE_SEASONAL_CATEGORY = 'Serviço de Temporada';
    private const SERVICE_CUSTOM_CATEGORY = 'Serviço Personalizado';

    private const SERVICE_TAXONOMY_CATEGORY_TO_ID = [
        self::SERVICE_BOOST_RANK_CATEGORY => 'boost_rank',
        self::SERVICE_CARRY_PVE_CATEGORY => 'carry_pve',
        self::SERVICE_LEVELING_CATEGORY => 'leveling',
        self::SERVICE_CURRENCY_CATEGORY => 'currency',
        self::SERVICE_COLLECTIBLES_CATEGORY => 'collectibles',
        self::SERVICE_SEASONAL_CATEGORY => 'seasonal',
        self::SERVICE_CUSTOM_CATEGORY => 'custom',
    ];

    private function normalizeDateOptions(mixed $value, int $max = 5): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        if (is_string($value)) {
            $decoded = json_decode($value, true);
            if (is_array($decoded)) {
                $value = $decoded;
            } else {
                // Support newline-separated dates
                $value = preg_split('/\r?\n/', $value) ?: [];
            }
        }

        if (! is_array($value)) {
            return [];
        }

        $options = [];
        foreach ($value as $item) {
            $text = trim((string) $item);
            if ($text === '') {
                continue;
            }

            if (! preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $text, $m)) {
                continue;
            }

            $y = (int) $m[1];
            $mo = (int) $m[2];
            $d = (int) $m[3];
            if (! checkdate($mo, $d, $y)) {
                continue;
            }

            $options[] = sprintf('%04d-%02d-%02d', $y, $mo, $d);
        }

        $options = array_values(array_unique($options));
        if (count($options) > $max) {
            $options = array_slice($options, 0, $max);
        }

        return $options;
    }

    private function normalizeTimeOptions(mixed $value, int $max = 5): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        if (is_string($value)) {
            $decoded = json_decode($value, true);
            if (is_array($decoded)) {
                $value = $decoded;
            } else {
                // Support newline-separated times
                $value = preg_split('/\r?\n/', $value) ?: [];
            }
        }

        if (! is_array($value)) {
            return [];
        }

        $options = [];
        foreach ($value as $item) {
            $text = trim((string) $item);
            if ($text === '') {
                continue;
            }

            // Expect HH:MM
            if (! preg_match('/^(\d{2}):(\d{2})$/', $text, $m)) {
                continue;
            }

            $h = (int) $m[1];
            $min = (int) $m[2];
            if ($h < 0 || $h > 23 || $min < 0 || $min > 59) {
                continue;
            }

            $options[] = sprintf('%02d:%02d', $h, $min);
        }

        $options = array_values(array_unique($options));
        if (count($options) > $max) {
            $options = array_slice($options, 0, $max);
        }

        return $options;
    }

    private function normalizeTimeRangeOptions(mixed $value, int $max = 5): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        if (is_string($value)) {
            $decoded = json_decode($value, true);
            if (is_array($decoded)) {
                $value = $decoded;
            }
        }

        if (! is_array($value)) {
            return [];
        }

        $options = [];
        foreach ($value as $item) {
            $text = trim((string) $item);
            if ($text === '') {
                continue;
            }

            // Expect HH:MM-HH:MM
            if (! preg_match('/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/', $text, $m)) {
                continue;
            }

            $h1 = (int) $m[1];
            $min1 = (int) $m[2];
            $h2 = (int) $m[3];
            $min2 = (int) $m[4];
            if ($h1 < 0 || $h1 > 23 || $h2 < 0 || $h2 > 23 || $min1 < 0 || $min1 > 59 || $min2 < 0 || $min2 > 59) {
                continue;
            }

            $start = $h1 * 60 + $min1;
            $end = $h2 * 60 + $min2;
            if ($end <= $start) {
                continue;
            }

            $options[] = sprintf('%02d:%02d-%02d:%02d', $h1, $min1, $h2, $min2);
        }

        $options = array_values(array_unique($options));
        if (count($options) > $max) {
            $options = array_slice($options, 0, $max);
        }

        return $options;
    }

    private function nextStatusAfterPayment(Negotiation $negotiation): string
    {
        return $this->isDigitalDeliveryCategory($negotiation->category)
            ? 'waiting_digital_delivery'
            : 'waiting_shipment';
    }

    private function withLockedNegotiation(int $id, callable $callback): mixed
    {
        return DB::transaction(function () use ($id, $callback) {
            $negotiation = Negotiation::lockForUpdate()->find($id);
            if (! $negotiation) {
                abort(404, 'Negociacao nao encontrada.');
            }

            return $callback($negotiation);
        });
    }

    private function upsertPaymentsAfterPaymentConfirmed(
        Negotiation $negotiation,
        ?string $provider = null,
        ?string $providerReference = null,
        ?string $idempotencyKey = null,
    ): void {
        $buyerFee = (float) config('services.mercadopago.buyer_fee_brl', 15);
        if ($buyerFee < 0) {
            $buyerFee = 0;
        }

        $paidAt = $negotiation->paid_at ? \Illuminate\Support\Carbon::instance($negotiation->paid_at) : now();

        // Fee (confirmada quando o pagamento do comprador é confirmado)
        Payment::updateOrCreate(
            ['negotiation_id' => $negotiation->id, 'type' => 'buyer_fee'],
            [
                'amount' => $buyerFee,
                'currency' => 'BRL',
                'provider' => $provider,
                'provider_reference' => $providerReference,
                'idempotency_key' => $idempotencyKey,
                'confirmed_at' => $paidAt,
            ]
        );

        // Repasse/liberação (pendente até a intermediadora efetuar o pagamento ao vendedor)
        Payment::firstOrCreate(
            ['negotiation_id' => $negotiation->id, 'type' => 'release'],
            [
                'amount' => (float) $negotiation->price,
                'currency' => 'BRL',
            ]
        );
    }

    private function isGameAccountCategory(?string $category): bool
    {
        return trim((string) $category) === self::GAME_ACCOUNT_CATEGORY;
    }

    private function isDigitalDeliveryCategory(?string $category): bool
    {
        $category = trim((string) $category);
        return in_array($category, [self::GAME_ACCOUNT_CATEGORY, self::CURRENCY_CATEGORY, self::KEY_DLC_CATEGORY], true);
    }

    private function isCurrencyCategory(?string $category): bool
    {
        return trim((string) $category) === self::CURRENCY_CATEGORY;
    }

    private function formatPtBrNumber(mixed $value, int $decimals = 2): string
    {
        $num = is_numeric($value) ? (float) $value : 0.0;
        $decimals = max(0, min(8, (int) $decimals));

        return number_format($num, $decimals, ',', '.');
    }

    private function isPhysicalCategory(?string $category): bool
    {
        $category = trim((string) $category);

        return in_array($category, [
            'Notebook',
            'Smartphone',
            'Celular',
            'Produto físico (pequeno)',
            'Outros (produtos físicos)',
        ], true);
    }

    private function serviceIdFromCategory(?string $category): ?string
    {
        $category = trim((string) $category);
        if ($category === '') {
            return null;
        }

        return self::SERVICE_TAXONOMY_CATEGORY_TO_ID[$category] ?? null;
    }

    private function isServiceFormsCategory(?string $category): bool
    {
        $category = trim((string) $category);
        if ($category === '') {
            return false;
        }

        return $this->serviceIdFromCategory($category) !== null
            || $category === self::LEGACY_SERVICE_CATEGORY;
    }

    private function isServiceScheduleCategory(?string $category): bool
    {
        // Service flow categories (taxonomy + legacy) require seller schedule options.
        return $this->isServiceFormsCategory($category);
    }

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

        $negotiations = Negotiation::with([
            'payments',
            'seller:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state',
            'buyer:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state',
        ])
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

        $negotiation = Negotiation::with([
            'payments',
            'seller:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state',
            'buyer:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state',
            'intermediator:id,name',
        ])
            ->find($id);

        if (! $negotiation) {
            return response()->json(['message' => 'Negociacao nao encontrada.'], 404);
        }

        $isAdmin = $user && $user->role === 'admin';
        $isIntermediator = $user && $user->role === 'intermediator';
        $isAssignedIntermediator = $isIntermediator && (int) $negotiation->intermediator_id === (int) $user->id;
        $isAvailableForIntermediator = $isIntermediator
            && $negotiation->intermediator_id === null
            && in_array((string) $negotiation->status, ['waiting_shipment', 'shipped', 'at_intermediary', 'approved', 'pending_receipt'], true);
        $isIntermediatorObserver = $isIntermediator && ! $isAssignedIntermediator;

        // Allow participant, admin, or intermediator (assigned/available/observer view).
        if (! $negotiation->isParticipant($user) && ! $isAdmin && ! $isIntermediator) {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        // Audit: when buyer opens and there are digital credentials/info available, mark as viewed.
        try {
            $isBuyer = $user && $negotiation->buyer_id === $user->id;
            if ($isBuyer && $this->isDigitalDeliveryCategory($negotiation->category)) {
                $status = (string) $negotiation->status;
                if (in_array($status, ['waiting_digital_delivery', 'approved', 'delivered'], true)) {
                    if ($this->isGameAccountCategory($negotiation->category)) {
                        if ($negotiation->game_account_seller_info && ! $negotiation->game_account_seller_info_viewed_by_buyer_at) {
                            $negotiation->update(['game_account_seller_info_viewed_by_buyer_at' => now()]);
                        }
                    } else {
                        if ($negotiation->digital_delivery_info && ! $negotiation->digital_delivery_info_viewed_by_buyer_at) {
                            $negotiation->update(['digital_delivery_info_viewed_by_buyer_at' => now()]);
                        }
                    }
                }
            }
        } catch (\Throwable $exception) {
            // ignore audit failures
        }

        return response()->json(['data' => $this->transform($negotiation, $user, [
            'include_photos' => $isAssignedIntermediator,
            'intermediator_observer' => $isIntermediatorObserver,
        ])]);
    }

    /**
     * Create a new negotiation. The authenticated user becomes the seller.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $serviceConfig = config('service_forms', []);
        $serviceLabelById = [];
        foreach (($serviceConfig['services'] ?? []) as $svc) {
            if (is_array($svc) && isset($svc['id'], $svc['label'])) {
                $serviceLabelById[(string) $svc['id']] = (string) $svc['label'];
            }
        }
        $gameLabelById = is_array($serviceConfig['games'] ?? null) ? $serviceConfig['games'] : [];
        $serviceGames = is_array($serviceConfig['serviceGames'] ?? null) ? $serviceConfig['serviceGames'] : [];
        $formFields = is_array($serviceConfig['formFields'] ?? null) ? $serviceConfig['formFields'] : [];

        // Normalize terms_accepted para aceitar vários formatos
        $termsAccepted = $request->input('terms_accepted');
        if (is_string($termsAccepted)) {
            $termsAccepted = in_array(strtolower($termsAccepted), ['true', '1', 'on', 'yes']);
        }
        $request->merge(['terms_accepted' => $termsAccepted ? 'yes' : '']);

        $validator = Validator::make($request->all(), [
            'title' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'price' => ['required', 'numeric', 'min:50', 'max:100000'],
            'category' => ['required', 'string', 'max:100'],
            'service_id' => ['nullable', 'string', 'max:80'],
            'game_id' => ['nullable', 'string', 'max:80'],
            'service_fields' => ['nullable'],
            'delivery_days' => ['nullable', 'integer', 'min:1', 'max:25'],
            'game_title' => ['nullable', 'string', 'max:120'],
            'item_name' => ['nullable', 'string', 'max:160'],
            'item_general_info' => ['nullable', 'string', 'max:1000'],
            'digital_game' => ['nullable', 'string', 'max:100'],
            'digital_currency_type' => ['nullable', 'string', 'max:60'],
            'digital_quantity' => ['nullable', 'integer', 'min:1'],
            'digital_platform_server' => ['nullable', 'string', 'max:120'],
            'digital_delivery_method' => ['nullable', 'string', 'in:trade,mail,gift'],
            'gold_seller_time_options' => ['nullable', 'array', 'max:3'],
            'gold_seller_time_options.*' => ['string', 'max:120'],
            'gold_seller_delivery_method' => ['nullable', 'string', 'in:trade,mail,gift'],
            'service_seller_start_date_options' => ['nullable', 'array', 'max:3'],
            'service_seller_start_date_options.*' => ['date_format:Y-m-d'],
            'service_seller_time_range_options' => ['nullable', 'array', 'max:3'],
            'service_seller_time_range_options.*' => ['string', 'max:120'],
            'battle_pass_game' => ['nullable', 'string', 'max:100'],
            'battle_pass_platform' => ['nullable', 'string', 'max:60'],
            'battle_pass_type' => ['nullable', 'string', 'max:120'],
            'battle_pass_duration_days' => ['nullable', 'integer', 'min:1', 'max:3650'],
            'game_account_type' => ['nullable', 'string', 'max:120'],
            'game_account_game' => ['nullable', 'string', 'max:100'],
            'game_account_platform' => ['nullable', 'string', 'max:40'],
            'game_account_game_other' => ['nullable', 'string', 'max:120'],
            'game_account_level' => ['nullable', 'string', 'max:60'],

            // Segurança (Camada 2)
            'game_account_first_owner' => ['nullable', 'string', 'max:10'],
            'game_account_has_original_email' => ['nullable', 'string', 'max:10'],
            'game_account_linked_providers' => ['nullable', 'array', 'max:8'],
            'game_account_linked_providers.*' => ['string', 'max:60'],
            'game_account_can_change_credentials' => ['nullable', 'string', 'max:20'],
            'game_account_punishment_history' => ['nullable', 'string', 'max:40'],

            // Provas e entrega
            'delivery_items' => ['nullable', 'array', 'max:6'],
            'delivery_items.*' => ['string', 'max:200'],
            'proof_images' => ['nullable', 'array', 'max:8'],
            'proof_images.*' => ['file', 'image', 'max:5120'],
            'what_will_be_delivered' => ['nullable', 'string', 'max:200'],

            // Itens exclusivos (Camada 4)
            'exclusive_items' => ['nullable', 'string', 'max:20000'],
            'exclusive_item_images' => ['nullable', 'array', 'max:40'],
            'exclusive_item_images.*' => ['file', 'image', 'max:5120'],

            // Campos dinâmicos serão agrupados em game_account_extras
            'game_account_extras' => ['nullable', 'array'],
            'game_account_seller_notes' => ['nullable', 'string', 'max:1000'],
            'seller_fee_deduct_from_payout' => ['nullable'],
            'buyer_email' => ['nullable', 'email', 'exists:users,email'],
            'buyer_id' => ['nullable', 'integer', 'exists:users,id'],
            'photos' => ['nullable', 'array', 'max:8'],
            'photos.*' => ['file', 'image', 'max:5120'], // 5MB max per photo
            'terms_accepted' => ['required', 'accepted'],
        ]);

        $validator->after(function ($validator) use ($request) {
            $category = trim((string) $request->input('category'));
            $isGameAccount = $this->isGameAccountCategory($category);
            $isPhysical = $this->isPhysicalCategory($category);

            $isBattlePass = $category === 'Passe de batalha / Assinatura'
                || $request->hasAny(['battle_pass_game', 'battle_pass_platform', 'battle_pass_type', 'battle_pass_duration_days']);

            $isCurrency = $category === self::CURRENCY_CATEGORY;
            $isService = $this->isServiceFormsCategory($category);
            $isServiceExchange = $category === self::SERVICE_EXCHANGE_CATEGORY;

            // Title: optional only for service forms categories (auto-generated from service/game)
            if (! $isService) {
                if (! trim((string) $request->input('title'))) {
                    $validator->errors()->add('title', 'Informe o título do produto.');
                }
            }
            $isSkin = $category === 'Skins / Roupas / Cosméticos';
            $isItem = $category === 'Itens / Equipamentos (in-game)';
            $isOthers = $category === 'Outros (jogos)';
            $isKeyDlc = $category === 'Chave de jogo / DLC';

            // Descrição: obrigatória para físicos e Skins.
            $needsDescription = $isPhysical || $isSkin;
            if ($needsDescription && ! trim((string) $request->input('description'))) {
                $validator->errors()->add('description', 'Informe a descrição.');
            }

            if ($isSkin || $isItem) {
                if (! trim((string) $request->input('game_title'))) {
                    $validator->errors()->add('game_title', 'Informe o nome do jogo.');
                }
            }

            if ($isItem) {
                if (! trim((string) $request->input('item_name'))) {
                    $validator->errors()->add('item_name', 'Informe o nome do item.');
                }
                if (! trim((string) $request->input('item_general_info'))) {
                    $validator->errors()->add('item_general_info', 'Informe as informações gerais.');
                }
            }

            if ($isKeyDlc) {
                $days = $request->input('delivery_days');
                if (! is_numeric($days) || (int) $days < 1 || (int) $days > 15) {
                    $validator->errors()->add('delivery_days', 'Selecione um prazo de entrega de 1 a 15 dias.');
                }
            }

            if ($this->isServiceScheduleCategory($category)) {
                $days = $request->input('delivery_days');
                if (! is_numeric($days) || (int) $days < 1 || (int) $days > 25) {
                    $validator->errors()->add('delivery_days', 'Selecione um prazo de entrega de 1 a 25 dias.');
                }

                $dateOptions = $this->normalizeDateOptions($request->input('service_seller_start_date_options'), 3);
                if (! $dateOptions) {
                    $validator->errors()->add('service_seller_start_date_options', 'Informe até 3 opções de data de início (mín. 1).');
                }

                $timeRanges = $this->normalizeTimeRangeOptions($request->input('service_seller_time_range_options'), 3);
                if (! $timeRanges) {
                    $validator->errors()->add('service_seller_time_range_options', 'Informe pelo menos 1 intervalo de horário (início/fim), máx 3.');
                }
            }

            if ($isServiceExchange) {
                $days = $request->input('delivery_days');
                if (! is_numeric($days) || (int) $days < 1 || (int) $days > 3) {
                    $validator->errors()->add('delivery_days', 'Selecione um prazo de entrega de 1 a 3 dias.');
                }
            }

            $allowsPhotos = $isGameAccount || $isSkin || $isItem || $isPhysical;
            if (! $allowsPhotos && $request->hasFile('photos')) {
                $validator->errors()->add('photos', 'Imagens não são permitidas nesta categoria.');
                return;
            }

            if ($isGameAccount) {
                $count = $request->hasFile('photos') ? count($request->file('photos')) : 0;
                if ($count < 1) {
                    $validator->errors()->add('photos', 'Adicione no mínimo 1 imagem da conta.');
                }
            }

            if ($isSkin || $isItem) {
                $count = $request->hasFile('photos') ? count($request->file('photos')) : 0;
                if ($count < 1) {
                    $validator->errors()->add('photos', 'Adicione no mínimo 1 imagem.');
                }
                if ($count > 5) {
                    $validator->errors()->add('photos', 'Máximo de 5 imagens para esta categoria.');
                }
            }

            if ($isCurrency) {
                if (! trim((string) $request->input('digital_game'))) {
                    $validator->errors()->add('digital_game', 'Informe o jogo.');
                }
                if (! trim((string) $request->input('digital_currency_type'))) {
                    $validator->errors()->add('digital_currency_type', 'Informe o tipo de moeda.');
                }
                $qty = $request->input('digital_quantity');
                if (! is_numeric($qty) || (int) $qty < 1) {
                    $validator->errors()->add('digital_quantity', 'Informe a quantidade da moeda.');
                }
                if (! trim((string) $request->input('digital_platform_server'))) {
                    $validator->errors()->add('digital_platform_server', 'Informe a plataforma/servidor.');
                }
                $method = (string) $request->input('digital_delivery_method');
                if (! in_array($method, ['trade', 'mail', 'gift'], true)) {
                    $validator->errors()->add('digital_delivery_method', 'Selecione o método de entrega.');
                }

                $goldTimes = $request->input('gold_seller_time_options');
                if (! is_array($goldTimes) || count($goldTimes) < 1) {
                    $validator->errors()->add('gold_seller_time_options', 'Informe pelo menos 1 horário disponível (máx 3).');
                } elseif (count($goldTimes) > 3) {
                    $validator->errors()->add('gold_seller_time_options', 'Máximo de 3 horários.');
                } else {
                    foreach ($goldTimes as $idx => $item) {
                        if (trim((string) $item) === '') {
                            $validator->errors()->add("gold_seller_time_options.$idx", 'Horário inválido.');
                        }
                    }
                }

                $goldMethod = (string) $request->input('gold_seller_delivery_method');
                if (! in_array($goldMethod, ['trade', 'mail', 'gift'], true)) {
                    $validator->errors()->add('gold_seller_delivery_method', 'Selecione o método de entrega do vendedor.');
                }
            }

            if ($isBattlePass) {
                if (! trim((string) $request->input('battle_pass_game'))) {
                    $validator->errors()->add('battle_pass_game', 'Informe o jogo do passe/assinatura.');
                }
                if (! trim((string) $request->input('battle_pass_platform'))) {
                    $validator->errors()->add('battle_pass_platform', 'Informe a plataforma do passe/assinatura.');
                }
                if (! trim((string) $request->input('battle_pass_type'))) {
                    $validator->errors()->add('battle_pass_type', 'Informe o tipo de passe/assinatura.');
                }
                $days = $request->input('battle_pass_duration_days');
                if (! is_numeric($days) || (int) $days < 1) {
                    $validator->errors()->add('battle_pass_duration_days', 'Informe a duração (dias).');
                }
            }

            if ($isGameAccount) {
                $gameType = trim((string) $request->input('game_account_type'));
                if ($gameType === '') {
                    $validator->errors()->add('game_account_type', 'Selecione o tipo do jogo.');
                }

                $platform = trim((string) $request->input('game_account_platform'));
                if ($platform === '') {
                    $validator->errors()->add('game_account_platform', 'Selecione a plataforma.');
                }

                $gameName = trim((string) $request->input('game_account_game'));
                if ($gameName === '') {
                    $validator->errors()->add('game_account_game', 'Informe o nome do jogo.');
                }

                $firstOwner = $request->input('game_account_first_owner');
                if (! in_array((string) $firstOwner, ['0', '1'], true) && ! in_array($firstOwner, [0, 1, true, false], true)) {
                    $validator->errors()->add('game_account_first_owner', 'Informe se você é o primeiro dono da conta.');
                }

                $hasOriginalEmail = $request->input('game_account_has_original_email');
                if (! in_array((string) $hasOriginalEmail, ['0', '1'], true) && ! in_array($hasOriginalEmail, [0, 1, true, false], true)) {
                    $validator->errors()->add('game_account_has_original_email', 'Informe se possui acesso ao e-mail original.');
                }

                $linkedProviders = $request->input('game_account_linked_providers');
                if (! is_array($linkedProviders) || count($linkedProviders) < 1) {
                    $validator->errors()->add('game_account_linked_providers', 'Informe as vinculações da conta (ou marque “Nenhuma”).');
                } else {
                    $normalized = array_values(array_filter(array_map('strval', $linkedProviders)));
                    if (in_array('none', $normalized, true) && count($normalized) > 1) {
                        $validator->errors()->add('game_account_linked_providers', 'Selecione apenas “Nenhuma” ou as vinculações existentes.');
                    }
                }

                $canChange = trim((string) $request->input('game_account_can_change_credentials'));
                if (! in_array($canChange, ['yes', 'no', 'partial'], true)) {
                    $validator->errors()->add('game_account_can_change_credentials', 'Informe se pode alterar e-mail e senha.');
                }

                if (trim((string) $request->input('game_account_punishment_history')) === '') {
                    $validator->errors()->add('game_account_punishment_history', 'Informe o histórico de punições.');
                }

                $deliver = trim((string) $request->input('what_will_be_delivered'));
                if ($deliver === '') {
                    $validator->errors()->add('what_will_be_delivered', 'Informe o que será entregue ao comprador.');
                }

                // Ranking obrigatório para tipos competitivos
                if (in_array($gameType, ['fps', 'moba', 'battle_royale', 'mobile', 'esporte'], true)) {
                    if (trim((string) $request->input('ga_rank_current_tier')) === '') {
                        $validator->errors()->add('ga_rank_current_tier', 'Informe o tier atual (ranking).');
                    }
                }

                // Itens exclusivos: se marcado como sim, exige metadados e imagens
                $hasExclusive = (string) $request->input('ga_has_exclusive_items');
                if (! in_array($hasExclusive, ['0', '1'], true)) {
                    $validator->errors()->add('ga_has_exclusive_items', 'Informe se a conta possui itens exclusivos.');
                }
                if ($hasExclusive === '1') {
                    $raw = (string) $request->input('exclusive_items');
                    $items = json_decode($raw, true);
                    if (! is_array($items) || count($items) < 1) {
                        $validator->errors()->add('exclusive_items', 'Adicione pelo menos 1 item exclusivo.');
                    }

                    $files = $request->file('exclusive_item_images') ?? [];
                    if (! is_array($files) || count($files) < 1) {
                        $validator->errors()->add('exclusive_item_images', 'Envie as imagens dos itens exclusivos.');
                    }
                }
            }
        });

        $data = $validator->validate();

        // Normalize platform (string trimmed)
        $data['game_account_platform'] = isset($data['game_account_platform']) ? trim((string) $data['game_account_platform']) : null;

        $category = trim((string) ($data['category'] ?? ''));
        $isServiceFormsCategory = $this->isServiceFormsCategory($category);
        $derivedServiceId = $this->serviceIdFromCategory($category);

        $serviceId = $isServiceFormsCategory ? trim((string) ($data['service_id'] ?? '')) : '';
        $gameId = $isServiceFormsCategory ? trim((string) ($data['game_id'] ?? '')) : '';

        if ($isServiceFormsCategory) {
            // Category implies service_id for the new taxonomy categories.
            if ($derivedServiceId !== null) {
                if ($serviceId === '') {
                    $serviceId = $derivedServiceId;
                    $data['service_id'] = $serviceId;
                } elseif ($serviceId !== $derivedServiceId) {
                    return response()->json(['message' => 'Serviço inválido para a categoria selecionada.'], 422);
                }
            }

            if ($serviceId === '' || ! array_key_exists($serviceId, $serviceLabelById)) {
                return response()->json(['message' => 'Selecione um serviço válido.'], 422);
            }

            $allowedGames = $serviceGames[$serviceId] ?? [];
            if (! is_array($allowedGames)) {
                $allowedGames = [];
            }

            if ($gameId === '' || ! in_array($gameId, $allowedGames, true)) {
                return response()->json(['message' => 'Selecione um jogo válido para este serviço.'], 422);
            }

            $serviceLabel = $serviceLabelById[$serviceId] ?? $serviceId;

            $rawFieldsForTitle = $request->input('service_fields');
            if (is_string($rawFieldsForTitle)) {
                $decoded = json_decode($rawFieldsForTitle, true);
                if (is_array($decoded)) {
                    $rawFieldsForTitle = $decoded;
                }
            }

            $gameLabel = $gameLabelById[$gameId] ?? $gameId;
            if ($gameId === 'other') {
                $typed = is_array($rawFieldsForTitle)
                    ? trim((string) ($rawFieldsForTitle['game_other_name'] ?? ''))
                    : '';
                if ($typed === '') {
                    return response()->json(['message' => 'Informe o nome do jogo (Outro).'], 422);
                }
                $gameLabel = $typed;
            }

            $data['title'] = trim($serviceLabel.' — '.$gameLabel);
        }

        $isGameAccount = $this->isGameAccountCategory($category);
        $isPhysical = $this->isPhysicalCategory($category);
        $isSkin = $category === 'Skins / Roupas / Cosméticos';
        $isItem = $category === 'Itens / Equipamentos (in-game)';
        $allowsPhotos = $isGameAccount || $isSkin || $isItem || $isPhysical;

        $deductRaw = $data['seller_fee_deduct_from_payout'] ?? null;
        $deduct = false;
        if (is_string($deductRaw)) {
            $deduct = in_array(strtolower($deductRaw), ['true', '1', 'on', 'yes'], true);
        } elseif (is_bool($deductRaw)) {
            $deduct = $deductRaw;
        } elseif (is_numeric($deductRaw)) {
            $deduct = ((int) $deductRaw) === 1;
        }

        // Para "Conta de jogo", os dados sensíveis (login/senha) serão informados somente após o pagamento confirmado.

        $buyerId = null;
        if (! empty($data['buyer_id'])) {
            $candidate = \App\Models\User::find((int) $data['buyer_id']);
            if ($candidate && $candidate->id !== $user->id) {
                $buyerId = $candidate->id;
            }
        } elseif (! empty($data['buyer_email'])) {
            $buyer = \App\Models\User::where('email', $data['buyer_email'])->first();
            if ($buyer && $buyer->id !== $user->id) {
                $buyerId = $buyer->id;
            }
        }

        // Handle photo uploads (only for allowed categories)
        $photosPaths = [];
        if ($allowsPhotos && $request->hasFile('photos')) {
            foreach ($request->file('photos') as $photo) {
                $path = $photo->store('negotiations/photos', 'public');
                $photosPaths[] = $path;
            }
        }
        // Support alternative field name from frontend: proof_images
        if ($allowsPhotos && $request->hasFile('proof_images')) {
            foreach ($request->file('proof_images') as $photo) {
                $path = $photo->store('negotiations/photos', 'public');
                $photosPaths[] = $path;
            }
        }

        // Game account extras (universal): capture dynamic ga_*/ts_* fields + exclusive items
        if ($isGameAccount) {
            $dynamic = [];
            foreach ($request->all() as $key => $value) {
                if (! is_string($key) || $key === '') {
                    continue;
                }
                if (strpos($key, 'ga_') !== 0 && strpos($key, 'ts_') !== 0) {
                    continue;
                }
                // Skip file inputs (handled elsewhere)
                if ($value instanceof \Illuminate\Http\UploadedFile) {
                    continue;
                }
                if (is_array($value)) {
                    $hasFile = false;
                    foreach ($value as $v) {
                        if ($v instanceof \Illuminate\Http\UploadedFile) {
                            $hasFile = true;
                            break;
                        }
                    }
                    if ($hasFile) {
                        continue;
                    }
                }
                $dynamic[$key] = $value;
            }

            // Exclusive items: metadata JSON + image uploads
            $exclusiveItemsWithImages = null;
            $rawExclusive = (string) $request->input('exclusive_items');
            if ($rawExclusive !== '') {
                $decoded = json_decode($rawExclusive, true);
                if (is_array($decoded)) {
                    $files = $request->file('exclusive_item_images') ?? [];
                    $stored = [];
                    if (is_array($files)) {
                        foreach ($files as $idx => $file) {
                            if (! $file instanceof \Illuminate\Http\UploadedFile) {
                                continue;
                            }
                            $stored[(string) $idx] = $file->store('negotiations/exclusive-items', 'public');
                        }
                    }

                    $items = [];
                    foreach ($decoded as $idx => $it) {
                        if (! is_array($it)) {
                            continue;
                        }
                        $image = $stored[(string) $idx] ?? null;
                        $items[] = [
                            'type' => isset($it['type']) ? (string) $it['type'] : '',
                            'name' => isset($it['name']) ? (string) $it['name'] : '',
                            'rarity' => isset($it['rarity']) ? (string) $it['rarity'] : '',
                            'description' => isset($it['description']) ? (string) $it['description'] : '',
                            'image' => $image,
                        ];
                    }
                    $exclusiveItemsWithImages = $items;
                }
            }

            if ($exclusiveItemsWithImages !== null) {
                $dynamic['exclusive_items'] = $exclusiveItemsWithImages;
            }

            $data['game_account_extras'] = $dynamic;
        }

        $description = isset($data['description']) ? trim((string) $data['description']) : null;
        if ($description === '') {
            $description = null;
        }

        $goldSellerTimeOptions = null;
        $goldSellerDeliveryMethod = null;
        $goldSellerAvailabilityText = null;
        $goldSellerSubmittedAt = null;
        if ($this->isCurrencyCategory($category)) {
            $goldSellerTimeOptions = $this->normalizeTimeOptions($data['gold_seller_time_options'] ?? [], 3);
            $goldSellerDeliveryMethod = array_key_exists('gold_seller_delivery_method', $data)
                ? (string) $data['gold_seller_delivery_method']
                : null;

            if ($goldSellerTimeOptions) {
                $goldSellerAvailabilityText = implode("\n", $goldSellerTimeOptions);
                $goldSellerSubmittedAt = now();
            }
        }

        $serviceSellerStartDateOptions = null;
        $serviceSellerTimeRangeOptions = null;
        if ($this->isServiceScheduleCategory($category)) {
            $serviceSellerStartDateOptions = $this->normalizeDateOptions($data['service_seller_start_date_options'] ?? [], 3);
            $serviceSellerTimeRangeOptions = $this->normalizeTimeRangeOptions($data['service_seller_time_range_options'] ?? [], 3);
        }

        $payload = [
            'seller_id' => $user->id,
            'buyer_id' => $buyerId,
            'title' => $data['title'],
            'description' => $description,
            'price' => $data['price'],
            'category' => $data['category'],
            'service_id' => $isServiceFormsCategory ? $serviceId : null,
            'game_id' => $isServiceFormsCategory ? $gameId : null,
            'delivery_days' => $data['delivery_days'] ?? null,
            'game_title' => $data['game_title'] ?? null,
            'item_name' => $data['item_name'] ?? null,
            'item_general_info' => $data['item_general_info'] ?? null,
            'digital_game' => $data['digital_game'] ?? null,
            'digital_currency_type' => $data['digital_currency_type'] ?? null,
            'digital_quantity' => $data['digital_quantity'] ?? null,
            'digital_platform_server' => $data['digital_platform_server'] ?? null,
            'digital_delivery_method' => $data['digital_delivery_method'] ?? null,
            'gold_seller_time_options' => $goldSellerTimeOptions,
            'gold_seller_delivery_method' => $goldSellerDeliveryMethod,
            'gold_seller_availability' => $goldSellerAvailabilityText,
            'gold_seller_info_submitted_at' => $goldSellerSubmittedAt,
            'battle_pass_game' => $data['battle_pass_game'] ?? null,
            'battle_pass_platform' => $data['battle_pass_platform'] ?? null,
            'battle_pass_type' => $data['battle_pass_type'] ?? null,
            'battle_pass_duration_days' => $data['battle_pass_duration_days'] ?? null,
            'game_account_type' => $data['game_account_type'] ?? null,
            'game_account_game' => $data['game_account_game'] ?? null,
            'game_account_platform' => $data['game_account_platform'] ?? null,
            'game_account_game_other' => $data['game_account_game_other'] ?? null,

            // Segurança
            'game_account_first_owner' => $data['game_account_first_owner'] ?? null,
            'game_account_has_original_email' => $data['game_account_has_original_email'] ?? null,
            'game_account_linked_providers' => $data['game_account_linked_providers'] ?? null,
            'game_account_can_change_credentials' => $data['game_account_can_change_credentials'] ?? null,
            'game_account_punishment_history' => $data['game_account_punishment_history'] ?? null,

            // Delivery / proofs
            'game_account_delivery_items' => $data['delivery_items'] ?? null,
            'game_account_delivery_description' => $data['what_will_be_delivered'] ?? null,

            // Dynamic data (per-type)
            'game_account_extras' => $request->input('_game_account_dynamic') ?? ($data['game_account_extras'] ?? null),
            'game_account_has_ban' => array_key_exists('game_account_has_ban', $data)
                ? filter_var($data['game_account_has_ban'], FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE)
                : null,
            'game_account_first_owner' => array_key_exists('game_account_first_owner', $data)
                ? filter_var($data['game_account_first_owner'], FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE)
                : null,
            'game_account_has_original_email' => array_key_exists('game_account_has_original_email', $data)
                ? filter_var($data['game_account_has_original_email'], FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE)
                : null,
            'game_account_linked_providers' => $data['game_account_linked_providers'] ?? null,
            'game_account_region' => $data['game_account_region'] ?? null,
            'game_account_extras' => $data['game_account_extras'] ?? null,
            // Observações privadas do vendedor (não sensíveis)
            'game_account_seller_notes' => $data['game_account_seller_notes'] ?? null,
            'seller_fee_deduct_from_payout' => $deduct,
            'product_photos' => !empty($photosPaths) ? $photosPaths : null,
            'status' => 'pending_acceptance',
        ];

        $optionalColumns = [
            'service_id',
            'game_id',
            'game_account_first_owner',
            'game_account_has_original_email',
            'game_account_linked_providers',
            'game_account_region',
            'game_account_extras',
            'game_account_type',
            'game_account_platform',
            'game_account_game_other',
            'game_account_can_change_credentials',
            'game_account_punishment_history',
            'game_account_delivery_items',
            'game_account_delivery_description',
        ];

        foreach ($optionalColumns as $column) {
            if (! Schema::hasColumn('negotiations', $column)) {
                unset($payload[$column]);
            }
        }

        if ($this->isServiceScheduleCategory($category)) {
            $payload['service_seller_start_date_options'] = $serviceSellerStartDateOptions;
            $payload['service_seller_time_range_options'] = $serviceSellerTimeRangeOptions;
        }

        $negotiation = Negotiation::create($payload);

        if ($isServiceFormsCategory) {
            $rawFields = $request->input('service_fields');
            if (is_string($rawFields)) {
                $decoded = json_decode($rawFields, true);
                if (is_array($decoded)) {
                    $rawFields = $decoded;
                }
            }

            $serviceFieldDefs = [];
            $defs = $formFields[$serviceId][$gameId] ?? [];
            if (is_array($defs)) {
                foreach ($defs as $def) {
                    if (! is_array($def) || ! isset($def['id'])) continue;
                    $serviceFieldDefs[(string) $def['id']] = $def;
                }
            }

            if (is_array($rawFields) && $serviceFieldDefs) {
                foreach ($rawFields as $fieldId => $fieldValue) {
                    $fieldId = trim((string) $fieldId);
                    if ($fieldId === '' || ! array_key_exists($fieldId, $serviceFieldDefs)) {
                        continue;
                    }

                    if (is_array($fieldValue) || is_object($fieldValue)) {
                        continue;
                    }

                    $value = trim((string) $fieldValue);
                    if ($value === '') {
                        continue;
                    }

                    // Keep it generic, but avoid gigantic payloads.
                    if (strlen($value) > 2000) {
                        $value = substr($value, 0, 2000);
                    }

                    NegotiationField::updateOrCreate(
                        ['negotiation_id' => $negotiation->id, 'field_id' => $fieldId],
                        ['field_value' => $value]
                    );
                }
            }
        }

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

        $negotiations = Negotiation::with([
            'payments',
            'seller:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state',
            'buyer:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state',
        ])
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

        $query = Negotiation::with([
            'payments',
            'seller:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state',
            'buyer:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state',
        ])
            ->where('status', 'awaiting_admin_approval');

        // Suporta filtros enviados pela UI:
        // - filter=today
        // - filter=custom&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
        $filter = (string) $request->query('filter', '');
        if ($filter === 'today') {
            $start = now()->startOfDay();
            $end = now()->endOfDay();
            $query->whereBetween('created_at', [$start, $end]);
        } elseif ($filter === 'custom') {
            $startDateRaw = (string) $request->query('start_date', '');
            $endDateRaw = (string) $request->query('end_date', '');

            if ($startDateRaw === '' || $endDateRaw === '') {
                return response()->json(['message' => 'start_date e end_date são obrigatórios para filtro custom.'], 422);
            }

            try {
                $start = \Illuminate\Support\Carbon::parse($startDateRaw)->startOfDay();
                $end = \Illuminate\Support\Carbon::parse($endDateRaw)->endOfDay();
            } catch (\Throwable $exception) {
                return response()->json(['message' => 'Datas inválidas para filtro.'], 422);
            }

            if ($start->greaterThan($end)) {
                return response()->json(['message' => 'Intervalo inválido: start_date maior que end_date.'], 422);
            }

            $query->whereBetween('created_at', [$start, $end]);
        }

        $negotiations = $query
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($n) => $this->transform($n, $user, ['include_photos' => false]));

        return response()->json(['data' => $negotiations]);
    }

    /**
     * Admin (somente teste/local): remover negociação.
     */
    public function adminDestroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        // Segurança: permitir apenas em ambiente local/testing.
        if (! app()->environment(['local', 'testing'])) {
            return response()->json(['message' => 'Remoção de negociações está habilitada apenas para teste.'], 403);
        }

        $negotiation = Negotiation::find($id);
        if (! $negotiation) {
            return response()->json(['message' => 'Negociacao nao encontrada.'], 404);
        }

        // Limpa arquivos associados (se existirem)
        $paths = [];
        if (is_array($negotiation->product_photos)) {
            $paths = array_merge($paths, $negotiation->product_photos);
        }
        if (is_array($negotiation->intermediary_photos)) {
            $paths = array_merge($paths, $negotiation->intermediary_photos);
        }
        $paths = array_values(array_filter(array_unique($paths), fn ($p) => is_string($p) && $p !== ''));
        if (! empty($paths)) {
            Storage::disk('public')->delete($paths);
        }

        // Em MySQL, negociações podem ter tabelas-filhas (ex: payments) com FK
        // restringindo o delete. Como esse endpoint é apenas para teste/local,
        // limpamos dependências automaticamente antes de remover a negociação.

        // Fallback explícito (mais robusto, mesmo sem acesso a information_schema).
        foreach ([
            ['payments', 'negotiation_id'],
            ['shipments', 'negotiation_id'],
            ['test_reports', 'negotiation_id'],
        ] as [$table, $column]) {
            try {
                if (Schema::hasTable($table) && Schema::hasColumn($table, $column)) {
                    DB::table($table)->where($column, $negotiation->id)->delete();
                }
            } catch (\Throwable $exception) {
                Log::warning('adminDestroy: failed to cleanup known child table', [
                    'negotiation_id' => $negotiation->id,
                    'table' => $table,
                    'column' => $column,
                    'error' => $exception->getMessage(),
                ]);
            }
        }

        // Descoberta dinâmica (cobre outras tabelas que referenciem negotiations).
        try {
            $references = DB::select(
                "select TABLE_NAME, COLUMN_NAME
                 from information_schema.KEY_COLUMN_USAGE
                 where REFERENCED_TABLE_SCHEMA = database()
                   and REFERENCED_TABLE_NAME = 'negotiations'"
            );

            foreach ($references as $ref) {
                $table = (string) ($ref->TABLE_NAME ?? '');
                $column = (string) ($ref->COLUMN_NAME ?? '');
                if ($table === '' || $column === '') {
                    continue;
                }

                if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $column)) {
                    continue;
                }

                DB::table($table)->where($column, $negotiation->id)->delete();
            }
        } catch (\Throwable $exception) {
            Log::warning('adminDestroy: failed to cleanup child rows via information_schema', [
                'negotiation_id' => $negotiation->id,
                'error' => $exception->getMessage(),
            ]);
        }

        try {
            $negotiation->delete();
        } catch (QueryException $exception) {
            return response()->json([
                'message' => 'Não foi possível remover a negociação por dependências no banco (FK).',
                'error' => $exception->getMessage(),
            ], 409);
        }

        AuditLogger::log($request, 'negotiation.admin_destroy', $negotiation);

        return response()->json(['success' => true]);
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
     * Intermediator: list available negotiations (not yet assigned to any intermediator).
     */
    public function intermediatorAvailable(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!in_array($user->role, ['intermediator', 'admin'], true)) {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        // Concluded/closed statuses are not available for new assignment.
        $unavailableStatuses = ['delivered', 'rejected_by_admin', 'cancelled', 'expired'];

        // Available = negotiations without an intermediator assigned
        $negotiations = Negotiation::with([
            'payments',
            'seller:id,name,email,phone',
            'buyer:id,name,email,phone',
            'intermediator:id,name',
        ])
            ->whereNull('intermediator_id')
            ->whereNotIn('status', $unavailableStatuses)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($n) => $this->transform($n, $user, ['include_photos' => false, 'intermediator_list' => true]));

        return response()->json(['data' => $negotiations]);
    }

    /**
     * Intermediator: list my assigned negotiations.
     */
    public function intermediatorMine(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!in_array($user->role, ['intermediator', 'admin'], true)) {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        $negotiations = Negotiation::with([
            'payments',
            'seller:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state',
            'buyer:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state',
            'intermediator:id,name',
        ])
            ->where('intermediator_id', $user->id)
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn ($n) => $this->transform($n, $user, ['include_photos' => false, 'intermediator_list' => true]));

        return response()->json(['data' => $negotiations]);
    }

    /**
     * Intermediator: list all negotiations in intermediation flow, including who is assigned.
     */
    public function intermediatorAll(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!in_array($user->role, ['intermediator', 'admin'], true)) {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        $negotiations = Negotiation::with([
            'payments',
            'seller:id,name,email,phone',
            'buyer:id,name,email,phone',
            'intermediator:id,name',
        ])
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn ($n) => $this->transform($n, $user, ['include_photos' => false, 'intermediator_list' => true]));

        return response()->json(['data' => $negotiations]);
    }

    /**
     * Intermediator: assign a negotiation to self.
     */
    public function intermediatorAssign(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!in_array($user->role, ['intermediator', 'admin'], true)) {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        return $this->withLockedNegotiation($id, function (Negotiation $negotiation) use ($request, $user) {
            // Only assign if not already assigned
            if ($negotiation->intermediator_id !== null) {
                return response()->json(['message' => 'Esta negociação já está sendo intermediada por outro usuário.'], 422);
            }

            // Disallow assignment when the negotiation is already concluded/closed.
            $unavailableStatuses = ['delivered', 'rejected_by_admin', 'cancelled', 'expired'];
            if (in_array((string) $negotiation->status, $unavailableStatuses, true)) {
                return response()->json(['message' => 'Esta negociação não está disponível para intermediação.'], 422);
            }

            $negotiation->intermediator_id = $user->id;
            $negotiation->intermediator_assigned_at = now();
            $negotiation->save();

            AuditLogger::log($request, 'negotiation.intermediator_assigned', $negotiation);

            return response()->json([
                'success' => true,
                'message' => 'Você assumiu esta intermediação.',
                'data' => $this->transform($negotiation->fresh(['seller', 'buyer', 'payments', 'intermediator']), $user),
            ]);
        });
    }

    /**
     * Intermediator: unassign self from a negotiation.
     */
    public function intermediatorUnassign(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!in_array($user->role, ['intermediator', 'admin'], true)) {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        return $this->withLockedNegotiation($id, function (Negotiation $negotiation) use ($request, $user) {
            if ($negotiation->intermediator_id !== $user->id) {
                return response()->json(['message' => 'Você não está atribuído a esta negociação.'], 422);
            }

            $negotiation->intermediator_id = null;
            $negotiation->intermediator_assigned_at = null;
            $negotiation->save();

            AuditLogger::log($request, 'negotiation.intermediator_unassigned', $negotiation);

            return response()->json([
                'success' => true,
                'message' => 'Você deixou de intermediar esta negociação.',
            ]);
        });
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

        $negotiation = null;
        $response = $this->withLockedNegotiation($id, function (Negotiation $locked) use (&$negotiation, $request) {
            if ($locked->status !== 'awaiting_admin_approval') {
                return response()->json(['message' => 'Aprovação não disponível neste status.'], 422);
            }

            $locked->update([
                'status' => 'waiting_payment',
            ]);

            $negotiation = $locked;
            AuditLogger::log($request, 'negotiation.admin_approve', $locked);

            return null;
        });

        if ($response instanceof JsonResponse) {
            return $response;
        }

        // Se Mercado Pago estiver configurado, tenta gerar Pix automaticamente para o comprador.
        // Isso permite que o front mostre um Pix real (em vez do fallback).
        try {
            $token = (string) config('services.mercadopago.access_token', '');
            if ($token !== '' && $negotiation->buyer_id) {
                $buyer = \App\Models\User::find($negotiation->buyer_id);
                if ($buyer && $buyer->email) {
                    $buyerFee = (float) config('services.mercadopago.buyer_fee_brl', 15);
                    $amount = (float) $negotiation->price + $buyerFee;

                    /** @var MercadoPagoService $mp */
                    $mp = app(MercadoPagoService::class);
                    $result = $mp->createPixPayment([
                        'transaction_amount' => $amount,
                        'description' => 'Intermediação segura - ' . (string) $negotiation->title,
                        'payer_email' => (string) $buyer->email,
                        'external_reference' => 'negotiation:' . (string) $negotiation->id,
                        'idempotency_key' => Str::uuid()->toString(),
                    ]);

                    $pixCode = $result['pix_code'] ?? null;
                    if (is_string($pixCode) && $pixCode !== '' && strlen($pixCode) <= 500) {
                        $negotiation->update([
                            'pix_code' => $pixCode,
                            'pix_generated_at' => now(),
                        ]);
                    }
                }
            }
        } catch (\Throwable $exception) {
            Log::warning('MercadoPago auto pix generation failed: ' . $exception->getMessage(), [
                'negotiation_id' => $negotiation->id,
            ]);
        }

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

        $reason = (string) $request->input('reason', '');

        return $this->withLockedNegotiation($id, function (Negotiation $negotiation) use ($reason, $request) {
            $negotiation->update([
                'status' => 'rejected_by_admin',
                'rejection_reason' => $reason,
            ]);

            AuditLogger::log($request, 'negotiation.admin_reject', $negotiation, [
                'has_reason' => trim((string) $reason) !== '',
                'reason_length' => strlen((string) $reason),
            ]);

            return response()->json(['success' => true]);
        });
    }

    /**
     * Approve action (buyer accepts the negotiation or other transitions).
     */
    public function approve(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        // Intermediadora/inspector: aprovar/reprovar após inspeção
        if (in_array($user->role, ['admin', 'inspector'], true) && $request->has('approved')) {
            $approvedRaw = $request->input('approved');
            $approved = filter_var($approvedRaw, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($approved === null) {
                return response()->json(['message' => 'Campo approved inválido.'], 422);
            }

            $notes = (string) ($request->input('notes') ?? $request->input('intermediary_notes') ?? '');
            $trackingToBuyer = trim((string) $request->input('tracking_to_buyer'));

            return $this->withLockedNegotiation($id, function (Negotiation $negotiation) use ($request, $approved, $notes, $trackingToBuyer) {
                if ($negotiation->status !== 'at_intermediary') {
                    return response()->json(['message' => 'Ação disponível apenas quando o produto está na intermediadora.'], 422);
                }
                if (! $negotiation->inspection_saved_at) {
                    return response()->json(['message' => 'Envie o relatório de inspeção antes de aprovar/reprovar.'], 422);
                }

                if ($approved) {
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

                    AuditLogger::log($request, 'negotiation.intermediary_approve', $negotiation);

                    return response()->json(['success' => true]);
                }

                $negotiation->update([
                    'status' => 'rejected_by_admin',
                    'rejection_reason' => $notes !== '' ? $notes : $negotiation->rejection_reason,
                    'intermediary_approval_confirmed_at' => now(),
                ]);

                AuditLogger::log($request, 'negotiation.intermediary_reject', $negotiation, [
                    'has_reason' => trim($notes) !== '',
                    'reason_length' => strlen($notes),
                ]);

                return response()->json(['success' => true]);
            });
        }

        // Buyer accepts the negotiation
        return $this->withLockedNegotiation($id, function (Negotiation $negotiation) use ($request, $user) {
            if ($negotiation->status !== 'pending_acceptance') {
                return response()->json(['message' => 'Aceite não disponível neste status.'], 422);
            }

            if ($negotiation->seller_id === $user->id) {
                return response()->json(['message' => 'O vendedor não pode aceitar a própria negociação.'], 403);
            }

            if ($user->role !== 'buyer') {
                return response()->json(['message' => 'Apenas compradores podem aceitar uma negociação.'], 403);
            }

            $goldBuyerUpdates = [];
            if ($this->isCurrencyCategory($negotiation->category)) {
                $buyerData = Validator::make($request->all(), [
                    'gold_buyer_character_name' => ['required', 'string', 'max:120'],
                    'gold_buyer_server' => ['required', 'string', 'max:120'],
                    'gold_buyer_faction' => ['required', 'string', 'max:60'],
                    'gold_buyer_time_options' => ['required', 'array', 'min:1', 'max:3'],
                    'gold_buyer_time_options.*' => ['string', 'max:120'],
                    'gold_buyer_notes' => ['nullable', 'string', 'max:2000'],
                ])->validate();

                $timeOptions = $this->normalizeTimeOptions($buyerData['gold_buyer_time_options'] ?? [], 3);
                if (! $timeOptions) {
                    return response()->json(['message' => 'Informe pelo menos 1 horário disponível (máx 3).'], 422);
                }

                $goldBuyerUpdates = [
                    'gold_buyer_character_name' => (string) $buyerData['gold_buyer_character_name'],
                    'gold_buyer_server' => (string) $buyerData['gold_buyer_server'],
                    'gold_buyer_faction' => (string) $buyerData['gold_buyer_faction'],
                    'gold_buyer_time_options' => $timeOptions,
                    'gold_buyer_availability' => implode("\n", $timeOptions),
                    'gold_buyer_notes' => array_key_exists('gold_buyer_notes', $buyerData) ? (string) $buyerData['gold_buyer_notes'] : null,
                    'gold_buyer_info_submitted_at' => now(),
                ];
            }

            $serviceBuyerUpdates = [];
            if ($this->isServiceScheduleCategory($negotiation->category)) {
                $buyerData = Validator::make($request->all(), [
                    'service_buyer_selected_start_date' => ['required', 'date_format:Y-m-d'],
                    'service_buyer_selected_time_range' => ['required', 'string', 'max:120'],
                ])->validate();

                $selectedDate = trim((string) $buyerData['service_buyer_selected_start_date']);
                $selectedRange = trim((string) $buyerData['service_buyer_selected_time_range']);

                $allowedDates = $this->normalizeDateOptions($negotiation->service_seller_start_date_options, 3);
                if (! in_array($selectedDate, $allowedDates, true)) {
                    return response()->json(['message' => 'Selecione uma data de início válida.'], 422);
                }

                $allowedRanges = $this->normalizeTimeRangeOptions($negotiation->service_seller_time_range_options, 5);
                if (! in_array($selectedRange, $allowedRanges, true)) {
                    return response()->json(['message' => 'Selecione um intervalo de horário válido.'], 422);
                }

                $serviceBuyerUpdates = [
                    'service_buyer_selected_start_date' => $selectedDate,
                    'service_buyer_selected_time_range' => $selectedRange,
                    'service_schedule_confirmed_at' => now(),
                ];
            }

            $becameBuyer = false;
            if (! $negotiation->buyer_id) {
                $becameBuyer = true;
                $negotiation->update(array_merge([
                    'buyer_id' => $user->id,
                    'status' => 'awaiting_admin_approval',
                    'accepted_at' => now(),
                ], $goldBuyerUpdates, $serviceBuyerUpdates));

                AuditLogger::log($request, 'negotiation.accepted_by_buyer', $negotiation, [
                    'became_buyer' => true,
                ]);

                return response()->json(['success' => true]);
            }

            if ($negotiation->isBuyer($user)) {
                $negotiation->update(array_merge([
                    'status' => 'awaiting_admin_approval',
                    'accepted_at' => now(),
                ], $goldBuyerUpdates, $serviceBuyerUpdates));

                AuditLogger::log($request, 'negotiation.accepted_by_buyer', $negotiation, [
                    'became_buyer' => $becameBuyer,
                ]);

                return response()->json(['success' => true]);
            }

            return response()->json(['message' => 'Acao nao permitida.'], 403);
        });
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

        return $this->withLockedNegotiation($id, function (Negotiation $negotiation) use ($request) {
            if ($this->isDigitalDeliveryCategory($negotiation->category)) {
                return response()->json(['message' => 'Negociação digital não possui recebimento físico na intermediadora.'], 422);
            }

            if ($negotiation->status !== 'shipped') {
                return response()->json(['message' => 'Recebimento disponível apenas após envio (Em Trânsito).'], 422);
            }

            $negotiation->update([
                'status' => 'at_intermediary',
                'received_at' => now(),
            ]);

            AuditLogger::log($request, 'negotiation.received_at_intermediary', $negotiation);

            return response()->json(['success' => true]);
        });
    }

    /**
     * Buyer confirms delivery.
     */
    public function buyerConfirm(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $data = Validator::make($request->all(), [
            'rating' => ['nullable', 'integer', 'min:1', 'max:10'],
            'comment' => ['nullable', 'string', 'max:500'],
        ])->validate();

        $rating = array_key_exists('rating', $data) ? $data['rating'] : null;
        $comment = array_key_exists('comment', $data) ? $data['comment'] : null;


        return $this->withLockedNegotiation($id, function (Negotiation $negotiation) use ($request, $user, $rating, $comment) {
            if (! $negotiation->isBuyer($user)) {
                return response()->json(['message' => 'Apenas o comprador pode confirmar.'], 403);
            }

            if ($negotiation->status !== 'approved') {
                return response()->json(['message' => 'Confirmação de entrega disponível apenas após aprovação da intermediadora.'], 422);
            }

            $negotiation->update([
                'status' => 'delivered',
                'delivered_at' => now(),
                'buyer_confirmed_at' => now(),
                'buyer_rating' => $rating ?? $negotiation->buyer_rating,
                'buyer_rating_note' => is_string($comment) ? trim($comment) : $negotiation->buyer_rating_note,
            ]);

            AuditLogger::log($request, 'negotiation.buyer_confirmed_delivery', $negotiation, [
                'has_rating' => $rating !== null,
            ]);

            return response()->json(['success' => true]);
        });
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
        $isAdmin = $user->role === 'admin';

        return $this->withLockedNegotiation($id, function (Negotiation $negotiation) use ($request, $user, $isAdmin) {
            if ($this->isDigitalDeliveryCategory($negotiation->category)) {
                return response()->json(['message' => 'Negociação digital não utiliza rastreio físico.'], 422);
            }

            if (! $negotiation->isSeller($user) && ! $isAdmin) {
                return response()->json(['message' => 'Apenas o vendedor pode adicionar rastreio.'], 403);
            }

            $statusBefore = (string) $negotiation->status;

            // Vendedor só pode registrar o envio quando estiver em "Aguardando Envio".
            // Admin pode corrigir/editar o código mesmo em outros status (sem alterar o status automaticamente).
            if (! $isAdmin && $statusBefore !== 'waiting_shipment') {
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

            $autoTransition = false;

            // Só força transição de status quando estiver no fluxo normal de envio.
            if ($statusBefore === 'waiting_shipment') {
                $autoTransition = true;
                $update['status'] = 'shipped';
                $update['shipped_at'] = $negotiation->shipped_at ?? now();
            }

            $negotiation->update($update);

            AuditLogger::log($request, 'negotiation.tracking_set', $negotiation, [
                'actor_role' => (string) $user->role,
                'status_before' => $statusBefore,
                'status_after' => (string) $negotiation->status,
                'auto_transition' => $autoTransition,
                'carrier_provided' => ! empty($data['tracking_carrier']),
                'tracking_code_length' => strlen((string) $data['tracking_code']),
            ]);

            return response()->json(['success' => true]);
        });
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

        return $this->withLockedNegotiation($id, function (Negotiation $negotiation) use ($request, $user) {
            if ($this->isDigitalDeliveryCategory($negotiation->category)) {
                return response()->json(['message' => 'Negociação digital não possui envio físico para comprador.'], 422);
            }

            $statusBefore = (string) $negotiation->status;

            if ($statusBefore !== 'at_intermediary' && $statusBefore !== 'approved') {
                return response()->json(['message' => 'Ação não disponível neste status.'], 422);
            }

            if (! $negotiation->inspection_saved_at) {
                return response()->json(['message' => 'Envie o relatório de inspeção antes de informar o rastreio do comprador.'], 422);
            }

            $data = Validator::make($request->all(), [
                'tracking_code' => ['required', 'string', 'max:100'],
                'tracking_carrier' => ['nullable', 'string', 'max:100'],
            ])->validate();

            $sentToBuyerAtBefore = $negotiation->sent_to_buyer_at;
            $approvalConfirmedAtBefore = $negotiation->intermediary_approval_confirmed_at;

            $negotiation->update([
                'buyer_tracking_code' => $data['tracking_code'],
                'buyer_tracking_carrier' => $data['tracking_carrier'] ?? null,
                'status' => 'approved',
                'sent_to_buyer_at' => $sentToBuyerAtBefore ?? now(),
                'intermediary_approval_confirmed_at' => $approvalConfirmedAtBefore ?? now(),
            ]);

            AuditLogger::log($request, 'negotiation.buyer_tracking_set', $negotiation, [
                'actor_role' => (string) $user->role,
                'status_before' => $statusBefore,
                'status_after' => (string) $negotiation->status,
                'carrier_provided' => ! empty($data['tracking_carrier']),
                'buyer_tracking_code_length' => strlen((string) $data['tracking_code']),
                'sent_to_buyer_at_was_set' => $sentToBuyerAtBefore ? false : true,
                'approval_confirmed_at_was_set' => $approvalConfirmedAtBefore ? false : true,
            ]);

            return response()->json(['success' => true]);
        });
    }

    /**
     * Buyer rejects the negotiation.
     */
    public function buyerReject(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $data = Validator::make($request->all(), [
            'reason_type' => ['required', 'string', 'max:50'],
            'reason_details' => ['nullable', 'string', 'max:500'],
        ])->validate();

        return $this->withLockedNegotiation($id, function (Negotiation $negotiation) use ($request, $user, $data) {
            if ($negotiation->buyer_id !== $user->id) {
                return response()->json(['message' => 'Acesso negado.'], 403);
            }

            $negotiation->update([
                'status' => 'cancelled',
                'buyer_rejection_reason' => $data['reason_type'],
                'buyer_rejection_details' => $data['reason_details'] ?? null,
                'cancelled_at' => now(),
            ]);

            AuditLogger::log($request, 'negotiation.buyer_rejected', $negotiation, [
                'reason_type' => (string) $data['reason_type'],
                'details_length' => isset($data['reason_details']) ? strlen((string) $data['reason_details']) : 0,
            ]);

            return response()->json(['success' => true]);
        });
    }

    /**
     * Buyer confirms payment.
     */
    public function confirmPayment(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $data = Validator::make($request->all(), [
            'payment_proof' => ['nullable', 'file', 'max:5120', 'mimes:jpg,jpeg,png,pdf', 'mimetypes:image/jpeg,image/png,application/pdf'],
        ])->validate();

        $proofPath = null;
        if ($request->hasFile('payment_proof')) {
            // Store privately (local disk is configured to storage/app/private)
            $proofPath = $request->file('payment_proof')->store('negotiations/payment-proofs', 'local');
        }

        DB::transaction(function () use ($id, $user, $proofPath, $request) {
            $negotiation = Negotiation::lockForUpdate()->find($id);

            if (! $negotiation) {
                abort(404, 'Negociacao nao encontrada.');
            }

            $isAdmin = $user && $user->role === 'admin';
            if (! $isAdmin && $negotiation->buyer_id !== $user->id) {
                abort(403, 'Acesso negado.');
            }

            if ($negotiation->status !== 'waiting_payment') {
                abort(400, 'Pagamento nao esperado neste status.');
            }

            $nextStatus = $this->nextStatusAfterPayment($negotiation);

            $payload = [
                'status' => $nextStatus,
                'paid_at' => now(),
                'payment_confirmed_by_buyer' => true,
            ];

            if ($proofPath) {
                $payload['buyer_payment_proof'] = $proofPath;
                $payload['buyer_payment_proof_uploaded_at'] = now();
            }

            $negotiation->update($payload);

            AuditLogger::log($request, 'negotiation.payment_confirmed', $negotiation, [
                'has_proof' => (bool) $proofPath,
            ]);

            $this->upsertPaymentsAfterPaymentConfirmed(
                $negotiation,
                $proofPath ? 'manual' : null,
                null,
                null,
            );
        });

        return response()->json(['success' => true]);
    }

    /**
     * Admin: confirmar que o repasse ao vendedor foi feito (marca payment.type=release como confirmado).
     */
    public function confirmReleasePayment(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (! $user || $user->role !== 'admin') {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        DB::transaction(function () use ($id, $request) {
            $negotiation = Negotiation::lockForUpdate()->find($id);
            if (! $negotiation) {
                abort(404, 'Negociacao nao encontrada.');
            }

            $isGoldReady = $this->isCurrencyCategory($negotiation->category)
                && (bool) $negotiation->gold_buyer_received_confirmed_at
                && (bool) $negotiation->gold_seller_sent_confirmed_at;

            if ($negotiation->status !== 'delivered' && ! $isGoldReady) {
                abort(422, 'Repasse disponível apenas após conclusão da negociação.');
            }

            $payment = Payment::firstOrCreate(
                ['negotiation_id' => $negotiation->id, 'type' => 'release'],
                ['amount' => (float) $negotiation->price, 'currency' => 'BRL']
            );

            if (! $payment->confirmed_at) {
                $payment->forceFill([
                    'confirmed_at' => now(),
                    'provider' => $payment->provider ?? 'manual',
                ])->save();
            }

            AuditLogger::log($request, 'negotiation.release_payment_confirmed', $negotiation);
        });

        return response()->json(['success' => true]);
    }

    /**
     * Buyer submits data required to change a game account (only for Conta de jogo).
     */
    public function submitGameAccountChangeRequest(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $data = Validator::make($request->all(), [
            'game_account_buyer_change_request' => ['required', 'string', 'min:10', 'max:5000'],
        ])->validate();

        return $this->withLockedNegotiation($id, function (Negotiation $negotiation) use ($user, $data) {
            if (! $this->isGameAccountCategory($negotiation->category)) {
                return response()->json(['message' => 'Ação disponível apenas para Conta de jogo.'], 422);
            }

            if ($negotiation->buyer_id !== $user->id) {
                return response()->json(['message' => 'Acesso negado.'], 403);
            }

            if ($negotiation->status !== 'waiting_digital_delivery') {
                return response()->json(['message' => 'Dados de alteração disponíveis apenas após o pagamento confirmado.'], 422);
            }

            $negotiation->update([
                'game_account_buyer_change_request' => (string) $data['game_account_buyer_change_request'],
                'game_account_buyer_change_requested_at' => now(),
            ]);

            return response()->json(['success' => true]);
        });
    }

    /**
     * Seller submits digital delivery info for non-account digital categories (e.g., Chave / DLC, Serviços).
     * Moedas / Gold / Créditos possui fluxo próprio via rotas /gold/*.
     */
    public function submitDigitalDeliveryInfo(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $data = Validator::make($request->all(), [
            'digital_delivery_info' => ['required', 'string', 'min:5', 'max:5000'],
        ])->validate();

        return $this->withLockedNegotiation($id, function (Negotiation $negotiation) use ($user, $data) {
            if (! $this->isDigitalDeliveryCategory($negotiation->category)
                || $this->isGameAccountCategory($negotiation->category)
                || $this->isCurrencyCategory($negotiation->category)) {
                return response()->json(['message' => 'Ação disponível apenas para categorias digitais (exceto Conta de jogo e Moedas / Gold / Créditos).'], 422);
            }

            if ($negotiation->seller_id !== $user->id) {
                return response()->json(['message' => 'Acesso negado.'], 403);
            }

            if ($negotiation->status !== 'waiting_digital_delivery') {
                return response()->json(['message' => 'Envio digital disponível apenas após o pagamento confirmado.'], 422);
            }

            $negotiation->update([
                'digital_delivery_info' => (string) $data['digital_delivery_info'],
                'digital_delivery_info_sent_by_user_id' => $user->id,
                'digital_delivery_info_sent_at' => now(),
                'digital_delivery_info_viewed_by_buyer_at' => null,
            ]);

            return response()->json(['success' => true]);
        });
    }

    /**
     * Buyer submits gold delivery details (character/server/faction + availability).
     */
    public function submitGoldBuyerInfo(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $data = Validator::make($request->all(), [
            'gold_buyer_character_name' => ['required', 'string', 'max:120'],
            'gold_buyer_server' => ['required', 'string', 'max:120'],
            'gold_buyer_faction' => ['required', 'string', 'max:60'],
            'gold_buyer_time_options' => ['required', 'array', 'min:1', 'max:3'],
            'gold_buyer_time_options.*' => ['string', 'max:120'],
            'gold_buyer_notes' => ['nullable', 'string', 'max:2000'],
        ])->validate();

        $timeOptions = $this->normalizeTimeOptions($data['gold_buyer_time_options'] ?? [], 3);
        if (! $timeOptions) {
            return response()->json(['message' => 'Informe pelo menos 1 horário disponível (máx 3).'], 422);
        }

        return $this->withLockedNegotiation($id, function (Negotiation $negotiation) use ($user, $data, $timeOptions) {
            if (! $this->isCurrencyCategory($negotiation->category)) {
                return response()->json(['message' => 'Ação disponível apenas para Moedas / Gold / Créditos.'], 422);
            }

            if ($negotiation->buyer_id !== $user->id) {
                return response()->json(['message' => 'Acesso negado.'], 403);
            }

            if ($negotiation->status !== 'waiting_digital_delivery') {
                return response()->json(['message' => 'Dados da entrega disponíveis apenas após o pagamento confirmado.'], 422);
            }

            $negotiation->update([
                'gold_buyer_character_name' => (string) $data['gold_buyer_character_name'],
                'gold_buyer_server' => (string) $data['gold_buyer_server'],
                'gold_buyer_faction' => (string) $data['gold_buyer_faction'],
                'gold_buyer_time_options' => $timeOptions,
                'gold_buyer_availability' => implode("\n", $timeOptions),
                'gold_buyer_notes' => array_key_exists('gold_buyer_notes', $data) ? (string) $data['gold_buyer_notes'] : null,
                'gold_buyer_info_submitted_at' => now(),
            ]);

            return response()->json(['success' => true]);
        });
    }

    /**
     * Seller submits gold delivery schedule + method.
     */
    public function submitGoldSellerInfo(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $data = Validator::make($request->all(), [
            'gold_seller_time_options' => ['required', 'array', 'min:1', 'max:3'],
            'gold_seller_time_options.*' => ['string', 'max:120'],
            'gold_seller_delivery_method' => ['required', 'string', 'in:trade,mail,gift'],
        ])->validate();

        $timeOptions = $this->normalizeTimeOptions($data['gold_seller_time_options'] ?? [], 3);
        if (! $timeOptions) {
            return response()->json(['message' => 'Informe pelo menos 1 horário disponível (máx 3).'], 422);
        }

        return $this->withLockedNegotiation($id, function (Negotiation $negotiation) use ($user, $data, $timeOptions) {
            if (! $this->isCurrencyCategory($negotiation->category)) {
                return response()->json(['message' => 'Ação disponível apenas para Moedas / Gold / Créditos.'], 422);
            }

            if ($negotiation->seller_id !== $user->id) {
                return response()->json(['message' => 'Acesso negado.'], 403);
            }

            if ($negotiation->status !== 'waiting_digital_delivery') {
                return response()->json(['message' => 'Envio disponível apenas após o pagamento confirmado.'], 422);
            }

            $negotiation->update([
                'gold_seller_time_options' => $timeOptions,
                'gold_seller_availability' => implode("\n", $timeOptions),
                'gold_seller_delivery_method' => (string) $data['gold_seller_delivery_method'],
                'gold_seller_info_submitted_at' => now(),
                // Seller changed schedule/method => buyer must confirm again.
                'gold_schedule_confirmed_at' => null,
                'gold_buyer_selected_time' => null,
            ]);

            return response()->json(['success' => true]);
        });
    }

    /**
     * Buyer confirms the seller schedule for gold delivery.
     */
    public function confirmGoldSchedule(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $data = Validator::make($request->all(), [
            'gold_buyer_selected_time' => ['required', 'string', 'max:120'],
        ])->validate();

        $selected = trim((string) $data['gold_buyer_selected_time']);

        return $this->withLockedNegotiation($id, function (Negotiation $negotiation) use ($user, $selected) {
            if (! $this->isCurrencyCategory($negotiation->category)) {
                return response()->json(['message' => 'Ação disponível apenas para Moedas / Gold / Créditos.'], 422);
            }

            if ($negotiation->buyer_id !== $user->id) {
                return response()->json(['message' => 'Acesso negado.'], 403);
            }

            if (! in_array($negotiation->status, ['awaiting_admin_approval', 'waiting_digital_delivery'], true)) {
                return response()->json(['message' => 'Confirmação disponível apenas após aceitar a negociação.'], 422);
            }

            if (! $negotiation->gold_seller_time_options || ! $negotiation->gold_seller_delivery_method) {
                return response()->json(['message' => 'O vendedor ainda não informou horário/método de entrega.'], 422);
            }

            $sellerOptions = $this->normalizeTimeOptions($negotiation->gold_seller_time_options, 3);
            if ($sellerOptions && ! in_array($selected, $sellerOptions, true)) {
                return response()->json(['message' => 'Selecione um horário enviado pelo vendedor.'], 422);
            }

            $negotiation->update([
                'gold_schedule_confirmed_at' => now(),
                'gold_buyer_selected_time' => $selected,
            ]);

            return response()->json([
                'success' => true,
                'notice' => 'Horário confirmado. Ambos devem aguardar até 10 minutos para o outro entrar.',
            ]);
        });
    }

    /**
     * Buyer requests a new schedule (if cannot attend).
     */
    public function submitGoldBuyerReschedule(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $data = Validator::make($request->all(), [
            'gold_buyer_reschedule_request' => ['required', 'string', 'min:10', 'max:2000'],
        ])->validate();

        return $this->withLockedNegotiation($id, function (Negotiation $negotiation) use ($user, $data) {
            if (! $this->isCurrencyCategory($negotiation->category)) {
                return response()->json(['message' => 'Ação disponível apenas para Moedas / Gold / Créditos.'], 422);
            }

            if ($negotiation->buyer_id !== $user->id) {
                return response()->json(['message' => 'Acesso negado.'], 403);
            }

            if ($negotiation->status !== 'waiting_digital_delivery') {
                return response()->json(['message' => 'Solicitação disponível apenas após o pagamento confirmado.'], 422);
            }

            $negotiation->update([
                'gold_buyer_reschedule_request' => (string) $data['gold_buyer_reschedule_request'],
                'gold_buyer_reschedule_requested_at' => now(),
                'gold_schedule_confirmed_at' => null,
                'gold_buyer_selected_time' => null,
            ]);

            return response()->json(['success' => true]);
        });
    }

    /**
     * Buyer confirms they received the gold in-game.
     */
    public function confirmGoldBuyerReceived(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        return $this->withLockedNegotiation($id, function (Negotiation $negotiation) use ($user) {
            if (! $this->isCurrencyCategory($negotiation->category)) {
                return response()->json(['message' => 'Ação disponível apenas para Moedas / Gold / Créditos.'], 422);
            }

            if ($negotiation->buyer_id !== $user->id) {
                return response()->json(['message' => 'Acesso negado.'], 403);
            }

            if ($negotiation->status !== 'waiting_digital_delivery') {
                return response()->json(['message' => 'Confirmação disponível apenas após o pagamento confirmado.'], 422);
            }

            if (! $negotiation->gold_schedule_confirmed_at) {
                return response()->json(['message' => 'Confirme o horário antes de confirmar o recebimento.'], 422);
            }

            if (! $negotiation->gold_buyer_received_confirmed_at) {
                $negotiation->update([
                    'gold_buyer_received_confirmed_at' => now(),
                    'buyer_confirmed_at' => now(),
                ]);
                $negotiation->refresh();
            }

            if ($negotiation->gold_seller_sent_confirmed_at && $negotiation->status !== 'delivered') {
                $negotiation->update([
                    'status' => 'delivered',
                    'delivered_at' => $negotiation->delivered_at ?? now(),
                ]);
            }

            return response()->json(['success' => true]);
        });
    }

    /**
     * Seller confirms they delivered the gold in-game.
     */
    public function confirmGoldSellerSent(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        return $this->withLockedNegotiation($id, function (Negotiation $negotiation) use ($user) {
            if (! $this->isCurrencyCategory($negotiation->category)) {
                return response()->json(['message' => 'Ação disponível apenas para Moedas / Gold / Créditos.'], 422);
            }

            if ($negotiation->seller_id !== $user->id) {
                return response()->json(['message' => 'Acesso negado.'], 403);
            }

            if ($negotiation->status !== 'waiting_digital_delivery') {
                return response()->json(['message' => 'Confirmação disponível apenas após o pagamento confirmado.'], 422);
            }

            if (! $negotiation->gold_schedule_confirmed_at) {
                return response()->json(['message' => 'Confirme o horário antes de confirmar o envio.'], 422);
            }

            if (! $negotiation->gold_seller_sent_confirmed_at) {
                $negotiation->update([
                    'gold_seller_sent_confirmed_at' => now(),
                ]);
                $negotiation->refresh();
            }

            if ($negotiation->gold_buyer_received_confirmed_at && $negotiation->status !== 'delivered') {
                $negotiation->update([
                    'status' => 'delivered',
                    'delivered_at' => $negotiation->delivered_at ?? now(),
                ]);
            }

            return response()->json(['success' => true]);
        });
    }

    /**
     * Seller submits account credentials/info (only for Conta de jogo) AFTER payment confirmed.
     */
    public function submitGameAccountSellerInfo(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $data = Validator::make($request->all(), [
            'game_account_seller_info' => ['required', 'string', 'min:10', 'max:5000'],
            'seller_fee_deduct_from_payout' => ['nullable'],
        ])->validate();

        $deductRaw = $data['seller_fee_deduct_from_payout'] ?? null;
        $deduct = false;
        if (is_string($deductRaw)) {
            $deduct = in_array(strtolower($deductRaw), ['true', '1', 'on', 'yes'], true);
        } elseif (is_bool($deductRaw)) {
            $deduct = $deductRaw;
        } elseif (is_numeric($deductRaw)) {
            $deduct = ((int) $deductRaw) === 1;
        }

        return $this->withLockedNegotiation($id, function (Negotiation $negotiation) use ($user, $data, $deduct) {
            if (! $this->isGameAccountCategory($negotiation->category)) {
                return response()->json(['message' => 'Ação disponível apenas para Conta de jogo.'], 422);
            }

            if ($negotiation->seller_id !== $user->id) {
                return response()->json(['message' => 'Acesso negado.'], 403);
            }

            if ($negotiation->status !== 'waiting_digital_delivery') {
                return response()->json(['message' => 'Dados da conta disponíveis apenas após o pagamento confirmado.'], 422);
            }

            $negotiation->update([
                'game_account_seller_info' => (string) $data['game_account_seller_info'],
                'seller_fee_deduct_from_payout' => $deduct,
                'game_account_seller_info_sent_by_user_id' => $user->id,
                'game_account_seller_info_sent_at' => now(),
                'game_account_seller_info_viewed_by_buyer_at' => null,
            ]);

            return response()->json(['success' => true]);
        });
    }

    /**
     * Admin/inspector marks a game account as digitally delivered to the buyer.
     */
    public function markDigitalDelivered(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'admin' && $user->role !== 'inspector') {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        return $this->withLockedNegotiation($id, function (Negotiation $negotiation) {
            if (! $this->isDigitalDeliveryCategory($negotiation->category)) {
                return response()->json(['message' => 'Ação disponível apenas para negociações digitais.'], 422);
            }

            if ($negotiation->status !== 'waiting_digital_delivery') {
                return response()->json(['message' => 'Entrega digital não disponível neste status.'], 422);
            }

            if ($negotiation->status !== 'delivered') {
                $negotiation->update([
                    'status' => 'delivered',
                    'delivered_at' => now(),
                ]);
            }

            return response()->json(['success' => true]);
        });
    }

    /**
     * Save inspection report.
     */
    public function saveInspectionReport(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $negotiation = Negotiation::find($id);
        if (! $negotiation) {
            return response()->json(['message' => 'Negociacao nao encontrada.'], 404);
        }

        $isAdminOrInspector = $user->role === 'admin' || $user->role === 'inspector';
        $isAssignedIntermediator = $user->role === 'intermediator' && (int) $negotiation->intermediator_id === (int) $user->id;
        if (! $isAdminOrInspector && ! $isAssignedIntermediator) {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        if ($this->isDigitalDeliveryCategory($negotiation->category)) {
            return response()->json(['message' => 'Negociação digital não possui inspeção física.'], 422);
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

        AuditLogger::log($request, 'negotiation.inspection_report_saved', $negotiation, [
            'photos_count' => is_array($allPhotos) ? count($allPhotos) : 0,
        ]);

        $negotiation->load([
            'seller:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state',
            'buyer:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state',
            'intermediator:id,name',
        ]);

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
        $negotiation = Negotiation::find($id);
        if (! $negotiation) {
            return response()->json(['message' => 'Negociacao nao encontrada.'], 404);
        }

        $isAdminOrInspector = $user->role === 'admin' || $user->role === 'inspector';
        $isAssignedIntermediator = $user->role === 'intermediator' && (int) $negotiation->intermediator_id === (int) $user->id;
        if (! $isAdminOrInspector && ! $isAssignedIntermediator) {
            return response()->json(['message' => 'Acesso negado.'], 403);
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

        AuditLogger::log($request, 'negotiation.internal_log_added', $negotiation, [
            'type' => $data['type'] ?? 'note',
        ]);

        $negotiation->load([
            'seller:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state',
            'buyer:id,name,email,phone,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state',
            'intermediator:id,name',
        ]);

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

        $isAdmin = $user && $user->role === 'admin';
        $isAssignedIntermediator = $user && $user->role === 'intermediator' && (int) $negotiation->intermediator_id === (int) $user->id;
        if (! $negotiation->isParticipant($user) && ! $isAdmin && ! $isAssignedIntermediator) {
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

        AuditLogger::log($request, 'negotiation.images_purged', $negotiation, [
            'deleted' => $deleted,
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
        $privateDisk = Storage::disk('local');

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

        $buyerPaymentProofUrl = null;
        if ($includePhotos && isset($negotiation->buyer_payment_proof) && is_string($negotiation->buyer_payment_proof) && $negotiation->buyer_payment_proof !== '') {
            // Do not expose direct storage URLs; generate a short-lived signed download URL.
            if ($privateDisk->exists($negotiation->buyer_payment_proof) || $publicDisk->exists($negotiation->buyer_payment_proof)) {
                $buyerPaymentProofUrl = URL::temporarySignedRoute(
                    'files.negotiations.payment-proof',
                    now()->addMinutes(10),
                    ['id' => $negotiation->id]
                );
            }
        }
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

        $currentUserRole = $currentUser?->role ?? null;
        $isAdminOrInspector = in_array($currentUserRole, ['admin', 'inspector'], true);
        $isBuyer = $currentUser && $negotiation->buyer_id === $currentUser->id;
        $isSeller = $currentUser && $negotiation->seller_id === $currentUser->id;

        $sellerFeeDeductFromPayout = null;
        if ($isAdminOrInspector || $isSeller) {
            $sellerFeeDeductFromPayout = (bool) $negotiation->seller_fee_deduct_from_payout;
        }

        $isGameAccount = $this->isGameAccountCategory($negotiation->category);
        $isDigitalDelivery = $this->isDigitalDeliveryCategory($negotiation->category);
        $isCurrency = $this->isCurrencyCategory($negotiation->category);

        $status = (string) $negotiation->status;
        $digitalViewAllowedByStatus = in_array($status, ['waiting_digital_delivery', 'approved', 'delivered'], true);

        $gameAccountSellerInfo = null;
        $gameAccountBuyerChangeRequest = null;
        $gameAccountBuyerChangeRequestedAt = null;

        $gameAccountSellerInfoSentAt = null;
        $gameAccountSellerInfoViewedByBuyerAt = null;

        $digitalDeliveryInfo = null;
        $digitalDeliveryInfoSentAt = null;
        $digitalDeliveryInfoViewedByBuyerAt = null;

        if ($isGameAccount) {
            if ($digitalViewAllowedByStatus && ($isAdminOrInspector || $isBuyer || $isSeller)) {
                $gameAccountSellerInfoSentAt = $this->toIso8601StringOrNull($negotiation->game_account_seller_info_sent_at);
            }

            // Sensitive: show ONLY to buyer/admin/inspector and only when digital delivery is relevant.
            if ($digitalViewAllowedByStatus && ($isAdminOrInspector || $isBuyer)) {
                $gameAccountSellerInfo = $negotiation->game_account_seller_info;
                $gameAccountSellerInfoViewedByBuyerAt = $this->toIso8601StringOrNull($negotiation->game_account_seller_info_viewed_by_buyer_at);
            }

            if ($isAdminOrInspector || $isBuyer) {
                $gameAccountBuyerChangeRequest = $negotiation->game_account_buyer_change_request;
                $gameAccountBuyerChangeRequestedAt = $this->toIso8601StringOrNull($negotiation->game_account_buyer_change_requested_at);
            }
        }

        if ($isDigitalDelivery && ! $isGameAccount) {
            if ($digitalViewAllowedByStatus && ($isAdminOrInspector || $isBuyer || $isSeller)) {
                $digitalDeliveryInfoSentAt = $this->toIso8601StringOrNull($negotiation->digital_delivery_info_sent_at);
            }

            // Sensitive: show ONLY to buyer/admin/inspector and only when digital delivery is relevant.
            if ($digitalViewAllowedByStatus && ($isAdminOrInspector || $isBuyer)) {
                $digitalDeliveryInfo = $negotiation->digital_delivery_info;
                $digitalDeliveryInfoViewedByBuyerAt = $this->toIso8601StringOrNull($negotiation->digital_delivery_info_viewed_by_buyer_at);
            }
        }

        $goldDelivery = null;
        if ($isCurrency && ($isAdminOrInspector || $isBuyer || $isSeller)) {
            $goldDelivery = [
                'buyer' => [
                    'character_name' => $negotiation->gold_buyer_character_name,
                    'server' => $negotiation->gold_buyer_server,
                    'faction' => $negotiation->gold_buyer_faction,
                    'time_options' => $this->normalizeTimeOptions($negotiation->gold_buyer_time_options, 3),
                    'availability' => $negotiation->gold_buyer_availability,
                    'notes' => $negotiation->gold_buyer_notes,
                    'submitted_at' => $this->toIso8601StringOrNull($negotiation->gold_buyer_info_submitted_at),
                ],
                'seller' => [
                    'time_options' => $this->normalizeTimeOptions($negotiation->gold_seller_time_options, 3),
                    'availability' => $negotiation->gold_seller_availability,
                    'delivery_method' => $negotiation->gold_seller_delivery_method,
                    'submitted_at' => $this->toIso8601StringOrNull($negotiation->gold_seller_info_submitted_at),
                ],
                'buyer_selected_time' => $negotiation->gold_buyer_selected_time,
                'schedule_confirmed_at' => $this->toIso8601StringOrNull($negotiation->gold_schedule_confirmed_at),
                'buyer_received_confirmed_at' => $this->toIso8601StringOrNull($negotiation->gold_buyer_received_confirmed_at),
                'seller_sent_confirmed_at' => $this->toIso8601StringOrNull($negotiation->gold_seller_sent_confirmed_at),
                'buyer_reschedule_request' => $negotiation->gold_buyer_reschedule_request,
                'buyer_reschedule_requested_at' => $this->toIso8601StringOrNull($negotiation->gold_buyer_reschedule_requested_at),
            ];
        }

        $paymentsData = [];
        try {
            $payments = $negotiation->relationLoaded('payments')
                ? $negotiation->payments
                : $negotiation->payments()->get();

            $paymentsData = $payments
                ->sortBy(fn ($p) => (string) $p->type)
                ->map(fn ($p) => [
                    'id' => $p->id,
                    'type' => $p->type,
                    'description' => $p->description,
                    'amount' => is_numeric($p->amount) ? (float) $p->amount : 0.0,
                    'currency' => $p->currency,
                    'confirmed_at' => $this->toIso8601StringOrNull($p->confirmed_at),
                ])
                ->values()
                ->all();
        } catch (\Throwable $exception) {
            $paymentsData = [];
        }

        $serviceData = null;
        try {
            $serviceId = trim((string) ($negotiation->service_id ?? ''));
            $gameId = trim((string) ($negotiation->game_id ?? ''));

            if ($serviceId !== '' && $gameId !== '') {
                $cfg = (array) config('service_forms', []);
                $services = $cfg['services'] ?? [];
                $games = $cfg['games'] ?? [];
                $formFields = $cfg['formFields'] ?? [];

                $serviceLabel = $serviceId;
                if (is_array($services)) {
                    foreach ($services as $s) {
                        if (is_array($s) && ($s['id'] ?? null) === $serviceId) {
                            $serviceLabel = (string) ($s['label'] ?? $serviceLabel);
                            break;
                        }
                    }
                }

                $gameLabel = is_array($games) ? (string) ($games[$gameId] ?? $gameId) : $gameId;
                if ($gameId === 'other') {
                    $typed = '';
                    try {
                        $fieldsForGame = $negotiation->relationLoaded('fields')
                            ? $negotiation->fields
                            : $negotiation->fields()->get();
                        foreach ($fieldsForGame as $f) {
                            if ((string) ($f->field_id ?? '') === 'game_other_name') {
                                $typed = trim((string) ($f->field_value ?? ''));
                                break;
                            }
                        }
                    } catch (\Throwable $e) {
                        $typed = '';
                    }
                    if ($typed !== '') {
                        $gameLabel = $typed;
                    }
                }

                $labelMap = [];
                if (is_array($formFields)
                    && isset($formFields[$serviceId])
                    && is_array($formFields[$serviceId])
                    && isset($formFields[$serviceId][$gameId])
                    && is_array($formFields[$serviceId][$gameId])
                ) {
                    foreach ($formFields[$serviceId][$gameId] as $def) {
                        if (! is_array($def)) {
                            continue;
                        }
                        $fid = trim((string) ($def['id'] ?? ''));
                        if ($fid === '') {
                            continue;
                        }
                        $labelMap[$fid] = (string) ($def['label'] ?? $fid);
                    }
                }

                $fields = null;
                try {
                    $fields = $negotiation->relationLoaded('fields')
                        ? $negotiation->fields
                        : $negotiation->fields()->get();
                } catch (\Throwable $e) {
                    $fields = collect();
                }

                $fieldsOut = [];
                foreach ($fields as $f) {
                    $fid = trim((string) ($f->field_id ?? ''));
                    $val = trim((string) ($f->field_value ?? ''));
                    if ($fid === '' || $val === '') {
                        continue;
                    }
                    $fieldsOut[] = [
                        'field_id' => $fid,
                        'label' => $labelMap[$fid] ?? $fid,
                        'value' => $val,
                    ];
                }

                $serviceData = [
                    'service_id' => $serviceId,
                    'service_label' => $serviceLabel,
                    'game_id' => $gameId,
                    'game_label' => $gameLabel,
                    'fields' => $fieldsOut,
                ];
            }
        } catch (\Throwable $exception) {
            $serviceData = null;
        }

        $serviceDelivery = null;
        if ($this->isServiceScheduleCategory($negotiation->category)) {
            $serviceDelivery = [
                'seller' => [
                    'start_date_options' => $this->normalizeDateOptions($negotiation->service_seller_start_date_options, 3),
                    'time_range_options' => $this->normalizeTimeRangeOptions($negotiation->service_seller_time_range_options, 5),
                ],
                'buyer_selected_start_date' => $negotiation->service_buyer_selected_start_date
                    ? $negotiation->service_buyer_selected_start_date->format('Y-m-d')
                    : null,
                'buyer_selected_time_range' => $negotiation->service_buyer_selected_time_range,
                'schedule_confirmed_at' => $this->toIso8601StringOrNull($negotiation->service_schedule_confirmed_at),
            ];
        }

        $data = [
            'id' => $negotiation->id,
            'title' => $title,
            'description' => $description,
            'category' => $negotiation->category,
            'service' => $serviceData,
            'delivery_days' => $negotiation->delivery_days,
            'game_title' => $negotiation->game_title,
            'item_name' => $negotiation->item_name,
            'item_general_info' => $negotiation->item_general_info,
            'digital_quantity' => $negotiation->digital_quantity,
            'digital_quantity_formatted' => $this->formatPtBrNumber($negotiation->digital_quantity, 2),
            'digital_game' => $negotiation->digital_game,
            'digital_currency_type' => $negotiation->digital_currency_type,
            'digital_platform_server' => $negotiation->digital_platform_server,
            'digital_delivery_method' => $negotiation->digital_delivery_method,
            'battle_pass' => [
                'game' => $negotiation->battle_pass_game,
                'platform' => $negotiation->battle_pass_platform,
                'type' => $negotiation->battle_pass_type,
                'duration_days' => $negotiation->battle_pass_duration_days,
            ],
            'game_account_public' => $isGameAccount ? [
                'game' => $negotiation->game_account_game,
                'platform' => $negotiation->game_account_platform,
                'level' => $negotiation->game_account_level,
                'rank' => $negotiation->game_account_rank,
                'has_ban' => $negotiation->game_account_has_ban,
            ] : null,
            'price' => $price,
            'price_formatted' => $this->formatPtBrNumber($price, 2),
            'status' => $negotiation->status,
            'seller_fee_deduct_from_payout' => $sellerFeeDeductFromPayout,
            'game_account' => $isGameAccount ? [
                'seller_info' => $gameAccountSellerInfo,
                'seller_info_sent_at' => $gameAccountSellerInfoSentAt,
                'seller_info_viewed_by_buyer_at' => $gameAccountSellerInfoViewedByBuyerAt,
                'buyer_change_request' => $gameAccountBuyerChangeRequest,
                'buyer_change_requested_at' => $gameAccountBuyerChangeRequestedAt,
            ] : null,
            'digital_delivery' => ($isDigitalDelivery && ! $isGameAccount) ? [
                'seller_info' => $digitalDeliveryInfo,
                'seller_info_sent_at' => $digitalDeliveryInfoSentAt,
                'seller_info_viewed_by_buyer_at' => $digitalDeliveryInfoViewedByBuyerAt,
            ] : null,
            'gold_delivery' => $goldDelivery,
            'service_delivery' => $serviceDelivery,
            'seller' => $negotiation->seller ? [
                'id' => $negotiation->seller->id,
                'name' => $negotiation->seller->name,
                'phone' => $negotiation->seller->phone,
                'last_seen_at' => $this->toIso8601StringOrNull($negotiation->seller->last_seen_at),
                'address_zipcode' => $negotiation->seller->address_zipcode,
                'address_street' => $negotiation->seller->address_street,
                'address_number' => $negotiation->seller->address_number,
                'address_complement' => $negotiation->seller->address_complement,
                'address_neighborhood' => $negotiation->seller->address_neighborhood,
                'address_city' => $negotiation->seller->address_city,
                'address_state' => $negotiation->seller->address_state,
            ] : null,
            'buyer' => $negotiation->buyer ? [
                'id' => $negotiation->buyer->id,
                'name' => $negotiation->buyer->name,
                'phone' => $negotiation->buyer->phone,
                'last_seen_at' => $this->toIso8601StringOrNull($negotiation->buyer->last_seen_at),
                'address_zipcode' => $negotiation->buyer->address_zipcode,
                'address_street' => $negotiation->buyer->address_street,
                'address_number' => $negotiation->buyer->address_number,
                'address_complement' => $negotiation->buyer->address_complement,
                'address_neighborhood' => $negotiation->buyer->address_neighborhood,
                'address_city' => $negotiation->buyer->address_city,
                'address_state' => $negotiation->buyer->address_state,
            ] : null,
            'intermediator' => $negotiation->intermediator ? [
                'id' => $negotiation->intermediator->id,
                'name' => $negotiation->intermediator->name,
                'code' => $negotiation->intermediator->intermediator_code ?? null,
                'is_principal' => (bool) ($negotiation->intermediator->is_intermediator_principal ?? false),
            ] : null,
            'intermediator_assigned_at' => $this->toIso8601StringOrNull($negotiation->intermediator_assigned_at),
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
            'payments' => $paymentsData,
            'buyer_payment_proof_url' => $isAdminOrInspector ? $buyerPaymentProofUrl : null,
            'buyer_payment_proof_uploaded_at' => $isAdminOrInspector ? $this->toIso8601StringOrNull($negotiation->buyer_payment_proof_uploaded_at) : null,
            'accepted_at' => $this->toIso8601StringOrNull($negotiation->accepted_at),
            'paid_at' => $this->toIso8601StringOrNull($negotiation->paid_at),
            'shipped_at' => $this->toIso8601StringOrNull($negotiation->shipped_at),
            'received_at' => $this->toIso8601StringOrNull($negotiation->received_at),
            'delivered_at' => $this->toIso8601StringOrNull($negotiation->delivered_at),
            'created_at' => $this->toIso8601StringOrNull($negotiation->created_at),
            'updated_at' => $this->toIso8601StringOrNull($negotiation->updated_at),
        ];

        $asIntermediatorObserver = (bool) ($options['intermediator_observer'] ?? false);
        $asIntermediatorList = (bool) ($options['intermediator_list'] ?? false);

        if (($asIntermediatorObserver || $asIntermediatorList) && (($currentUser?->role ?? null) === 'intermediator')) {
            // Somente leitura / resumo: não expor dados sensíveis.
            $data['pix_code'] = null;
            $data['pix_generated_at'] = null;
            $data['internal_logs'] = [];
            $data['payments'] = [];
            $data['buyer_payment_proof_url'] = null;
            $data['buyer_payment_proof_uploaded_at'] = null;

            $data['tracking_code'] = null;
            $data['tracking_carrier'] = null;
            $data['buyer_tracking_code'] = null;
            $data['buyer_tracking_carrier'] = null;

            $data['rejection_reason'] = null;
            $data['buyer_rejection_reason'] = null;
            $data['buyer_rejection_details'] = null;

            $data['product_photos'] = [];
            $data['inspection_report'] = null;
            $data['intermediary_checklist'] = [];
            $data['intermediary_notes'] = null;
            $data['intermediary_photos'] = [];
            $data['inspection_saved_at'] = null;

            $data['gold_delivery'] = null;
            $data['service_delivery'] = null;

            if (is_array($data['seller'] ?? null)) {
                $data['seller']['phone'] = null;
                $data['seller']['address_zipcode'] = null;
                $data['seller']['address_street'] = null;
                $data['seller']['address_number'] = null;
                $data['seller']['address_complement'] = null;
                $data['seller']['address_neighborhood'] = null;
                $data['seller']['address_city'] = null;
                $data['seller']['address_state'] = null;
            }

            if (is_array($data['buyer'] ?? null)) {
                $data['buyer']['phone'] = null;
                $data['buyer']['address_zipcode'] = null;
                $data['buyer']['address_street'] = null;
                $data['buyer']['address_number'] = null;
                $data['buyer']['address_complement'] = null;
                $data['buyer']['address_neighborhood'] = null;
                $data['buyer']['address_city'] = null;
                $data['buyer']['address_state'] = null;
            }
        }

        return $data;
    }
}
