<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserLog extends Model
{
    protected $fillable = [
        'ip_address',
        'user_agent',
        'endpoint',
        'response_time_ms',
        'news_analysis_id'
    ];
}