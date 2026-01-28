<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NegotiationField extends Model
{
    use HasFactory;

    protected $fillable = [
        'negotiation_id',
        'field_id',
        'field_value',
    ];

    public function negotiation(): BelongsTo
    {
        return $this->belongsTo(Negotiation::class, 'negotiation_id');
    }
}
