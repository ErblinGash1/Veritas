<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\V1\AnalysisController;

/*
|--------------------------------------------------------------------------
| API Routes - Veritas Backend (Java 3)
|--------------------------------------------------------------------------
*/
Route::post('/v1/analyze', [AnalysisController::class, 'analyze'])
    ->middleware('throttle:10,1');

