import { useState } from 'react';
import { RISK_META, resolveRiskLevel, formatDate } from '../config';
import './ResultPage.css';

const stripQuotes = (value) => String(value ?? '').trim().replace(/^[“"„']+|[”"']+$/g, '');
const clamp = (value) => Math.max(0, Math.min(100, Number(value) || 0));
const percent = (value) => Number.isFinite(Number(value)) && value != null
  ? `${Number(value).toFixed(2)}%` : '—';

function Symbol({ name, size = 18 }) {
  const base = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  const shapes = {
    back: <path d="m14 6-6 6 6 6M9 12h12" />,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
    export: <><path d="M12 3v12m-5-5 5 5 5-5" /><path d="M5 17v3h14v-3" /></>,
    shield: <><path d="M12 2 20 6v5c0 5-3.2 8.5-8 11-4.8-2.5-8-6-8-11V6l8-4Z" /><path d="m9 12 2 2 4-4" /></>,
    brain: <><path d="M12 5a4 4 0 0 0-7 2 4 4 0 0 0-1 7 4 4 0 0 0 7 5V5ZM12 5a4 4 0 0 1 7 2 4 4 0 0 1 1 7 4 4 0 0 1-7 5V5Z" /><path d="M8 10c2 0 3 1 3 3m5-3c-2 0-3 1-3 3" /></>,
    signal: <><path d="M4 20v-5m5 5V9m5 11V4m5 16v-8" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18" /></>,
    file: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    light: <><path d="M9 18h6m-5 3h4M9 14a6 6 0 1 1 6 0l-1 2h-4l-1-2Z" /></>,
  };
  return <svg {...base}>{shapes[name]}</svg>;
}

export default function ResultPage({ result, onBack }) {
  const [copied, setCopied] = useState(false);

  const {
    score = 0, isFake = false, riskLevel, textSample = '', totalWords,
    sentencesCount, date, aiSummary = '', explanationReasons = [],
    suggestions = [], domainInfo = null, mlSqAnalysis = null,
    mlEnAnalysis = null, language = 'sq',
  } = result || {};

  const level = resolveRiskLevel(riskLevel, isFake, score);
  const meta = RISK_META[level] || {};
  const summary = stripQuotes(aiSummary);
  const dateStr = date ? formatDate(date) : formatDate(new Date());
  const mlAnalysis = language === 'en' ? mlEnAnalysis : mlSqAnalysis;
  const mlLanguageName = language === 'en' ? 'Anglisht' : 'Shqip';
  const ringScore = clamp(score);
  const mlVerdict = mlAnalysis?.prediction;
  const mlTone = mlVerdict === 'FAKE' ? 'fake' : mlVerdict === 'REAL' ? 'real' : 'uncertain';
  const riskTone = ringScore >= 60 ? 'high' : ringScore >= 25 ? 'medium' : 'low';

  const buildReportText = () => [
    'RAPORT VERITAS',
    `Data: ${dateStr}`,
    `Vlerësimi heuristik i rrezikut: ${meta.label || 'I panjohur'} (${ringScore}%)`,
    'Ky rezultat nuk përcakton nëse lajmi është i vërtetë apo i rremë.',
    totalWords != null ? `Gjithsej fjalë: ${totalWords}` : null,
    sentencesCount != null ? `Gjithsej fjali: ${sentencesCount}` : null,
    domainInfo?.domain ? `Domeni: ${domainInfo.domain}` : null,
    mlAnalysis ? `--- MACHINE LEARNING (${mlLanguageName.toUpperCase()}, EKSPERIMENTAL) ---` : null,
    mlAnalysis ? `Klasifikimi statistikor: ${mlVerdict}` : null,
    mlAnalysis?.probability_real != null ? `Probabiliteti REAL: ${mlAnalysis.probability_real}%` : null,
    mlAnalysis?.probability_fake != null ? `Probabiliteti FAKE: ${mlAnalysis.probability_fake}%` : null,
    mlAnalysis ? 'Probabilitetet ML nuk janë verifikim faktik.' : null,
    explanationReasons.length ? `Sinjalet e gjetura:\n- ${explanationReasons.join('\n- ')}` : null,
    suggestions.length ? `Rekomandime:\n- ${suggestions.join('\n- ')}` : null,
    summary ? `Përmbledhje e tekstit:\n${summary}` : null,
    '', 'Përmbajtja e analizuar:', textSample, '',
    'Metodologjia: rregulla heuristike dhe, kur është e disponueshme, analizë ML eksperimentale.',
    'Asnjëra nuk verifikon në mënyrë të pavarur faktet ose burimet.',
  ].filter((entry) => entry !== null).join('\n');

  const handleExport = () => {
    const blob = new Blob(['\uFEFF', buildReportText()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const element = document.createElement('a');
    element.href = url;
    element.download = `veritas-raport-${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    element.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildReportText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (!result) {
    return (
      <main className="vr-empty">
        <h1>Nuk ka rezultat për t’u shfaqur.</h1>
        <button type="button" className="vr-button vr-button-primary" onClick={onBack}>Kthehu te skaneri</button>
      </main>
    );
  }

  return (
    <main className="vr-page">
      <div className="vr-ambient" aria-hidden="true" />
      <div className="vr-topbar">
        <button className="vr-button vr-button-ghost" type="button" onClick={onBack}>
          <Symbol name="back" size={16} /> Analizë e re
        </button>
        <div className="vr-actions">
          <button className="vr-button vr-button-ghost" type="button" onClick={handleCopy}>
            <Symbol name="copy" size={16} /> {copied ? 'U kopjua ✓' : 'Kopjo raportin'}
          </button>
          <button className="vr-button vr-button-primary" type="button" onClick={handleExport}>
            <Symbol name="export" size={16} /> Eksporto raportin
          </button>
        </div>
      </div>

      <div className="vr-titlearea">
        <div className="vr-eyebrow"><Symbol name="signal" size={15} /> VERITAS · ANALYSIS REPORT</div>
        <h1>Raporti i analizës<span>.</span></h1>
        <p>Vlerësim i sinjaleve të rrezikut dhe klasifikim eksperimental, kur është i disponueshëm.</p>
        <div className="vr-date">Gjeneruar më {dateStr}</div>
      </div>

      <section className="vr-panel vr-primary-panel" aria-labelledby="vr-risk-title">
        <div className="vr-section-heading">
          <div className="vr-heading-icon"><Symbol name="shield" size={21} /></div>
          <div><p className="vr-kicker">01 / HEURISTIC ASSESSMENT</p><h2 id="vr-risk-title">Vlerësimi i rrezikut</h2></div>
          <span className="vr-method-tag">Analizë heuristike</span>
        </div>
        <div className="vr-primary-content">
          <div className="vr-risk-card">
            <div className={`vr-gauge vr-gauge-${riskTone}`} style={{ '--vr-ring-color': meta.stroke || '#83cfff' }}>
              <svg viewBox="0 0 120 120" role="img" aria-label={`Indeksi i rrezikut ${ringScore}%`}>
                <circle className="vr-gauge-track" cx="60" cy="60" r="49" />
                <circle className="vr-gauge-value" cx="60" cy="60" r="49" strokeDasharray={2 * Math.PI * 49} strokeDashoffset={(2 * Math.PI * 49) * (1 - ringScore / 100)} />
              </svg>
              <div className="vr-gauge-center"><strong>{ringScore}%</strong><small>INDEKSI I RREZIKUT</small></div>
            </div>
            <div className={`vr-risk-badge vr-risk-${riskTone}`}>{meta.label || 'I papërcaktuar'}</div>
            <p>Nuk është probabilitet i vërtetësisë.</p>
          </div>
          <div className="vr-risk-detail">
            <h3>Çfarë tregon ky rezultat?</h3>
            <p>Indeksi reflekton sinjale stilistike dhe strukturore që sistemi ka identifikuar. Një rezultat i ulët nuk provon se informacioni është i saktë.</p>
            {(totalWords != null || sentencesCount != null) && (
              <div className="vr-metrics">
                {totalWords != null && <div className="vr-metric"><span>Numri i fjalëve</span><strong>{totalWords}</strong></div>}
                {sentencesCount != null && <div className="vr-metric"><span>Numri i fjalive</span><strong>{sentencesCount}</strong></div>}
              </div>
            )}
            <div className="vr-explanation">
              <div className="vr-subhead"><Symbol name="signal" size={17} /><h4>Sinjalet e identifikuara</h4></div>
              {explanationReasons.length ? (
                <ul className="vr-points">{explanationReasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>
              ) : (
                <p>Nuk ka shpjegime të detajuara të ruajtura për këtë analizë.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {mlAnalysis && (
        <section className="vr-panel" aria-labelledby="vr-ml-title">
          <div className="vr-section-heading">
            <div className="vr-heading-icon"><Symbol name="brain" size={21} /></div>
            <div><p className="vr-kicker">02 / EXPERIMENTAL MODEL</p><h2 id="vr-ml-title">Machine Learning — {mlLanguageName}</h2></div>
            <span className={`vr-ml-badge vr-ml-${mlTone}`}>{mlVerdict === 'UNCERTAIN' ? 'I PASIGURT' : mlVerdict || 'I PANJOHUR'}</span>
          </div>
          <p className="vr-section-intro">Ky është klasifikim statistikor, i pavarur nga indeksi heuristik. Etiketat REAL dhe FAKE përfaqësojnë kategori të modelit, jo fakte të verifikuara.</p>
          <div className="vr-prob-grid">
            {[
              { key: 'real', label: 'Kategoria REAL', value: mlAnalysis.probability_real },
              { key: 'fake', label: 'Kategoria FAKE', value: mlAnalysis.probability_fake },
            ].map(({ key, label, value }) => (
              <div className="vr-prob-card" key={key}>
                <div className="vr-prob-top"><span>{label}</span><strong>{percent(value)}</strong></div>
                <div className="vr-bar-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamp(value)}>
                  <div className={`vr-bar-fill vr-bar-${key}`} style={{ width: `${clamp(value)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="vr-inline-note"><Symbol name="info" size={18} /><span>{mlAnalysis.disclaimer || 'Klasifikimi ML nuk verifikon vërtetësinë e lajmit.'} Këto rezultate nuk ruhen si etiketa faktike në History ose Analytics.</span></div>
        </section>
      )}

      <div className="vr-detail-grid">
        {domainInfo?.domain && (
          <section className="vr-panel vr-detail-panel">
            <div className="vr-subhead"><Symbol name="globe" size={19} /><h2>Analiza e domenit</h2></div>
            <div className="vr-domain-name">{domainInfo.domain}</div>
            <p className={domainInfo.is_suspicious_domain ? 'vr-domain-warning' : 'vr-domain-neutral'}>
              {domainInfo.is_suspicious_domain
                ? (domainInfo.warning || 'U identifikuan tregues të mundshëm të domenit të dyshimtë.')
                : 'Nuk u identifikuan sinjale të dukshme imitimi të domenit. Kjo nuk garanton besueshmërinë e burimit.'}
            </p>
          </section>
        )}
        {summary && (
          <section className="vr-panel vr-detail-panel">
            <div className="vr-subhead"><Symbol name="file" size={19} /><h2>Fillimi i tekstit</h2></div>
            <p className="vr-summary">“{summary}”</p>
          </section>
        )}
        {suggestions.length > 0 && (
          <section className="vr-panel vr-detail-panel">
            <div className="vr-subhead"><Symbol name="light" size={19} /><h2>Si ta verifikosh vetë</h2></div>
            <ul className="vr-points">{suggestions.map((suggestion, index) => <li key={index}>{suggestion}</li>)}</ul>
          </section>
        )}
        <section className="vr-panel vr-detail-panel">
          <div className="vr-subhead"><Symbol name="file" size={19} /><h2>Fragmenti i analizuar</h2></div>
          <p className="vr-sample">{stripQuotes(textSample).slice(0, 300)}{textSample.length > 300 ? '…' : ''}</p>
        </section>
      </div>

      <footer className="vr-footer"><Symbol name="info" size={19} /><p><strong>Shënim metodologjik.</strong> Veritas vlerëson sinjale të tekstit dhe domenit; modelet e tij ML janë eksperimentale. Mungesa e sinjaleve ose një etiketë REAL nuk dëshmon se lajmi është i vërtetë. Verifiko pretendimet me burime të pavarura.</p></footer>
    </main>
  );
}
