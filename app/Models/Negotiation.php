<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Negotiation extends Model
{
    use HasFactory;

    protected $fillable = [
        'seller_id',
        'buyer_id',
        'title',
        'description',
        'category',
        'digital_quantity',
        'digital_game',
        'digital_currency_type',
        'digital_platform_server',
        'digital_delivery_method',
        'delivery_days',
        'game_title',
        'item_name',
        'item_general_info',
        'battle_pass_game',
        'battle_pass_platform',
        'battle_pass_type',
        'battle_pass_duration_days',
        'game_account_game',
        'game_account_platform',
        'game_account_level',
        'game_account_rank',
        'game_account_has_ban',
        'game_account_seller_notes',
        'product_photos',
        'price',
        'status',
        'tracking_code',
        'tracking_carrier',
        'buyer_tracking_code',
        'buyer_tracking_carrier',
        'rejection_reason',
        'buyer_rejection_reason',
        'buyer_rejection_details',
        'intermediary_checklist',
        'intermediary_notes',
        'intermediary_photos',
        'inspection_saved_at',
        'internal_logs',
        'pix_code',
        'pix_generated_at',
        'buyer_payment_proof',
        'buyer_payment_proof_uploaded_at',
        'game_account_seller_info',
        'game_account_seller_info_sent_by_user_id',
        'game_account_seller_info_sent_at',
        'game_account_seller_info_viewed_by_buyer_at',
        'game_account_buyer_change_request',
        'game_account_buyer_change_requested_at',
        'digital_delivery_info',
        'digital_delivery_info_sent_by_user_id',
        'digital_delivery_info_sent_at',
        'digital_delivery_info_viewed_by_buyer_at',
        'digital_delivery_due_soon_alerted_at',
        'digital_delivery_overdue_alerted_at',
        'digital_delivery_overdue_buyer_alerted_at',
        'gold_buyer_character_name',
        'gold_buyer_server',
        'gold_buyer_faction',
        'gold_buyer_availability',
        'gold_buyer_time_options',
        'gold_buyer_notes',
        'gold_buyer_info_submitted_at',
        'gold_seller_availability',
        'gold_seller_time_options',
        'gold_seller_delivery_method',
        'gold_seller_info_submitted_at',
        'gold_buyer_selected_time',
        'gold_schedule_confirmed_at',
        'gold_buyer_received_confirmed_at',
        'gold_seller_sent_confirmed_at',
        'gold_buyer_reschedule_request',
        'gold_buyer_reschedule_requested_at',
        'seller_fee_deduct_from_payout',
        'accepted_at',
        'paid_at',
        'shipped_at',
        'received_at',
        'delivered_at',
        'buyer_confirmed_at',
        'buyer_rating',
        'buyer_rating_note',
        'seller_rating',
        'seller_rating_note',
        'intermediary_rating',
        'intermediary_rating_note',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'digital_quantity' => 'integer',
            'delivery_days' => 'integer',
            'battle_pass_duration_days' => 'integer',
            'game_account_has_ban' => 'boolean',
            'product_photos' => 'array',
            'intermediary_checklist' => 'array',
            'intermediary_photos' => 'array',
            'internal_logs' => 'array',
            'inspection_saved_at' => 'datetime',
            'pix_generated_at' => 'datetime',
            'buyer_payment_proof_uploaded_at' => 'datetime',
            'game_account_buyer_change_requested_at' => 'datetime',
            'game_account_seller_info_sent_at' => 'datetime',
            'game_account_seller_info_viewed_by_buyer_at' => 'datetime',
            'digital_delivery_info_sent_at' => 'datetime',
            'digital_delivery_info_viewed_by_buyer_at' => 'datetime',
            'digital_delivery_due_soon_alerted_at' => 'datetime',
            'digital_delivery_overdue_alerted_at' => 'datetime',
            'digital_delivery_overdue_buyer_alerted_at' => 'datetime',
            'gold_buyer_info_submitted_at' => 'datetime',
            'gold_seller_info_submitted_at' => 'datetime',
            'gold_schedule_confirmed_at' => 'datetime',
            'gold_buyer_time_options' => 'array',
            'gold_seller_time_options' => 'array',
            'gold_buyer_received_confirmed_at' => 'datetime',
            'gold_seller_sent_confirmed_at' => 'datetime',
            'gold_buyer_reschedule_requested_at' => 'datetime',
            'seller_fee_deduct_from_payout' => 'boolean',
            'accepted_at' => 'datetime',
            'paid_at' => 'datetime',
            'shipped_at' => 'datetime',
            'received_at' => 'datetime',
            'delivered_at' => 'datetime',
            'buyer_confirmed_at' => 'datetime',
        ];
    }

    /**
     * The user who created the negotiation (seller for this transaction).
     */
    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    /**
     * The user who accepted the negotiation (buyer for this transaction).
     */
    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    /**
     * Check if a user is the seller in this negotiation.
     */
    public function isSeller(User $user): bool
    {
        return $this->seller_id === $user->id;
    }

    /**
     * Check if a user is the buyer in this negotiation.
     */
    public function isBuyer(User $user): bool
    {
        return $this->buyer_id === $user->id;
    }

    /**
     * Check if a user is participant (seller or buyer).
     */
    public function isParticipant(User $user): bool
    {
        return $this->isSeller($user) || $this->isBuyer($user);
    }

    /**
     * Get the role of the user in this negotiation.
     */
    public function getUserRole(User $user): ?string
    {
        if ($this->isSeller($user)) {
            return 'seller';
        }
        if ($this->isBuyer($user)) {
            return 'buyer';
        }
        return null;
    }
}
