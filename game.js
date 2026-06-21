/* =========================================================
   WEYLAND-YUTANI // BIO-SPECIMEN HARVESTER
   Ein Alien-Universum Auto-Clicker
   ========================================================= */

"use strict";

/* ---------- Spieldaten ---------- */

// Auto-Produzenten: der Xenomorph-Lebenszyklus.
// baseCost = Startpreis, rate = Biomasse/Sek pro Einheit.
const GENERATORS = [
  { id: "facehugger", name: "Facehugger",            baseCost: 15,      rate: 0.1,     desc: "Klammert sich an Wirte. Sammelt passiv Biomasse." },
  { id: "burster",    name: "Chestburster",          baseCost: 110,     rate: 1,       desc: "Frisch geschlüpft. Wächst rasend schnell." },
  { id: "drone",      name: "Xenomorph-Drohne",      baseCost: 1200,    rate: 8,       desc: "Arbeiterkaste des Schwarms." },
  { id: "warrior",    name: "Xenomorph-Krieger",     baseCost: 13000,   rate: 47,      desc: "Aggressive Beschützer der Brut." },
  { id: "praetorian", name: "Praetorianer",          baseCost: 140000,  rate: 260,     desc: "Elite-Wache der Königin." },
  { id: "queen",      name: "Xenomorph-Königin",     baseCost: 1.6e6,   rate: 1400,    desc: "Legt Eier am laufenden Band." },
  { id: "hive",       name: "Hive-Cluster",          baseCost: 2.1e7,   rate: 7800,    desc: "Ganzer Nestkomplex aus Harz." },
  { id: "derelict",   name: "Derelict-Frachter",     baseCost: 3.3e8,   rate: 44000,   desc: "Abgestürztes Ei-Silo der Space Jockeys." },
  { id: "lv426",      name: "Kolonie LV-426",        baseCost: 5.1e9,   rate: 260000,  desc: "Hadley's Hope. Vollständig infiziert." },
  { id: "wy",         name: "W-Y Biowaffen-Sparte",  baseCost: 7.5e10,  rate: 1.6e6,   desc: "Industrielle Massenproduktion. Für die Firma." },
];

// Ausrüstung: einmalige Käufe, multiplizieren die Klickkraft.
const EQUIPMENT = [
  { id: "prod",    name: "Viehtreiber-Stab",       cost: 120,    mult: 2, desc: "Verdoppelt die Entnahme pro Klick." },
  { id: "tracker", name: "Bewegungsmelder M314",   cost: 2500,   mult: 2, desc: "Präzisere Entnahme. x2 Klickkraft." },
  { id: "pulse",   name: "M41A Pulsgewehr",        cost: 60000,  mult: 2, desc: "10mm explosiv. x2 Klickkraft." },
  { id: "loader",  name: "P-5000 Power-Loader",    cost: 1.2e6,  mult: 3, desc: "\"Get away from her, you bitch!\" x3 Klickkraft." },
  { id: "flamer",  name: "M240 Flammenwerfer",     cost: 3e7,    mult: 3, desc: "Nur sicher aus dem Orbit. x3 Klickkraft." },
  { id: "sentry",  name: "UA 571-C Geschützturm",  cost: 7e8,    mult: 4, desc: "Automatisierte Entnahme-Salven. x4 Klickkraft." },
];

const SAVE_KEY = "alienclicker-save-v1";
const BASE_CLICK = 1;

/* ---------- Spielzustand ---------- */

let state = {
  biomass: 0,
  totalBiomass: 0,
  totalClicks: 0,
  startTime: Date.now(),
  gens: {},     // id -> Anzahl
  equip: {},    // id -> true
};

GENERATORS.forEach(g => (state.gens[g.id] = 0));

/* ---------- Hilfsfunktionen ---------- */

const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
function fmt(n) {
  if (n < 1000) return Number.isInteger(n) ? n.toString() : n.toFixed(1);
  let tier = Math.floor(Math.log10(n) / 3);
  if (tier >= SUFFIXES.length) tier = SUFFIXES.length - 1;
  const scaled = n / Math.pow(1000, tier);
  return scaled.toFixed(scaled < 10 ? 2 : scaled < 100 ? 1 : 0) + SUFFIXES[tier];
}

// Preis eines Generators bei aktuellem Bestand (Cookie-Clicker-Skalierung 1.15^n).
function genCost(g) {
  return Math.ceil(g.baseCost * Math.pow(1.15, state.gens[g.id]));
}

function clickMultiplier() {
  let m = 1;
  EQUIPMENT.forEach(e => { if (state.equip[e.id]) m *= e.mult; });
  return m;
}
function clickPower() {
  return BASE_CLICK * clickMultiplier();
}

function perSecond() {
  return GENERATORS.reduce((sum, g) => sum + g.rate * state.gens[g.id], 0);
}

/* ---------- DOM-Referenzen ---------- */

const el = {
  biomass: document.getElementById("biomass"),
  rate: document.getElementById("rate"),
  clickPower: document.getElementById("clickPower"),
  eggBtn: document.getElementById("eggBtn"),
  genList: document.getElementById("genList"),
  equipList: document.getElementById("equipList"),
  log: document.getElementById("log"),
  stats: document.getElementById("stats"),
  savedHint: document.getElementById("savedHint"),
};

/* ---------- System-Log ---------- */

const LOG_FLAVOR = [
  "Probe stabil. Biomasse-Strom nominal.",
  "WARNUNG: Bewegung im Lüftungsschacht erkannt.",
  "Spezimen 6 zeigt erhöhte Aggression.",
  "Cryo-Kammern bei optimaler Temperatur.",
  "Direktive 937: Crew entbehrlich. Priorität Probe.",
  "Säure-Leck auf Deck C eingedämmt.",
  "Mutter: Analyse abgeschlossen.",
  "Quarantäne-Protokoll greift nicht. Ignoriere.",
  "Neue Eiablage in Sektor 7 registriert.",
  "Bishop meldet: Synthetik-Systeme stabil.",
];
let logCount = 0;
function logMsg(text, warn = false) {
  const line = document.createElement("div");
  line.className = "line" + (warn ? " warn" : "");
  const t = new Date();
  const ts = `${String(t.getHours()).padStart(2,"0")}:${String(t.getMinutes()).padStart(2,"0")}:${String(t.getSeconds()).padStart(2,"0")}`;
  line.innerHTML = `<span class="ts">[${ts}]</span> <span class="msg">${text}</span>`;
  el.log.appendChild(line);
  el.log.scrollTop = el.log.scrollHeight;
  while (el.log.childElementCount > 60) el.log.removeChild(el.log.firstChild);
}

/* ---------- Klick-Ernte ---------- */

el.eggBtn.addEventListener("click", (ev) => {
  const gain = clickPower();
  state.biomass += gain;
  state.totalBiomass += gain;
  state.totalClicks++;
  spawnFloat(ev.clientX, ev.clientY, "+" + fmt(gain));
  updateReadout();
});

function spawnFloat(x, y, text) {
  const f = document.createElement("div");
  f.className = "float-num";
  f.textContent = text;
  f.style.left = x + "px";
  f.style.top = y + "px";
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 900);
}

/* ---------- Kaufen ---------- */

function buyGen(g) {
  const cost = genCost(g);
  if (state.biomass < cost) return;
  state.biomass -= cost;
  state.gens[g.id]++;
  if (state.gens[g.id] === 1) logMsg(`${g.name} aktiviert. Erste Einheit online.`);
  renderShop();
  updateReadout();
}

function buyEquip(e) {
  if (state.equip[e.id] || state.biomass < e.cost) return;
  state.biomass -= e.cost;
  state.equip[e.id] = true;
  logMsg(`Ausrüstung erworben: ${e.name}.`, true);
  renderShop();
  updateReadout();
}

/* ---------- Rendering ---------- */

function renderShop() {
  // Generatoren
  el.genList.innerHTML = "";
  GENERATORS.forEach((g, i) => {
    const cost = genCost(g);
    const unlocked = i === 0 || state.gens[GENERATORS[i - 1].id] > 0 || state.gens[g.id] > 0;
    if (!unlocked) return;
    const affordable = state.biomass >= cost;
    const item = document.createElement("div");
    item.className = "item" + (affordable ? "" : " locked");
    item.innerHTML = `
      <div class="item-name">${g.name}<span class="count">×${state.gens[g.id]}</span></div>
      <div class="item-rate">${fmt(g.rate)}/s pro Einheit · ${g.desc}</div>
      <div class="item-cost"><span class="cost-val">${fmt(cost)}</span><span class="cost-lbl">BIOMASSE</span></div>
    `;
    item.addEventListener("click", () => buyGen(g));
    el.genList.appendChild(item);
  });

  // Ausrüstung
  el.equipList.innerHTML = "";
  EQUIPMENT.forEach(e => {
    const bought = !!state.equip[e.id];
    const affordable = state.biomass >= e.cost;
    const item = document.createElement("div");
    item.className = "item" + (bought ? " maxed" : affordable ? "" : " locked");
    item.innerHTML = `
      <div class="item-name">${e.name}${bought ? ' <span class="count">[INSTALLIERT]</span>' : ""}</div>
      <div class="item-desc">${e.desc}</div>
      <div class="item-cost">${bought ? '<span class="cost-val">✓</span>' : `<span class="cost-val">${fmt(e.cost)}</span><span class="cost-lbl">BIOMASSE</span>`}</div>
    `;
    if (!bought) item.addEventListener("click", () => buyEquip(e));
    el.equipList.appendChild(item);
  });
}

function updateReadout() {
  el.biomass.textContent = fmt(Math.floor(state.biomass));
  el.rate.textContent = fmt(perSecond()) + " / SEK";
  el.clickPower.textContent = fmt(clickPower());
  // Erschwinglichkeit live togglen, ohne Shop neu zu bauen
  refreshAffordability();
}

let lastShopSignature = "";
function refreshAffordability() {
  // Nur Klassen aktualisieren (billig). Vollständiger Rebuild nur bei Bestandsänderung.
  const sig = GENERATORS.map(g => state.gens[g.id]).join(",") +
              "|" + EQUIPMENT.map(e => state.equip[e.id] ? 1 : 0).join(",");
  if (sig !== lastShopSignature) {
    renderShop();
    lastShopSignature = sig;
    return;
  }
  // Bestand unverändert -> nur Erschwinglichkeits-Klassen anpassen (billig).
  let gi = 0;
  GENERATORS.forEach((g, i) => {
    const unlocked = i === 0 || state.gens[GENERATORS[i - 1].id] > 0 || state.gens[g.id] > 0;
    if (!unlocked) return;
    const node = el.genList.children[gi++];
    if (!node) return;
    node.classList.toggle("locked", state.biomass < genCost(g));
  });
  EQUIPMENT.forEach((e, i) => {
    const node = el.equipList.children[i];
    if (!node || state.equip[e.id]) return;
    node.classList.toggle("locked", state.biomass < e.cost);
  });
}

function renderStats() {
  const playMs = Date.now() - state.startTime;
  const mins = Math.floor(playMs / 60000);
  const playStr = mins < 60 ? `${mins} Min` : `${Math.floor(mins/60)} Std ${mins%60} Min`;
  const totalGens = GENERATORS.reduce((s, g) => s + state.gens[g.id], 0);
  el.stats.innerHTML = `
    <div class="row"><span>Gesamt geerntet</span><b>${fmt(Math.floor(state.totalBiomass))}</b></div>
    <div class="row"><span>Entnahmen (Klicks)</span><b>${fmt(state.totalClicks)}</b></div>
    <div class="row"><span>Spezimen aktiv</span><b>${fmt(totalGens)}</b></div>
    <div class="row"><span>Klickkraft</span><b>×${fmt(clickMultiplier())}</b></div>
    <div class="row"><span>Laufzeit</span><b>${playStr}</b></div>
  `;
}

/* ---------- Game-Loop ---------- */

let lastTick = Date.now();
function tick() {
  const now = Date.now();
  const dt = (now - lastTick) / 1000;
  lastTick = now;
  const gain = perSecond() * dt;
  if (gain > 0) {
    state.biomass += gain;
    state.totalBiomass += gain;
  }
  updateReadout();
}
setInterval(tick, 100);
setInterval(renderStats, 500);

// Flavor-Log alle ~18s
setInterval(() => {
  const warn = LOG_FLAVOR[logCount % LOG_FLAVOR.length].startsWith("WARNUNG") ||
               LOG_FLAVOR[logCount % LOG_FLAVOR.length].startsWith("Direktive");
  logMsg(LOG_FLAVOR[logCount % LOG_FLAVOR.length], warn);
  logCount++;
}, 18000);

/* ---------- Speichern / Laden ---------- */

function save(showHint = false) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    if (showHint) {
      el.savedHint.textContent = "// Zustand in lokalem Speicher gesichert.";
      setTimeout(() => (el.savedHint.textContent = ""), 2500);
    }
  } catch (err) {
    el.savedHint.textContent = "// FEHLER: Speichern fehlgeschlagen.";
  }
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    state.biomass = data.biomass || 0;
    state.totalBiomass = data.totalBiomass || 0;
    state.totalClicks = data.totalClicks || 0;
    state.startTime = data.startTime || Date.now();
    GENERATORS.forEach(g => (state.gens[g.id] = (data.gens && data.gens[g.id]) || 0));
    state.equip = data.equip || {};

    // Offline-Fortschritt (gedeckelt auf 8 Std, halbe Rate)
    const offlineMs = Date.now() - (data._savedAt || Date.now());
    if (offlineMs > 10000) {
      const cappedSec = Math.min(offlineMs / 1000, 8 * 3600);
      const earned = perSecond() * cappedSec * 0.5;
      if (earned > 0) {
        state.biomass += earned;
        state.totalBiomass += earned;
        logMsg(`Reaktivierung nach Stillstand. Offline-Ertrag: ${fmt(Math.floor(earned))} Biomasse.`, true);
      }
    }
    return true;
  } catch (err) {
    return false;
  }
}

document.getElementById("saveBtn").addEventListener("click", () => save(true));

document.getElementById("resetBtn").addEventListener("click", () => {
  if (!confirm("PURGE-PROTOKOLL: Alle Probendaten unwiderruflich löschen?\nDie Firma wird das nicht gutheißen.")) return;
  localStorage.removeItem(SAVE_KEY);
  state = { biomass: 0, totalBiomass: 0, totalClicks: 0, startTime: Date.now(), gens: {}, equip: {} };
  GENERATORS.forEach(g => (state.gens[g.id] = 0));
  lastShopSignature = "";
  logMsg("PURGE ausgeführt. Anlage zurückgesetzt.", true);
  renderShop();
  updateReadout();
});

// Auto-Save alle 15s + beim Schließen (mit Zeitstempel für Offline-Ertrag)
function saveWithStamp(showHint) {
  state._savedAt = Date.now();
  save(showHint);
}
setInterval(() => saveWithStamp(false), 15000);
window.addEventListener("beforeunload", () => saveWithStamp(false));

// Tab-Umschaltung
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const which = tab.dataset.tab;
    el.genList.classList.toggle("hidden", which !== "gen");
    el.equipList.classList.toggle("hidden", which !== "equip");
  });
});

/* ---------- Start ---------- */

const loaded = load();
logMsg("WEYLAND-YUTANI Bio-Specimen Harvester gestartet.");
logMsg(loaded ? "Gespeicherte Probendaten wiederhergestellt." : "Keine Vordaten. Neue Anlage initialisiert.");
renderShop();
lastShopSignature = GENERATORS.map(g => state.gens[g.id]).join(",") + "|" + EQUIPMENT.map(e => state.equip[e.id] ? 1 : 0).join(",");
updateReadout();
renderStats();
