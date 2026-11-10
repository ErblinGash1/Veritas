<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Veritas API — React -> Laravel -> FastAPI
|--------------------------------------------------------------------------
| Rezultati heuristik ruhet ne MySQL. Klasifikimi ML sq/en eshte eksperimental
| dhe kthehet vetem me pergjigjen e analizes aktuale.
*/

Route::post('/api/v1/analyze', function (Request $request) {
    $startedAt = microtime(true);
    $content = $request->input('content', '');
    $type = $request->input('type', 'text');
    $language = $request->input('language', 'sq');

    if (!is_string($content) || trim($content) === '') {
        return response()->json([
            'status' => 'error',
            'message' => 'Përmbajtja është e zbrazët ose e pavlefshme.',
        ], 400);
    }

    if (mb_strlen($content, 'UTF-8') > 20000) {
        return response()->json([
            'status' => 'error',
            'message' => 'Përmbajtja nuk mund të kalojë 20 000 karaktere.',
        ], 422);
    }

    if (!in_array($type, ['text', 'url'], true)) {
        return response()->json([
            'status' => 'error',
            'message' => 'Lloji i analizës duhet të jetë text ose url.',
        ], 422);
    }

    if (!in_array($language, ['sq', 'en'], true)) {
        return response()->json([
            'status' => 'error',
            'message' => 'Gjuha duhet të jetë sq ose en.',
        ], 422);
    }

    $content = trim($content);
    // services.fastapi.url vjen nga config/services.php; skedari shoqerues
    // shpjegon si te konfigurohet FASTAPI_URL ne .env.
    $fastApiUrl = rtrim((string) config('services.fastapi.url', 'http://127.0.0.1:5001'), '/');

    try {
        $response = Http::acceptJson()
            ->connectTimeout(3)
            ->timeout(12)
            ->post($fastApiUrl . '/predict', [
                'content' => $content,
                'type' => $type,
            ]);

        if ($response->failed()) {
            $pythonStatus = $response->status();
            // Gabimet e validimit te FastAPI mund te kthehen te klienti,
            // por jo detajet e brendshme te serverit Python.
            $detail = $response->json('detail');
            $message = 'Shërbimi i analizës nuk mundi ta përpunojë kërkesën.';

            if (in_array($pythonStatus, [400, 422], true)) {
                $message = is_string($detail) && $detail !== ''
                    ? $detail
                    : 'Kërkesë e pavlefshme për shërbimin e analizës.';
            }

            Log::warning('FastAPI heuristic request failed', [
                'python_status' => $pythonStatus,
            ]);

            return response()->json([
                'status' => 'error',
                'message' => $message,
                'python_status' => $pythonStatus,
            ], in_array($pythonStatus, [400, 422], true) ? $pythonStatus : 502);
        }

        $heuristic = $response->json();
        if (!is_array($heuristic) || ($heuristic['status'] ?? null) !== 'success') {
            Log::warning('Invalid FastAPI heuristic response');
            return response()->json([
                'status' => 'error',
                'message' => 'Përgjigje e pavlefshme nga shërbimi i analizës.',
            ], 502);
        }

        $mlSqData = null;
        $mlEnData = null;
        $isText = $type === 'text'
            && !preg_match('/^https?:\/\//i', $content);
        $words = preg_split('/\s+/u', $content, -1, PREG_SPLIT_NO_EMPTY);
        $wordCount = is_array($words) ? count($words) : 0;

        if ($isText && $wordCount >= 8) {
            $endpoint = $language === 'en' ? 'predict-ml-en' : 'predict-ml-sq';

            try {
                $mlResponse = Http::acceptJson()
                    ->connectTimeout(3)
                    ->timeout(5)
                    ->post($fastApiUrl . '/' . $endpoint, [
                        'content' => $content,
                        'type' => 'text',
                    ]);

                if ($mlResponse->successful()) {
                    $candidate = $mlResponse->json();

                    if (
                        is_array($candidate)
                        && ($candidate['status'] ?? null) === 'success'
                        && ($candidate['language'] ?? null) === $language
                        && in_array($candidate['prediction'] ?? null, ['REAL', 'FAKE', 'UNCERTAIN'], true)
                    ) {
                        if ($language === 'en') {
                            $mlEnData = $candidate;
                        } else {
                            $mlSqData = $candidate;
                        }
                    } else {
                        Log::warning('Invalid experimental ML response', ['language' => $language]);
                    }
                } else {
                    Log::warning('Experimental ML endpoint returned an error', [
                        'language' => $language,
                        'python_status' => $mlResponse->status(),
                    ]);
                }
            } catch (\Throwable $e) {
                // ML eshte opsional: mos e deshto analizen kryesore heuristike.
                Log::warning('Experimental ML analysis unavailable', [
                    'language' => $language,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Per URL, fragmenti i kthyer nga Python nuk eshte domosdoshmerisht
        // i gjithe artikulli; sentences_count mbetet vleresim i fragmentit.
        $analyzedText = $isText
            ? $content
            : ($heuristic['analyzed_text_sample'] ?? $content);
        if (!is_string($analyzedText)) {
            $analyzedText = $content;
        }

        $fallbackWords = preg_split('/\s+/u', trim($analyzedText), -1, PREG_SPLIT_NO_EMPTY);
        $totalWords = $heuristic['word_count']
            ?? (is_array($fallbackWords) ? count($fallbackWords) : 0);
        $sentences = preg_split('/[.!?]+/u', $analyzedText, -1, PREG_SPLIT_NO_EMPTY);
        $sentencesCount = max(1, is_array($sentences) ? count($sentences) : 0);

        // Ruajtja ruan formatin historik te tabelave. ML nuk ruhet si fakt.
        $analysisId = DB::table('news_analyses')->insertGetId([
            'content' => mb_substr($content, 0, 5000),
            'prediction' => $heuristic['prediction'] ?? 'REAL',
            'is_fake' => $heuristic['is_fake'] ?? false,
            'confidence_score' => $heuristic['confidence_score'] ?? 0.0,
            'total_words' => $totalWords,
            'sentences_count' => $sentencesCount,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $executionTime = (int) round((microtime(true) - $startedAt) * 1000);
        DB::table('user_logs')->insert([
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent() ?? 'Unknown',
            'endpoint' => '/api/v1/analyze',
            'response_time_ms' => $executionTime,
            'news_analysis_id' => $analysisId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'status' => 'success',
            'ml_sq_analysis' => $mlSqData,
            'ml_en_analysis' => $mlEnData,
            'nlp_analysis' => [
                'prediction' => $heuristic['prediction'] ?? 'REAL',
                'is_fake' => $heuristic['is_fake'] ?? false,
                'risk_score' => $heuristic['risk_score'] ?? 0,
                'risk_level' => $heuristic['risk_level'] ?? 'UNCERTAIN',
                'sensationalism_score' => $heuristic['confidence_score'] ?? 0.0,
                'total_words' => $totalWords,
                'sentences_count' => $sentencesCount,
                'ai_summary' => $heuristic['ai_summary'] ?? '',
                'explanation_reasons' => $heuristic['explanation_reasons'] ?? [],
                'suggestions' => $heuristic['suggestions'] ?? [],
                'domain_info' => $heuristic['domain_info'] ?? null,
            ],
        ]);
    } catch (\Throwable $e) {
        Log::error('Veritas analysis failed', ['error' => $e->getMessage()]);
        return response()->json([
            'status' => 'error',
            'message' => 'Ndodhi një gabim gjatë analizës. Provo përsëri.',
        ], 500);
    }
});

Route::get('/api/v1/analytics', function () {
    try {
        $totalAnalyses = DB::table('news_analyses')->count();
        $fakeCount = DB::table('news_analyses')->where('is_fake', true)->count();
        $realCount = DB::table('news_analyses')->where('is_fake', false)->count();
        $avgConfidence = DB::table('news_analyses')->avg('confidence_score');

        // 7 datat me te fundit me analiza, te renditura kronologjikisht
        // per grafiket. Nuk jane domosdoshmerisht 7 dite kalendarike.
        $dailyStats = DB::table('news_analyses')
            ->select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('COUNT(*) as total'),
                DB::raw('SUM(CASE WHEN is_fake = 1 THEN 1 ELSE 0 END) as fake'),
                DB::raw('SUM(CASE WHEN is_fake = 0 THEN 1 ELSE 0 END) as real_news')
            )
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy(DB::raw('DATE(created_at)'), 'DESC')
            ->limit(7)
            ->get()
            ->reverse()
            ->values();

        return response()->json([
            'status' => 'success',
            'metrics' => [
                'total_analyses' => $totalAnalyses,
                'fake_count' => $fakeCount,
                'real_count' => $realCount,
                'avg_confidence' => round($avgConfidence ?? 0, 2),
            ],
            'chart_data' => $dailyStats,
        ]);
    } catch (\Throwable $e) {
        Log::error('Veritas analytics failed', ['error' => $e->getMessage()]);
        return response()->json([
            'status' => 'error',
            'message' => 'Nuk u arritën të ngarkohen statistikat.',
        ], 500);
    }
});

Route::get('/api/v1/history', function (Request $request) {
    try {
        $query = DB::table('news_analyses');
        $search = $request->input('search', '');
        $status = $request->input('status', '');

        if (!is_string($search) || mb_strlen($search, 'UTF-8') > 200) {
            return response()->json([
                'status' => 'error',
                'message' => 'Kërkimi duhet të jetë tekst deri në 200 karaktere.',
            ], 422);
        }

        if ($search !== '') {
            $query->where('content', 'LIKE', '%' . $search . '%');
        }

        if (is_string($status) && in_array($status, ['REAL', 'FAKE'], true)) {
            $query->where('prediction', $status);
        }

        $analyses = $query
            ->orderBy('created_at', 'DESC')
            ->orderBy('id', 'DESC')
            ->paginate(10);

        return response()->json($analyses);
    } catch (\Throwable $e) {
        Log::error('Veritas history failed', ['error' => $e->getMessage()]);
        return response()->json([
            'status' => 'error',
            'message' => 'Nuk u arrit të ngarkohej historia.',
        ], 500);
    }
});
