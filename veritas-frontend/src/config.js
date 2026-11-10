// Zhvillim: Vite proxy /api -> http://127.0.0.1:8001
// Prodhim: cakto VITE_API_URL me adresën publike të Laravel API.
export const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

// 2026-10-12 / ISO string -> 12.10.2026 (nuk varet nga locale-i i shfletuesit)
export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// Niveli i rrezikut: përdor risk_level nga backend-i, ose e nxjerr nga pikët (për analizat e vjetra).
export function resolveRiskLevel(riskLevel, isFake, score) {
  if (riskLevel) return riskLevel;
  if (isFake) return 'HIGH';
  return Number(score) >= 20 ? 'UNCERTAIN' : 'LOW';
}

export const RISK_META = {
  HIGH: {
    label: 'Rrezik i lartë',
    text: 'text-red-400',
    badge: 'bg-red-500/10 border-red-500/30 text-red-400',
    stroke: '#F87171',
  },
  UNCERTAIN: {
    label: 'I pasigurt',
    text: 'text-amber-300',
    badge: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    stroke: '#FCD34D',
  },
  LOW: {
    label: 'Pa sinjale të dyshimta',
    text: 'text-emerald-400',
    badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    stroke: '#2DD4BF',
  },
};
