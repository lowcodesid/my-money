"use strict";

const STORAGE_KEY = "my-money-v2";
const CATEGORIES = ["Groceries", "Dining out", "Housing", "Transport", "Utilities", "Healthcare", "Insurance", "Education", "Shopping", "Entertainment", "Subscriptions", "Cash/ATM", "Transfer", "Income", "Other"];
const ASSET_TYPES = [["cash", "Cash & savings"], ["vehicle", "Cars & vehicles"], ["gold", "Gold"], ["commodity", "Other commodities"], ["other", "Other assets"]];
const WEALTH_COLOURS = { property: "#A92F22", super: "#6436A3", shares: "#08796F", cash: "#1559A6", vehicle: "#C56B16", gold: "#B38A09", commodity: "#8B5A2B", other: "#60756B" };

const demoState = () => ({
  version: 2, isDemo: true, theme: "system",
  properties: [{ id: uid(), name: "Demo home", type: "Home", value: 850000, mortgage: 400000, rate: 6.1, weeklyRent: 0, annualCosts: 6500, asAt: today() }],
  shares: [{ id: uid(), ticker: "VAS", name: "Demo shares", units: 100, averagePrice: 80, currentPrice: 95, asAt: today() }],
  superMembers: [{ id: uid(), name: "Demo super", fund: "Industry", balance: 125000, asAt: today() }],
  assets: [{ id: uid(), name: "Demo savings", type: "cash", value: 15000, asAt: today() }],
  loans: [], income: [{ id: uid(), name: "Demo household income", monthlyNet: 9500 }], txns: [], imports: [], lastSaved: null
});

let state = loadState();
let pendingImport = null;
let saveTimer = null;
let toastTimer = null;

const $ = (selector, root = document) => root.querySelector(selector);
function today() { const now = new Date(); const offset = now.getTimezoneOffset() * 60000; return new Date(now.getTime() - offset).toISOString().slice(0, 10); }
function uid() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`; }
function money(value) { return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(Number(value) || 0); }
function shortMoney(value) { const n = Number(value) || 0; const sign = n < 0 ? "-" : ""; const absolute = Math.abs(n); if (absolute >= 999500) return `${sign}$${(absolute / 1e6).toFixed(absolute >= 1e7 ? 1 : 2)}M`; if (absolute >= 1e3) return `${sign}$${Math.round(absolute / 1e3)}k`; return money(n); }
function esc(value) { return String(value ?? "").replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char])); }
function parseNumber(value) { const source = String(value ?? "").trim(); const negative = /^\(.*\)$/.test(source) || /^-/.test(source); const parsed = Number.parseFloat(source.replace(/[^0-9.]/g, "")); return Number.isFinite(parsed) ? (negative ? -parsed : parsed) : 0; }
function validDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const source = String(value).trim();
  let match = source.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  match = source.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (!match) return null;
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function normaliseState(value) {
  const base = demoState();
  if (!value || typeof value !== "object") return base;
  const array = (key, fallback = []) => Array.isArray(value[key]) ? value[key] : fallback;
  return { ...base, ...value, version: 2, properties: array("properties", base.properties), shares: array("shares", base.shares), superMembers: array("superMembers", base.superMembers), assets: array("assets", base.assets), loans: array("loans"), income: array("income", base.income), txns: array("txns"), imports: array("imports") };
}
function loadState() { try { return normaliseState(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch { return demoState(); } }
function persist(showConfirmation = false) {
  clearTimeout(saveTimer);
  try { state.lastSaved = new Date().toISOString(); localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); updateSavedCopy(); if (showConfirmation) toast("Saved on this device."); return true; }
  catch { state.lastSaved = null; updateSavedCopy("Save failed. Download a backup before closing this page.", true); toast("That save didn’t stick. Download a backup before closing this page.", true); return false; }
}
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(() => persist(false), 350); }
function updateSavedCopy(message, isError = false) { const target = $("#last-saved"); target.textContent = message || (state.lastSaved ? `Saved ${new Date(state.lastSaved).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}` : "Not saved yet"); target.style.color = isError ? "var(--danger)" : ""; }
function toast(message, error = false) { const target = $("#toast"); target.textContent = message; target.style.background = error ? "var(--danger)" : ""; target.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => target.classList.remove("show"), 3200); }

function calculations() {
  const propertyValue = state.properties.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const mortgages = state.properties.reduce((sum, item) => sum + Number(item.mortgage || 0), 0);
  const sharesValue = state.shares.reduce((sum, item) => sum + Number(item.units || 0) * Number(item.currentPrice || 0), 0);
  const superValue = state.superMembers.reduce((sum, item) => sum + Number(item.balance || 0), 0);
  const assetByType = Object.fromEntries(ASSET_TYPES.map(([type]) => [type, 0]));
  state.assets.forEach(item => { assetByType[item.type] = (assetByType[item.type] || 0) + Number(item.value || 0); });
  const standaloneLoans = state.loans.reduce((sum, item) => sum + Number(item.balance || 0), 0);
  const grossAssets = propertyValue + sharesValue + superValue + Object.values(assetByType).reduce((a, b) => a + b, 0);
  const liabilities = mortgages + standaloneLoans;
  const netWorth = grossAssets - liabilities;
  const monthlyIncome = state.income.reduce((sum, item) => sum + Number(item.monthlyNet || 0), 0);
  const expenses = state.txns.filter(item => item.amount < 0 && !["Transfer", "Income"].includes(item.category));
  const expenseMonths = [...new Set(expenses.map(item => item.date?.slice(0, 7)).filter(Boolean))];
  const totalExpenses = expenses.reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const monthlyExpenses = expenseMonths.length ? totalExpenses / expenseMonths.length : null;
  const surplus = monthlyExpenses === null ? null : monthlyIncome - monthlyExpenses;
  const savingsRate = surplus === null || monthlyIncome <= 0 ? null : surplus / monthlyIncome * 100;
  const emergencyMonths = monthlyExpenses && monthlyExpenses > 0 ? (assetByType.cash || 0) / monthlyExpenses : null;
  const categories = [
    { key: "property", label: "Property", value: propertyValue }, { key: "super", label: "Super", value: superValue },
    { key: "shares", label: "Shares", value: sharesValue }, { key: "cash", label: "Cash & savings", value: assetByType.cash || 0 },
    { key: "vehicle", label: "Cars & vehicles", value: assetByType.vehicle || 0 }, { key: "gold", label: "Gold", value: assetByType.gold || 0 },
    { key: "commodity", label: "Other commodities", value: assetByType.commodity || 0 }, { key: "other", label: "Other assets", value: assetByType.other || 0 }
  ];
  return { propertyValue, mortgages, sharesValue, superValue, grossAssets, liabilities, netWorth, monthlyIncome, monthlyExpenses, surplus, savingsRate, emergencyMonths, categories };
}

function render() { applyTheme(); renderStatus(); renderSummary(); renderWealth(); renderProperties(); renderShares(); renderSuper(); renderOtherAssets(); renderLoans(); renderIncome(); renderTransactions(); updateSavedCopy(); }
function renderStatus() { const badge = $("#data-status"); badge.textContent = state.isDemo ? "Demo data" : state.txns.length ? "Imported + manual" : "Manual data"; badge.classList.toggle("ready", !state.isDemo); $("#demo-notice").classList.toggle("hidden", !state.isDemo); $("#clear-import-button").classList.toggle("hidden", !state.txns.length); }
function renderSummary() {
  const m = calculations();
  const cards = [
    { label: "Net worth", value: shortMoney(m.netWorth), detail: "Assets minus liabilities", tone: "net" },
    { label: "Monthly surplus", value: m.surplus === null ? "Not ready" : money(m.surplus), detail: m.surplus === null ? "Import a statement" : "Based on imported months", tone: m.surplus === null ? "info" : m.surplus >= 0 ? "good" : "warn" },
    { label: "Savings rate", value: m.savingsRate === null ? "Not ready" : `${m.savingsRate.toFixed(1)}%`, detail: m.savingsRate === null ? "Needs income and expenses" : "Net income after spending", tone: m.savingsRate !== null && m.savingsRate >= 15 ? "good" : "warn" },
    { label: "Cash runway", value: m.emergencyMonths === null ? "Not ready" : `${m.emergencyMonths.toFixed(1)} mo`, detail: m.emergencyMonths === null ? "Add cash and expenses" : "Cash ÷ monthly spending", tone: m.emergencyMonths !== null && m.emergencyMonths >= 3 ? "good" : "info" }
  ];
  $("#signal-cards").innerHTML = cards.map(card => `<article class="signal-card ${card.tone}"><span>${card.label}</span><strong>${card.value}</strong><small>${card.detail}</small></article>`).join("");
}
function renderWealth() {
  const m = calculations();
  $("#net-worth-centre").textContent = shortMoney(m.netWorth); $("#gross-assets").textContent = shortMoney(m.grossAssets); $("#total-liabilities").textContent = shortMoney(m.liabilities);
  $("#wealth-legend").innerHTML = m.categories.map(item => { const pct = m.grossAssets > 0 ? item.value / m.grossAssets * 100 : 0; return `<div class="legend-row"><span class="legend-dot" style="background:${WEALTH_COLOURS[item.key]}"></span><span>${item.label}</span><strong>${shortMoney(item.value)} · ${pct.toFixed(1)}%</strong></div>`; }).join("");
  const chart = $("#wealth-chart"); const debtRing = $("#liability-ring");
  chart.style.background = conicGradient(m.categories.map(item => item.value), m.categories.map(item => WEALTH_COLOURS[item.key]), m.grossAssets);
  const debtShare = m.grossAssets > 0 ? Math.min(Math.max(m.liabilities / m.grossAssets * 100, 0), 100) : 0;
  debtRing.style.background = `conic-gradient(#A12424 0 ${debtShare}%, var(--border-soft) ${debtShare}% 100%)`;
  chart.setAttribute("aria-label", `Gross assets ${money(m.grossAssets)}. Liabilities ${money(m.liabilities)}. Net worth ${money(m.netWorth)}.`);
}
function conicGradient(values, colours, total) {
  if (!total) return "var(--border-soft)"; let start = 0; const stops = [];
  values.forEach((value, index) => { if (value <= 0) return; const end = start + value / total * 100; stops.push(`${colours[index]} ${start}% ${end}%`); start = end; });
  return `conic-gradient(${stops.join(", ") || "var(--border-soft) 0 100%"})`;
}

function input(collection, id, field, value, label, type = "text", step = "any", className = "") { return `<input class="cell-input ${type === "number" ? "number" : ""} ${className}" aria-label="${esc(label)}" data-collection="${collection}" data-id="${id}" data-field="${field}" data-value-type="${type}" type="${type}" step="${step}" value="${esc(value)}">`; }
function select(collection, id, field, value, label, options) { return `<select class="cell-select" aria-label="${esc(label)}" data-collection="${collection}" data-id="${id}" data-field="${field}">${options.map(([key, text]) => `<option value="${key}"${key === value ? " selected" : ""}>${text}</option>`).join("")}</select>`; }
function deleteButton(collection, id, name) { return `<button class="delete-button" type="button" data-delete="${collection}" data-id="${id}" data-name="${esc(name)}" aria-label="Delete ${esc(name)}" title="Delete ${esc(name)}">×</button>`; }
function cell(label, content, className = "") { return `<td data-label="${esc(label)}" class="${className}">${content}</td>`; }
function table(headers, rows, emptyText, hasActions = true) { return `<div class="table-wrap"><table><thead><tr>${headers.map(header => `<th>${header}</th>`).join("")}${hasActions ? '<th><span class="visually-hidden">Actions</span></th>' : ""}</tr></thead><tbody>${rows.length ? rows.join("") : `<tr><td colspan="${headers.length + (hasActions ? 1 : 0)}" class="empty-row">${emptyText}</td></tr>`}</tbody></table></div>`; }
function metrics(items) { return `<div class="metric-strip">${items.map(item => `<div class="metric"><span>${item[0]}</span><strong>${item[1]}</strong></div>`).join("")}</div>`; }
function blockHeading(title, subtitle, metricItems, action, actionLabel) { return `<div class="block-heading"><div><h3>${title}</h3><p>${subtitle}</p></div>${metrics(metricItems)}<button class="button secondary" type="button" data-add="${action}">${actionLabel}</button></div>`; }

function renderProperties() {
  const totalValue = state.properties.reduce((sum, p) => sum + Number(p.value || 0), 0); const totalDebt = state.properties.reduce((sum, p) => sum + Number(p.mortgage || 0), 0);
  const rows = state.properties.map(p => { const equity = Number(p.value || 0) - Number(p.mortgage || 0); const lvr = p.value ? Number(p.mortgage || 0) / Number(p.value) * 100 : 0; return `<tr>${cell("Property", input("properties", p.id, "name", p.name, "Property name", "text", "any", "name"))}${cell("Type", select("properties", p.id, "type", p.type, "Property type", [["Home", "Home"], ["Investment", "Investment"]]))}${cell("Value", input("properties", p.id, "value", p.value, `${p.name} value`, "number", "1000"))}${cell("Mortgage", input("properties", p.id, "mortgage", p.mortgage, `${p.name} mortgage`, "number", "1000"))}${cell("Equity", `<strong>${shortMoney(equity)}</strong>`)}${cell("LVR", `${lvr.toFixed(1)}%`)}${cell("Rate", input("properties", p.id, "rate", p.rate, `${p.name} interest rate`, "number", ".01"))}${cell("Rent / week", input("properties", p.id, "weeklyRent", p.weeklyRent, `${p.name} weekly rent`, "number", "10"))}${cell("Annual costs", input("properties", p.id, "annualCosts", p.annualCosts, `${p.name} annual costs`, "number", "100"))}${cell("As at", input("properties", p.id, "asAt", p.asAt || today(), `${p.name} valuation date`, "date"))}${cell("", deleteButton("properties", p.id, p.name), "action-cell")}</tr>`; });
  $("#property-block").innerHTML = blockHeading("Property", "Home and investment property", [["Value", shortMoney(totalValue)], ["Equity", shortMoney(totalValue - totalDebt)], ["Debt", shortMoney(totalDebt)]], "properties", "Add property") + table(["Property", "Type", "Value", "Mortgage", "Equity", "LVR", "Rate %", "Rent / week", "Annual costs", "As at"], rows, "No property added yet.");
}
function renderShares() {
  const totalValue = state.shares.reduce((sum, s) => sum + Number(s.units || 0) * Number(s.currentPrice || 0), 0); const totalCost = state.shares.reduce((sum, s) => sum + Number(s.units || 0) * Number(s.averagePrice || 0), 0);
  const rows = state.shares.map(s => { const value = Number(s.units || 0) * Number(s.currentPrice || 0); return `<tr>${cell("Ticker", input("shares", s.id, "ticker", s.ticker, "Share ticker", "text", "any", "name"))}${cell("Name", input("shares", s.id, "name", s.name, "Share name", "text", "any", "name"))}${cell("Units", input("shares", s.id, "units", s.units, `${s.ticker} units`, "number", ".0001"))}${cell("Average price", input("shares", s.id, "averagePrice", s.averagePrice, `${s.ticker} average price`, "number", ".01"))}${cell("Current price", input("shares", s.id, "currentPrice", s.currentPrice, `${s.ticker} current price`, "number", ".01"))}${cell("Value", `<strong>${shortMoney(value)}</strong>`)}${cell("Return", `<strong>${shortMoney(value - Number(s.units || 0) * Number(s.averagePrice || 0))}</strong>`)}${cell("As at", input("shares", s.id, "asAt", s.asAt || today(), `${s.ticker} price date`, "date"))}${cell("", deleteButton("shares", s.id, s.ticker || "holding"), "action-cell")}</tr>`; });
  $("#shares-block").innerHTML = blockHeading("Shares", "Listed shares, ETFs and managed funds", [["Value", shortMoney(totalValue)], ["Return", shortMoney(totalValue - totalCost)]], "shares", "Add holding") + table(["Ticker", "Name", "Units", "Average price", "Current price", "Value", "Return", "As at"], rows, "No shares added yet.");
}
function renderSuper() {
  const total = state.superMembers.reduce((sum, s) => sum + Number(s.balance || 0), 0);
  const rows = state.superMembers.map(s => `<tr>${cell("Member", input("superMembers", s.id, "name", s.name, "Super member", "text", "any", "name"))}${cell("Fund", select("superMembers", s.id, "fund", s.fund, `${s.name} fund type`, [["Industry", "Industry"], ["Retail", "Retail"], ["SMSF", "SMSF"], ["Other", "Other"]]))}${cell("Balance", input("superMembers", s.id, "balance", s.balance, `${s.name} super balance`, "number", "100"))}${cell("As at", input("superMembers", s.id, "asAt", s.asAt || today(), `${s.name} super date`, "date"))}${cell("", deleteButton("superMembers", s.id, s.name), "action-cell")}</tr>`);
  $("#super-block").innerHTML = blockHeading("Super", "Current balances, not projected values", [["Total", shortMoney(total)]], "superMembers", "Add member") + table(["Member", "Fund", "Balance", "As at"], rows, "No super balances added yet.");
}
function renderOtherAssets() {
  const total = state.assets.reduce((sum, a) => sum + Number(a.value || 0), 0);
  const rows = state.assets.map(a => `<tr>${cell("Asset", input("assets", a.id, "name", a.name, "Asset name", "text", "any", "name"))}${cell("Category", select("assets", a.id, "type", a.type, `${a.name} category`, ASSET_TYPES))}${cell("Value", input("assets", a.id, "value", a.value, `${a.name} value`, "number", "100"))}${cell("As at", input("assets", a.id, "asAt", a.asAt || today(), `${a.name} valuation date`, "date"))}${cell("", deleteButton("assets", a.id, a.name), "action-cell")}</tr>`);
  $("#other-assets-block").innerHTML = blockHeading("Other assets", "Cash, cars, gold, commodities and anything else that counts", [["Total", shortMoney(total)]], "assets", "Add asset") + table(["Asset", "Category", "Value", "As at"], rows, "No other assets added yet.");
}
function renderLoans() {
  const total = state.loans.reduce((sum, l) => sum + Number(l.balance || 0), 0);
  const rows = state.loans.map(l => `<tr>${cell("Loan", input("loans", l.id, "name", l.name, "Loan name", "text", "any", "name"))}${cell("Type", select("loans", l.id, "type", l.type, `${l.name} type`, [["Personal", "Personal loan"], ["Vehicle", "Vehicle finance"], ["Credit", "Credit card"], ["Other", "Other"]]))}${cell("Balance", input("loans", l.id, "balance", l.balance, `${l.name} balance`, "number", "100"))}${cell("Rate", input("loans", l.id, "rate", l.rate, `${l.name} interest rate`, "number", ".01"))}${cell("As at", input("loans", l.id, "asAt", l.asAt || today(), `${l.name} balance date`, "date"))}${cell("", deleteButton("loans", l.id, l.name), "action-cell")}</tr>`);
  $("#loans-block").innerHTML = blockHeading("Other loans", "Mortgages are already captured under property", [["Balance", shortMoney(total)]], "loans", "Add loan") + table(["Loan", "Type", "Balance", "Rate %", "As at"], rows, "No other loans added yet.");
}
function renderIncome() {
  const total = state.income.reduce((sum, item) => sum + Number(item.monthlyNet || 0), 0);
  const rows = state.income.map(item => `<tr>${cell("Income", input("income", item.id, "name", item.name, "Income name", "text", "any", "name"))}${cell("Monthly net", input("income", item.id, "monthlyNet", item.monthlyNet, `${item.name} monthly net income`, "number", "100"))}${cell("", deleteButton("income", item.id, item.name), "action-cell")}</tr>`);
  $("#income-block").innerHTML = blockHeading("Income", "Monthly take-home income used for surplus and savings rate", [["Monthly net", shortMoney(total)]], "income", "Add income") + table(["Income", "Monthly net"], rows, "No income added yet.");
}

function renderTransactions() {
  const section = $("#transactions-section"); section.classList.toggle("hidden", !state.txns.length);
  if (!state.txns.length) return;
  const mode = $("#transaction-filter")?.value || "all"; const filtered = state.txns.filter(t => mode === "all" || (mode === "expenses" ? t.amount < 0 : t.amount >= 0));
  $("#transactions-summary").textContent = `${state.txns.length.toLocaleString()} transactions from ${state.imports.length} file${state.imports.length === 1 ? "" : "s"}. Showing ${Math.min(filtered.length, 150)}.`;
  const rows = filtered.slice(0, 150).map(t => `<tr>${cell("Date", esc(t.date || "Unknown"))}${cell("Description", `<span class="transaction-description" title="${esc(t.description)}">${esc(t.description)}</span>`)}${cell("Amount", `<strong>${money(t.amount)}</strong>`)}${cell("Category", select("txns", t.id, "category", t.category, `${t.description} category`, CATEGORIES.map(c => [c, c])))}${cell("Source", esc(t.source || "Import"))}${cell("", deleteButton("txns", t.id, t.description), "action-cell")}</tr>`);
  $("#transactions-table").innerHTML = table(["Date", "Description", "Amount", "Category", "Source"], rows, "No transactions match this filter."); renderExpenseChart();
}
function renderExpenseChart() {
  const byCategory = {}; state.txns.filter(t => t.amount < 0 && !["Transfer", "Income"].includes(t.category)).forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + Math.abs(t.amount); });
  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 8); requestAnimationFrame(() => drawExpenseChart(entries));
}
function drawExpenseChart(entries) {
  const canvas = $("#expense-chart"); if (!canvas) return; const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return; const ratio = Math.min(devicePixelRatio || 1, 2); canvas.width = rect.width * ratio; canvas.height = rect.height * ratio; const context = canvas.getContext("2d"); context.scale(ratio, ratio); context.font = "12px system-ui, sans-serif"; context.textBaseline = "middle"; const max = Math.max(...entries.map(entry => entry[1]), 1); const labelWidth = Math.min(120, rect.width * .34); const chartWidth = rect.width - labelWidth - 62; const rowHeight = rect.height / Math.max(entries.length, 1);
  context.clearRect(0, 0, rect.width, rect.height); entries.forEach(([label, value], index) => { const y = index * rowHeight + rowHeight / 2; context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--muted").trim(); context.textAlign = "left"; context.fillText(label.length > 18 ? `${label.slice(0, 17)}…` : label, 0, y); context.fillStyle = "#A92F22"; context.fillRect(labelWidth, y - 9, Math.max(2, chartWidth * value / max), 18); context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim(); context.fillText(shortMoney(value), labelWidth + chartWidth * value / max + 7, y); });
}
function applyTheme() { const resolved = state.theme === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : state.theme; document.documentElement.dataset.theme = resolved; $("#theme-button").title = `Theme: ${state.theme}. Click to change.`; $("#theme-button").setAttribute("aria-label", `Theme is ${state.theme}. Change colour theme.`); }

function markReal() { if (state.isDemo) state.isDemo = false; }
function updateField(element) { const collection = element.dataset.collection; const item = state[collection]?.find(entry => String(entry.id) === element.dataset.id); if (!item) return; item[element.dataset.field] = element.dataset.valueType === "number" ? parseNumber(element.value) : element.value; markReal(); scheduleSave(); render(); }
function addItem(collection) {
  const templates = {
    properties: { id: uid(), name: "New property", type: "Investment", value: 0, mortgage: 0, rate: 0, weeklyRent: 0, annualCosts: 0, asAt: today() },
    shares: { id: uid(), ticker: "NEW", name: "New holding", units: 0, averagePrice: 0, currentPrice: 0, asAt: today() },
    superMembers: { id: uid(), name: "New member", fund: "Industry", balance: 0, asAt: today() },
    assets: { id: uid(), name: "New asset", type: "vehicle", value: 0, asAt: today() },
    loans: { id: uid(), name: "New loan", type: "Personal", balance: 0, rate: 0, asAt: today() },
    income: { id: uid(), name: "New income", monthlyNet: 0 }
  };
  state[collection].push(templates[collection]); markReal(); scheduleSave(); render();
}
function deleteItem(collection, id, name) { if (!confirm(`Delete ${name}? This can’t be undone.`)) return; state[collection] = state[collection].filter(item => String(item.id) !== id); markReal(); scheduleSave(); render(); }

function categorise(description, amount) {
  if (amount > 0) return "Income"; const text = description.toLowerCase();
  if (/coles|woolworth|aldi|iga|grocer|fruit|market/.test(text)) return "Groceries";
  if (/uber eat|menulog|doordash|cafe|coffee|restaurant|dining|pizza|sushi|bar\b|pub\b/.test(text)) return "Dining out";
  if (/netflix|spotify|disney|subscription|stan\b|binge|kayo/.test(text)) return "Subscriptions";
  if (/petrol|fuel|bp\b|shell|caltex|ampol|uber\b|taxi|parking|rego|toll|myki|ptv/.test(text)) return "Transport";
  if (/electric|gas bill|water|internet|telstra|optus|vodafone|energy|agl|origin|nbn/.test(text)) return "Utilities";
  if (/medibank|bupa|doctor|pharmacy|chemist|dental|physio|medical|health|hospital/.test(text)) return "Healthcare";
  if (/insurance|allianz|suncorp|qbe|racv|nrma|youi/.test(text)) return "Insurance";
  if (/school|tuition|childcare|kindy|daycare|education|university|tafe/.test(text)) return "Education";
  if (/mortgage|home loan|rent\b|body corp|strata|council rate/.test(text)) return "Housing";
  if (/target|kmart|big w|jb hi|bunnings|harvey|clothing|shoe|fashion|amazon/.test(text)) return "Shopping";
  if (/gym|sport|fitness|swim|ticket|cinema|concert|event/.test(text)) return "Entertainment";
  if (/transfer|xfer|trf/.test(text)) return "Transfer";
  if (/atm|cash|withdraw/.test(text)) return "Cash/ATM";
  return "Other";
}
function findHeader(rows) { const patterns = /date|description|narration|details|particular|payee|amount|debit|credit|withdrawal|deposit/i; let bestIndex = 0; let bestScore = -1; rows.slice(0, 20).forEach((row, index) => { const score = row.filter(cellValue => patterns.test(String(cellValue))).length; if (score > bestScore) { bestIndex = index; bestScore = score; } }); return bestIndex; }
function rowsToTransactions(rows, source) {
  const headerIndex = findHeader(rows); const headers = rows[headerIndex].map(value => String(value).trim().toLowerCase()); const indexOf = regex => headers.findIndex(value => regex.test(value));
  const dateIndex = indexOf(/date/); let descriptionIndex = indexOf(/desc|narr|memo|particular|detail|reference|payee/); const amountIndex = indexOf(/^amount$|transaction amount|value/); const debitIndex = indexOf(/debit|withdrawal|money out/); const creditIndex = indexOf(/credit|deposit|money in/); const categoryIndex = indexOf(/^category$|^type$/); if (descriptionIndex < 0) descriptionIndex = headers.length > 1 ? 1 : 0;
  return rows.slice(headerIndex + 1).flatMap(row => { if (!row || !row.some(cellValue => String(cellValue).trim())) return []; let amount = amountIndex >= 0 ? parseNumber(row[amountIndex]) : 0; if (amountIndex < 0) { const debit = debitIndex >= 0 ? Math.abs(parseNumber(row[debitIndex])) : 0; const credit = creditIndex >= 0 ? Math.abs(parseNumber(row[creditIndex])) : 0; amount = credit || (debit ? -debit : 0); } if (!amount) return []; const description = String(row[descriptionIndex] || "Transaction").trim(); const date = dateIndex >= 0 ? validDate(row[dateIndex]) : null; return [{ id: uid(), date, description, amount, category: categoryIndex >= 0 && row[categoryIndex] ? String(row[categoryIndex]).trim() : categorise(description, amount), source }]; });
}
function parseCsv(text, source) {
  const rows = []; let row = []; let value = ""; let quoted = false; const inputText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let index = 0; index < inputText.length; index += 1) { const char = inputText[index]; if (quoted) { if (char === '"' && inputText[index + 1] === '"') { value += '"'; index += 1; } else if (char === '"') quoted = false; else value += char; } else if (char === '"') quoted = true; else if (char === ",") { row.push(value); value = ""; } else if (char === "\n") { row.push(value); rows.push(row); row = []; value = ""; } else value += char; }
  row.push(value); rows.push(row); return rowsToTransactions(rows, source);
}
async function parseSpreadsheet(file) { if (!window.XLSX) throw new Error("The Excel reader did not load. Check your connection and try again."); const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true }); return workbook.SheetNames.flatMap(name => rowsToTransactions(XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: "", raw: false }), `${file.name} · ${name}`)); }
async function pdfLines(file) {
  if (!window.pdfjsLib) throw new Error("The PDF reader did not load. Refresh and try again."); pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js"; const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise; const lines = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) { const page = await pdf.getPage(pageNumber); const content = await page.getTextContent(); const groups = new Map(); content.items.forEach(item => { const y = Math.round(item.transform[5] / 3) * 3; if (!groups.has(y)) groups.set(y, []); groups.get(y).push({ x: item.transform[4], text: item.str }); }); [...groups.entries()].sort((a, b) => b[0] - a[0]).forEach(([, items]) => lines.push(items.sort((a, b) => a.x - b.x).map(item => item.text).join(" ").replace(/\s+/g, " ").trim())); }
  return lines;
}
async function parsePdf(file) {
  const lines = await pdfLines(file); const transactions = [];
  lines.forEach(line => { const dateMatch = line.match(/^(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s+/); if (!dateMatch) return; const tokens = [...line.matchAll(/(?:\$\s*)?-?\(?\d[\d,]*\.\d{2}\)?/g)]; if (!tokens.length) return; const amountToken = tokens.length > 1 ? tokens[tokens.length - 2] : tokens[0]; let amount = parseNumber(amountToken[0]); const context = line.toLowerCase(); if (/\b(debit|withdrawal|purchase|payment|dr)\b/.test(context) && amount > 0) amount *= -1; const description = line.slice(dateMatch[0].length, amountToken.index).trim() || "PDF transaction"; if (amount) transactions.push({ id: uid(), date: validDate(dateMatch[1]), description, amount, category: categorise(description, amount), source: file.name }); });
  if (!transactions.length) throw new Error("No transaction rows were detected. This may be a scanned PDF or an unfamiliar statement layout. Export CSV/XLSX, or use a text-based PDF."); return transactions;
}
async function readFiles(files) {
  const results = []; const failures = [];
  for (const file of files) { try { const extension = file.name.split(".").pop().toLowerCase(); let transactions; if (extension === "csv") transactions = parseCsv(await file.text(), file.name); else if (["xlsx", "xls"].includes(extension)) transactions = await parseSpreadsheet(file); else if (extension === "pdf") transactions = await parsePdf(file); else throw new Error("Unsupported file type."); if (!transactions.length) throw new Error("No usable transactions were found."); results.push(...transactions); } catch (error) { failures.push(`${file.name}: ${error.message}`); } }
  pendingImport = { files: [...files].map(file => file.name), transactions: results, failures }; showImportReview();
}
function showImportReview() {
  const { transactions, failures, files } = pendingImport; const dated = transactions.filter(t => t.date).sort((a, b) => a.date.localeCompare(b.date)); const range = dated.length ? `${dated[0].date} to ${dated[dated.length - 1].date}` : "Dates need review"; const message = $("#import-message"); message.className = `import-message${!transactions.length ? " error" : ""}`;
  message.innerHTML = transactions.length ? `<strong>${transactions.length.toLocaleString()} transactions detected</strong> from ${files.length} file${files.length === 1 ? "" : "s"} · ${range}${failures.length ? `<br><span>${esc(failures.join(" "))}</span>` : ""}` : `<strong>Nothing ready to import.</strong><br>${esc(failures.join(" "))}`;
  const rows = transactions.slice(0, 20).map(t => `<tr>${cell("Date", esc(t.date || "Unknown"))}${cell("Description", esc(t.description))}${cell("Amount", money(t.amount))}${cell("Category", esc(t.category))}</tr>`); $("#import-preview").innerHTML = table(["Date", "Description", "Amount", "Category"], rows, "No transactions detected.", false); $("#confirm-import-button").disabled = !transactions.length; $("#import-dialog").showModal();
}
function refreshImportPreview() {
  if (!pendingImport) return; const reverse = $("#sign-mode").value === "reverse";
  const rows = pendingImport.transactions.slice(0, 20).map(t => { const amount = reverse ? -t.amount : t.amount; return `<tr>${cell("Date", esc(t.date || "Unknown"))}${cell("Description", esc(t.description))}${cell("Amount", money(amount))}${cell("Category", esc(categorise(t.description, amount)))}</tr>`; });
  $("#import-preview").innerHTML = table(["Date", "Description", "Amount", "Category"], rows, "No transactions detected.", false);
}
function transactionKey(t) { return `${t.date || ""}|${t.description.trim().toLowerCase()}|${Number(t.amount).toFixed(2)}`; }
function confirmImport(event) {
  event.preventDefault(); if (!pendingImport?.transactions.length) return; const mode = $("#import-mode").value; const reverse = $("#sign-mode").value === "reverse"; let next = pendingImport.transactions.map(item => { const amount = reverse ? -item.amount : item.amount; return { ...item, amount, category: categorise(item.description, amount) }; }); let skipped = 0;
  if (mode === "merge") { const existing = new Set(state.txns.map(transactionKey)); next = pendingImport.transactions.filter(item => { const duplicate = existing.has(transactionKey(item)); if (duplicate) skipped += 1; return !duplicate; }); state.txns.push(...next); } else state.txns = next;
  state.imports = mode === "replace" ? pendingImport.files : [...new Set([...state.imports, ...pendingImport.files])]; markReal(); persist(false); $("#import-dialog").close(); pendingImport = null; render(); toast(`${next.length.toLocaleString()} transactions imported${skipped ? `; ${skipped} duplicates skipped` : ""}.`);
}

function downloadBackup() { const blob = new Blob([JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `my-money-backup-${today()}.json`; link.click(); URL.revokeObjectURL(link.href); }
async function restoreBackup(file) { try { const restored = normaliseState(JSON.parse(await file.text())); if (!Array.isArray(restored.properties) || !Array.isArray(restored.txns)) throw new Error("Invalid backup"); if (!confirm("Replace the data on this device with this backup?")) return; state = restored; state.isDemo = false; persist(false); render(); toast("Backup restored."); } catch { toast("That backup could not be read.", true); } }
function clearImports() { if (!confirm("Clear all imported transactions? Your manually entered assets will stay.")) return; state.txns = []; state.imports = []; persist(false); render(); toast("Imported transactions cleared."); }
function startFresh() { if (!confirm("Remove the fictional example and start with an empty dashboard?")) return; const theme = state.theme; state = { ...demoState(), theme, isDemo: false, properties: [], shares: [], superMembers: [], assets: [], income: [], loans: [], txns: [], imports: [] }; persist(false); render(); toast("Fresh dashboard ready."); }
function resetAll() { if (!confirm("Erase all My Money data stored in this browser? Download a backup first if you may need it.")) return; localStorage.removeItem(STORAGE_KEY); state = demoState(); render(); toast("Local data erased. The small demo is back."); }

document.addEventListener("change", event => { if (event.target.matches("[data-collection]")) updateField(event.target); });
document.addEventListener("click", event => { const add = event.target.closest("[data-add]"); if (add) return addItem(add.dataset.add); const del = event.target.closest("[data-delete]"); if (del) return deleteItem(del.dataset.delete, del.dataset.id, del.dataset.name); const scroll = event.target.closest("[data-scroll-to]"); if (scroll) $("#" + scroll.dataset.scrollTo)?.scrollIntoView({ behavior: "smooth" }); });
$("#choose-file-button").addEventListener("click", () => $("#file-input").click());
$("#file-input").addEventListener("change", event => { if (event.target.files.length) readFiles(event.target.files); event.target.value = ""; });
$("#import-form").addEventListener("submit", confirmImport);
$("#sign-mode").addEventListener("change", refreshImportPreview);
$("#clear-import-button").addEventListener("click", clearImports);
$("#clear-demo-button").addEventListener("click", startFresh);
$("#save-button").addEventListener("click", () => persist(true));
$("#download-backup-button").addEventListener("click", downloadBackup);
$("#restore-backup-button").addEventListener("click", () => $("#backup-input").click());
$("#backup-input").addEventListener("change", event => { if (event.target.files[0]) restoreBackup(event.target.files[0]); event.target.value = ""; });
$("#reset-button").addEventListener("click", resetAll);
$("#transaction-filter").addEventListener("change", renderTransactions);
$("#theme-button").addEventListener("click", () => { state.theme = state.theme === "system" ? "light" : state.theme === "light" ? "dark" : "system"; persist(false); render(); toast(`Theme: ${state.theme}.`); });
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { if (state.theme === "system") render(); });
render();
