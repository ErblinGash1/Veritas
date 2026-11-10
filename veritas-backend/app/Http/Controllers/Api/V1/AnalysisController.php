<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class AnalysisController extends Controller
{
    public function analyze(Request $request)
    {
        $request->validate([
            'content' => 'required|string',
        ]);

        $text = $request->input('content');

        // Përpunimi bazë i tekstit (Tokenization & NLP logic)
        $cleanedText = strtolower(preg_replace('/[^\w\s]/u', '', $text));
        $words = array_filter(explode(' ', $cleanedText));
        
        // Nxjerrja e fjalëve më të përdorura (Keywords)
        $wordCounts = array_count_values($words);
        arsort($wordCounts);
        $topKeywords = array_slice(array_keys($wordCounts), 0, 5);

        // Numërimi i fjalive
        $sentencesCount = count(preg_split('/[.!?]+/', $text, -1, PREG_SPLIT_NO_EMPTY));

        return response()->json([
            'status' => 'success',
            'message' => 'Analiza u krye me sukses',
            'nlp_analysis' => [
                'total_words' => count($words),
                'sentences_count' => $sentencesCount,
                'extracted_keywords' => array_values($topKeywords)
            ]
        ]);
    }
}