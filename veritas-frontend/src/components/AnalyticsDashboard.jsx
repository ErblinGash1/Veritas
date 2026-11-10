import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts';
import { API_URL } from '../config';
import './AnalyticsDashboard.css';

const DAY_MS = 86_400_000;
const MAX_DAYS = 60;
const formatDay = (day) => (typeof day === 'string' ? day.slice(5).split('-').reverse().join('.') : day);
const formatDayFull = (day) => (typeof day === 'string' ? day.split('-').reverse().join('.') : day);

function fillMissingDays(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const valid = rows.filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row?.date || ''));
  const times = valid.map((row) => Date.parse(`${row.date}T00:00:00Z`)).filter(Number.isFinite);
  if (!times.length) return [];
  const byDate = new Map(valid.map((row) => [row.date, row]));
  const end = Math.max(...times);
  const start = Math.max(Math.min(...times), end - (MAX_DAYS - 1) * DAY_MS);
  const result = [];
  for (let time = start; time <= end; time += DAY_MS) {
    const date = new Date(time).toISOString().slice(0, 10);
    const row = byDate.get(date);
    result.push({
      date,
      total: Number(row?.total) || 0,
      fake: Number(row?.fake) || 0,
      real_news: Number(row?.real_news) || 0,
    });
  }
  return result;
}

function Icon({ name, size = 18 }) {
  const shared = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.7,
    strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
  };
  const icons = {
    chart: <><path d="M3 3v18h18" /><path d="m7 15 4-5 4 3 5-7" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.5 9A7 7 0 0 1 18 6l2 1M4 17l2 1a7 7 0 0 0 12.5-3" /></>,
    activity: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
    alert: <><path d="M12 3 2.7 20h18.6L12 3Z" /><path d="M12 9v5m0 3h.01" /></>,
    shield: <><path d="m12 2 8 4v5c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V6l8-4Z" /><path d="m9 12 2 2 4-4" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
    sparkles: <><path d="m12 2 2.1 7.9L22 12l-7.9 2.1L12 22l-2.1-7.9L2 12l7.9-2.1L12 2Z" /></>,
  };
  return <svg {...shared}>{icons[name]}</svg>;
}

function MetricCard({ icon, label, value, detail, tone = 'blue' }) {
  return (
    <div className={`va-metric va-metric--${tone}`}>
      <div className="va-metric-top">
        <span className="va-metric-label">{label}</span>
        <span className="va-metric-icon"><Icon name={icon} size={17} /></span>
      </div>
      <strong className="va-metric-value">{value}</strong>
      <span className="va-metric-detail">{detail}</span>
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: '#111e31', border: '1px solid #34506e',
  borderRadius: 12, fontSize: 12, color: '#eaf4ff',
  boxShadow: '0 16px 42px rgba(0,0,0,.35)',
};

export default function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [rawChartData, setRawChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchAnalytics = useCallback(async (signal, initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/analytics`, {
        headers: { Accept: 'application/json' }, signal,
      });
      if (!response.ok) throw new Error(`Gabim nga serveri: ${response.status}`);
      const data = await response.json();
      if (data.status !== 'success') throw new Error(data.message || 'Ngarkimi dështoi.');
      if (signal?.aborted) return;
      setMetrics(data.metrics || {});
      setRawChartData(Array.isArray(data.chart_data) ? data.chart_data : []);
    } catch (err) {
      if (err.name === 'AbortError' || signal?.aborted) return;
      console.error('Gabim gjatë marrjes së analytics:', err);
      setError('Nuk u ngarkuan të dhënat. Kontrollo Laravel (porti 8001) dhe databazën.');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchAnalytics(controller.signal, true);
    return () => controller.abort();
  }, [fetchAnalytics]);

  const chartData = useMemo(() => fillMissingDays(rawChartData), [rawChartData]);
  const total = Number(metrics?.total_analyses) || 0;
  const highCount = Number(metrics?.fake_count) || 0;
  const lowCount = Number(metrics?.real_count) || 0;
  const highPct = total ? ((highCount / total) * 100).toFixed(1) : '0.0';
  const lowPct = total ? ((lowCount / total) * 100).toFixed(1) : '0.0';
  // Existing API field name is avg_confidence; the current backend uses it for
  // the stored heuristic index, not calibrated ML confidence.
  const avgRisk = (Number(metrics?.avg_confidence) || 0).toFixed(1);

  return (
    <main className="va-analytics">
      <div className="va-aurora" aria-hidden="true" />
      <header className="va-header">
        <div>
          <div className="va-eyebrow"><Icon name="sparkles" size={14} /> VERITAS INTELLIGENCE <span className="va-separator">/</span> ANALYTICS</div>
          <h1>Analitika <span>&amp; njohuri.</span></h1>
          <p>Pasqyrë e aktivitetit dhe e sinjaleve heuristike të rrezikut në analizat e ruajtura.</p>
        </div>
        <button type="button" className="va-refresh" disabled={loading || refreshing}
          onClick={() => fetchAnalytics(undefined, false)}>
          <Icon name="refresh" size={16} />
          {refreshing ? 'Duke përditësuar...' : 'Përditëso të dhënat'}
        </button>
      </header>

      {error && (
        <div className="va-error" role="alert">
          <Icon name="alert" size={19} />
          <span>{error}</span>
          <button type="button" onClick={() => fetchAnalytics(undefined, !metrics)}>Provo përsëri</button>
        </div>
      )}

      {loading ? (
        <section className="va-loading" role="status">
          <span className="va-spinner" />
          <p>Duke ngarkuar analitikën...</p>
        </section>
      ) : (
        <>
          <div className="va-metrics">
            <MetricCard icon="chart" label="Gjithsej analiza" value={total.toLocaleString('sq-AL')} detail="Analiza të ruajtura në sistem" />
            <MetricCard icon="alert" label="Sinjal i lartë heuristik" value={highCount.toLocaleString('sq-AL')} detail={`${highPct}% e analizave`} tone="red" />
            <MetricCard icon="shield" label="Sinjal i ulët heuristik" value={lowCount.toLocaleString('sq-AL')} detail={`${lowPct}% e analizave`} tone="teal" />
            <MetricCard icon="activity" label="Indeksi mesatar" value={`${avgRisk}%`} detail="Nga vlerat heuristike të ruajtura" tone="ice" />
          </div>

          {total === 0 ? (
            <section className="va-empty">
              <Icon name="chart" size={28} />
              <h2>Ende nuk ka analiza të ruajtura</h2>
              <p>Grafikët do të shfaqen pasi të analizosh përmbajtje në skaner.</p>
            </section>
          ) : chartData.length === 0 ? (
            <section className="va-empty">
              <Icon name="chart" size={28} />
              <h2>Nuk ka të dhëna ditore për grafikët</h2>
              <p>Statistikat e përgjithshme janë ngarkuar, por API nuk ktheu seri ditore.</p>
            </section>
          ) : (
            <div className="va-charts">
              <section className="va-chart-card" aria-label="Grafiku i analizave ditore">
                <div className="va-chart-heading">
                  <span className="va-chart-icon"><Icon name="activity" size={18} /></span>
                  <div><h2>Aktiviteti i analizave</h2><p>Numri i analizave të regjistruara sipas ditës, deri në 60 ditë.</p></div>
                </div>
                <div className="va-chart-content">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 4, left: -22, bottom: 2 }}>
                      <defs>
                        <linearGradient id="vaDailyFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#89caff" stopOpacity={0.36} />
                          <stop offset="100%" stopColor="#89caff" stopOpacity={0.015} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="#26374e" strokeDasharray="3 5" />
                      <XAxis dataKey="date" tickFormatter={formatDay} tick={{ fill: '#91a9c6', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={20} />
                      <YAxis allowDecimals={false} tick={{ fill: '#91a9c6', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#cee5ff' }} labelFormatter={formatDayFull} />
                      <Area type="monotone" name="Analiza" dataKey="total" stroke="#9bd7ff" strokeWidth={2.5} fill="url(#vaDailyFill)" activeDot={{ r: 5, fill: '#d6eeff' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="va-chart-card" aria-label="Shpërndarja ditore e kategorive heuristike">
                <div className="va-chart-heading">
                  <span className="va-chart-icon"><Icon name="shield" size={18} /></span>
                  <div><h2>Shpërndarja e sinjaleve</h2><p>Kategoritë heuristike të ruajtura, jo gjykime për vërtetësinë.</p></div>
                </div>
                <div className="va-chart-content">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 4, left: -22, bottom: 5 }}>
                      <CartesianGrid vertical={false} stroke="#26374e" strokeDasharray="3 5" />
                      <XAxis dataKey="date" tickFormatter={formatDay} tick={{ fill: '#91a9c6', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={20} />
                      <YAxis allowDecimals={false} tick={{ fill: '#91a9c6', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#cee5ff' }} labelFormatter={formatDayFull} />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#a9bed7' }} />
                      <Bar dataKey="fake" name="Sinjal i lartë" fill="#f18c9c" radius={[5, 5, 0, 0]} maxBarSize={32} />
                      <Bar dataKey="real_news" name="Sinjal i ulët" fill="#61d1bb" radius={[5, 5, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
          )}

          <div className="va-method-note">
            <Icon name="info" size={18} />
            <p>Këto statistika bazohen në analizat heuristike të ruajtura në Laravel. Modeli ML në shqip dhe anglisht nuk përfshihet në këto numërime. Mungesa e sinjaleve nuk vërteton që një lajm është i saktë.</p>
          </div>
        </>
      )}
    </main>
  );
}
