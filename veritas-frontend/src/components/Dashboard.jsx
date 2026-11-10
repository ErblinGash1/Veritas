
import { useState } from 'react';
import './Dashboard.css';

function Icon({ name, size = 18 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  const paths = {
    text: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
        <path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    sparkles: (
      <>
        <path d="m12 3 1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3Z" />
        <path d="m19 18 .6 1.4L21 20l-1.4.6L19 22l-.6-1.4L17 20l1.4-.6L19 18Z" />
      </>
    ),
    shield: (
      <>
        <path d="M12 2 20 6v5c0 5-3.2 8.5-8 11-4.8-2.5-8-6-8-11V6l8-4Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18" />
      </>
    ),
    alert: (
      <>
        <path d="M12 3 2.5 20h19L12 3Z" />
        <path d="M12 9v5m0 3h.01" />
      </>
    ),
  };

  return <svg {...common}>{paths[name]}</svg>;
}

export default function Dashboard({ onAnalyze, isLoading, error }) {
  const [content, setContent] = useState('');
  const [mode, setMode] = useState('text');
  const [language, setLanguage] = useState('sq');

  const handleSubmit = (event) => {
    event.preventDefault();

    if (isLoading || !content.trim()) return;

    onAnalyze({
      content: content.trim(),
      type: mode,
      language,
    });
  };

  const changeMode = (nextMode) => {
    if (isLoading || nextMode === mode) return;

    setMode(nextMode);
    setContent('');
  };

  const isReady = content.trim().length > 0;

  return (
    <main className="vt-dashboard">
      <div className="vt-ambient" aria-hidden="true" />

      <section className="vt-hero">
        <div className="vt-eyebrow">
          <Icon name="sparkles" size={15} />
          <span>VERITAS INTELLIGENCE</span>
          <span className="vt-eyebrow-dot" />
          <span>AI-ASSISTED ANALYSIS</span>
        </div>

        <h1 className="vt-hero-title">
          Më shumë qartësi.
          <span>Më pak pasiguri.</span>
        </h1>

        <p className="vt-hero-description">
          Analizo artikuj dhe lidhje të lajmeve, identifiko sinjale
          të mundshme të dezinformimit dhe kupto arsyet
          pas vlerësimit të rrezikut.
        </p>
      </section>

      <section className="vt-workspace" aria-labelledby="vt-form-heading">
        <div className="vt-workspace-topline" aria-hidden="true" />

        <div className="vt-workspace-header">
          <div className="vt-workspace-heading">
            <div className="vt-workspace-icon">
              <Icon name="shield" size={22} />
            </div>

            <div>
              <p className="vt-overline">WORKSPACE</p>
              <h2 id="vt-form-heading">Analizë e re</h2>
            </div>
          </div>

          <div className="vt-workspace-tag">
            <span className="vt-tag-sparkle">✦</span>
            Intelligent analysis
          </div>
        </div>

        <div className="vt-workspace-content">
          <div className="vt-field-section">
            <div className="vt-field-heading">
              <div>
                <span className="vt-section-number">01</span>
                <h3>Zgjidh mënyrën e analizës</h3>
              </div>
              <p>Çfarë dëshiron të analizosh?</p>
            </div>

            <div className="vt-mode-grid" role="group" aria-label="Mënyra e analizës">
              <button
                type="button"
                disabled={isLoading}
                className={`vt-mode-option ${mode === 'text' ? 'is-selected' : ''}`}
                aria-pressed={mode === 'text'}
                onClick={() => changeMode('text')}
              >
                <span className="vt-mode-icon">
                  <Icon name="text" size={20} />
                </span>

                <span className="vt-mode-copy">
                  <strong>Analizo tekst</strong>
                  <small>Ngjit një artikull ose lajm</small>
                </span>

                <span className="vt-radio-mark" aria-hidden="true" />
              </button>

              <button
                type="button"
                disabled={isLoading}
                className={`vt-mode-option ${mode === 'url' ? 'is-selected' : ''}`}
                aria-pressed={mode === 'url'}
                onClick={() => changeMode('url')}
              >
                <span className="vt-mode-icon">
                  <Icon name="link" size={20} />
                </span>

                <span className="vt-mode-copy">
                  <strong>Analizo URL</strong>
                  <small>Vendos lidhjen e një artikulli</small>
                </span>

                <span className="vt-radio-mark" aria-hidden="true" />
              </button>
            </div>
          </div>

          {mode === 'text' && (
            <div className="vt-field-section vt-language-section">
              <div className="vt-field-heading">
                <div>
                  <span className="vt-section-number">02</span>
                  <h3>Gjuha e përmbajtjes</h3>
                </div>
                <p>Zgjidh gjuhën për modelin ML</p>
              </div>

              <div className="vt-language-control" role="group" aria-label="Gjuha e përmbajtjes">
                <button
                  type="button"
                  disabled={isLoading}
                  aria-pressed={language === 'sq'}
                  onClick={() => setLanguage('sq')}
                  className={language === 'sq' ? 'is-selected' : ''}
                >
                  Shqip
                </button>

                <button
                  type="button"
                  disabled={isLoading}
                  aria-pressed={language === 'en'}
                  onClick={() => setLanguage('en')}
                  className={language === 'en' ? 'is-selected' : ''}
                >
                  English
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="vt-analysis-form">
            <div className="vt-input-heading">
              <div>
                <span className="vt-section-number">
                  {mode === 'text' ? '03' : '02'}
                </span>
                <label htmlFor="vt-analysis-content">
                  {mode === 'text' ? 'Përmbajtja e artikullit' : 'Lidhja e artikullit'}
                </label>
              </div>

              {mode === 'text' && (
                <span className="vt-character-count">
                  {content.length.toLocaleString()} karaktere
                </span>
              )}
            </div>

            <div className="vt-input-container">
              {mode === 'text' ? (
                <textarea
                  id="vt-analysis-content"
                  rows={8}
                  maxLength={20000}
                  value={content}
                  disabled={isLoading}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder={
                    language === 'en'
                      ? 'Paste the full news article here to begin your analysis...'
                      : 'Ngjit këtu tekstin e lajmit ose artikullit që dëshiron të analizosh...'
                  }
                  required
                />
              ) : (
                <div className="vt-url-input-wrap">
                  <Icon name="globe" size={20} />
                  <input
                    id="vt-analysis-content"
                    type="url"
                    value={content}
                    disabled={isLoading}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="https://example.com/news/article"
                    required
                  />
                </div>
              )}
            </div>

            <p className="vt-input-help">
              {mode === 'text'
                ? 'Për analiza më të dobishme, përdor tekstin e plotë të artikullit.'
                : 'Për lidhjet URL përdoret analiza heuristike, pa klasifikim ML.'}
            </p>

            {error && (
              <div className="vt-error" role="alert">
                <Icon name="alert" size={18} />
                <span>{error}</span>
              </div>
            )}

            <div className="vt-form-footer">
              <div className="vt-disclaimer">
                <Icon name="shield" size={17} />
                <p>
                  Rezultatet tregojnë sinjale rreziku.
                  Modelet ML janë eksperimentale dhe nuk
                  zëvendësojnë verifikimin e fakteve.
                </p>
              </div>

              <button
                type="submit"
                className="vt-submit-button"
                disabled={isLoading || !isReady}
              >
                {isLoading ? (
                  <>
                    <span className="vt-spinner" aria-hidden="true" />
                    <span>Po analizohet...</span>
                  </>
                ) : (
                  <>
                    <span>Fillo analizën</span>
                    <Icon name="arrow" size={19} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </section>

      <div className="vt-bottom-caption">
        <span className="vt-caption-line" />
        <span>Built for clarity. Designed for critical thinking.</span>
        <span className="vt-caption-line" />
      </div>
    </main>
  );
}
