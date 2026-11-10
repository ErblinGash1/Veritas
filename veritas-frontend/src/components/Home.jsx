import { useState } from 'react';

export default function Dashboard({ onAnalyze, isLoading, error }) {
  const [mode, setMode] = useState('text'); // 'text' | 'url'
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const content = mode === 'text' ? text.trim() : url.trim();
    if (!content) return;
    onAnalyze({ type: mode, content });
  };

  const canSubmit = mode === 'text' ? text.trim().length > 0 : url.trim().length > 0;

  return (
    <div className="min-h-[calc(100vh-88px)] flex flex-col justify-center px-4 sm:px-6 md:px-12 py-10">
      <div className="max-w-3xl mx-auto w-full text-center">

        {/* Trust metadata row */}
        <div
          className="flex flex-wrap justify-center gap-3 sm:gap-6 mb-6 text-xs sm:text-sm text-white/50 animate-blur-fade-up"
          style={{ animationDelay: '150ms' }}
        >
          <span>Bazuar në Analizë NLP</span>
          <span className="text-white/20">•</span>
          <span>Verifikim në Kohë Reale</span>
          <span className="text-white/20">•</span>
          <span>Metodologji e Hapur</span>
        </div>

        {/* Title */}
        <h1
          className="font-serif text-4xl sm:text-5xl md:text-6xl font-semibold text-white tracking-tight mb-5 animate-blur-fade-up"
          style={{ animationDelay: '300ms', letterSpacing: '-0.02em' }}
        >
          Dallo të Vërtetën<br className="hidden sm:block" /> nga Zhurma.
        </h1>

        {/* Description */}
        <p
          className="text-base sm:text-lg text-white/50 max-w-xl mx-auto mb-10 animate-blur-fade-up"
          style={{ animationDelay: '450ms' }}
        >
          Ngjit një artikull ose lidhje dhe Veritas AI skanon tonin, strukturën dhe
          gjuhën për shenja të manipulimit — në sekonda.
        </p>

        {/* Glass analysis card */}
        <div
          className="text-left bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-7 animate-blur-fade-up"
          style={{ animationDelay: '600ms' }}
        >
          {/* Mode toggle */}
          <div className="inline-flex bg-black/30 rounded-full p-1 mb-4 border border-white/5">
            <button
              type="button"
              onClick={() => setMode('text')}
              className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition ${
                mode === 'text' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
              }`}
            >
              Tekst
            </button>
            <button
              type="button"
              onClick={() => setMode('url')}
              className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition ${
                mode === 'url' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
              }`}
            >
              URL
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {mode === 'text' ? (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows="5"
                className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 text-white placeholder-white/30 text-sm focus:outline-none focus:border-teal-400/50 transition resize-none"
                placeholder="Ngjit këtu tekstin e lajmit që dëshiron të analizosh..."
              />
            ) : (
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 text-white placeholder-white/30 text-sm focus:outline-none focus:border-teal-400/50 transition"
                placeholder="https://example.com/artikulli-i-lajmit"
              />
            )}

            <button
              type="submit"
              disabled={isLoading || !canSubmit}
              className="glass-border mt-4 w-full bg-white text-black hover:bg-white/90 font-bold py-3.5 rounded-2xl transition text-sm uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Skanimi po kryhet...' : 'Skano me Veritas AI'}
            </button>
          </form>

          {error && (
            <div className="mt-4 px-4 py-3 rounded-xl bg-red-400/10 border border-red-400/20 text-red-300 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}