<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NewsAnalysis extends Model
{
    protected $fillable = [
        'content',
        'prediction',
        'is_fake',
        'confidence_score',
        'total_words',
        'sentences_count'
    ];

    protected $casts = [
        'is_fake' => 'boolean',
    ];
}