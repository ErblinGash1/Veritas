<?php

namespace App\Services;

class NlpService
{
    // Lista e fjalëve të zakonshme (Stop Words) në gjuhën shqipe që duhen injoruar për Keyword Extraction
    private array $stopWordsShqip = [
        'dhe', 'të', 'në', 'i', 'e', 'të', 'o', 'për', 'me', 'nga', 'ka', 'u', 'as', 'ose', 'pas', 
        'por', 'si', 'se', 'shumë', 'nuk', 'ky', 'kjo', 'këtë', 'ata', 'ato', 'disa', 'jam', 'është'
    ];

    /**
     * Hapi 1: Text Preprocess (Pastrimi i tekstit)
     */
    public function preprocess(string $text): string
    {
        // 1. Heqja e kodeve HTML nëse ka
        $text = strip_tags($text);
        
        // 2. Kthimi i të gjithë tekstit në shkronja të vogla (lowercase)
        $text = mb_strtolower($text, 'UTF-8');
        
        // 3. Heqja e shenjave të pikësimit dhe karaktereve speciale
        $text = preg_replace('/[^\w\s]/u', '', $text);
        
        return trim($text);
    }

    /**
     * Hapi 2 & 3: Parsing (Tokenization) dhe Keyword Extraction
     */
    public function extractKeywords(string $cleanText, int $limit = 5): array
    {
        // Tokenizimi: Ndarja e tekstit në fjalë individuale
        $words = preg_split('/\s+/u', $cleanText, -1, PREG_SPLIT_NO_EMPTY);
        
        // Filtri: Heqja e Stop Words dhe fjalëve shumë të shkurtra (nën 3 shkronja)
        $filteredWords = array_filter($words, function ($word) {
            return !in_array($word, $this->stopWordsShqip) && mb_strlen($word, 'UTF-8') > 2;
        });

        // Llogaritja e frekuencës së fjalëve të mbetura
        $wordCounts = array_count_values($filteredWords);
        
        // Renditja nga fjalët më të përsëritura tek ato më pak të përsëritura
        arsort($wordCounts);
        
        // Kthimi i vetëm numrit të kërkuar të fjalëve kyçe (default top 5)
        return array_slice(array_keys($wordCounts), 0, $limit);
    }

    /**
     * Parsing shtesë: Ndarja në fjali (Sentence Segmentation)
     */
    public function parseSentences(string $rawText): array
    {
        // Ndarja e tekstit sa herë që ka pikë, pikëçuditje ose pikëpyetje
        return preg_split('/(?<=[.!?])\s+/', trim($rawText), -1, PREG_SPLIT_NO_EMPTY);
    }
}