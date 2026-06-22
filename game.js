/* =========================================================
   DRAGON'S DEBT — Crew-Clicker im Alien-Universum
   Klicke das Brücken-Terminal für Credits, heuere Crew an,
   schalte Räume frei und tilge die Schiffsschulden.
   ========================================================= */
"use strict";

/* ---------- Spieldaten ---------- */

// Crew = Auto-Produzenten. Jede Figur bekommt einen eigenen Raum.
// Rollen/Reihenfolge gern anpassen.
// room = in welchem Raum des Deckplans die Figur läuft (siehe ROOMS).
// Zuordnung/Reihenfolge/Rollen gern anpassen.
const CREW = [
  { id: "mae",      name: "Mae",      role: "Maschinistin",            room: "engine",  baseCost: 15,    rate: 0.2,  desc: "Hält die Triebwerke am Laufen." },
  { id: "gustav",   name: "Gustav",   role: "Techniker",               room: "android", baseCost: 120,   rate: 1.5,  desc: "Wartet die Androiden." },
  { id: "silas",    name: "Silas",    role: "Pilot",                   room: "bridge",  baseCost: 1300,  rate: 9,    desc: "Fliegt den Frachter durchs Nichts." },
  { id: "scott",    name: "Scott",    role: "Sicherheitsoffizier",     room: "food",    baseCost: 14000, rate: 50,   desc: "Bewacht Fracht und Crew." },
  { id: "isabella", name: "Isabella", role: "Sanitäterin",             room: "medbay",  baseCost: 2e5,   rate: 300,  desc: "Hält die Crew am Leben." },
  { id: "julian",   name: "Julian",   role: "Captain",                 room: "muthur",  baseCost: 3e6,   rate: 1800, desc: "Trägt die Schulden — und die Verantwortung." },
];

// Räume des Deckplans. box = Lauf-Zone in % des Schiff-Bildes (l=links, t=oben, w=breite, h=höhe).
// Werte sind Schätzungen und werden am echten Bild feinjustiert.
const ROOMS = [
  { id: "medbay",  label: "KRANKENSTATION", box: { l: 9,  t: 13, w: 22, h: 22 } },
  { id: "bridge",  label: "BRÜCKE",         box: { l: 39, t: 15, w: 23, h: 19 } },
  { id: "food",    label: "FOOD STORAGE",   box: { l: 69, t: 13, w: 22, h: 22 } },
  { id: "engine",  label: "ENGINE ROOM",    box: { l: 9,  t: 55, w: 23, h: 30 } },
  { id: "muthur",  label: "MUTHUR",         box: { l: 39, t: 56, w: 23, h: 29 } },
  { id: "android", label: "ANDROID BAY",    box: { l: 69, t: 55, w: 22, h: 30 } },
];

// Systeme = einmalige Käufe, vervielfachen den Credit-Ertrag pro Klick.
const MODULES = [
  { id: "macro",   name: "Eingabe-Makro",       cost: 120,   mult: 2, icon: "⌨️", desc: "Verdoppelt Credits pro Terminal-Klick." },
  { id: "cpu",     name: "Ko-Prozessor",        cost: 2500,  mult: 2, icon: "🖥️", desc: "x2 Klick-Ertrag." },
  { id: "muthur",  name: "MU/TH/UR-Uplink",     cost: 60000, mult: 2, icon: "🤖", desc: "Direktzugriff auf den Bordcomputer. x2." },
  { id: "quantum", name: "Quanten-Terminal",    cost: 1.2e6, mult: 3, icon: "⚛️", desc: "x3 Klick-Ertrag." },
  { id: "neural",  name: "Neuronales Interface", cost: 3e7,  mult: 3, icon: "🧠", desc: "Gedankensteuerung. x3." },
  { id: "ai",      name: "KI-Automatisierung",  cost: 7e8,   mult: 4, icon: "🛰️", desc: "Vollautomatische Eingabe. x4." },
];

const SAVE_KEY = "dragonsdebt-save-v1";
const BASE_CLICK = 1;
const DEBT_TOTAL = 1e8; // Gesamtschuld in Credits, die getilgt werden muss

/* ---------- Spielzustand ---------- */

let state = {
  credits: 0,
  totalEarned: 0,
  totalClicks: 0,
  startTime: Date.now(),
  crew: {},     // id -> Anzahl
  modules: {},  // id -> true
};
CREW.forEach(c => (state.crew[c.id] = 0));

/* ---------- Hilfsfunktionen ---------- */

const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
function fmt(n) {
  if (n < 1000) return Number.isInteger(n) ? n.toString() : n.toFixed(1);
  let tier = Math.floor(Math.log10(n) / 3);
  if (tier >= SUFFIXES.length) tier = SUFFIXES.length - 1;
  const scaled = n / Math.pow(1000, tier);
  return scaled.toFixed(scaled < 10 ? 2 : scaled < 100 ? 1 : 0) + SUFFIXES[tier];
}

function crewCost(c) {
  return Math.ceil(c.baseCost * Math.pow(1.15, state.crew[c.id]));
}
function clickMultiplier() {
  let m = 1;
  MODULES.forEach(e => { if (state.modules[e.id]) m *= e.mult; });
  return m;
}
function clickPower() { return BASE_CLICK * clickMultiplier(); }
function perSecond() {
  return CREW.reduce((sum, c) => sum + c.rate * state.crew[c.id], 0);
}

/* ---------- DOM-Referenzen ---------- */

const el = {
  credits: document.getElementById("credits"),
  rate: document.getElementById("rate"),
  deck: document.getElementById("deck"),
  crewList: document.getElementById("crewList"),
  moduleList: document.getElementById("moduleList"),
  log: document.getElementById("log"),
  stats: document.getElementById("stats"),
  savedHint: document.getElementById("savedHint"),
  debtStage: document.getElementById("debtStage"),
  debtFill: document.getElementById("debtFill"),
  stageFlash: document.getElementById("stageFlash"),
};

/* ---------- Schiffs-Log ---------- */

const LOG_FLAVOR = [
  "Reaktor stabil. Lebenserhaltung nominal.",
  "MU/TH/UR: Kurskorrektur abgeschlossen.",
  "WARNUNG: Mikro-Riss in Hülle, Sektor 3.",
  "Frachtmanifest aktualisiert.",
  "Schuldenzins der Bank verbucht.",
  "Bewegungssensor: nichts Ungewöhnliches.",
  "Cryo-Kammern bereit für Langschlaf.",
  "Treibstoffreserven bei 87 %.",
  "Eingehende Nachricht von der Reederei: 'Zahlt eure Raten.'",
  "Hyperraum-Sprung in 12 Stunden geplant.",
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

/* ---------- Klick-Ertrag (Terminal) ---------- */

function spawnFloat(x, y, text) {
  const f = document.createElement("div");
  f.className = "float-num";
  f.textContent = text;
  f.style.left = x + "px";
  f.style.top = y + "px";
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 900);
}

// Klicks auf das Brücken-Terminal (per Delegation, da das Deck neu gerendert wird)
el.deck.addEventListener("click", (ev) => {
  const term = ev.target.closest(".terminal");
  if (!term) return;
  const gain = clickPower();
  state.credits += gain;
  state.totalEarned += gain;
  state.totalClicks++;
  spawnFloat(ev.clientX, ev.clientY, "+" + fmt(gain));
  term.classList.remove("ping"); void term.offsetWidth; term.classList.add("ping");
  updateReadout();
});

/* ---------- Kaufen ---------- */

function buyCrew(c) {
  const cost = crewCost(c);
  if (state.credits < cost) return;
  state.credits -= cost;
  state.crew[c.id]++;
  if (state.crew[c.id] === 1) logMsg(`${c.name} (${c.role}) angeheuert. An Bord.`, true);
  renderDeck();
  renderShop();
  updateReadout();
}

function buyModule(e) {
  if (state.modules[e.id] || state.credits < e.cost) return;
  state.credits -= e.cost;
  state.modules[e.id] = true;
  logMsg(`System installiert: ${e.name}.`);
  renderShop();
  updateReadout();
}

/* ---------- Deckplan (Räume + laufende Crew) ---------- */

function renderDeck() {
  el.deck.innerHTML = "";

  ROOMS.forEach(room => {
    const zone = document.createElement("div");
    zone.className = "region";
    zone.dataset.room = room.id;
    zone.style.left = room.box.l + "%";
    zone.style.top = room.box.t + "%";
    zone.style.width = room.box.w + "%";
    zone.style.height = room.box.h + "%";

    // Label (nur sichtbar im Fallback ohne Schiffsbild)
    zone.innerHTML = `<span class="region-label">${room.label}</span>`;

    // Crew, die in diesem Raum laufen
    CREW.filter(c => c.room === room.id && state.crew[c.id] > 0).forEach(c => {
      const n = Math.min(3, state.crew[c.id]);
      for (let i = 0; i < n; i++) {
        const r = document.createElement("div");
        r.className = "runner";
        r.dataset.id = c.id;
        r.innerHTML = `<img src="assets/crew/${c.id}.png" alt="${c.name}" draggable="false"
                        onerror="this.remove(); this.parentElement.classList.add('noimg')">`;
        zone.appendChild(r);
      }
    });

    // Terminal-Hotspot in der Brücke (Klick-Ziel)
    if (room.id === "bridge") {
      const term = document.createElement("button");
      term.className = "terminal";
      term.setAttribute("aria-label", "Terminal bedienen");
      term.innerHTML = `<span class="term-screen"></span>`;
      zone.appendChild(term);
    }

    el.deck.appendChild(zone);
  });
}

/* ---------- Shop ---------- */

function renderShop() {
  // Crew
  el.crewList.innerHTML = "";
  CREW.forEach((c, i) => {
    const cost = crewCost(c);
    const unlocked = i === 0 || state.crew[CREW[i - 1].id] > 0 || state.crew[c.id] > 0;
    if (!unlocked) return;
    const affordable = state.credits >= cost;
    const item = document.createElement("div");
    item.className = "item" + (affordable ? "" : " locked");
    item.innerHTML = `
      <div class="thumb"><span class="thumb-fallback">${c.name[0]}</span><img src="assets/crew/${c.id}.png" alt="" onerror="this.remove()"></div>
      <div class="item-info">
        <div class="item-name">${c.name}<span class="count">×${state.crew[c.id]}</span></div>
        <div class="item-rate">${c.role} · +${fmt(c.rate)} cr/s</div>
      </div>
      <div class="item-cost"><span class="cost-val">${fmt(cost)}</span><span class="cost-lbl">CREDITS</span></div>
    `;
    item.addEventListener("click", () => buyCrew(c));
    el.crewList.appendChild(item);
  });

  // Systeme
  el.moduleList.innerHTML = "";
  MODULES.forEach(e => {
    const bought = !!state.modules[e.id];
    const affordable = state.credits >= e.cost;
    const item = document.createElement("div");
    item.className = "item" + (bought ? " maxed" : affordable ? "" : " locked");
    item.innerHTML = `
      <div class="thumb"><span class="thumb-fallback">${e.icon}</span></div>
      <div class="item-info">
        <div class="item-name">${e.name}${bought ? ' <span class="count">[AKTIV]</span>' : ""}</div>
        <div class="item-desc">${e.desc}</div>
      </div>
      <div class="item-cost">${bought ? '<span class="cost-val">✓</span>' : `<span class="cost-val">${fmt(e.cost)}</span><span class="cost-lbl">CREDITS</span>`}</div>
    `;
    if (!bought) item.addEventListener("click", () => buyModule(e));
    el.moduleList.appendChild(item);
  });
}

function updateReadout() {
  el.credits.textContent = fmt(Math.floor(state.credits));
  el.rate.textContent = fmt(perSecond()) + " / SEK";
  const cp = document.getElementById("clickPower");
  if (cp) cp.textContent = fmt(clickPower());
  refreshAffordability();
}

let lastShopSignature = "";
function refreshAffordability() {
  const sig = CREW.map(c => state.crew[c.id]).join(",") + "|" + MODULES.map(e => state.modules[e.id] ? 1 : 0).join(",");
  if (sig !== lastShopSignature) { renderShop(); lastShopSignature = sig; return; }
  let gi = 0;
  CREW.forEach((c, i) => {
    const unlocked = i === 0 || state.crew[CREW[i - 1].id] > 0 || state.crew[c.id] > 0;
    if (!unlocked) return;
    const node = el.crewList.children[gi++];
    if (node) node.classList.toggle("locked", state.credits < crewCost(c));
  });
  MODULES.forEach((e, i) => {
    const node = el.moduleList.children[i];
    if (node && !state.modules[e.id]) node.classList.toggle("locked", state.credits < e.cost);
  });
}

function renderStats() {
  const playMs = Date.now() - state.startTime;
  const mins = Math.floor(playMs / 60000);
  const playStr = mins < 60 ? `${mins} Min` : `${Math.floor(mins/60)} Std ${mins%60} Min`;
  const crewAboard = CREW.reduce((s, c) => s + (state.crew[c.id] > 0 ? 1 : 0), 0);
  const open = Math.max(0, DEBT_TOTAL - state.totalEarned);
  el.stats.innerHTML = `
    <div class="row"><span>Credits gesamt</span><b>${fmt(Math.floor(state.totalEarned))}</b></div>
    <div class="row"><span>Schuld offen</span><b>${fmt(Math.ceil(open))}</b></div>
    <div class="row"><span>Terminal-Klicks</span><b>${fmt(state.totalClicks)}</b></div>
    <div class="row"><span>Crew an Bord</span><b>${crewAboard} / ${CREW.length}</b></div>
    <div class="row"><span>Klick-Ertrag</span><b>×${fmt(clickMultiplier())}</b></div>
    <div class="row"><span>Dienstzeit</span><b>${playStr}</b></div>
  `;
}

/* ---------- Schulden-Tilgung ---------- */

const DEBT_MILESTONES = [
  { pct: 10,  msg: "10 % getilgt. Die Reederei hält still." },
  { pct: 25,  msg: "Ein Viertel weg. Erste Mahnung zurückgezogen." },
  { pct: 50,  msg: "Halbzeit. Die Crew schöpft Hoffnung." },
  { pct: 75,  msg: "75 %. Das Schiff gehört fast euch." },
  { pct: 100, msg: "SCHULDEN GETILGT. DRAGON'S DEBT ist frei!" },
];
let lastMilestone = -1;

function renderDebt() {
  const pct = Math.min(100, (state.totalEarned / DEBT_TOTAL) * 100);
  el.debtStage.textContent = pct.toFixed(pct < 10 ? 1 : 0) + " %";
  el.debtFill.style.width = pct + "%";
  for (let i = 0; i < DEBT_MILESTONES.length; i++) {
    if (pct >= DEBT_MILESTONES[i].pct && i > lastMilestone) {
      lastMilestone = i;
      logMsg(`SCHULDEN-TILGUNG: ${DEBT_MILESTONES[i].msg}`, true);
      el.stageFlash.classList.remove("on"); void el.stageFlash.offsetWidth; el.stageFlash.classList.add("on");
    }
  }
}

/* ---------- Game-Loop ---------- */

let lastTick = Date.now();
function tick() {
  const now = Date.now();
  const dt = (now - lastTick) / 1000;
  lastTick = now;
  const gain = perSecond() * dt;
  if (gain > 0) { state.credits += gain; state.totalEarned += gain; }
  updateReadout();
}
setInterval(tick, 100);
setInterval(renderStats, 500);
setInterval(renderDebt, 500);

setInterval(() => {
  const m = LOG_FLAVOR[logCount % LOG_FLAVOR.length];
  logMsg(m, m.startsWith("WARNUNG") || m.startsWith("Eingehende"));
  logCount++;
}, 18000);

/* ---------- Speichern / Laden ---------- */

function save(showHint = false) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    if (showHint) {
      el.savedHint.textContent = "// Logbuch gesichert.";
      setTimeout(() => (el.savedHint.textContent = ""), 2500);
    }
  } catch (err) { el.savedHint.textContent = "// FEHLER: Speichern fehlgeschlagen."; }
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    state.credits = data.credits || 0;
    state.totalEarned = data.totalEarned || 0;
    state.totalClicks = data.totalClicks || 0;
    state.startTime = data.startTime || Date.now();
    CREW.forEach(c => (state.crew[c.id] = (data.crew && data.crew[c.id]) || 0));
    state.modules = data.modules || {};

    const offlineMs = Date.now() - (data._savedAt || Date.now());
    if (offlineMs > 10000) {
      const cappedSec = Math.min(offlineMs / 1000, 8 * 3600);
      const earned = perSecond() * cappedSec * 0.5;
      if (earned > 0) {
        state.credits += earned; state.totalEarned += earned;
        logMsg(`Rückkehr aus dem Cryo-Schlaf. Crew erwirtschaftete ${fmt(Math.floor(earned))} Credits.`, true);
      }
    }
    return true;
  } catch (err) { return false; }
}

document.getElementById("saveBtn").addEventListener("click", () => save(true));
document.getElementById("resetBtn").addEventListener("click", () => {
  if (!confirm("RESET: Logbuch und Fortschritt unwiderruflich löschen?")) return;
  localStorage.removeItem(SAVE_KEY);
  state = { credits: 0, totalEarned: 0, totalClicks: 0, startTime: Date.now(), crew: {}, modules: {} };
  CREW.forEach(c => (state.crew[c.id] = 0));
  lastShopSignature = ""; lastMilestone = -1;
  logMsg("Schiffssysteme zurückgesetzt.", true);
  renderDeck(); renderShop(); updateReadout();
});

function saveWithStamp(showHint) { state._savedAt = Date.now(); save(showHint); }
setInterval(() => saveWithStamp(false), 15000);
window.addEventListener("beforeunload", () => saveWithStamp(false));

// Tab-Umschaltung
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const which = tab.dataset.tab;
    el.crewList.classList.toggle("hidden", which !== "crew");
    el.moduleList.classList.toggle("hidden", which !== "modules");
  });
});

// Daten für ship.js
window.crewData = function () { return { crew: state.crew }; };

/* ---------- Start ---------- */

const loaded = load();
logMsg("DRAGON'S DEBT — Bordsysteme hochgefahren.");
logMsg(loaded ? "Logbuch wiederhergestellt." : "Neue Schicht. Schulden offen: " + fmt(DEBT_TOTAL) + " Credits.");
renderDeck();
renderShop();
lastShopSignature = CREW.map(c => state.crew[c.id]).join(",") + "|" + MODULES.map(e => state.modules[e.id] ? 1 : 0).join(",");
updateReadout();
renderStats();
renderDebt();
