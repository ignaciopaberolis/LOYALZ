import React, { useState, useMemo, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Upload,
  Download,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  Rocket,
  Users,
  CreditCard,
  Zap,
  Search,
  Filter,
  ChevronRight,
  Activity,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  X,
  FileSpreadsheet,
  History,
  Trash2,
  Eye,
} from "lucide-react";

/* ============================================================
   LOYALZ WEEKLY TRACKER
   App interna de seguimiento semanal de cuentas
   
   ESTRUCTURA:
   - Ingesta CSV/XLSX con mapeo flexible de columnas
   - Histórico por snapshots semanales (import/export JSON)
   - Cálculo de KPIs, health score y segmentación
   - Dashboard multi-vista + Radiografía semanal
============================================================ */

// -------------------- CONFIG DE COLUMNAS (mapeo flexible) --------------------
const COLUMN_ALIASES = {
  id: ["id", "account id", "accountid", "user id", "userid"],
  company: ["company name", "company", "empresa", "business", "account name"],
  email: ["email", "mail", "correo", "e-mail"],
  contact: ["contact full name", "contact", "contact name", "full name", "nombre"],
  tariff: ["tariff", "plan", "tarifa"],
  tariffStatus: ["tariffstatus", "tariff status", "status", "estado"],
  tariffPeriod: ["tariffperiod", "tariff period", "period", "periodo", "billing period"],
  activationDate: ["tariffactivationdate", "activation date", "activation", "activated at"],
  cards: ["cards count", "cards", "tarjetas", "card count", "cardscount"],
  integrations: ["integrations count", "integrations", "integraciones", "integrationscount"],
};

const normalizeHeader = (h) => String(h || "").trim().toLowerCase().replace(/[_\-\s]+/g, " ");

const mapRow = (row) => {
  const normalized = {};
  for (const key of Object.keys(row)) {
    normalized[normalizeHeader(key)] = row[key];
  }
  const pick = (aliases) => {
    for (const a of aliases) {
      const k = normalizeHeader(a);
      if (normalized[k] !== undefined && normalized[k] !== null && normalized[k] !== "") {
        return normalized[k];
      }
    }
    return null;
  };
  const toNum = (v) => {
    if (v === null || v === undefined || v === "") return 0;
    const n = Number(String(v).replace(/[^0-9.-]/g, ""));
    return isNaN(n) ? 0 : n;
  };
  return {
    id: String(pick(COLUMN_ALIASES.id) || "").trim(),
    company: String(pick(COLUMN_ALIASES.company) || "").trim(),
    email: String(pick(COLUMN_ALIASES.email) || "").trim(),
    contact: String(pick(COLUMN_ALIASES.contact) || "").trim(),
    tariff: String(pick(COLUMN_ALIASES.tariff) || "").trim(),
    tariffStatus: String(pick(COLUMN_ALIASES.tariffStatus) || "").trim().toLowerCase(),
    tariffPeriod: String(pick(COLUMN_ALIASES.tariffPeriod) || "").trim(),
    activationDate: String(pick(COLUMN_ALIASES.activationDate) || "").trim(),
    cards: toNum(pick(COLUMN_ALIASES.cards)),
    integrations: toNum(pick(COLUMN_ALIASES.integrations)),
  };
};

// -------------------- MOCK DATA (2 semanas de ejemplo) --------------------
const MOCK_WEEK_1 = [
  { id: "1", company: "Acme Corp", email: "ana@acme.com", contact: "Ana García", tariff: "Pro", tariffStatus: "paid", tariffPeriod: "Monthly", activationDate: "2025-09-10", cards: 45, integrations: 3 },
  { id: "2", company: "Beta Solutions", email: "luis@beta.com", contact: "Luis Pérez", tariff: "Starter", tariffStatus: "trial", tariffPeriod: "Monthly", activationDate: "2026-03-20", cards: 8, integrations: 0 },
  { id: "3", company: "Cactus Labs", email: "mar@cactus.io", contact: "María López", tariff: "Pro", tariffStatus: "paid", tariffPeriod: "Yearly", activationDate: "2025-04-01", cards: 120, integrations: 5 },
  { id: "4", company: "Delta Retail", email: "joa@delta.shop", contact: "Joaquín Ruiz", tariff: "Business", tariffStatus: "paid", tariffPeriod: "Monthly", activationDate: "2024-11-15", cards: 210, integrations: 8 },
  { id: "5", company: "Echo Studios", email: "sof@echo.co", contact: "Sofía Díaz", tariff: "Starter", tariffStatus: "unpaid", tariffPeriod: "Monthly", activationDate: "2026-01-08", cards: 3, integrations: 0 },
  { id: "6", company: "Flow Logistics", email: "dia@flow.com", contact: "Diego Martín", tariff: "Pro", tariffStatus: "trial", tariffPeriod: "Monthly", activationDate: "2026-04-01", cards: 22, integrations: 2 },
  { id: "7", company: "Gamma Health", email: "car@gamma.care", contact: "Carla Suárez", tariff: "Business", tariffStatus: "paid", tariffPeriod: "Yearly", activationDate: "2024-06-20", cards: 340, integrations: 12 },
  { id: "8", company: "Helios Energy", email: "pab@helios.en", contact: "Pablo Herrera", tariff: "Pro", tariffStatus: "paid", tariffPeriod: "Monthly", activationDate: "2025-08-05", cards: 67, integrations: 4 },
  { id: "9", company: "Iris Beauty", email: "val@iris.co", contact: "Valentina Romero", tariff: "Starter", tariffStatus: "paid", tariffPeriod: "Monthly", activationDate: "2025-12-01", cards: 18, integrations: 1 },
  { id: "10", company: "Jade Travel", email: "nic@jade.tr", contact: "Nicolás Gómez", tariff: "Pro", tariffStatus: "trial", tariffPeriod: "Monthly", activationDate: "2026-03-25", cards: 15, integrations: 1 },
  { id: "11", company: "Kappa Foods", email: "lau@kappa.eat", contact: "Laura Benítez", tariff: "Business", tariffStatus: "paid", tariffPeriod: "Monthly", activationDate: "2025-02-14", cards: 180, integrations: 6 },
  { id: "12", company: "Luna Fitness", email: "mat@luna.fit", contact: "Matías Silva", tariff: "Starter", tariffStatus: "trial", tariffPeriod: "Monthly", activationDate: "2026-04-05", cards: 5, integrations: 0 },
];

const MOCK_WEEK_2 = [
  { id: "1", company: "Acme Corp", email: "ana@acme.com", contact: "Ana García", tariff: "Pro", tariffStatus: "paid", tariffPeriod: "Monthly", activationDate: "2025-09-10", cards: 52, integrations: 4 },
  { id: "2", company: "Beta Solutions", email: "luis@beta.com", contact: "Luis Pérez", tariff: "Pro", tariffStatus: "paid", tariffPeriod: "Monthly", activationDate: "2025-03-20", cards: 14, integrations: 1 }, // convirtió
  { id: "3", company: "Cactus Labs", email: "mar@cactus.io", contact: "María López", tariff: "Pro", tariffStatus: "paid", tariffPeriod: "Yearly", activationDate: "2025-04-01", cards: 135, integrations: 5 },
  { id: "4", company: "Delta Retail", email: "joa@delta.shop", contact: "Joaquín Ruiz", tariff: "Business", tariffStatus: "paid", tariffPeriod: "Monthly", activationDate: "2024-11-15", cards: 245, integrations: 10 }, // upsell
  { id: "5", company: "Echo Studios", email: "sof@echo.co", contact: "Sofía Díaz", tariff: "Starter", tariffStatus: "unpaid", tariffPeriod: "Monthly", activationDate: "2026-01-08", cards: 2, integrations: 0 },
  { id: "6", company: "Flow Logistics", email: "dia@flow.com", contact: "Diego Martín", tariff: "Pro", tariffStatus: "trial", tariffPeriod: "Monthly", activationDate: "2026-04-01", cards: 31, integrations: 3 },
  { id: "7", company: "Gamma Health", email: "car@gamma.care", contact: "Carla Suárez", tariff: "Business", tariffStatus: "paid", tariffPeriod: "Yearly", activationDate: "2024-06-20", cards: 320, integrations: 12 }, // leve caída
  { id: "8", company: "Helios Energy", email: "pab@helios.en", contact: "Pablo Herrera", tariff: "Pro", tariffStatus: "paid", tariffPeriod: "Monthly", activationDate: "2025-08-05", cards: 42, integrations: 4 }, // caída fuerte
  { id: "9", company: "Iris Beauty", email: "val@iris.co", contact: "Valentina Romero", tariff: "Starter", tariffStatus: "paid", tariffPeriod: "Monthly", activationDate: "2025-12-01", cards: 24, integrations: 2 },
  // 10 - Jade Travel: dejó de aparecer (churn)
  { id: "11", company: "Kappa Foods", email: "lau@kappa.eat", contact: "Laura Benítez", tariff: "Business", tariffStatus: "paid", tariffPeriod: "Monthly", activationDate: "2025-02-14", cards: 195, integrations: 7 },
  { id: "12", company: "Luna Fitness", email: "mat@luna.fit", contact: "Matías Silva", tariff: "Starter", tariffStatus: "trial", tariffPeriod: "Monthly", activationDate: "2026-04-05", cards: 5, integrations: 0 }, // estancado
  { id: "13", company: "Mono Digital", email: "fed@mono.co", contact: "Federico Núñez", tariff: "Pro", tariffStatus: "trial", tariffPeriod: "Monthly", activationDate: "2026-04-10", cards: 28, integrations: 2 }, // nueva
  { id: "14", company: "Nova Print", email: "rox@nova.pr", contact: "Roxana Vega", tariff: "Starter", tariffStatus: "paid", tariffPeriod: "Monthly", activationDate: "2026-04-08", cards: 12, integrations: 1 }, // nueva
];

const MOCK_SNAPSHOTS = [
  { weekLabel: "2026-W14", weekDate: "2026-04-06", rows: MOCK_WEEK_1 },
  { weekLabel: "2026-W15", weekDate: "2026-04-13", rows: MOCK_WEEK_2 },
];

// -------------------- HELPERS --------------------
const isoWeek = (dateStr) => {
  const d = new Date(dateStr);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
};

const fmt = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return new Intl.NumberFormat("es-AR").format(Math.round(n));
};

const fmtPct = (n) => {
  if (n === null || n === undefined || isNaN(n) || !isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
};

const statusOf = (s) => {
  const v = (s || "").toLowerCase();
  if (v.includes("paid") || v === "active" || v === "pago") return "paid";
  if (v.includes("trial")) return "trial";
  if (v.includes("unpaid") || v.includes("expired") || v.includes("cancel")) return "unpaid";
  return v || "unknown";
};

// -------------------- HEALTH SCORE --------------------
/*
  Lógica del Health Score (0-100):
  - Status:             35 pts   (paid=35, trial=18, unpaid=0)
  - Uso actual (cards): 25 pts   (escalonado por rango)
  - Integrations:       15 pts   (0=0, 1=6, 2=10, 3+=15)
  - Variación de uso:   15 pts   (crecimiento=15, estable=10, caída leve=5, caída fuerte=0)
  - Crecimiento integr: 10 pts   (sumó=10, igual=6, perdió=0)
  Total: 100. Bucket: 80+ saludable, 60+ estable, 40+ atención, <40 riesgo.
*/
const computeHealthScore = (curr, prev) => {
  let score = 0;
  const reasons = [];

  // Status
  if (curr.tariffStatus === "paid") { score += 35; reasons.push({ k: "Plan pago", v: "+35" }); }
  else if (curr.tariffStatus === "trial") { score += 18; reasons.push({ k: "En trial", v: "+18" }); }
  else { reasons.push({ k: "Sin plan pago", v: "+0" }); }

  // Cards
  const c = curr.cards;
  let cardsPts = 0;
  if (c >= 100) cardsPts = 25;
  else if (c >= 50) cardsPts = 20;
  else if (c >= 20) cardsPts = 14;
  else if (c >= 5) cardsPts = 8;
  else cardsPts = 2;
  score += cardsPts;
  reasons.push({ k: `${c} cards`, v: `+${cardsPts}` });

  // Integrations
  const i = curr.integrations;
  let iPts = i >= 3 ? 15 : i === 2 ? 10 : i === 1 ? 6 : 0;
  score += iPts;
  reasons.push({ k: `${i} integrations`, v: `+${iPts}` });

  // Variación
  if (prev) {
    const dCards = curr.cards - prev.cards;
    const pct = prev.cards > 0 ? (dCards / prev.cards) * 100 : dCards > 0 ? 100 : 0;
    let varPts = 0;
    if (pct >= 10) varPts = 15;
    else if (pct >= -5) varPts = 10;
    else if (pct >= -20) varPts = 5;
    else varPts = 0;
    score += varPts;
    reasons.push({ k: `Uso ${fmtPct(pct)} vs semana pasada`, v: `+${varPts}` });

    const dI = curr.integrations - prev.integrations;
    const iVarPts = dI > 0 ? 10 : dI === 0 ? 6 : 0;
    score += iVarPts;
    reasons.push({ k: dI > 0 ? "Sumó integrations" : dI < 0 ? "Perdió integrations" : "Integrations estable", v: `+${iVarPts}` });
  } else {
    score += 10; reasons.push({ k: "Sin historial previo", v: "+10" });
    score += 6;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  let bucket;
  if (score >= 80) bucket = "saludable";
  else if (score >= 60) bucket = "estable";
  else if (score >= 40) bucket = "atención";
  else bucket = "riesgo";

  return { score, bucket, reasons };
};

// -------------------- COMPARACIÓN & ENRIQUECIMIENTO --------------------
const enrich = (snapshots) => {
  if (!snapshots.length) return { current: [], previous: [], diff: null };
  const sorted = [...snapshots].sort((a, b) => a.weekDate.localeCompare(b.weekDate));
  const current = sorted[sorted.length - 1];
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;

  const prevMap = new Map((previous?.rows || []).map((r) => [r.id, r]));
  const currMap = new Map(current.rows.map((r) => [r.id, r]));

  const enriched = current.rows.map((r) => {
    const prev = prevMap.get(r.id) || null;
    const health = computeHealthScore(r, prev);
    const dCards = prev ? r.cards - prev.cards : 0;
    const pctCards = prev && prev.cards > 0 ? (dCards / prev.cards) * 100 : dCards > 0 ? 100 : 0;
    const dInteg = prev ? r.integrations - prev.integrations : 0;
    const isNew = !prev;
    const converted = prev && prev.tariffStatus !== "paid" && r.tariffStatus === "paid";
    const churnedToUnpaid = prev && prev.tariffStatus === "paid" && r.tariffStatus === "unpaid";
    const planChanged = prev && prev.tariff !== r.tariff;

    // Segmento
    let segment = "neutral";
    if (isNew && r.cards >= 10) segment = "Nueva prometedora";
    else if (isNew) segment = "Nueva";
    else if (converted) segment = "Conversión reciente";
    else if (churnedToUnpaid) segment = "Churn (paid → unpaid)";
    else if (r.tariffStatus === "trial" && r.cards >= 15 && dCards > 0) segment = "Trial por convertir";
    else if (r.tariffStatus === "trial" && dCards <= 0) segment = "Trial estancado";
    else if (r.tariffStatus === "unpaid" && r.cards > 0) segment = "Unpaid con actividad";
    else if (r.tariffStatus === "paid" && health.score >= 80 && pctCards >= 10) segment = "Upsell potencial";
    else if (r.tariffStatus === "paid" && health.score >= 80) segment = "Paga saludable";
    else if (r.tariffStatus === "paid" && health.score < 50) segment = "Paga en riesgo";
    else if (r.tariffStatus === "paid" && r.cards < 10) segment = "Paga poco uso";
    else if (r.cards === 0) segment = "Inactiva";

    return {
      ...r,
      _prev: prev,
      _isNew: isNew,
      _converted: converted,
      _churnedToUnpaid: churnedToUnpaid,
      _planChanged: planChanged,
      _dCards: dCards,
      _pctCards: pctCards,
      _dInteg: dInteg,
      _health: health,
      _segment: segment,
    };
  });

  // Churn: aparecían antes y ya no
  const churned = previous
    ? previous.rows.filter((r) => !currMap.has(r.id)).map((r) => ({ ...r, _churned: true }))
    : [];

  return { current: enriched, previous: previous?.rows || [], churned, currentSnapshot: current, previousSnapshot: previous };
};

// -------------------- KPIs --------------------
const computeKPIs = (data) => {
  const { current, previous, churned } = data;
  const total = current.length;
  const paid = current.filter((r) => r.tariffStatus === "paid").length;
  const trial = current.filter((r) => r.tariffStatus === "trial").length;
  const unpaid = current.filter((r) => r.tariffStatus === "unpaid").length;
  const newAccounts = current.filter((r) => r._isNew).length;
  const conversions = current.filter((r) => r._converted).length;
  const churnToUnpaid = current.filter((r) => r._churnedToUnpaid).length;

  const prevTotal = previous.length;
  const prevPaid = previous.filter((r) => r.tariffStatus === "paid").length;
  const prevTrial = previous.filter((r) => r.tariffStatus === "trial").length;
  const prevUnpaid = previous.filter((r) => r.tariffStatus === "unpaid").length;

  const totalCards = current.reduce((s, r) => s + r.cards, 0);
  const avgCards = total > 0 ? totalCards / total : 0;
  const sortedCards = [...current].map((r) => r.cards).sort((a, b) => a - b);
  const medianCards = sortedCards.length ? sortedCards[Math.floor(sortedCards.length / 2)] : 0;

  const totalIntegrations = current.reduce((s, r) => s + r.integrations, 0);
  const avgIntegrations = total > 0 ? totalIntegrations / total : 0;

  const prevTotalCards = previous.reduce((s, r) => s + r.cards, 0);

  return {
    total, paid, trial, unpaid, newAccounts, conversions,
    churn: churned.length,       // desapariciones (casi siempre 0 en reportes acumulativos)
    churnToUnpaid,                 // churn real: paid → unpaid
    totalCards, avgCards, medianCards,
    totalIntegrations, avgIntegrations,
    deltaTotal: total - prevTotal,
    deltaPaid: paid - prevPaid,
    deltaTrial: trial - prevTrial,
    deltaUnpaid: unpaid - prevUnpaid,
    deltaCards: totalCards - prevTotalCards,
  };
};

// -------------------- RADIOGRAFÍA SEMANAL (insights) --------------------
const buildNarrative = (data, kpis) => {
  const { current, currentSnapshot, previousSnapshot } = data;
  const lines = [];

  if (!previousSnapshot) {
    lines.push("Esta es la primera semana cargada. Los próximos cortes van a permitir detectar variaciones, riesgos y oportunidades con comparativa.");
    return { summary: lines, risks: [], opportunities: [], focus: [] };
  }

  // Resumen
  lines.push(`Semana ${currentSnapshot.weekLabel}: ${fmt(kpis.total)} cuentas totales (${kpis.deltaTotal >= 0 ? "+" : ""}${kpis.deltaTotal} vs semana pasada).`);
  lines.push(`Distribución: ${fmt(kpis.paid)} paid · ${fmt(kpis.trial)} trial · ${fmt(kpis.unpaid)} unpaid.`);
  if (kpis.newAccounts) lines.push(`Entraron ${kpis.newAccounts} cuentas nuevas.`);
  if (kpis.conversions) lines.push(`Se convirtieron ${kpis.conversions} cuentas a plan pago.`);
  if (kpis.churnToUnpaid) lines.push(`⚠ ${kpis.churnToUnpaid} cuenta${kpis.churnToUnpaid !== 1 ? "s" : ""} pasaron de paid a unpaid (churn real).`);
  if (kpis.deltaCards) lines.push(`El uso total (cards) se movió ${kpis.deltaCards >= 0 ? "+" : ""}${fmt(kpis.deltaCards)}.`);

  // Riesgos
  const risks = [];
  const churnsReal = current.filter((r) => r._churnedToUnpaid).sort((a, b) => b.cards - a.cards).slice(0, 5);
  churnsReal.forEach((r) => risks.push(`${r.company} pasó a unpaid con ${fmt(r.cards)} cards — prioridad 1 de recuperación`));

  const pagasRiesgo = current.filter((r) => r.tariffStatus === "paid" && r._health.score < 50)
    .sort((a, b) => a._health.score - b._health.score).slice(0, 5);
  pagasRiesgo.forEach((r) => risks.push(`${r.company} (paga, health ${r._health.score}, ${fmtPct(r._pctCards)} uso)`));

  // Oportunidades — solo trials ordenados por cards (como indicador de conversión)
  const opportunities = [];
  const trialsHot = current.filter((r) => r.tariffStatus === "trial" && r.cards >= 10)
    .sort((a, b) => b.cards - a.cards).slice(0, 5);
  trialsHot.forEach((r) => opportunities.push(`${r.company} (trial, ${fmt(r.cards)} cards) — mayor probabilidad de conversión`));

  const upsells = current.filter((r) => r.tariffStatus === "paid" && r._pctCards >= 10 && r.cards >= 50)
    .sort((a, b) => b._pctCards - a._pctCards).slice(0, 5);
  upsells.forEach((r) => opportunities.push(`${r.company} (${fmtPct(r._pctCards)} crecimiento, ${fmt(r.cards)} cards) — upsell`));

  // Foco
  const focus = [];
  if (churnsReal.length) focus.push(`Recuperación: contactar urgente a las ${churnsReal.length} cuentas que pasaron a unpaid esta semana.`);
  if (pagasRiesgo.length) focus.push(`Retención: revisar las ${pagasRiesgo.length} pagas con health bajo antes del cierre de semana.`);
  if (trialsHot.length) focus.push(`Conversión: CS + Comercial deben atacar los ${trialsHot.length} trials con mayor uso de cards.`);
  if (upsells.length) focus.push(`Upsell: revisar los ${upsells.length} clientes con crecimiento sostenido para ofrecer plan mayor.`);

  return { summary: lines, risks, opportunities, focus };
};

// -------------------- UI PRIMITIVES --------------------
const StatusBadge = ({ status }) => {
  const map = {
    paid: { bg: "bg-emerald-500/15", text: "text-emerald-300", ring: "ring-emerald-500/30", label: "Paid" },
    trial: { bg: "bg-amber-500/15", text: "text-amber-300", ring: "ring-amber-500/30", label: "Trial" },
    unpaid: { bg: "bg-rose-500/15", text: "text-rose-300", ring: "ring-rose-500/30", label: "Unpaid" },
    unknown: { bg: "bg-zinc-500/15", text: "text-zinc-300", ring: "ring-zinc-500/30", label: "—" },
  };
  const s = map[status] || map.unknown;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase ring-1 ${s.bg} ${s.text} ${s.ring}`}>
      {s.label}
    </span>
  );
};

const HealthPill = ({ score, bucket }) => {
  const map = {
    saludable: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    estable: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
    "atención": "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    riesgo: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${map[bucket]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {score}
    </span>
  );
};

const Delta = ({ value, suffix = "", inverted = false }) => {
  if (value === 0 || value === null || value === undefined) return <span className="text-zinc-500 text-xs inline-flex items-center gap-1"><Minus size={12}/> 0{suffix}</span>;
  const positive = inverted ? value < 0 : value > 0;
  return (
    <span className={`text-xs inline-flex items-center gap-1 font-medium ${positive ? "text-emerald-400" : "text-rose-400"}`}>
      {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {value > 0 ? "+" : ""}{value}{suffix}
    </span>
  );
};

const KpiCard = ({ label, value, delta, deltaSuffix = "", icon: Icon, accent = "amber", inverted = false }) => {
  const iconColorMap = {
    amber: "text-amber-400/70",
    emerald: "text-emerald-400/70",
    rose: "text-rose-400/70",
    sky: "text-sky-400/70",
  };
  return (
    <div className="group relative bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">{label}</span>
        {Icon && <Icon size={15} className={iconColorMap[accent] || iconColorMap.amber} />}
      </div>
      <div className="mt-3 flex items-baseline gap-3">
        <span className="text-3xl font-serif text-zinc-50 tabular-nums">{value}</span>
        {delta !== undefined && <Delta value={delta} suffix={deltaSuffix} inverted={inverted} />}
      </div>
    </div>
  );
};

const SectionTitle = ({ children, sub }) => (
  <div className="mb-5">
    <h2 className="text-xl font-serif text-zinc-100">{children}</h2>
    {sub && <p className="text-sm text-zinc-500 mt-1">{sub}</p>}
  </div>
);

// -------------------- MAIN APP --------------------
export default function LoyalzTracker() {
  const [snapshots, setSnapshots] = useState(MOCK_SNAPSHOTS);
  const [view, setView] = useState("resumen");
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailAccount, setDetailAccount] = useState(null);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);
  const jsonInputRef = useRef(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const data = useMemo(() => enrich(snapshots), [snapshots]);
  const kpis = useMemo(() => computeKPIs(data), [data]);
  const narrative = useMemo(() => buildNarrative(data, kpis), [data, kpis]);

  // -------------------- INGESTA --------------------
  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      let rows = [];
      const ext = f.name.split(".").pop().toLowerCase();
      if (ext === "csv" || ext === "tsv") {
        const text = await f.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        rows = parsed.data;
      } else if (ext === "xlsx" || ext === "xls") {
        const buf = await f.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      } else {
        setToast({ type: "error", msg: "Formato no soportado. Usá CSV o XLSX." });
        return;
      }

      const mapped = rows.map(mapRow).filter((r) => r.id && r.company);
      if (!mapped.length) {
        setToast({ type: "error", msg: "No se detectaron filas válidas. Revisá los nombres de columnas." });
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const weekLabel = isoWeek(today);
      const existing = snapshots.find((s) => s.weekLabel === weekLabel);
      const newSnap = { weekLabel, weekDate: today, rows: mapped };

      if (existing) {
        if (!confirm(`Ya existe un snapshot para ${weekLabel}. ¿Reemplazarlo?`)) return;
        setSnapshots(snapshots.map((s) => (s.weekLabel === weekLabel ? newSnap : s)));
      } else {
        setSnapshots([...snapshots, newSnap]);
      }
      setToast({ type: "success", msg: `Cargado: ${mapped.length} cuentas (${weekLabel})` });
    } catch (err) {
      setToast({ type: "error", msg: `Error: ${err.message}` });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(snapshots, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loyalz-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast({ type: "success", msg: "Histórico exportado" });
  };

  const importJSON = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("Formato inválido");
      setSnapshots(parsed);
      setToast({ type: "success", msg: `Histórico importado (${parsed.length} semanas)` });
    } catch (err) {
      setToast({ type: "error", msg: `Error: ${err.message}` });
    } finally {
      if (jsonInputRef.current) jsonInputRef.current.value = "";
    }
  };

  const resetToMock = () => {
    if (!confirm("¿Restablecer con los datos de ejemplo? Se perderán los snapshots cargados.")) return;
    setSnapshots(MOCK_SNAPSHOTS);
    setToast({ type: "success", msg: "Restablecido a datos de ejemplo" });
  };

  const deleteSnapshot = (weekLabel) => {
    if (!confirm(`¿Eliminar snapshot ${weekLabel}?`)) return;
    setSnapshots(snapshots.filter((s) => s.weekLabel !== weekLabel));
  };

  // -------------------- FILTROS VISTA CUENTAS --------------------
  const filteredAccounts = useMemo(() => {
    return data.current.filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        if (![r.company, r.email, r.id, r.tariff].some((f) => String(f).toLowerCase().includes(q))) return false;
      }
      if (segmentFilter !== "all" && r._segment !== segmentFilter) return false;
      if (statusFilter !== "all" && r.tariffStatus !== statusFilter) return false;
      return true;
    });
  }, [data.current, search, segmentFilter, statusFilter]);

  const segments = useMemo(() => {
    const s = new Set(data.current.map((r) => r._segment));
    return ["all", ...Array.from(s)];
  }, [data.current]);

  // -------------------- TIMELINE HISTÓRICO --------------------
  const timeline = useMemo(() => {
    return [...snapshots].sort((a, b) => a.weekDate.localeCompare(b.weekDate)).map((s) => {
      const paid = s.rows.filter((r) => statusOf(r.tariffStatus) === "paid").length;
      const trial = s.rows.filter((r) => statusOf(r.tariffStatus) === "trial").length;
      const unpaid = s.rows.filter((r) => statusOf(r.tariffStatus) === "unpaid").length;
      const totalCards = s.rows.reduce((sum, r) => sum + Number(r.cards || 0), 0);
      return { week: s.weekLabel, paid, trial, unpaid, total: s.rows.length, cards: totalCards };
    });
  }, [snapshots]);

  // -------------------- ALERTAS / TOPS --------------------
  const topRisk = useMemo(() =>
    data.current.filter((r) => r.tariffStatus === "paid")
      .sort((a, b) => a._health.score - b._health.score).slice(0, 5),
    [data.current]);

  const topConvert = useMemo(() =>
    data.current.filter((r) => r.tariffStatus === "trial")
      .sort((a, b) => (b.cards + b._dCards) - (a.cards + a._dCards)).slice(0, 5),
    [data.current]);

  const topUpsell = useMemo(() =>
    data.current.filter((r) => r.tariffStatus === "paid" && r._pctCards >= 5)
      .sort((a, b) => b._pctCards - a._pctCards).slice(0, 5),
    [data.current]);

  const topActivate = useMemo(() =>
    data.current.filter((r) => r.tariffStatus === "unpaid")
      .sort((a, b) => b.cards - a.cards).slice(0, 5),
    [data.current]);

  const topGrowth = useMemo(() =>
    data.current.filter((r) => r._dCards > 0)
      .sort((a, b) => b._dCards - a._dCards).slice(0, 5),
    [data.current]);

  const topDrop = useMemo(() =>
    data.current.filter((r) => r._dCards < 0)
      .sort((a, b) => a._dCards - b._dCards).slice(0, 5),
    [data.current]);

  // -------------------- DISTRIBUCIONES --------------------
  const planDist = useMemo(() => {
    const m = {};
    data.current.forEach((r) => { m[r.tariff || "—"] = (m[r.tariff || "—"] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [data.current]);

  const periodDist = useMemo(() => {
    const m = {};
    data.current.forEach((r) => { m[r.tariffPeriod || "—"] = (m[r.tariffPeriod || "—"] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [data.current]);

  const PIE_COLORS = ["#f59e0b", "#eab308", "#84cc16", "#10b981", "#06b6d4", "#8b5cf6"];

  // -------------------- RENDER --------------------
  const views = [
    { k: "resumen", label: "Resumen", icon: Activity },
    { k: "riesgo", label: "Riesgo", icon: AlertTriangle },
    { k: "conversion", label: "Conversión", icon: Target },
    { k: "upsell", label: "Upsell", icon: Rocket },
    { k: "unpaid", label: "Unpaid", icon: CreditCard },
    { k: "historico", label: "Histórico", icon: History },
    { k: "cuentas", label: "Cuentas", icon: Users },
    { k: "radiografia", label: "Radiografía", icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased" style={{ fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');
        .font-serif { font-family: 'Fraunces', ui-serif, Georgia, serif; font-optical-sizing: auto; letter-spacing: -0.01em; }
        .font-sans { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
        body { background: #09090b; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #18181b; }
        ::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #52525b; }
      `}</style>

      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto px-8 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <span className="font-serif text-zinc-950 text-lg font-bold">L</span>
            </div>
            <div>
              <div className="font-serif text-lg text-zinc-50 leading-none">Loyalz <span className="text-amber-400">·</span> Weekly Tracker</div>
              <div className="text-[11px] text-zinc-500 mt-0.5 tracking-wide uppercase">Revenue & Customer Success · {data.currentSnapshot?.weekLabel || "sin data"}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.tsv" onChange={handleFile} className="hidden" />
            <input ref={jsonInputRef} type="file" accept=".json" onChange={importJSON} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-lg text-sm font-semibold transition-colors">
              <Upload size={15} /> Cargar semana
            </button>
            <button onClick={exportJSON} title="Exportar histórico" className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors">
              <Download size={16} />
            </button>
            <button onClick={() => jsonInputRef.current?.click()} title="Importar histórico" className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors">
              <FileSpreadsheet size={16} />
            </button>
            <button onClick={resetToMock} title="Restablecer ejemplo" className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors">
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="max-w-[1440px] mx-auto px-8 flex gap-1 overflow-x-auto">
          {views.map((v) => (
            <button
              key={v.k}
              onClick={() => setView(v.k)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                view === v.k
                  ? "border-amber-400 text-zinc-50"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <v.icon size={14} /> {v.label}
            </button>
          ))}
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-[1440px] mx-auto px-8 py-8">
        {view === "resumen" && (
          <>
            <div className="flex items-end justify-between mb-6">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-amber-400/80 mb-1">Resumen ejecutivo</div>
                <h1 className="text-4xl font-serif text-zinc-50">Estado de la cartera</h1>
                <p className="text-zinc-500 mt-2 text-sm">Foto de la semana comparada contra el corte anterior.</p>
              </div>
              <div className="text-right text-xs text-zinc-500">
                <div>Snapshot actual</div>
                <div className="font-serif text-zinc-200 text-lg">{data.currentSnapshot?.weekLabel}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <KpiCard label="Total cuentas" value={fmt(kpis.total)} delta={kpis.deltaTotal} icon={Users} accent="amber" />
              <KpiCard label="Pagas" value={fmt(kpis.paid)} delta={kpis.deltaPaid} icon={CreditCard} accent="emerald" />
              <KpiCard label="Trial" value={fmt(kpis.trial)} delta={kpis.deltaTrial} icon={Zap} accent="amber" />
              <KpiCard label="Unpaid" value={fmt(kpis.unpaid)} icon={AlertTriangle} accent="rose" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              <KpiCard label="Nuevas" value={fmt(kpis.newAccounts)} icon={Sparkles} accent="sky" />
              <KpiCard label="Conversiones" value={fmt(kpis.conversions)} icon={Target} accent="emerald" />
              <KpiCard label="Churn (paid → unpaid)" value={fmt(kpis.churnToUnpaid)} icon={TrendingDown} accent="rose" inverted />
              <KpiCard label="Δ Cards" value={fmt(kpis.deltaCards)} icon={TrendingUp} accent="amber" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
              <KpiCard label="Total cards" value={fmt(kpis.totalCards)} icon={CreditCard} />
              <KpiCard label="Promedio cards" value={fmt(kpis.avgCards)} />
              <KpiCard label="Mediana cards" value={fmt(kpis.medianCards)} />
            </div>

            {/* Distribuciones */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6">
                <SectionTitle sub="Cuentas por plan">Distribución por tarifa</SectionTitle>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={planDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                      {planDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6">
                <SectionTitle sub="Mensual / Anual">Distribución por período</SectionTitle>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={periodDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                      {periodDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 2) % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Alertas rápidas grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <AlertCard title="Top riesgo" icon={AlertTriangle} accent="rose" rows={topRisk} onClick={setDetailAccount}
                render={(r) => <><HealthPill score={r._health.score} bucket={r._health.bucket} /><span className="text-xs text-zinc-500">{fmtPct(r._pctCards)}</span></>} />
              <AlertCard title="Top convertir" icon={Target} accent="amber" rows={topConvert} onClick={setDetailAccount}
                render={(r) => <><span className="text-xs text-zinc-300 font-medium tabular-nums">{r.cards} cards</span><Delta value={r._dCards} /></>} />
              <AlertCard title="Top upsell" icon={Rocket} accent="emerald" rows={topUpsell} onClick={setDetailAccount}
                render={(r) => <><span className="text-xs text-zinc-300 font-medium tabular-nums">{r.cards}</span><span className="text-xs text-emerald-400">{fmtPct(r._pctCards)}</span></>} />
              <AlertCard title="Top crecimiento" icon={TrendingUp} accent="emerald" rows={topGrowth} onClick={setDetailAccount}
                render={(r) => <Delta value={r._dCards} />} />
              <AlertCard title="Top caída" icon={TrendingDown} accent="rose" rows={topDrop} onClick={setDetailAccount}
                render={(r) => <Delta value={r._dCards} />} />
              <AlertCard title="Top activar" icon={Zap} accent="amber" rows={topActivate} onClick={setDetailAccount}
                render={(r) => <span className="text-xs text-zinc-300 tabular-nums">{r.cards} cards</span>} />
            </div>
          </>
        )}

        {view === "riesgo" && (
          <>
            <SectionTitle sub="Cuentas pagas con health score bajo o caídas de uso significativas">Riesgo y retención</SectionTitle>
            <AccountTable
              rows={data.current.filter((r) => r.tariffStatus === "paid" && (r._health.score < 60 || r._pctCards < -10))
                .sort((a, b) => a._health.score - b._health.score)}
              onRowClick={setDetailAccount}
              emptyText="No hay cuentas pagas en riesgo. 🎉"
            />
          </>
        )}

        {view === "conversion" && (
          <>
            <SectionTitle sub="Solo trials — ordenados por cards (mayor uso = mayor probabilidad de conversión)">Oportunidades de conversión</SectionTitle>
            <AccountTable
              rows={data.current.filter((r) => r.tariffStatus === "trial").sort((a, b) => b.cards - a.cards)}
              onRowClick={setDetailAccount}
              emptyText="No hay trials en el corte."
            />
          </>
        )}

        {view === "upsell" && (
          <>
            <SectionTitle sub="Pagas con crecimiento sostenido y alto uso">Señales de upsell</SectionTitle>
            <AccountTable
              rows={data.current.filter((r) => r.tariffStatus === "paid" && (r._pctCards >= 5 || r.cards >= 100))
                .sort((a, b) => b._pctCards - a._pctCards)}
              onRowClick={setDetailAccount}
              emptyText="Sin señales fuertes de upsell esta semana."
            />
          </>
        )}

        {view === "unpaid" && (
          <>
            <SectionTitle sub="Base histórica de cuentas unpaid — seguimiento del funnel frío">Unpaid</SectionTitle>

            {/* BLOQUE CHURN: lo más importante de esta vista */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-rose-400" />
                <h3 className="text-sm font-semibold text-zinc-200">Churn de la semana (paid → unpaid)</h3>
                <span className="text-xs text-zinc-500">· movimiento crítico a recuperar</span>
              </div>
              {(() => {
                const churns = data.current.filter((r) => r._churnedToUnpaid).sort((a, b) => b.cards - a.cards);
                if (!churns.length) {
                  return (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 text-sm text-emerald-200">
                      No se registraron churns esta semana. 🎉
                    </div>
                  );
                }
                return (
                  <>
                    <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 mb-4 text-sm text-rose-200">
                      <span className="font-semibold">{churns.length}</span> cuenta{churns.length !== 1 ? "s" : ""} pasaron de <span className="text-emerald-300">paid</span> a <span className="text-rose-300">unpaid</span> esta semana.
                      Son prioridad 1 de contacto para recuperación.
                    </div>
                    <AccountTable rows={churns} onRowClick={setDetailAccount} emptyText="" />
                  </>
                );
              })()}
            </div>

            {/* BLOQUE UNPAID CON ACTIVIDAD (prospectos de activación) */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={16} className="text-amber-400" />
                <h3 className="text-sm font-semibold text-zinc-200">Unpaid con actividad</h3>
                <span className="text-xs text-zinc-500">· señal de valor sin pagar — candidatos a activar</span>
              </div>
              <AccountTable
                rows={data.current.filter((r) => r.tariffStatus === "unpaid" && r.cards > 0).sort((a, b) => b.cards - a.cards).slice(0, 50)}
                onRowClick={setDetailAccount}
                emptyText="Sin unpaids con actividad."
              />
              <div className="text-xs text-zinc-500 mt-2">Mostrando top 50 por uso.</div>
            </div>

            {/* BLOQUE BASE UNPAID TOTAL */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <History size={16} className="text-zinc-400" />
                <h3 className="text-sm font-semibold text-zinc-200">Base unpaid total</h3>
                <span className="text-xs text-zinc-500">· {data.current.filter((r) => r.tariffStatus === "unpaid").length.toLocaleString("es-AR")} cuentas</span>
              </div>
              <AccountTable
                rows={data.current.filter((r) => r.tariffStatus === "unpaid").sort((a, b) => b.cards - a.cards)}
                onRowClick={setDetailAccount}
                emptyText="Sin unpaids."
              />
            </div>
          </>
        )}

        {view === "historico" && (
          <>
            <SectionTitle sub="Evolución semana a semana">Histórico acumulado</SectionTitle>

            {timeline.length < 2 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-200 mb-6">
                Solo hay {timeline.length} semana{timeline.length === 1 ? "" : "s"} cargada{timeline.length === 1 ? "" : "s"}. Cargá más cortes para ver tendencia.
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6">
                <h3 className="text-sm font-medium text-zinc-300 mb-1">Pagas y trials por semana</h3>
                <p className="text-xs text-zinc-500 mb-4">Escala real — ordenes de magnitud similares.</p>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="week" stroke="#71717a" fontSize={11} />
                    <YAxis stroke="#71717a" fontSize={11} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="paid" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} name="Paid" />
                    <Line type="monotone" dataKey="trial" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4 }} name="Trial" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6">
                <h3 className="text-sm font-medium text-zinc-300 mb-1">Base unpaid por semana</h3>
                <p className="text-xs text-zinc-500 mb-4">Funnel frío — escala separada por volumen.</p>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="week" stroke="#71717a" fontSize={11} />
                    <YAxis stroke="#71717a" fontSize={11} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="unpaid" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 4 }} name="Unpaid" />
                    <Line type="monotone" dataKey="total" stroke="#a1a1aa" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Total" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 lg:col-span-2">
                <h3 className="text-sm font-medium text-zinc-300 mb-1">Cards totales por semana</h3>
                <p className="text-xs text-zinc-500 mb-4">Uso agregado de la plataforma.</p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="week" stroke="#71717a" fontSize={11} />
                    <YAxis stroke="#71717a" fontSize={11} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="cards" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-sm font-medium text-zinc-300">Snapshots guardados</h3>
                <span className="text-xs text-zinc-500">{snapshots.length} semana{snapshots.length !== 1 ? "s" : ""}</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-zinc-900/40 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-6 py-3">Semana</th>
                    <th className="px-6 py-3">Fecha</th>
                    <th className="px-6 py-3 text-right">Cuentas</th>
                    <th className="px-6 py-3 text-right">Paid</th>
                    <th className="px-6 py-3 text-right">Trial</th>
                    <th className="px-6 py-3 text-right">Cards</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((row, i) => {
                    const snap = snapshots.find((s) => s.weekLabel === row.week);
                    return (
                      <tr key={i} className="border-t border-zinc-800/60 hover:bg-zinc-900/40">
                        <td className="px-6 py-3 font-serif text-zinc-100">{row.week}</td>
                        <td className="px-6 py-3 text-zinc-400">{snap?.weekDate}</td>
                        <td className="px-6 py-3 text-right tabular-nums">{row.total}</td>
                        <td className="px-6 py-3 text-right tabular-nums text-emerald-400">{row.paid}</td>
                        <td className="px-6 py-3 text-right tabular-nums text-amber-400">{row.trial}</td>
                        <td className="px-6 py-3 text-right tabular-nums">{fmt(row.cards)}</td>
                        <td className="px-6 py-3 text-right">
                          <button onClick={() => deleteSnapshot(row.week)} className="text-zinc-500 hover:text-rose-400 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {view === "cuentas" && (
          <>
            <SectionTitle sub={`${filteredAccounts.length} de ${data.current.length} cuentas`}>Todas las cuentas</SectionTitle>
            <div className="flex flex-wrap gap-3 mb-5">
              <div className="relative flex-1 min-w-[260px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por empresa, email, ID, plan…"
                  className="w-full pl-9 pr-3 py-2 bg-zinc-900/70 border border-zinc-800 rounded-lg text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30"
                />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-zinc-900/70 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-amber-500/60">
                <option value="all">Todos los estados</option>
                <option value="paid">Paid</option>
                <option value="trial">Trial</option>
                <option value="unpaid">Unpaid</option>
              </select>
              <select value={segmentFilter} onChange={(e) => setSegmentFilter(e.target.value)}
                className="px-3 py-2 bg-zinc-900/70 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-amber-500/60">
                {segments.map((s) => (<option key={s} value={s}>{s === "all" ? "Todos los segmentos" : s}</option>))}
              </select>
            </div>
            <AccountTable rows={filteredAccounts} onRowClick={setDetailAccount} emptyText="No hay cuentas que coincidan con los filtros." />
          </>
        )}

        {view === "radiografia" && (
          <>
            <div className="mb-8">
              <div className="text-[11px] uppercase tracking-[0.18em] text-amber-400/80 mb-1">Radiografía semanal</div>
              <h1 className="text-4xl font-serif text-zinc-50">Qué pasó esta semana</h1>
              <p className="text-zinc-500 mt-2 text-sm max-w-2xl">Resumen ejecutivo autogenerado a partir del corte de {data.currentSnapshot?.weekLabel} comparado contra {data.previousSnapshot?.weekLabel || "—"}.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <NarrativeCard title="Resumen" icon={Activity} accent="amber" items={narrative.summary} />
              <NarrativeCard title="Principales riesgos" icon={AlertTriangle} accent="rose" items={narrative.risks} emptyText="Sin riesgos críticos detectados." />
              <NarrativeCard title="Principales oportunidades" icon={Rocket} accent="emerald" items={narrative.opportunities} emptyText="Sin señales fuertes de oportunidad." />
              <NarrativeCard title="Qué haría esta semana" icon={Target} accent="sky" items={narrative.focus} emptyText="Sin acciones urgentes." />
            </div>

            <div className="mt-10 bg-zinc-900/40 border border-zinc-800 rounded-xl p-6">
              <h3 className="font-serif text-lg text-zinc-100 mb-3">Lógica del Health Score</h3>
              <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
                El score va de 0 a 100 y pondera cinco dimensiones simples e interpretables:
              </p>
              <ul className="text-sm text-zinc-300 space-y-2 leading-relaxed">
                <li><span className="text-amber-400 font-medium">Status (35 pts):</span> paga = 35, trial = 18, unpaid = 0.</li>
                <li><span className="text-amber-400 font-medium">Uso actual (25 pts):</span> escalonado por cards: 100+ = 25, 50+ = 20, 20+ = 14, 5+ = 8, &lt;5 = 2.</li>
                <li><span className="text-amber-400 font-medium">Integrations (15 pts):</span> 3+ = 15, 2 = 10, 1 = 6, 0 = 0.</li>
                <li><span className="text-amber-400 font-medium">Variación de uso (15 pts):</span> +10% = 15, estable = 10, caída leve = 5, caída fuerte = 0.</li>
                <li><span className="text-amber-400 font-medium">Crecimiento integraciones (10 pts):</span> sumó = 10, igual = 6, perdió = 0.</li>
              </ul>
              <p className="text-sm text-zinc-400 mt-4 leading-relaxed">
                <span className="text-emerald-300">80–100 saludable</span> · <span className="text-sky-300">60–79 estable</span> · <span className="text-amber-300">40–59 atención</span> · <span className="text-rose-300">0–39 riesgo</span>
              </p>
            </div>
          </>
        )}
      </main>

      {/* DETALLE DE CUENTA */}
      {detailAccount && <AccountDetail account={detailAccount} onClose={() => setDetailAccount(null)} history={snapshots} />}

      {/* TOAST */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-xl border text-sm font-medium ${
          toast.type === "success" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-200" : "bg-rose-500/20 border-rose-500/40 text-rose-200"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* FOOTER */}
      <footer className="max-w-[1440px] mx-auto px-8 py-8 border-t border-zinc-900 mt-10">
        <div className="flex items-center justify-between text-xs text-zinc-600">
          <div>Loyalz Weekly Tracker · herramienta interna · {snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""} en memoria</div>
          <div>Datos persisten durante la sesión · usá <span className="text-zinc-400">Exportar</span> para guardar histórico</div>
        </div>
      </footer>
    </div>
  );
}

// -------------------- COMPONENTES --------------------
const AlertCard = ({ title, icon: Icon, accent, rows, onClick, render }) => {
  const accentMap = {
    rose: "text-rose-400", emerald: "text-emerald-400", amber: "text-amber-400", sky: "text-sky-400",
  };
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={15} className={accentMap[accent]} />
        <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <div className="text-xs text-zinc-600 italic py-4">Sin cuentas en esta categoría.</div>
      ) : (
        <ul className="divide-y divide-zinc-800/60">
          {rows.map((r) => (
            <li key={r.id} onClick={() => onClick(r)}
              className="flex items-center justify-between py-2.5 cursor-pointer hover:bg-zinc-800/30 -mx-2 px-2 rounded transition-colors">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-zinc-100 truncate">{r.company}</div>
                <div className="text-[11px] text-zinc-500 truncate">{r.tariff} · {r.tariffStatus}</div>
              </div>
              <div className="flex items-center gap-2 ml-3">
                {render(r)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const NarrativeCard = ({ title, icon: Icon, accent, items, emptyText }) => {
  const map = {
    rose: { icon: "text-rose-400", border: "border-rose-500/20", bg: "bg-rose-500/5" },
    emerald: { icon: "text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/5" },
    amber: { icon: "text-amber-400", border: "border-amber-500/20", bg: "bg-amber-500/5" },
    sky: { icon: "text-sky-400", border: "border-sky-500/20", bg: "bg-sky-500/5" },
  };
  const s = map[accent] || map.amber;
  return (
    <div className={`border rounded-xl p-6 ${s.border} ${s.bg}`}>
      <div className="flex items-center gap-2 mb-4">
        <Icon size={18} className={s.icon} />
        <h3 className="font-serif text-lg text-zinc-100">{title}</h3>
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-zinc-500 italic">{emptyText}</div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((it, i) => (
            <li key={i} className="text-sm text-zinc-300 leading-relaxed flex gap-2">
              <span className={`${s.icon} mt-1.5 flex-shrink-0`}>•</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const AccountTable = ({ rows, onRowClick, emptyText }) => {
  const [sortKey, setSortKey] = useState("_health.score");
  const [sortDir, setSortDir] = useState("asc");

  const sorted = useMemo(() => {
    const getVal = (r, k) => k.split(".").reduce((o, p) => (o ? o[p] : undefined), r);
    return [...rows].sort((a, b) => {
      const va = getVal(a, sortKey);
      const vb = getVal(b, sortKey);
      if (typeof va === "number") return sortDir === "asc" ? va - vb : vb - va;
      return sortDir === "asc" ? String(va || "").localeCompare(String(vb || "")) : String(vb || "").localeCompare(String(va || ""));
    });
  }, [rows, sortKey, sortDir]);

  const hdr = (k, label, align = "left") => (
    <th className={`px-4 py-3 text-[11px] uppercase tracking-wider text-zinc-500 font-medium cursor-pointer hover:text-zinc-200 text-${align}`}
        onClick={() => { if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir("desc"); } }}>
      {label} {sortKey === k && <span className="text-amber-400">{sortDir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );

  if (!rows.length) {
    return (
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-10 text-center text-sm text-zinc-500">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/60">
            <tr>
              {hdr("company", "Empresa")}
              {hdr("tariff", "Plan")}
              {hdr("tariffStatus", "Estado")}
              {hdr("_segment", "Segmento")}
              {hdr("cards", "Cards", "right")}
              {hdr("_dCards", "Δ Cards", "right")}
              {hdr("integrations", "Integr.", "right")}
              {hdr("_health.score", "Health", "right")}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} onClick={() => onRowClick(r)}
                className="border-t border-zinc-800/60 hover:bg-zinc-800/30 cursor-pointer transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-zinc-100">{r.company}</div>
                    {r._isNew && <span className="text-[10px] px-1.5 py-0.5 bg-sky-500/20 text-sky-300 rounded">NEW</span>}
                    {r._converted && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded">CONV</span>}
                    {r._churnedToUnpaid && <span className="text-[10px] px-1.5 py-0.5 bg-rose-500/20 text-rose-300 rounded">CHURN</span>}
                    {r._planChanged && <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded">PLAN</span>}
                  </div>
                  <div className="text-[11px] text-zinc-500 truncate max-w-[240px]">{r.email}</div>
                </td>
                <td className="px-4 py-3 text-zinc-300">{r.tariff || "—"}</td>
                <td className="px-4 py-3"><StatusBadge status={r.tariffStatus} /></td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{r._segment}</td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-200">{r.cards}</td>
                <td className="px-4 py-3 text-right"><Delta value={r._dCards} /></td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-300">{r.integrations}</td>
                <td className="px-4 py-3 text-right"><HealthPill score={r._health.score} bucket={r._health.bucket} /></td>
                <td className="px-4 py-3 text-zinc-600"><ChevronRight size={14} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AccountDetail = ({ account, onClose, history }) => {
  // Evolución histórica de esta cuenta
  const accountHistory = useMemo(() => {
    return [...history].sort((a, b) => a.weekDate.localeCompare(b.weekDate))
      .map((s) => {
        const row = s.rows.find((r) => r.id === account.id);
        return { week: s.weekLabel, cards: row?.cards || null, integrations: row?.integrations || null, status: row?.tariffStatus };
      });
  }, [account, history]);

  return (
    <div className="fixed inset-0 z-40 bg-zinc-950/80 backdrop-blur-sm flex items-start justify-end" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl h-full bg-zinc-950 border-l border-zinc-800 overflow-y-auto">
        <div className="sticky top-0 bg-zinc-950/90 backdrop-blur border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">Cuenta</div>
            <h2 className="font-serif text-xl text-zinc-100">{account.company}</h2>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={account.tariffStatus} />
            <HealthPill score={account._health.score} bucket={account._health.bucket} />
            <span className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded">{account._segment}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">Cards</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-serif tabular-nums">{account.cards}</span>
                <Delta value={account._dCards} />
              </div>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">Integrations</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-serif tabular-nums">{account.integrations}</span>
                <Delta value={account._dInteg} />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-2">Información</h3>
            <dl className="text-sm divide-y divide-zinc-800/60 border border-zinc-800 rounded-lg">
              <Row label="ID" value={account.id} />
              <Row label="Email" value={account.email} />
              <Row label="Contacto" value={account.contact} />
              <Row label="Plan" value={account.tariff} />
              <Row label="Período" value={account.tariffPeriod} />
              <Row label="Activación" value={account.activationDate} />
            </dl>
          </div>

          {accountHistory.length > 1 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-300 mb-2">Evolución</h3>
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={accountHistory.filter((h) => h.cards !== null)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="week" stroke="#71717a" fontSize={10} />
                    <YAxis stroke="#71717a" fontSize={10} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 }} />
                    <Line type="monotone" dataKey="cards" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
              <Eye size={14} /> Desglose del Health Score
            </h3>
            <ul className="bg-zinc-900/60 border border-zinc-800 rounded-lg divide-y divide-zinc-800/60">
              {account._health.reasons.map((r, i) => (
                <li key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="text-zinc-300">{r.k}</span>
                  <span className="font-medium text-amber-400 tabular-nums">{r.v}</span>
                </li>
              ))}
              <li className="flex items-center justify-between px-4 py-2 text-sm bg-zinc-900">
                <span className="font-medium text-zinc-100">Total</span>
                <span className="font-serif text-xl text-amber-400">{account._health.score}/100</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

const Row = ({ label, value }) => (
  <div className="flex items-center justify-between px-4 py-2.5">
    <dt className="text-xs uppercase tracking-wider text-zinc-500">{label}</dt>
    <dd className="text-sm text-zinc-200 truncate max-w-[60%] text-right">{value || "—"}</dd>
  </div>
);
