
import { lazy, Suspense, useState } from 'react';

import './index.css';
import './App.css';
import './veritas-theme.css';

import Navbar from './components/Navbar';
import { API_URL } from './config';

// Lazy loading për optimizimin e performancës
const Dashboard = lazy(() => import('./components/Dashboard'));
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard'));
const ResultPage = lazy(() => import('./components/ResultPage'));
const History = lazy(() => import('./components/History'));

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handlePageChange = (newPage) => {
    setError('');
    setPage(newPage);
  };

  const handleAnalyze = async (inputData) => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          content: inputData.content,
          type: inputData.type || 'text',
          language: inputData.language || 'sq',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 429) {
          throw new Error(
            'Shumë kërkesa. Prit një minutë dhe provo përsëri.'
          );
        }

        throw new Error(
          errorData.message ||
          `Gabim nga serveri: ${response.status}`
        );
      }

      const data = await response.json();

      if (data.status !== 'success') {
        throw new Error(
          data.message || 'Përpunimi i tekstit dështoi.'
        );
      }

      const analysis = data.nlp_analysis;

      setResult({
        id: Date.now(),
        date: new Date().toISOString(),

        score:
          analysis.risk_score ??
          analysis.sensationalism_score ??
          analysis.confidence_score ??
          0,

        riskLevel: analysis.risk_level,
        isFake: analysis.is_fake,
        prediction: analysis.prediction,

        type: inputData.type || 'text',
        textSample: inputData.content,

        totalWords:
          analysis.total_words ??
          analysis.word_count,

        sentencesCount: analysis.sentences_count,

        aiSummary: analysis.ai_summary || '',
        explanationReasons:
          analysis.explanation_reasons || [],
        suggestions: analysis.suggestions || [],
        domainInfo: analysis.domain_info || null,

        // Rezultatet eksperimentale ML
        language: inputData.language || 'sq',
        mlSqAnalysis: data.ml_sq_analysis ?? null,
        mlEnAnalysis: data.ml_en_analysis ?? null,
      });

      setPage('result');
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
        'Nuk u arrit lidhja me serverin. Sigurohu që Laravel (porti 8001) është aktiv.'
      );
    } finally {
      setLoading(false);
    }
  };

  const openHistoryEntry = (entry) => {
    setResult({
      id: entry.id,
      date: entry.created_at,

      score:
        entry.risk_score ??
        entry.confidence_score ??
        0,

      riskLevel: entry.risk_level,
      isFake:
        entry.prediction === 'FAKE' ||
        entry.is_fake,

      prediction: entry.prediction,
      type: 'text',
      textSample: entry.content || '',

      totalWords: entry.total_words,
      sentencesCount: entry.sentences_count,

      aiSummary: '',
      explanationReasons: [],

      suggestions: [
        'Ri-skano tekstin për të parë sinjalet e detajuara.',
      ],

      domainInfo: null,

      // History nuk ruan klasifikimin ML
      language: null,
      mlSqAnalysis: null,
      mlEnAnalysis: null,
    });

    setPage('result');
  };

  return (
    <div className="app-shell min-h-screen bg-zinc-950 text-white">

      {/* Sfondi vizual i Veritas */}
      <div className="scan-bg" aria-hidden="true">
        <div className="scan-line" />
      </div>

      <div className="relative z-10">

        {/* Navbar qëndron gjithmonë i dukshëm */}
        <Navbar
          setPage={handlePageChange}
          currentPage={page}
        />

        {/* Lazy loading vetëm për faqet */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-[50vh] text-sky-200 text-sm">
              Duke ngarkuar Veritas...
            </div>
          }
        >
          {page === 'dashboard' && (
            <Dashboard
              onAnalyze={handleAnalyze}
              isLoading={loading}
              error={error}
            />
          )}

          {page === 'analytics' && (
            <AnalyticsDashboard />
          )}

          {page === 'result' && (
            <ResultPage
              result={result}
              onBack={() =>
                handlePageChange('dashboard')
              }
            />
          )}

          {page === 'history' && (
            <History
              onSelect={openHistoryEntry}
              onNewAnalysis={() =>
                handlePageChange('dashboard')
              }
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}
