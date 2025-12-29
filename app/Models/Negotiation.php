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
            'product_photos' => 'array',
            'intermediary_checklist' => 'array',
            'intermediary_photos' => 'array',
            'internal_logs' => 'array',
            'inspection_saved_at' => 'datetime',
            'pix_generated_at' => 'datetime',
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
