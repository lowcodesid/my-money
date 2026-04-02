import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ── THEME ───────────────────────────────────────────────────────────────────
const T = {
  bg: "#FAF7F2", card: "#FFFFFF", text: "#2D2A26", muted: "#8C8578",
  border: "#E8E2D8", borderDark: "#D4CEC4",
  gold: "#A67C00", goldL: "#C49B1A", goldBg: "#FFF8E7",
  teal: "#0D7C72", tealBg: "#E6F7F5",
  green: "#16803C", greenBg: "#ECFDF5",
  red: "#C42B2B", redBg: "#FEF2F2",
  purple: "#6D28D9", purpleBg: "#F3EEFF",
  blue: "#1D5CBF", blueBg: "#EFF6FF",
  orange: "#C2590A",
  chart: ["#A67C00","#0D7C72","#6D28D9","#C2590A","#C42B2B","#1D5CBF","#16803C","#9F5CC0","#B45B1A","#2D8C84","#8B6914","#5B21B6"],
};
const MONO = "'DM Mono', 'SF Mono', 'Menlo', monospace";
const SANS = "'DM Sans', -apple-system, system-ui, sans-serif";
const fmt = (v) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
const fmtK = (v) => { if (v >= 1e6) return "$" + (v / 1e6).toFixed(v >= 1e7 ? 1 : 2) + "M"; if (v >= 1000) return "$" + (v / 1000).toFixed(0) + "k"; return fmt(v); };
const pctF = (v) => (v > 0 ? "+" : "") + v.toFixed(1) + "%";

// ── STORAGE ─────────────────────────────────────────────────────────────────
async function load(key, fallback) {
  try { const r = await window.storage.get("mymoney-" + key); return r ? JSON.parse(r.value) : fallback; }
  catch { return fallback; }
}
async function save(key, data) {
  try { await window.storage.set("mymoney-" + key, JSON.stringify(data)); return true; }
  catch { return false; }
}

// ── DEFAULTS ────────────────────────────────────────────────────────────────
const DEF_INCOME = [
  { id: 1, name: "Partner 1 Salary", type: "salary", grossAnnual: 185000, netMonthly: 11200 },
  { id: 2, name: "Partner 2 Salary", type: "salary", grossAnnual: 145000, netMonthly: 9100 },
  { id: 3, name: "IP1 Brunswick Rent", type: "rental", grossAnnual: 28800, netMonthly: 2400 },
  { id: 4, name: "IP2 Geelong Rent", type: "rental", grossAnnual: 25200, netMonthly: 2100 },
  { id: 5, name: "ETF Dividends", type: "investment", grossAnnual: 4800, netMonthly: 400 },
];
const DEF_PROPS = [
  { id: 1, name: "Family Home, Ivanhoe", type: "PPOR", value: 1450000, mortgage: 520000, rate: 5.89, weeklyRent: 0, occupancy: 0, annualExpenses: 12000, growth: 4.2 },
  { id: 2, name: "IP1 Brunswick", type: "Investment", value: 780000, mortgage: 480000, rate: 6.19, weeklyRent: 600, occupancy: 95, annualExpenses: 8400, growth: 5.1 },
  { id: 3, name: "IP2 Geelong", type: "Investment", value: 620000, mortgage: 390000, rate: 6.39, weeklyRent: 525, occupancy: 92, annualExpenses: 7200, growth: 6.8 },
];
const DEF_ETFS = [
  { id: 1, ticker: "VAS", name: "Vanguard AU Shares", units: 1200, avgPrice: 82.5, currentPrice: 94.2, allocation: 35 },
  { id: 2, ticker: "VGS", name: "Vanguard Intl Shares", units: 800, avgPrice: 95, currentPrice: 112.8, allocation: 28 },
  { id: 3, ticker: "NDQ", name: "BetaShares NASDAQ 100", units: 250, avgPrice: 32, currentPrice: 42.5, allocation: 12 },
  { id: 4, ticker: "VGE", name: "Vanguard Emerging Mkts", units: 400, avgPrice: 68, currentPrice: 72.4, allocation: 9 },
  { id: 5, ticker: "VAF", name: "Vanguard AU Fixed Int", units: 600, avgPrice: 48.5, currentPrice: 46.8, allocation: 9 },
  { id: 6, ticker: "VHY", name: "Vanguard High Yield", units: 350, avgPrice: 58, currentPrice: 64.2, allocation: 7 },
];
const DEF_SUPER = [
  { id: 1, name: "Partner 1", fund: "SMSF", balance: 285000, salaryIncSuper: 185000, sgRate: 11.5, salarySacrifice: 12000, nonConcessional: 0, insurancePremium: 1200 },
  { id: 2, name: "Partner 2", fund: "SMSF", balance: 195000, salaryIncSuper: 145000, sgRate: 11.5, salarySacrifice: 8000, nonConcessional: 0, insurancePremium: 950 },
];
const DEF_SAVINGS = { emergencyCurrent: 52000, offsetBalance: 38000, cashReserve: 7000,
  goals: [{ name: "Emergency Fund", target: 75000, current: 52000 }, { name: "Holiday Fund", target: 8000, current: 3200 }, { name: "Car Replacement", target: 45000, current: 18500 }] };

// ── CSV ─────────────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].toLowerCase().split(",").map(h => h.trim().replace(/"/g, ""));
  const dI = headers.findIndex(h => /date/.test(h));
  const descI = headers.findIndex(h => /desc|narr|memo|particular|detail|reference/.test(h));
  const amtI = headers.findIndex(h => /^amount$/.test(h));
  const debI = headers.findIndex(h => /debit/.test(h));
  const creI = headers.findIndex(h => /credit/.test(h));
  const catI = headers.findIndex(h => /cat|category/.test(h));
  const txns = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = lines[i].match(/(".*?"|[^,]+)/g);
    if (!vals || vals.length < 2) continue;
    const cl = vals.map(v => v.trim().replace(/^"|"$/g, ""));
    const desc = descI >= 0 ? cl[descI] : (cl[1] || "");
    let amount = 0;
    if (amtI >= 0) amount = parseFloat((cl[amtI] || "0").replace(/[^0-9.\-]/g, "")) || 0;
    else { const d = debI >= 0 ? Math.abs(parseFloat((cl[debI] || "0").replace(/[^0-9.\-]/g, "")) || 0) : 0; const c = creI >= 0 ? parseFloat((cl[creI] || "0").replace(/[^0-9.\-]/g, "")) || 0 : 0; amount = c > 0 ? c : -d; }
    let date = null;
    if (dI >= 0 && cl[dI]) { const p = cl[dI].split(/[/\-]/); if (p.length === 3) { const n = p.map(Number); date = n[0] > 31 ? new Date(n[0], n[1]-1, n[2]) : new Date(n[2] < 100 ? 2000+n[2] : n[2], n[1]-1, n[0]); } }
    txns.push({ date, description: desc, amount, category: catI >= 0 ? cl[catI] : cat(desc), isIncome: amount > 0 });
  }
  return txns;
}
function cat(d) { const l = d.toLowerCase(); if (/coles|woolworth|aldi|iga|grocer/.test(l)) return "Groceries"; if (/uber eat|menulog|doordash|mcdonald|cafe|coffee|restaurant|dining|pizza|sushi/.test(l)) return "Dining Out"; if (/netflix|spotify|disney|apple|google play|subscription|stan/.test(l)) return "Subscriptions"; if (/petrol|fuel|bp |shell|uber|taxi|parking|rego|toll|myki|ptv/.test(l)) return "Transport"; if (/electric|gas|water|internet|telstra|optus|energy|agl|origin/.test(l)) return "Utilities"; if (/medibank|bupa|doctor|pharmacy|dental|physio|health/.test(l)) return "Healthcare"; if (/insurance|allianz|suncorp|racv/.test(l)) return "Insurance"; if (/school|tuition|childcare|education/.test(l)) return "Education"; if (/mortgage|home loan|rent|body corp|strata|council/.test(l)) return "Housing"; if (/target|kmart|bigw|jb hi|bunning|clothing/.test(l)) return "Shopping"; if (/gym|sport|fitness|ticket|cinema|concert/.test(l)) return "Entertainment"; if (/transfer|pay|salary|wage|income|dividend/.test(l)) return "Transfer/Income"; return "Other"; }

// ── METRICS ─────────────────────────────────────────────────────────────────
function calcMetrics(txns, props, income, etfs, superMembers, savings) {
  const totalIncome = income.reduce((s, i) => s + i.netMonthly, 0);
  const totalSavings = savings.emergencyCurrent + savings.offsetBalance + savings.cashReserve;
  const propEquity = props.reduce((s, p) => s + (p.value - p.mortgage), 0);
  const propValue = props.reduce((s, p) => s + p.value, 0);
  const propDebt = props.reduce((s, p) => s + p.mortgage, 0);
  const etfVal = etfs.reduce((s, h) => s + h.units * h.currentPrice, 0);
  const etfCost = etfs.reduce((s, h) => s + h.units * h.avgPrice, 0);
  const superTotal = superMembers.reduce((s, m) => s + m.balance, 0);
  const expTxns = txns.filter(t => !t.isIncome && t.category !== "Transfer/Income");
  const totalExp = expTxns.reduce((s, t) => s + Math.abs(t.amount), 0);
  const monthSet = new Set(expTxns.map(t => t.date ? (t.date.getFullYear() + "-" + t.date.getMonth()) : "x"));
  const months = Math.max(monthSet.size, 1);
  const avgExp = totalExp / months;
  const byCat = {}; expTxns.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + Math.abs(t.amount); });
  const catList = Object.entries(byCat).map(([n, tot]) => ({ name: n, total: tot, monthly: tot / months })).sort((a, b) => b.total - a.total);
  const byMo = {}; expTxns.forEach(t => { if (!t.date) return; const k = t.date.getFullYear() + "-" + String(t.date.getMonth()+1).padStart(2,"0"); const l = t.date.toLocaleDateString("en-AU",{month:"short",year:"2-digit"}); if (!byMo[k]) byMo[k] = {key:k,label:l,total:0,cats:{}}; byMo[k].total += Math.abs(t.amount); byMo[k].cats[t.category] = (byMo[k].cats[t.category]||0) + Math.abs(t.amount); });
  const moData = Object.values(byMo).sort((a, b) => a.key.localeCompare(b.key));
  const topCats = catList.slice(0, 6).map(c => c.name);
  const stacked = moData.map(md => { const row = {month:md.label,total:Math.round(md.total)}; topCats.forEach(c=>{row[c]=Math.round(md.cats[c]||0);}); row.Other = Math.round(Object.entries(md.cats).filter(([k])=>!topCats.includes(k)).reduce((s,e)=>s+e[1],0)); return row; });
  const hasCSV = txns.length > 0;
  const exp = hasCSV ? avgExp : 14375;
  const surplus = totalIncome - exp;
  const savRate = totalIncome > 0 ? (surplus / totalIncome * 100) : 0;
  const eMo = savings.emergencyCurrent / exp;
  const drift = hasCSV && moData.length >= 2 ? ((moData[moData.length-1].total - moData[moData.length-2].total)/(moData[moData.length-2].total||1)*100) : 3.2;
  const capReady = Math.min(100, Math.round((savRate>20?40:savRate*2)+(Math.abs(drift)<5?30:Math.abs(drift)<10?20:10)+(eMo>6?30:(eMo/6)*30)));
  const signal = capReady>=70 && Math.abs(drift)<5 && savRate>15 ? "Lean In" : capReady<40||Math.abs(drift)>20||savRate<5 ? "Stand Down" : "Prepare";
  const netWorth = propEquity + etfVal + totalSavings + superTotal;
  return { totalIncome, totalExpenses:exp, surplus, savingsRate:savRate, expenseDrift:drift, propertyEquity:propEquity, totalPropertyValue:propValue, totalMortgage:propDebt, etfValue:etfVal, etfCost, superTotal, totalSavings, emergencyMonths:eMo, capitalReadiness:capReady, signal, netWorth, hasCSV, categoryList:catList, stackedMonthly:stacked, monthlyData:moData, topCats, txnCount:txns.length, avgMonthlyExpense:avgExp };
}

// ── EDITABLE CELL ───────────────────────────────────────────────────────────
function EditCell({ value, onChange, type, prefix, suffix, align }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const ref = useRef(null);
  useEffect(() => { if (editing && ref.current) ref.current.select(); }, [editing]);
  if (!editing) {
    const display = type === "money" ? fmt(value) : type === "pct" ? value + "%" : type === "number" ? Number(value).toLocaleString() : String(value);
    return (
      <span onClick={() => { setDraft(String(value)); setEditing(true); }}
        style={{ cursor: "pointer", borderBottom: "1px dashed " + T.border, paddingBottom: 1 }}
        title="Click to edit">
        {prefix}{display}{suffix}
      </span>
    );
  }
  const commit = () => {
    setEditing(false);
    const v = type === "money" || type === "number" || type === "pct" ? parseFloat(draft) || 0 : draft;
    onChange(v);
  };
  return (
    <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
      style={{
        width: type === "text" ? 140 : 80, padding: "2px 6px", fontSize: 12, fontFamily: MONO,
        border: "1.5px solid " + T.gold, borderRadius: 4, background: T.goldBg, color: T.text,
        textAlign: align || (type === "text" ? "left" : "right"), outline: "none",
      }} />
  );
}

// ── ROOT ────────────────────────────────────────────────────────────────────
export default function MyMoney() {
  const [properties, setProperties] = useState(DEF_PROPS);
  const [etfs, setEtfs] = useState(DEF_ETFS);
  const [superMembers, setSuperMembers] = useState(DEF_SUPER);
  const [income] = useState(DEF_INCOME);
  const [savings] = useState(DEF_SAVINGS);
  const [transactions, setTransactions] = useState([]);
  const [csvStatus, setCsvStatus] = useState("idle"); // idle | loading | done
  const [csvName, setCsvName] = useState(null);
  const [csvCount, setCsvCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved
  const [loaded, setLoaded] = useState(false);
  const [expandedPillar, setExpandedPillar] = useState(null);
  const fileRef = useRef(null);

  // Load from storage on mount
  useEffect(() => {
    (async () => {
      const p = await load("properties", null);
      const e = await load("etfs", null);
      const s = await load("super", null);
      const c = await load("csv", null);
      if (p) setProperties(p);
      if (e) setEtfs(e);
      if (s) setSuperMembers(s);
      if (c && c.txns) { setTransactions(c.txns.map(t => ({...t, date: t.date ? new Date(t.date) : null}))); setCsvName(c.name); setCsvCount(c.txns.length); setCsvStatus("done"); }
      setLoaded(true);
    })();
  }, []);

  const handleCSV = useCallback((e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setCsvStatus("loading");
    setCsvName(f.name);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const parsed = parseCSV(ev.target.result);
      setTransactions(parsed);
      setCsvCount(parsed.length);
      setCsvStatus("done");
      await save("csv", { name: f.name, txns: parsed });
    };
    reader.readAsText(f);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const handleSave = useCallback(async () => {
    setSaveStatus("saving");
    await save("properties", properties);
    await save("etfs", etfs);
    await save("super", superMembers);
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  }, [properties, etfs, superMembers]);

  const updateProp = (id, field, val) => setProperties(prev => prev.map(p => p.id === id ? {...p, [field]: val} : p));
  const addProp = () => setProperties(prev => [...prev, { id: Date.now(), name: "New Property", type: "Investment", value: 0, mortgage: 0, rate: 6.0, weeklyRent: 0, occupancy: 95, annualExpenses: 0, growth: 5 }]);
  const delProp = (id) => setProperties(prev => prev.filter(p => p.id !== id));

  const updateEtf = (id, field, val) => setEtfs(prev => prev.map(e => e.id === id ? {...e, [field]: val} : e));
  const addEtf = () => setEtfs(prev => [...prev, { id: Date.now(), ticker: "NEW", name: "New Holding", units: 0, avgPrice: 0, currentPrice: 0, allocation: 0 }]);
  const delEtf = (id) => setEtfs(prev => prev.filter(e => e.id !== id));

  const updateSuper = (id, field, val) => setSuperMembers(prev => prev.map(s => s.id === id ? {...s, [field]: val} : s));
  const addSuper = () => setSuperMembers(prev => [...prev, { id: Date.now(), name: "New Member", fund: "Industry", balance: 0, salaryIncSuper: 0, sgRate: 11.5, salarySacrifice: 0, nonConcessional: 0, insurancePremium: 0 }]);
  const delSuper = (id) => setSuperMembers(prev => prev.filter(s => s.id !== id));

  const m = useMemo(() => calcMetrics(transactions, properties, income, etfs, superMembers, savings), [transactions, properties, income, etfs, superMembers, savings]);

  if (!loaded) return <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted }}>Loading...</div>;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: SANS }}>
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(250,247,242,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid " + T.border, padding: "0 32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: T.gold, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#fff" }}>$</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>My Money</div>
              <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1, textTransform: "uppercase", fontFamily: MONO }}>Household Financial Dashboard</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SigBadge signal={m.signal} />
            <button onClick={handleSave} style={{
              padding: "7px 16px", borderRadius: 7, border: "1.5px solid " + (saveStatus === "saved" ? T.green : T.gold),
              background: saveStatus === "saved" ? T.greenBg : T.goldBg,
              color: saveStatus === "saved" ? T.green : T.gold,
              fontSize: 12, fontWeight: 600, fontFamily: MONO, cursor: "pointer",
            }}>
              {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "\u2713 Saved" : "Save Session"}
            </button>
          </div>
        </div>
      </header>

      <main style={{ padding: "24px 32px 100px", maxWidth: 1440, margin: "0 auto" }}>
        {/* ── CSV UPLOAD ───────────────────────────────────────── */}
        <div style={{ marginBottom: 20, background: T.card, border: "1.5px solid " + (csvStatus === "done" ? T.green : T.border), borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: csvStatus === "done" ? T.greenBg : T.blueBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: csvStatus === "done" ? T.green : T.blue }}>
              {csvStatus === "done" ? "\u2713" : "\u2191"}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
                {csvStatus === "idle" ? "Upload Bank CSV" : csvStatus === "loading" ? "Processing..." : "CSV Loaded"}
              </div>
              <div style={{ fontSize: 12, color: T.muted }}>
                {csvStatus === "idle" ? "Import transactions to see expense breakdown. Supports most AU bank formats."
                  : csvStatus === "loading" ? "Parsing and categorising transactions..."
                  : csvName + " \u2022 " + csvCount.toLocaleString() + " transactions imported"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {csvStatus === "done" && (
              <button onClick={() => { setTransactions([]); setCsvStatus("idle"); setCsvName(null); setCsvCount(0); save("csv", null); }}
                style={{ padding: "8px 14px", borderRadius: 7, border: "1px solid " + T.border, background: T.bg, color: T.muted, fontSize: 12, fontFamily: MONO, cursor: "pointer" }}>
                Clear
              </button>
            )}
            <button onClick={() => fileRef.current && fileRef.current.click()} style={{
              padding: "8px 18px", borderRadius: 7, border: "none",
              background: csvStatus === "done" ? T.green : T.gold,
              color: "#fff", fontSize: 12, fontWeight: 600, fontFamily: MONO, cursor: "pointer",
            }}>
              {csvStatus === "done" ? "Replace CSV" : csvStatus === "loading" ? "Processing..." : "Choose File"}
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleCSV} style={{ display: "none" }} />
        </div>

        {/* ── SIGNAL CARDS ─────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 20 }}>
          <SigCard label="Net Monthly Surplus" value={fmt(m.surplus)} sub="Run-rate" color={m.surplus >= 0 ? T.green : T.red} />
          <SigCard label="Expense Drift" value={pctF(m.expenseDrift)} sub={m.hasCSV ? "vs prior month" : "estimated"} color={Math.abs(m.expenseDrift) > 5 ? T.red : Math.abs(m.expenseDrift) > 2 ? T.orange : T.green} />
          <SigCard label="Savings Rate" value={m.savingsRate.toFixed(1) + "%"} sub={m.savingsRate > 20 ? "Strong" : m.savingsRate > 10 ? "Healthy" : "Low"} color={m.savingsRate > 20 ? T.green : m.savingsRate > 10 ? T.orange : T.red} />
          <SigCard label="Capital Readiness" value={String(m.capitalReadiness)} sub="/100 composite" color={T.teal} progress={m.capitalReadiness} />
          <SigCard label="Total Net Worth" value={fmtK(m.netWorth)} sub="All pillars" color={T.gold} />
        </div>

        {/* ── PILLAR CARDS ─────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { id: "income", label: "Income", val: fmt(m.totalIncome), sub: "/month net", color: T.green, bg: T.greenBg },
            { id: "expenses", label: "Expenses", val: m.hasCSV ? fmt(m.avgMonthlyExpense) : "No CSV", sub: m.hasCSV ? m.txnCount + " transactions" : "Upload above", color: T.red, bg: T.redBg, dim: !m.hasCSV },
            { id: "savings", label: "Savings", val: fmtK(m.totalSavings), sub: m.emergencyMonths.toFixed(1) + " months cover", color: T.teal, bg: T.tealBg },
            { id: "investments", label: "Investments", val: fmtK(m.propertyEquity + m.etfValue), sub: "Property + Shares", color: T.gold, bg: T.goldBg },
            { id: "super", label: "Super", val: fmtK(m.superTotal), sub: superMembers.length + " members", color: T.purple, bg: T.purpleBg },
          ].map(p => (
            <button key={p.id} onClick={() => setExpandedPillar(expandedPillar === p.id ? null : p.id)} style={{
              background: expandedPillar === p.id ? p.bg : T.card,
              border: "1.5px solid " + (expandedPillar === p.id ? p.color : T.border),
              borderRadius: 10, padding: "14px 16px", cursor: "pointer", textAlign: "left", transition: "all 0.15s",
            }}>
              <div style={{ fontSize: 10, color: T.muted, fontFamily: MONO, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 }}>{p.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: p.dim ? T.muted : T.text }}>{p.val}</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{p.sub}</div>
            </button>
          ))}
        </div>

        {/* ── EXPANDED PILLAR ──────────────────────────────────── */}
        {expandedPillar === "income" && <IncomePanel sources={income} m={m} />}
        {expandedPillar === "expenses" && m.hasCSV && <ExpChart m={m} />}
        {expandedPillar === "savings" && <SavingsPanel savings={savings} m={m} />}

        {/* ── EXPENDITURE CHART ────────────────────────────────── */}
        {m.hasCSV && !expandedPillar && <ExpChart m={m} />}

        {/* ── PROPERTY TABLE ──────────────────────────────────── */}
        <Section title="Property Portfolio" color={T.gold} metrics={[
          { l: "Total Value", v: fmtK(m.totalPropertyValue), c: T.gold },
          { l: "Total Equity", v: fmtK(m.propertyEquity), c: T.teal },
          { l: "Total Debt", v: fmtK(m.totalMortgage), c: T.red },
          { l: "LVR", v: (m.totalMortgage / m.totalPropertyValue * 100).toFixed(0) + "%", c: T.muted },
        ]} onAdd={addProp} addLabel="+ Add Property">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ background: T.bg }}>
                {["Property","Type","Value","Mortgage","Equity","LVR","Rate","Rent /wk","Occupancy","Annual Costs","Monthly CF","Growth",""].map((h, i) => (
                  <th key={h+i} style={{ padding: "10px 10px", textAlign: i === 0 ? "left" : "right", fontSize: 9, fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase", color: T.gold, borderBottom: "2px solid " + T.gold + "30", fontWeight: 600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {properties.map(p => {
                  const eq = p.value - p.mortgage; const lvr = p.value > 0 ? (p.mortgage / p.value * 100) : 0;
                  const moRent = p.weeklyRent * 52 * (p.occupancy / 100) / 12;
                  const moInt = p.mortgage * (p.rate / 100) / 12;
                  const moCost = p.annualExpenses / 12;
                  const cf = p.type !== "PPOR" ? moRent - moCost - moInt : -(moCost + moInt);
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid " + T.border }}>
                      <td style={{ padding: "10px", fontWeight: 600 }}><EditCell value={p.name} onChange={v => updateProp(p.id,"name",v)} type="text" /></td>
                      <td style={{ padding: "10px", textAlign: "right" }}>
                        <select value={p.type} onChange={e => updateProp(p.id,"type",e.target.value)} style={{ fontSize: 11, fontFamily: MONO, border: "1px solid " + T.border, borderRadius: 4, padding: "2px 4px", background: p.type === "PPOR" ? T.purpleBg : T.tealBg, color: p.type === "PPOR" ? T.purple : T.teal, cursor: "pointer" }}>
                          <option value="PPOR">PPOR</option><option value="Investment">Investment</option>
                        </select>
                      </td>
                      <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO }}><EditCell value={p.value} onChange={v => updateProp(p.id,"value",v)} type="money" /></td>
                      <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO, color: T.red }}><EditCell value={p.mortgage} onChange={v => updateProp(p.id,"mortgage",v)} type="money" /></td>
                      <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO, color: T.teal, fontWeight: 600 }}>{fmtK(eq)}</td>
                      <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO, color: lvr > 80 ? T.red : lvr > 60 ? T.orange : T.green }}>{lvr.toFixed(0)}%</td>
                      <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO }}><EditCell value={p.rate} onChange={v => updateProp(p.id,"rate",v)} type="pct" /></td>
                      <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO }}><EditCell value={p.weeklyRent} onChange={v => updateProp(p.id,"weeklyRent",v)} type="money" /></td>
                      <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO }}><EditCell value={p.occupancy} onChange={v => updateProp(p.id,"occupancy",v)} type="pct" /></td>
                      <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO }}><EditCell value={p.annualExpenses} onChange={v => updateProp(p.id,"annualExpenses",v)} type="money" /></td>
                      <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO, fontWeight: 600, color: cf >= 0 ? T.green : T.red }}>{(cf >= 0 ? "+" : "") + fmt(Math.round(cf))}</td>
                      <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO, color: T.green }}><EditCell value={p.growth} onChange={v => updateProp(p.id,"growth",v)} type="pct" /></td>
                      <td style={{ padding: "10px", textAlign: "right" }}>
                        <button onClick={() => delProp(p.id)} style={{ border: "none", background: "none", color: T.red, cursor: "pointer", fontSize: 14, opacity: 0.5 }} title="Delete">&times;</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── SHARES PORTFOLIO ─────────────────────────────────── */}
        <Section title="Shares Portfolio" color={T.teal} metrics={[
          { l: "Value", v: fmtK(m.etfValue), c: T.teal },
          { l: "Return", v: fmtK(m.etfValue - m.etfCost), c: T.green },
          { l: "Return %", v: "+" + ((m.etfValue - m.etfCost) / (m.etfCost || 1) * 100).toFixed(1) + "%", c: T.green },
        ]} onAdd={addEtf} addLabel="+ Add Holding">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ background: T.bg }}>
              {["Ticker","Name","Units","Avg Price","Current","Value","Return $","Return %","Allocation",""].map((h, i) => (
                <th key={h+i} style={{ padding: "10px", textAlign: i < 2 ? "left" : "right", fontSize: 9, fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase", color: T.teal, borderBottom: "2px solid " + T.teal + "30", fontWeight: 600 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {etfs.map((h, idx) => {
                const v = h.units * h.currentPrice; const cost = h.units * h.avgPrice;
                const ret = v - cost; const rp = cost > 0 ? (ret / cost * 100) : 0;
                return (
                  <tr key={h.id} style={{ borderBottom: "1px solid " + T.border }}>
                    <td style={{ padding: "10px", fontWeight: 700 }}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 6, height: 6, borderRadius: 2, background: T.chart[idx % T.chart.length] }} /><EditCell value={h.ticker} onChange={v2 => updateEtf(h.id,"ticker",v2)} type="text" /></div></td>
                    <td style={{ padding: "10px", color: T.muted }}><EditCell value={h.name} onChange={v2 => updateEtf(h.id,"name",v2)} type="text" /></td>
                    <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO }}><EditCell value={h.units} onChange={v2 => updateEtf(h.id,"units",v2)} type="number" /></td>
                    <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO }}><EditCell value={h.avgPrice} onChange={v2 => updateEtf(h.id,"avgPrice",v2)} type="number" /></td>
                    <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO }}><EditCell value={h.currentPrice} onChange={v2 => updateEtf(h.id,"currentPrice",v2)} type="number" /></td>
                    <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO, fontWeight: 600 }}>{fmtK(v)}</td>
                    <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO, color: ret >= 0 ? T.green : T.red }}>{(ret >= 0 ? "+" : "") + fmtK(ret)}</td>
                    <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO, fontWeight: 600, color: rp >= 0 ? T.green : T.red }}>{(rp >= 0 ? "+" : "") + rp.toFixed(1)}%</td>
                    <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO }}><EditCell value={h.allocation} onChange={v2 => updateEtf(h.id,"allocation",v2)} type="pct" /></td>
                    <td style={{ padding: "10px", textAlign: "right" }}><button onClick={() => delEtf(h.id)} style={{ border: "none", background: "none", color: T.red, cursor: "pointer", fontSize: 14, opacity: 0.5 }}>&times;</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        {/* ── SUPER TABLE ──────────────────────────────────────── */}
        <Section title="Superannuation" color={T.purple} metrics={[
          { l: "Total Balance", v: fmtK(m.superTotal), c: T.purple },
          { l: "Members", v: String(superMembers.length), c: T.muted },
        ]} onAdd={addSuper} addLabel="+ Add Member">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ background: T.bg }}>
              {["Member","Fund","Balance","Salary (inc. super)","SG Rate","Employer SG","Salary Sacrifice","Non-Concessional","Insurance","Total Contributions",""].map((h, i) => (
                <th key={h+i} style={{ padding: "10px", textAlign: i < 2 ? "left" : "right", fontSize: 9, fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase", color: T.purple, borderBottom: "2px solid " + T.purple + "30", fontWeight: 600 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {superMembers.map(s => {
                const sg = s.salaryIncSuper * (s.sgRate / 100) / (1 + s.sgRate / 100);
                const totalContrib = sg + s.salarySacrifice + s.nonConcessional;
                return (
                  <tr key={s.id} style={{ borderBottom: "1px solid " + T.border }}>
                    <td style={{ padding: "10px", fontWeight: 600 }}><EditCell value={s.name} onChange={v => updateSuper(s.id,"name",v)} type="text" /></td>
                    <td style={{ padding: "10px" }}>
                      <select value={s.fund} onChange={e => updateSuper(s.id,"fund",e.target.value)} style={{ fontSize: 11, fontFamily: MONO, border: "1px solid " + T.border, borderRadius: 4, padding: "2px 4px", background: T.purpleBg, color: T.purple, cursor: "pointer" }}>
                        <option value="SMSF">SMSF</option><option value="Industry">Industry</option><option value="Retail">Retail</option>
                      </select>
                    </td>
                    <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO, fontWeight: 600, color: T.purple }}><EditCell value={s.balance} onChange={v => updateSuper(s.id,"balance",v)} type="money" /></td>
                    <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO }}><EditCell value={s.salaryIncSuper} onChange={v => updateSuper(s.id,"salaryIncSuper",v)} type="money" /></td>
                    <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO }}><EditCell value={s.sgRate} onChange={v => updateSuper(s.id,"sgRate",v)} type="pct" /></td>
                    <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO, color: T.green }}>{fmtK(Math.round(sg))}/yr</td>
                    <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO, color: T.teal }}><EditCell value={s.salarySacrifice} onChange={v => updateSuper(s.id,"salarySacrifice",v)} type="money" /></td>
                    <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO }}><EditCell value={s.nonConcessional} onChange={v => updateSuper(s.id,"nonConcessional",v)} type="money" /></td>
                    <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO, color: T.red }}><EditCell value={s.insurancePremium} onChange={v => updateSuper(s.id,"insurancePremium",v)} type="money" /></td>
                    <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO, fontWeight: 600, color: T.green }}>{fmtK(Math.round(totalContrib))}/yr</td>
                    <td style={{ padding: "10px", textAlign: "right" }}><button onClick={() => delSuper(s.id)} style={{ border: "none", background: "none", color: T.red, cursor: "pointer", fontSize: 14, opacity: 0.5 }}>&times;</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      </main>
    </div>
  );
}

// ── COMPONENTS ──────────────────────────────────────────────────────────────
function SigBadge({ signal }) {
  const map = { "Lean In": { bg: T.greenBg, b: T.green, t: T.green }, "Prepare": { bg: T.goldBg, b: T.orange, t: T.orange }, "Stand Down": { bg: T.redBg, b: T.red, t: T.red } };
  const s = map[signal];
  return <span style={{ padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: MONO, background: s.bg, border: "1.5px solid " + s.b, color: s.t }}>{signal}</span>;
}

function SigCard({ label, value, sub, color, progress }) {
  return (
    <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ fontSize: 9.5, color: T.muted, fontFamily: MONO, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color, fontFamily: MONO }}>{value}</div>
      {progress !== undefined && <div style={{ marginTop: 6, height: 5, background: T.bg, borderRadius: 3, overflow: "hidden" }}><div style={{ width: progress + "%", height: "100%", background: color, borderRadius: 3 }} /></div>}
      <div style={{ fontSize: 10, color: T.muted, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function Section({ title, color, metrics, onAdd, addLabel, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: color }}>{title}</div>
          {metrics && metrics.map(m => (
            <div key={m.l} style={{ background: T.bg, borderRadius: 6, padding: "6px 12px", display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 9, color: T.muted, fontFamily: MONO }}>{m.l}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: m.c, fontFamily: MONO }}>{m.v}</span>
            </div>
          ))}
        </div>
        {onAdd && <button onClick={onAdd} style={{ padding: "6px 14px", borderRadius: 6, border: "1.5px solid " + color, background: "transparent", color: color, fontSize: 12, fontWeight: 600, fontFamily: MONO, cursor: "pointer" }}>{addLabel}</button>}
      </div>
      <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 10, overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

function ExpChart({ m }) {
  const keys = [...m.topCats, "Other"];
  return (
    <div style={{ marginBottom: 20, background: T.card, border: "1px solid " + T.border, borderRadius: 12, padding: "16px 20px" }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Monthly Expenditure</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 20 }}>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={m.stackedMonthly} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: T.muted }} axisLine={{ stroke: T.border }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} tickFormatter={(v) => "$" + (v / 1000).toFixed(0) + "k"} />
              <Tooltip contentStyle={{ background: T.card, border: "1px solid " + T.border, borderRadius: 8, fontSize: 11 }} formatter={(v) => fmt(v)} />
              {keys.map((k, i) => <Bar key={k} dataKey={k} stackId="a" fill={T.chart[i % T.chart.length]} radius={i === keys.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <div style={{ fontSize: 10, color: T.muted, fontFamily: MONO, marginBottom: 8 }}>CATEGORY BREAKDOWN</div>
          {m.categoryList.slice(0, 10).map((c, i) => (
            <div key={c.name} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid " + T.border }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: 2, background: T.chart[i % T.chart.length] }} />
                <span style={{ fontSize: 12 }}>{c.name}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, fontFamily: MONO }}>{fmt(Math.round(c.monthly))}/mo</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", marginTop: 4, borderTop: "2px solid " + T.border }}>
            <span style={{ fontWeight: 600, color: T.gold }}>Total avg</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.red, fontFamily: MONO }}>{fmt(Math.round(m.avgMonthlyExpense))}/mo</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function IncomePanel({ sources, m }) {
  const byType = {}; sources.forEach(s => { byType[s.type] = (byType[s.type] || 0) + s.netMonthly; });
  const pie = Object.entries(byType).map(([n, v]) => ({ name: n.charAt(0).toUpperCase() + n.slice(1), value: v }));
  return (
    <div style={{ marginBottom: 20, background: T.card, border: "1px solid " + T.border, borderRadius: 12, padding: "16px 20px" }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Income Breakdown</div>
      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 20 }}>
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart><Pie data={pie} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
              {pie.map((_, i) => <Cell key={i} fill={T.chart[i]} />)}
            </Pie></PieChart>
          </ResponsiveContainer>
        </div>
        <div>
          {sources.map(s => (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid " + T.border }}>
              <div><div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div><div style={{ fontSize: 10, color: T.muted, fontFamily: MONO }}>{s.type}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 14, fontWeight: 600, color: T.green, fontFamily: MONO }}>{fmt(s.netMonthly)}</div><div style={{ fontSize: 10, color: T.muted }}>{fmt(s.grossAnnual)} p.a.</div></div>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
            <span style={{ fontWeight: 600, color: T.gold }}>Total monthly net</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: T.green, fontFamily: MONO }}>{fmt(m.totalIncome)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SavingsPanel({ savings, m }) {
  return (
    <div style={{ marginBottom: 20, background: T.card, border: "1px solid " + T.border, borderRadius: 12, padding: "16px 20px" }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Savings and Reserves</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        {[
          { l: "Emergency Fund", v: fmtK(savings.emergencyCurrent), s: m.emergencyMonths.toFixed(1) + " months", c: m.emergencyMonths >= 6 ? T.green : T.orange },
          { l: "Offset Account", v: fmtK(savings.offsetBalance), s: "Reducing PPOR interest", c: T.teal },
          { l: "Cash Reserve", v: fmtK(savings.cashReserve), s: "Deployable", c: T.gold },
        ].map(x => (
          <div key={x.l} style={{ background: T.bg, borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ fontSize: 9, color: T.muted, fontFamily: MONO, marginBottom: 3 }}>{x.l}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: x.c, fontFamily: MONO }}>{x.v}</div>
            <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{x.s}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: T.gold, fontWeight: 600, fontFamily: MONO, marginBottom: 8 }}>GOALS</div>
      {savings.goals.map((g, i) => {
        const done = (g.current / g.target * 100);
        return (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 12.5, fontWeight: 500 }}>{g.name}</span>
              <span style={{ fontSize: 11, color: T.muted, fontFamily: MONO }}>{fmtK(g.current)} / {fmtK(g.target)}</span>
            </div>
            <div style={{ height: 6, background: T.bg, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: done + "%", height: "100%", background: T.teal, borderRadius: 3 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
