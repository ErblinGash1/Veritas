import { useEffect, useState } from 'react';
import { API_URL, formatDate, resolveRiskLevel, RISK_META } from '../config';
import './History.css';

const PAGE_SIZE = 10;

const csvCell = (value) => {
  let text = String(value ?? '');
  // Prevent spreadsheet applications from interpreting user content as formulas.
  if (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

const scoreOf = (item) => {
  const score = Number(item.risk_score ?? item.confidence_score ?? 0);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
};

function HistoryIcon({ name, size = 18 }) {
  const paths = {
    search: <><circle cx="10.8" cy="10.8" r="6.4" /><path d="m16 16 4.2 4.2" /></>,
    export: <><path d="M12 3v12m-4-4 4 4 4-4" /><path d="M4 17v3h16v-3" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5M12 7v5l3 2" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    chevronLeft: <path d="m15 18-6-6 6-6" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
    refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M5.9 9A7 7 0 0 1 18 7l2 5M4 12l2 5a7 7 0 0 0 12-2" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
    alert: <><path d="m12 3 9 17H3L12 3Z" /><path d="M12 9v5m0 3h.01" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export default function History({ onSelect, onNewAnalysis }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, current_page: 1, last_page: 1, per_page: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    // Dërgo vetëm filtrat me vlerë; Laravel refuzon search/status bosh (422).
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (status) params.set('status', status);
    params.set('page', String(page));
    setLoading(true);
    setError('');

    fetch(`${API_URL}/history?${params}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Gabim nga serveri: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const list = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
        setItems(list);
        setPagination({
          total: Number.isFinite(Number(data.total)) ? Number(data.total) : list.length,
          current_page: Number(data.current_page) || page,
          last_page: Math.max(1, Number(data.last_page) || 1),
          per_page: Number(data.per_page) || PAGE_SIZE,
        });
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError' || controller.signal.aborted) return;
        console.error('Gabim gjatë marrjes së historisë:', err);
        setError('Historia nuk u ngarkua. Kontrollo që Laravel është aktiv.');
        setItems([]);
        setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedSearch, status, page, reloadKey]);

  const changeSearch = (value) => {
    setSearch(value);
    setPage(1);
  };
  const changeStatus = (value) => {
    setStatus(value);
    setPage(1);
  };

  const handleExportCSV = () => {
    if (!items.length) return;
    const headers = ['ID', 'Përmbajtja', 'Niveli heuristik', 'Rrezik (%)', 'Data'];
    const rows = items.map((item) => {
      const level = resolveRiskLevel(
        item.risk_level,
        item.prediction === 'FAKE' || item.is_fake,
        scoreOf(item),
      );
      return [item.id, item.content, RISK_META[level]?.label ?? level, scoreOf(item), formatDate(item.created_at)]
        .map(csvCell)
        .join(',');
    });
    const csv = '\uFEFF' + [headers.map(csvCell).join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `veritas_historia_faqja_${pagination.current_page}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const visibleCount = items.length;
  const highCount = items.filter((item) =>
    resolveRiskLevel(item.risk_level, item.prediction === 'FAKE' || item.is_fake, scoreOf(item)) === 'HIGH'
  ).length;
  const avgScore = visibleCount
    ? (items.reduce((sum, item) => sum + scoreOf(item), 0) / visibleCount).toFixed(1)
    : '0.0';
  const highPercent = visibleCount ? Math.round((highCount / visibleCount) * 100) : 0;
  const start = pagination.total ? (pagination.current_page - 1) * pagination.per_page + 1 : 0;
  const end = pagination.total ? Math.min(start + visibleCount - 1, pagination.total) : 0;

  return (
    <main className="vh-page">
      <div className="vh-aurora" aria-hidden="true" />

      <header className="vh-header">
        <div className="vh-eyebrow"><HistoryIcon name="history" size={15} /> VERITAS / ANALYSIS ARCHIVE</div>
        <h1>Historia e <span>analizave.</span></h1>
        <p>Rishiko sinjalet e rrezikut, kërko në analizat e ruajtura dhe eksporto rezultatet.</p>
      </header>

      <section className="vh-stats" aria-label="Statistikat e historisë">
        <div className="vh-stat">
          <span className="vh-stat-label">Gjithsej analiza</span>
          <strong>{loading ? '—' : pagination.total.toLocaleString()}</strong>
          <small>{search || status ? 'Sipas filtrave aktivë' : 'Nga historia e ruajtur'}</small>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Rrezik i lartë</span>
          <strong className="vh-stat-red">{loading ? '—' : `${highPercent}%`}</strong>
          <small>Vetëm në faqen aktuale</small>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Rreziku mesatar</span>
          <strong className="vh-stat-blue">{loading ? '—' : `${avgScore}%`}</strong>
          <small>Vetëm në faqen aktuale</small>
        </div>
      </section>

      <section className="vh-panel" aria-label="Lista e analizave">
        <div className="vh-panel-heading">
          <div>
            <span className="vh-kicker">ARCHIVE EXPLORER</span>
            <h2>Analizat e ruajtura</h2>
          </div>
          <button type="button" className="vh-refresh" onClick={() => setReloadKey((n) => n + 1)} disabled={loading}>
            <HistoryIcon name="refresh" size={16} /> Përditëso
          </button>
        </div>

        <div className="vh-toolbar">
          <label className="vh-search">
            <HistoryIcon name="search" size={18} />
            <input
              aria-label="Kërko në tekstin e analizave"
              type="search"
              maxLength={200}
              placeholder="Kërko me fjalë kyçe..."
              value={search}
              onChange={(event) => changeSearch(event.target.value)}
            />
          </label>
          <select aria-label="Filtro sipas nivelit" value={status} onChange={(event) => changeStatus(event.target.value)}>
            <option value="">Të gjitha nivelet</option>
            <option value="FAKE">Rrezik i lartë</option>
            <option value="REAL">Rrezik i ulët</option>
          </select>
          <button type="button" className="vh-export" onClick={handleExportCSV} disabled={loading || !!error || !items.length} title="Eksporto vetëm analizat e faqes aktuale">
            <HistoryIcon name="export" size={17} /> Eksporto CSV
          </button>
        </div>

        <div className="vh-export-note"><HistoryIcon name="info" size={15} /> CSV përfshin vetëm {visibleCount} analizat e faqes aktuale. Statistikat janë heuristike, jo verifikime faktesh.</div>

        <div className="vh-table-scroll">
          {loading ? (
            <div className="vh-message" role="status"><span className="vh-loader" /> Duke ngarkuar analizat...</div>
          ) : error ? (
            <div className="vh-message vh-error" role="alert"><HistoryIcon name="alert" /> {error} <button onClick={() => setReloadKey((n) => n + 1)}>Provo përsëri</button></div>
          ) : !items.length ? (
            <div className="vh-empty">
              <HistoryIcon name="history" size={30} />
              <strong>Nuk u gjet asnjë analizë</strong>
              <p>Ndrysho filtrat ose fillo një analizë të re.</p>
              {onNewAnalysis && <button type="button" onClick={onNewAnalysis}>Analizë e re <HistoryIcon name="arrow" size={16} /></button>}
            </div>
          ) : (
            <table className="vh-table">
              <thead><tr><th scope="col">Artikulli / fragmenti</th><th scope="col">Data</th><th scope="col">Indeksi</th><th scope="col">Niveli heuristik</th><th scope="col"><span className="vh-sr-only">Hap analizën</span></th></tr></thead>
              <tbody>
                {items.map((item) => {
                  const level = resolveRiskLevel(item.risk_level, item.prediction === 'FAKE' || item.is_fake, scoreOf(item));
                  const meta = RISK_META[level];
                  const content = String(item.content ?? '');
                  return (
                    <tr key={item.id}>
                      <td className="vh-article"><span title={content}>{content.slice(0, 85) || 'Pa përmbajtje'}{content.length > 85 ? '…' : ''}</span><small>Analiza #{item.id}</small></td>
                      <td className="vh-date">{formatDate(item.created_at)}</td>
                      <td className="vh-score">{scoreOf(item)}%</td>
                      <td><span className={`vh-risk vh-risk-${String(level).toLowerCase()}`}>{meta?.label ?? level}</span></td>
                      <td className="vh-open"><button type="button" aria-label={`Hap analizën ${item.id}`} onClick={() => onSelect?.(item)}><HistoryIcon name="arrow" size={17} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="vh-pagination">
          <span>{loading ? 'Duke përditësuar…' : `Duke shfaqur ${start}–${end} nga ${pagination.total}`}</span>
          <div className="vh-page-actions">
            <button type="button" disabled={loading || pagination.current_page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Faqja e mëparshme"><HistoryIcon name="chevronLeft" size={17} /></button>
            <span>Faqja {pagination.current_page} / {pagination.last_page}</span>
            <button type="button" disabled={loading || pagination.current_page >= pagination.last_page} onClick={() => setPage((p) => Math.min(pagination.last_page, p + 1))} aria-label="Faqja tjetër"><HistoryIcon name="chevronRight" size={17} /></button>
          </div>
        </div>
      </section>
    </main>
  );
}
