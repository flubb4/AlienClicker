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
  { id: "mae",      name: "Mae",      role: "Wissenschaftsoffizierin", room: "muthur",  baseCost: 15,    rate: 0.2,  desc: "Überwacht MU/TH/UR und die Bordsysteme." },
  { id: "gustav",   name: "Gustav",   role: "Pilot",                   room: "bridge",  baseCost: 120,   rate: 1.5,  desc: "Hält das Schiff auf Kurs." },
  { id: "silas",    name: "Silas",    role: "Maschinist",              room: "engine",  baseCost: 1300,  rate: 9,    desc: "Hält die Triebwerke am Laufen." },
  { id: "scott",    name: "Scott",    role: "Quartiermeister",         room: "food",    baseCost: 14000, rate: 50,   desc: "Verwaltet Vorräte und Fracht." },
  { id: "isabella", name: "Isabella", role: "Sanitäterin",             room: "medbay",  baseCost: 2e5,   rate: 300,  desc: "Hält die Crew am Leben." },
  { id: "julian",   name: "Julian",   role: "Synthetik",               room: "android", baseCost: 3e6,   rate: 1800, desc: "Der Synthetik der Firma. Wartet im Android Bay." },
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

const SAVE_KEY = "dragonsdebt-save-v2";
const BASE_CLICK = 1;
const DEBT_BASE = 1e8;        // Schuld des ersten Vertrags
const DEBT_GROWTH = 8;        // Schuld ×8 pro weiterem Vertrag
const CREW_MILESTONES = [10, 25, 50, 100, 150, 200]; // Output-Verdopplung je Stückzahl
const ACH_BONUS = 0.02;       // +2% globale Produktion je Erfolg
const TOKEN_BONUS = 0.05;     // +5% globale Produktion je Dienstmarke

// Erfolge: cond() wird zur Laufzeit geprüft.
const ACHIEVEMENTS = [
  { id: "firstclick", name: "Erster Handgriff",       desc: "Bediene das Terminal.",                cond: () => state.totalClicks >= 1 },
  { id: "click100",   name: "Fleißig",                desc: "100 Terminal-Klicks.",                 cond: () => state.totalClicks >= 100 },
  { id: "click1k",    name: "Akkordarbeit",           desc: "1.000 Terminal-Klicks.",               cond: () => state.totalClicks >= 1000 },
  { id: "firsthire",  name: "Nicht mehr allein",      desc: "Heuere dein erstes Crewmitglied an.",  cond: () => crewAboard() >= 1 },
  { id: "fullcrew",   name: "Volle Besatzung",        desc: "Alle 6 Crewmitglieder an Bord.",       cond: () => crewAboard() >= CREW.length },
  { id: "cred1k",     name: "Erste Rate",             desc: "Verdiene 1.000 Credits.",              cond: () => state.totalEarned >= 1e3 },
  { id: "cred1m",     name: "Liquide",                desc: "Verdiene 1 Mio Credits.",              cond: () => state.totalEarned >= 1e6 },
  { id: "cred1b",     name: "Reich",                  desc: "Verdiene 1 Mrd Credits.",              cond: () => state.totalEarned >= 1e9 },
  { id: "cred1t",     name: "Dagobert",               desc: "Verdiene 1 Bio Credits.",              cond: () => state.totalEarned >= 1e12 },
  { id: "sysall",     name: "Voll aufgerüstet",       desc: "Installiere alle Systeme.",            cond: () => MODULES.every(m => state.modules[m.id]) },
  { id: "crew10",     name: "Schichtbetrieb",         desc: "Habe 10× ein Crewmitglied.",           cond: () => CREW.some(c => state.crew[c.id] >= 10) },
  { id: "crew50",     name: "Überbesetzt",            desc: "Habe 50× ein Crewmitglied.",           cond: () => CREW.some(c => state.crew[c.id] >= 50) },
  { id: "crew100",    name: "Klon-Verdacht",          desc: "Habe 100× ein Crewmitglied.",          cond: () => CREW.some(c => state.crew[c.id] >= 100) },
  { id: "rate1k",     name: "Selbstläufer",           desc: "Erreiche 1.000 cr/s.",                 cond: () => perSecond() >= 1e3 },
  { id: "rate1m",     name: "Industrie",              desc: "Erreiche 1 Mio cr/s.",                 cond: () => perSecond() >= 1e6 },
  { id: "debthalf",   name: "Halb frei",              desc: "Tilge 50 % eines Vertrags.",           cond: () => state.contractEarned >= currentDebt() * 0.5 },
  { id: "cryo",       name: "Cryo-Schlaf",            desc: "Kehre aus dem Offline-Ertrag zurück.", cond: () => !!state._cryo },
  { id: "prestige1",  name: "Neuer Vertrag",          desc: "Unterschreibe einen neuen Vertrag.",   cond: () => state.prestiges >= 1 },
  { id: "prestige3",  name: "Veteran",                desc: "Schließe 3 Verträge ab.",              cond: () => state.prestiges >= 3 },
  { id: "prestige5",  name: "Legende der Reederei",   desc: "Schließe 5 Verträge ab.",              cond: () => state.prestiges >= 5 },
];

// Veteranen-Perks: mit Dienstmarken gekauft, bleiben über Verträge hinweg.
const PERKS = [
  { id: "eff",    name: "Effizienz-Protokolle",   desc: "+20 % globale Produktion je Stufe.",          base: 1, max: 25 },
  { id: "click",  name: "Signal-Verstärker",      desc: "Klickkraft ×2 je Stufe.",                     base: 2, max: 12 },
  { id: "haggle", name: "Harte Verhandlung",      desc: "−4 % Crew-Kosten je Stufe.",                  base: 2, max: 12 },
  { id: "cargo",  name: "Vorschuss der Reederei", desc: "Startkapital nach jedem Vertrag (×10/Stufe).", base: 3, max: 8 },
  { id: "cryo",   name: "Cryo-Optimierung",       desc: "Offline-Ertrag: 16 h Cap & 75 % Rate.",       base: 8, max: 1 },
  { id: "bait",   name: "Köder-Protokoll",        desc: "Facehugger öfter & +25 % Beute je Stufe.",    base: 6, max: 5 },
];

// Individuelle Crew-Upgrades: mit Credits gekauft (pro Vertrag), multiplizieren den Output dieser Figur.
const CREW_UPGRADES = {
  mae:      [ { id: "mae1", req: 10, mult: 3, name: "MU/TH/UR-Overclock" }, { id: "mae2", req: 50, mult: 3, name: "Datenkern-Tuning" }, { id: "mae3", req: 150, mult: 4, name: "Quanten-Routinen" } ],
  gustav:   [ { id: "gus1", req: 10, mult: 3, name: "Flug-Assistent" },     { id: "gus2", req: 50, mult: 3, name: "Trägheitsdämpfer" },  { id: "gus3", req: 150, mult: 4, name: "Sprung-Kalibrierung" } ],
  silas:    [ { id: "sil1", req: 10, mult: 3, name: "Triebwerks-Tuning" },  { id: "sil2", req: 50, mult: 3, name: "Plasma-Injektoren" }, { id: "sil3", req: 150, mult: 4, name: "Reaktor-Übertaktung" } ],
  scott:    [ { id: "sco1", req: 10, mult: 3, name: "Lager-Optimierung" },  { id: "sco2", req: 50, mult: 3, name: "Automatik-Greifer" }, { id: "sco3", req: 150, mult: 4, name: "Frachtdrohnen" } ],
  isabella: [ { id: "isa1", req: 10, mult: 3, name: "Med-Scanner" },        { id: "isa2", req: 50, mult: 3, name: "Auto-Diagnose" },     { id: "isa3", req: 150, mult: 4, name: "Nano-Medizin" } ],
  julian:   [ { id: "jul1", req: 10, mult: 3, name: "Verhaltens-Update" },  { id: "jul2", req: 50, mult: 3, name: "Kampf-Protokoll" },   { id: "jul3", req: 150, mult: 4, name: "Spezial-Direktive" } ],
};

// Aktive Crew-Fähigkeiten: temporärer Produktions-Buff mit Cooldown (Sekunden). req = nötige Stückzahl.
const ABILITIES = {
  silas:    { name: "Vollschub",     req: 5,  mult: 5, dur: 15, cd: 150, desc: "+400 % Produktion (15 s)" },
  isabella: { name: "Notversorgung", req: 5,  mult: 3, dur: 30, cd: 180, desc: "+200 % Produktion (30 s)" },
  mae:      { name: "Systemanalyse", req: 5,  mult: 4, dur: 20, cd: 200, desc: "+300 % Produktion (20 s)" },
  gustav:   { name: "Autopilot",     req: 10, mult: 6, dur: 12, cd: 220, desc: "+500 % Produktion (12 s)" },
  scott:    { name: "Inventur",      req: 10, mult: 4, dur: 25, cd: 210, desc: "+300 % Produktion (25 s)" },
  julian:   { name: "Spezial-Order", req: 10, mult: 8, dur: 10, cd: 300, desc: "+700 % Produktion (10 s)" },
};

/* ---------- Spielzustand ---------- */

let state = {
  credits: 0,
  totalEarned: 0,      // lebenslang (Erfolge / Statistik)
  contractEarned: 0,   // seit letztem Vertrag (Schulden-Balken)
  totalClicks: 0,
  startTime: Date.now(),
  crew: {},            // id -> Anzahl
  modules: {},         // id -> true
  achievements: {},    // id -> true
  dienstmarken: 0,     // Prestige-Währung (permanenter Bonus)
  prestiges: 0,        // abgeschlossene Verträge
  perks: {},           // perkId -> Stufe (permanent)
  crewUpgrades: {},    // upgradeId -> true (pro Vertrag)
  buffs: [],           // temporäre Produktions-Buffs {mult, until}
  cooldowns: {},       // crewId -> Timestamp bis Fähigkeit wieder bereit
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
  return Math.ceil(c.baseCost * Math.pow(1.15, state.crew[c.id]) * crewCostPerkMult());
}
function crewAboard() { return CREW.reduce((s, c) => s + (state.crew[c.id] > 0 ? 1 : 0), 0); }
function achCount() { return Object.keys(state.achievements).length; }
// Globaler Produktions-Multiplikator: Erfolge + Dienstmarken + Effizienz-Perk
function globalMult() { return (1 + ACH_BONUS * achCount()) * (1 + TOKEN_BONUS * state.dienstmarken) * prodPerkMult(); }
// Output-Multiplikator eines Crewmitglieds durch Stückzahl-Meilensteine
function crewMult(id) { let m = 1; for (const t of CREW_MILESTONES) if (state.crew[id] >= t) m *= 2; return m; }
function nextCrewMilestone(id) { const n = state.crew[id]; for (const t of CREW_MILESTONES) if (n < t) return t; return null; }

function clickMultiplier() {
  let m = 1;
  MODULES.forEach(e => { if (state.modules[e.id]) m *= e.mult; });
  return m;
}
function clickPower() { return BASE_CLICK * clickMultiplier() * clickPerkMult() * globalMult() * buffMult(); }
function perSecond() {
  const raw = CREW.reduce((sum, c) => sum + c.rate * state.crew[c.id] * crewMult(c.id) * crewUpgradeMult(c.id), 0);
  return raw * globalMult() * synergyMult() * buffMult();
}

function currentDebt() { return DEBT_BASE * Math.pow(DEBT_GROWTH, state.prestiges); }
function prestigeGain() { return Math.floor(Math.sqrt(state.contractEarned / 1e6)); }
function canPrestige() { return state.contractEarned >= currentDebt(); }

/* ---------- Veteranen-Perks ---------- */
function perkLevel(id) { return state.perks[id] || 0; }
function perkCost(id) { const p = PERKS.find(x => x.id === id); return p.base * (perkLevel(id) + 1); }
function buyPerk(id) {
  const p = PERKS.find(x => x.id === id); const lvl = perkLevel(id);
  if (lvl >= p.max) return;
  const cost = perkCost(id);
  if (state.dienstmarken < cost) return;
  state.dienstmarken -= cost; state.perks[id] = lvl + 1;
  logMsg(`Veteranen-Perk: ${p.name} → Stufe ${lvl + 1}.`, true);
  renderPerks(); renderContract(); updateReadout();
}
function prodPerkMult() { return 1 + 0.20 * perkLevel("eff"); }
function clickPerkMult() { return Math.pow(2, perkLevel("click")); }
function crewCostPerkMult() { return Math.max(0.2, 1 - 0.04 * perkLevel("haggle")); }
function startCredits() { return perkLevel("cargo") > 0 ? 1000 * Math.pow(10, perkLevel("cargo") - 1) : 0; }

/* ---------- Raum-Synergien ---------- */
function synergyMult() {
  let m = 1, staffed = 0;
  CREW.forEach(c => { const n = state.crew[c.id]; if (n > 0) { staffed++; m *= 1 + 0.05 + 0.05 * Math.floor(n / 25); } });
  if (staffed === CREW.length) m *= 1.25; // alle Räume besetzt
  return m;
}

/* ---------- Crew-Upgrades ---------- */
function crewUpgradeMult(id) { let m = 1; (CREW_UPGRADES[id] || []).forEach(u => { if (state.crewUpgrades[u.id]) m *= u.mult; }); return m; }
function crewUpgradeCost(crewId, u) { const c = CREW.find(x => x.id === crewId); return Math.ceil(c.baseCost * Math.pow(1.15, u.req) * 12); }
function buyCrewUpgrade(crewId, u) {
  if (state.crewUpgrades[u.id]) return;
  const cost = crewUpgradeCost(crewId, u);
  if (state.credits < cost) return;
  state.credits -= cost; state.crewUpgrades[u.id] = true;
  const c = CREW.find(x => x.id === crewId);
  logMsg(`Upgrade: ${c.name} — ${u.name} (×${u.mult}).`, true);
  renderShop(); updateReadout(); checkAchievements();
}

/* ---------- Buffs & Fähigkeiten ---------- */
function buffMult() {
  const now = Date.now();
  if (state.buffs && state.buffs.length) state.buffs = state.buffs.filter(b => b.until > now);
  let m = 1; (state.buffs || []).forEach(b => m *= b.mult); return m;
}
function abilityReady(crewId) { return Date.now() >= (state.cooldowns[crewId] || 0); }
function useAbility(crewId) {
  const a = ABILITIES[crewId];
  if (!a || state.crew[crewId] < a.req || !abilityReady(crewId)) return;
  const now = Date.now();
  state.buffs = state.buffs || [];
  state.buffs.push({ mult: a.mult, until: now + a.dur * 1000, src: crewId });
  state.cooldowns[crewId] = now + a.cd * 1000;
  const c = CREW.find(x => x.id === crewId);
  logMsg(`${c.name} setzt „${a.name}" ein! ${a.desc}`, true);
  renderAbilities(); updateReadout();
}

/* ---------- DOM-Referenzen ---------- */

const el = {
  credits: document.getElementById("credits"),
  rate: document.getElementById("rate"),
  deck: document.getElementById("deck"),
  crewList: document.getElementById("crewList"),
  moduleList: document.getElementById("moduleList"),
  achList: document.getElementById("achList"),
  perkList: document.getElementById("perkList"),
  contract: document.getElementById("contract"),
  toasts: document.getElementById("toasts"),
  abilityBar: document.getElementById("abilityBar"),
  buffChip: document.getElementById("buffChip"),
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
  state.contractEarned += gain;
  state.totalClicks++;
  spawnFloat(ev.clientX, ev.clientY, "+" + fmt(gain));
  term.classList.remove("ping"); void term.offsetWidth; term.classList.add("ping");
  updateReadout();
});

/* ---------- Kaufen ---------- */

// Kaufmenge (Mengen-Selektor)
const BUY_AMOUNTS = [1, 5, 10, 50, 100, "max"];
let buyAmount = 1;

// Anzahl + Gesamtkosten für die aktuell gewählte Kaufmenge eines Crewmitglieds
function bulkInfo(c) {
  const owned = state.crew[c.id];
  const cm = crewCostPerkMult();
  if (buyAmount === "max") {
    let count = 0, cost = 0;
    while (count < 100000) {
      const next = Math.ceil(c.baseCost * Math.pow(1.15, owned + count) * cm);
      if (cost + next > state.credits) break;
      cost += next; count++;
    }
    return { count, cost };
  }
  let cost = 0;
  for (let k = 0; k < buyAmount; k++) cost += Math.ceil(c.baseCost * Math.pow(1.15, owned + k) * cm);
  return { count: buyAmount, cost };
}

function buyCrew(c) {
  const { count, cost } = bulkInfo(c);
  if (count < 1 || state.credits < cost) return;
  const before = state.crew[c.id];
  state.credits -= cost;
  state.crew[c.id] += count;
  if (before === 0) logMsg(`${c.name} (${c.role}) angeheuert. An Bord.`, true);
  CREW_MILESTONES.forEach(t => { if (before < t && state.crew[c.id] >= t) logMsg(`Meilenstein: ${c.name} ×${t} — Output verdoppelt!`, true); });
  renderDeck();
  renderShop();
  renderAbilities();
  updateReadout();
  checkAchievements();
}

function renderBuyAmt() {
  const box = document.getElementById("buyAmt");
  if (!box) return;
  box.innerHTML = "";
  BUY_AMOUNTS.forEach(a => {
    const b = document.createElement("button");
    b.className = "amt" + (buyAmount === a ? " active" : "");
    b.textContent = a === "max" ? "MAX" : "×" + a;
    b.addEventListener("click", () => { buyAmount = a; renderBuyAmt(); renderShop(); });
    box.appendChild(b);
  });
}

function buyModule(e) {
  if (state.modules[e.id] || state.credits < e.cost) return;
  state.credits -= e.cost;
  state.modules[e.id] = true;
  logMsg(`System installiert: ${e.name}.`);
  renderShop();
  updateReadout();
  checkAchievements();
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

    el.deck.appendChild(zone);
  });

  // Zentrales Terminal (Klick-Ziel) in der Schiffsmitte
  const term = document.createElement("button");
  term.className = "terminal";
  term.setAttribute("aria-label", "Terminal bedienen");
  term.innerHTML = `<span class="term-screen"></span><span class="term-label">TERMINAL</span>`;
  el.deck.appendChild(term);
}

/* ---------- Shop ---------- */

function renderShop() {
  // Crew
  el.crewList.innerHTML = "";
  CREW.forEach((c, i) => {
    const unlocked = i === 0 || state.crew[CREW[i - 1].id] > 0 || state.crew[c.id] > 0;
    if (!unlocked) return;
    const info = bulkInfo(c);
    const dispCount = info.count < 1 ? 1 : info.count;
    const dispCost = info.count < 1 ? crewCost(c) : info.cost;
    const affordable = info.count >= 1 && state.credits >= info.cost;
    const item = document.createElement("div");
    item.className = "item" + (affordable ? "" : " locked");
    const mult = crewMult(c.id);
    const next = nextCrewMilestone(c.id);
    const ups = (CREW_UPGRADES[c.id] || []).filter(u => !state.crewUpgrades[u.id] && state.crew[c.id] >= u.req);
    const upsHtml = ups.length
      ? `<div class="crew-ups">${ups.map(u => `<button class="cup${state.credits >= crewUpgradeCost(c.id, u) ? "" : " locked"}" data-uid="${u.id}">⚡ ${u.name} · ${fmt(crewUpgradeCost(c.id, u))}</button>`).join("")}</div>`
      : "";
    item.innerHTML = `
      <div class="thumb"><span class="thumb-fallback">${c.name[0]}</span><img src="assets/crew/${c.id}.png" alt="" onerror="this.remove()"></div>
      <div class="item-info">
        <div class="item-name">${c.name}<span class="count">×${state.crew[c.id]}</span>${mult > 1 ? `<span class="ms-badge">×${mult}</span>` : ""}</div>
        <div class="item-rate">${c.role} · +${fmt(c.rate * mult * crewUpgradeMult(c.id))} cr/s</div>
        ${next ? `<div class="item-ms">Bonus bei ${next} · ${state.crew[c.id]}/${next}</div>` : `<div class="item-ms">max. Bonus erreicht</div>`}
        ${upsHtml}
      </div>
      <div class="item-cost"><span class="cost-val">${fmt(dispCost)}</span><span class="cost-lbl">CREDITS${dispCount > 1 ? ` · ×${dispCount}` : ""}</span></div>
    `;
    item.addEventListener("click", () => buyCrew(c));
    item.querySelectorAll(".cup").forEach(btn => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const u = (CREW_UPGRADES[c.id] || []).find(x => x.id === btn.dataset.uid);
        if (u) buyCrewUpgrade(c.id, u);
      });
    });
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
  if (el.buffChip) {
    const b = buffMult();
    if (b > 1) { el.buffChip.textContent = `🔥 ×${Number.isInteger(b) ? b : b.toFixed(1)}`; el.buffChip.classList.add("on"); }
    else el.buffChip.classList.remove("on");
  }
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
    if (!node) return;
    const info = bulkInfo(c);
    node.classList.toggle("locked", info.count < 1 || state.credits < info.cost);
    const cnt = info.count < 1 ? 1 : info.count;
    const cv = node.querySelector(".cost-val");
    if (cv) cv.textContent = fmt(info.count < 1 ? crewCost(c) : info.cost);
    const cl = node.querySelector(".cost-lbl");
    if (cl) cl.textContent = "CREDITS" + (cnt > 1 ? ` · ×${cnt}` : "");
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
  const open = Math.max(0, currentDebt() - state.contractEarned);
  el.stats.innerHTML = `
    <div class="row"><span>Credits gesamt</span><b>${fmt(Math.floor(state.totalEarned))}</b></div>
    <div class="row"><span>Schuld offen</span><b>${fmt(Math.ceil(open))}</b></div>
    <div class="row"><span>Terminal-Klicks</span><b>${fmt(state.totalClicks)}</b></div>
    <div class="row"><span>Crew an Bord</span><b>${crewAboard()} / ${CREW.length}</b></div>
    <div class="row"><span>Global-Bonus</span><b>×${globalMult().toFixed(2)}</b></div>
    <div class="row"><span>Erfolge</span><b>${achCount()} / ${ACHIEVEMENTS.length}</b></div>
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
  const pct = Math.min(100, (state.contractEarned / currentDebt()) * 100);
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

/* ---------- Erfolge ---------- */

function showToast(title, sub) {
  if (!el.toasts) return;
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `<div class="toast-title">🏅 ERFOLG: ${title}</div><div class="toast-sub">${sub}</div>`;
  el.toasts.appendChild(t);
  setTimeout(() => t.classList.add("show"), 30);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, 4500);
}

function checkAchievements() {
  let any = false;
  ACHIEVEMENTS.forEach(a => {
    if (!state.achievements[a.id] && a.cond()) {
      state.achievements[a.id] = true;
      any = true;
      logMsg(`ERFOLG: ${a.name} (+${Math.round(ACH_BONUS * 100)}% Produktion)`, true);
      showToast(a.name, a.desc);
    }
  });
  if (any) { renderAchievements(); renderContract(); updateReadout(); }
}

function renderAchievements() {
  if (!el.achList) return;
  let html = `<div class="ach-head">${achCount()} / ${ACHIEVEMENTS.length} freigeschaltet · je +${Math.round(ACH_BONUS * 100)}% Produktion</div>`;
  ACHIEVEMENTS.forEach(a => {
    const got = !!state.achievements[a.id];
    html += `<div class="ach${got ? " got" : ""}">
      <div class="ach-icon">${got ? "🏅" : "🔒"}</div>
      <div class="ach-info"><div class="ach-name">${got ? a.name : "???"}</div><div class="ach-desc">${a.desc}</div></div>
    </div>`;
  });
  el.achList.innerHTML = html;
}

/* ---------- Vertrag / Prestige ---------- */

function renderContract() {
  if (!el.contract) return;
  const gain = prestigeGain();
  const ready = canPrestige();
  el.contract.innerHTML = `
    <div class="row"><span>Vertrag</span><b>#${state.prestiges + 1}</b></div>
    <div class="row"><span>Dienstmarken</span><b>${fmt(state.dienstmarken)}</b></div>
    <div class="row"><span>Veteranen-Bonus</span><b>+${Math.round(TOKEN_BONUS * state.dienstmarken * 100)}%</b></div>
    <button class="contract-btn${ready ? " ready" : ""}" id="prestigeBtn"${ready ? "" : " disabled"}>
      ${ready ? `Neuer Vertrag · +${gain} Marken` : "Schuld tilgen für neuen Vertrag"}
    </button>
  `;
  const btn = document.getElementById("prestigeBtn");
  if (btn) btn.addEventListener("click", doPrestige);
}

function doPrestige() {
  if (!canPrestige()) return;
  const gain = prestigeGain();
  if (gain < 1) return;
  if (!confirm(`Neuen Vertrag unterschreiben?\n\nDu erhältst ${gain} Dienstmarken (+${gain * Math.round(TOKEN_BONUS * 100)}% permanente Produktion).\nCredits, Crew und Systeme werden zurückgesetzt. Erfolge & Dienstmarken bleiben.`)) return;
  state.dienstmarken += gain;
  state.prestiges++;
  state.contractEarned = 0;
  CREW.forEach(c => (state.crew[c.id] = 0));
  state.modules = {};
  state.crewUpgrades = {};
  state.buffs = [];
  state.cooldowns = {};
  state.credits = startCredits();
  lastMilestone = -1;
  lastShopSignature = "";
  logMsg(`NEUER VERTRAG #${state.prestiges + 1}. +${gain} Dienstmarken. Neue Schuld: ${fmt(currentDebt())} cr.`, true);
  el.stageFlash.classList.remove("on"); void el.stageFlash.offsetWidth; el.stageFlash.classList.add("on");
  renderDeck(); renderShop(); renderAbilities(); renderContract(); renderDebt(); updateReadout();
  saveWithStamp(false);
}

/* ---------- Veteranen-Shop (Perks) ---------- */

function renderPerks() {
  if (!el.perkList) return;
  let html = `<div class="ach-head">Dienstmarken: ${fmt(state.dienstmarken)} · permanent über alle Verträge</div>`;
  PERKS.forEach(p => {
    const lvl = perkLevel(p.id), maxed = lvl >= p.max, cost = perkCost(p.id);
    const cls = maxed ? "maxed" : (state.dienstmarken >= cost ? "" : "locked");
    html += `<div class="item perk ${cls}" data-perk="${p.id}">
      <div class="item-info">
        <div class="item-name">${p.name} <span class="count">Stufe ${lvl}${p.max > 1 ? `/${p.max}` : ""}</span></div>
        <div class="item-desc">${p.desc}</div>
      </div>
      <div class="item-cost">${maxed ? '<span class="cost-val">MAX</span>' : `<span class="cost-val">${fmt(cost)}</span><span class="cost-lbl">MARKEN</span>`}</div>
    </div>`;
  });
  el.perkList.innerHTML = html;
  el.perkList.querySelectorAll(".perk").forEach(node => {
    if (!node.classList.contains("maxed")) node.addEventListener("click", () => buyPerk(node.dataset.perk));
  });
}

/* ---------- Fähigkeiten-Leiste ---------- */

function renderAbilities() {
  const bar = el.abilityBar;
  if (!bar) return;
  bar.innerHTML = "";
  Object.keys(ABILITIES).forEach(crewId => {
    const a = ABILITIES[crewId];
    if (state.crew[crewId] < a.req) return;
    const btn = document.createElement("button");
    btn.className = "ability";
    btn.dataset.crew = crewId;
    btn.title = `${a.name} — ${a.desc}`;
    btn.innerHTML = `<img src="assets/crew/${crewId}.png" alt="" draggable="false" onerror="this.remove()"><span class="ab-cd"></span><span class="ab-name">${a.name}</span>`;
    btn.addEventListener("click", () => useAbility(crewId));
    bar.appendChild(btn);
  });
  updateAbilityCooldowns();
}

function updateAbilityCooldowns() {
  const bar = el.abilityBar;
  if (!bar) return;
  const now = Date.now();
  [...bar.children].forEach(btn => {
    const crewId = btn.dataset.crew;
    const cd = ABILITIES[crewId].cd;
    const remain = Math.max(0, ((state.cooldowns[crewId] || 0) - now) / 1000);
    const ov = btn.querySelector(".ab-cd");
    if (remain > 0) {
      btn.classList.remove("ready");
      if (ov) { ov.textContent = Math.ceil(remain) + "s"; ov.style.height = Math.min(100, remain / cd * 100) + "%"; }
    } else {
      btn.classList.add("ready");
      if (ov) { ov.textContent = ""; ov.style.height = "0%"; }
    }
  });
}

/* ---------- Streunender Facehugger ---------- */

function spawnFacehugger() {
  if (document.querySelector(".facehugger")) return;
  const fh = document.createElement("button");
  fh.className = "facehugger";
  fh.innerHTML = '<img src="assets/facehugger.png" alt="" draggable="false">';
  fh.title = "Fangen!";
  document.body.appendChild(fh);

  const size = 78;
  // Bewegungsfläche = das Schiff (Deck), sonst Fallback Viewport
  const area = () => {
    const d = document.getElementById("deck");
    const r = (d && d.clientWidth) ? d.getBoundingClientRect() : { left: 40, top: 80, width: innerWidth - 80, height: innerHeight - 120 };
    return r;
  };
  const b0 = area();
  let x = b0.left + Math.random() * Math.max(1, b0.width - size);
  let y = b0.top + Math.random() * Math.max(1, b0.height - size);
  let tx = x, ty = y;
  const pick = () => { const b = area(); tx = b.left + Math.random() * Math.max(1, b.width - size); ty = b.top + Math.random() * Math.max(1, b.height - size); };
  pick();
  fh.style.left = x.toFixed(1) + "px"; fh.style.top = y.toFixed(1) + "px";

  const life = 10000 + Math.random() * 5000;   // 10–15 s herumkrabbeln
  const start = performance.now();
  let last = start, leaving = false, caught = false, raf = 0;
  function step(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!leaving && now - start > life) { leaving = true; ty = area().top - size * 3; tx = x; } // nach oben wegfliegen
    const dx = tx - x, dy = ty - y, dist = Math.hypot(dx, dy);
    const sp = leaving ? 460 : 150;
    if (dist < 6) { if (leaving) { fh.remove(); return; } pick(); }
    else { const s = Math.min(dist, sp * dt); x += dx / dist * s; y += dy / dist * s; }
    fh.style.left = x.toFixed(1) + "px"; fh.style.top = y.toFixed(1) + "px";
    raf = requestAnimationFrame(step);
  }
  raf = requestAnimationFrame(step);
  fh.addEventListener("click", () => { if (caught) return; caught = true; cancelAnimationFrame(raf); catchFacehugger(fh); });
}

function catchFacehugger(fh) {
  fh.remove();
  const rewardMul = 1 + 0.25 * perkLevel("bait");
  if (Math.random() < 0.35) {
    const mult = 7, dur = 15;
    state.buffs = state.buffs || [];
    state.buffs.push({ mult, until: Date.now() + dur * 1000, src: "facehugger" });
    logMsg(`Facehugger gefangen! FRENZY ×${mult} für ${dur}s.`, true);
    showToast("Facehugger gefangen!", `FRENZY ×${mult} für ${dur} Sekunden`);
  } else {
    const reward = Math.floor((Math.max(clickPower() * 50, perSecond() * 60) + 50) * rewardMul);
    state.credits += reward; state.totalEarned += reward; state.contractEarned += reward;
    logMsg(`Facehugger gefangen! +${fmt(reward)} Credits.`, true);
    showToast("Facehugger gefangen!", `+${fmt(reward)} Credits`);
  }
  updateReadout();
}

function scheduleFacehugger() {
  const base = Math.max(45000, 120000 - perkLevel("bait") * 12000);
  const delay = base * 0.6 + Math.random() * base * 0.8;
  setTimeout(() => { spawnFacehugger(); scheduleFacehugger(); }, delay);
}

/* ---------- Game-Loop ---------- */

let lastTick = Date.now();
function tick() {
  const now = Date.now();
  const dt = (now - lastTick) / 1000;
  lastTick = now;
  const gain = perSecond() * dt;
  if (gain > 0) { state.credits += gain; state.totalEarned += gain; state.contractEarned += gain; }
  updateReadout();
}
setInterval(tick, 100);
setInterval(renderStats, 500);
setInterval(renderDebt, 500);
setInterval(renderContract, 700);
setInterval(checkAchievements, 1000);
setInterval(updateAbilityCooldowns, 250);
scheduleFacehugger();

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
    state.contractEarned = data.contractEarned || 0;
    state.totalClicks = data.totalClicks || 0;
    state.startTime = data.startTime || Date.now();
    CREW.forEach(c => (state.crew[c.id] = (data.crew && data.crew[c.id]) || 0));
    state.modules = data.modules || {};
    state.achievements = data.achievements || {};
    state.dienstmarken = data.dienstmarken || 0;
    state.prestiges = data.prestiges || 0;
    state.perks = data.perks || {};
    state.crewUpgrades = data.crewUpgrades || {};
    state.buffs = []; state.cooldowns = {};

    const offlineMs = Date.now() - (data._savedAt || Date.now());
    if (offlineMs > 10000) {
      const capH = perkLevel("cryo") > 0 ? 16 : 8;
      const rate = perkLevel("cryo") > 0 ? 0.75 : 0.5;
      const cappedSec = Math.min(offlineMs / 1000, capH * 3600);
      const earned = perSecond() * cappedSec * rate;
      if (earned > 0) {
        state.credits += earned; state.totalEarned += earned; state.contractEarned += earned;
        state._cryo = true;
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
  state = { credits: 0, totalEarned: 0, contractEarned: 0, totalClicks: 0, startTime: Date.now(), crew: {}, modules: {}, achievements: {}, dienstmarken: 0, prestiges: 0, perks: {}, crewUpgrades: {}, buffs: [], cooldowns: {} };
  CREW.forEach(c => (state.crew[c.id] = 0));
  lastShopSignature = ""; lastMilestone = -1;
  logMsg("Schiffssysteme zurückgesetzt.", true);
  renderDeck(); renderShop(); renderAbilities(); renderAchievements(); renderPerks(); renderContract(); renderDebt(); updateReadout();
});

function saveWithStamp(showHint) { state._savedAt = Date.now(); save(showHint); }
setInterval(() => saveWithStamp(false), 15000);
window.addEventListener("beforeunload", () => saveWithStamp(false));

// Tab-Umschaltung
const TAB_BODIES = { crew: el.crewList, modules: el.moduleList, ach: el.achList, veteran: el.perkList };
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const which = tab.dataset.tab;
    Object.entries(TAB_BODIES).forEach(([k, node]) => { if (node) node.classList.toggle("hidden", k !== which); });
    const ba = document.getElementById("buyAmt");
    if (ba) ba.classList.toggle("hidden", which !== "crew");
    if (which === "ach") renderAchievements();
    if (which === "veteran") renderPerks();
  });
});

// Daten für ship.js
window.crewData = function () { return { crew: state.crew }; };

/* ---------- Admin-Mode (Strg+Shift+A) ---------- */

function setupAdmin() {
  const panel = document.createElement("div");
  panel.id = "admin";
  panel.className = "admin hidden";
  panel.innerHTML = `
    <div class="admin-title">⚙ ADMIN-MODUS</div>
    <div class="admin-row">
      <button data-add="1000">+1K</button>
      <button data-add="100000">+100K</button>
      <button data-add="1000000">+1M</button>
      <button data-add="1000000000">+1B</button>
      <button data-add="1000000000000">+1T</button>
    </div>
    <div class="admin-row">
      <button id="admCrew">Alle Crew +5</button>
      <button id="admModules">Alle Systeme</button>
      <button id="admDebt">+10% Tilgung</button>
    </div>
    <div class="admin-hint">Strg+Shift+A zum Ein-/Ausblenden</div>
  `;
  document.body.appendChild(panel);

  panel.addEventListener("click", (e) => {
    const add = e.target.dataset && e.target.dataset.add;
    if (add) { state.credits += Number(add); updateReadout(); checkAchievements(); }
  });
  panel.querySelector("#admCrew").addEventListener("click", () => {
    CREW.forEach(c => state.crew[c.id] += 5);
    renderDeck(); renderShop(); updateReadout(); checkAchievements();
  });
  panel.querySelector("#admModules").addEventListener("click", () => {
    MODULES.forEach(m => state.modules[m.id] = true);
    renderShop(); updateReadout(); checkAchievements();
  });
  panel.querySelector("#admDebt").addEventListener("click", () => {
    const d = currentDebt() * 0.1;
    state.totalEarned += d; state.contractEarned += d;
    updateReadout(); renderDebt(); renderContract(); checkAchievements();
  });

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === "A" || e.key === "a")) {
      e.preventDefault();
      panel.classList.toggle("hidden");
      logMsg(panel.classList.contains("hidden") ? "Admin-Modus aus." : "Admin-Modus an.");
    }
  });
}
setupAdmin();

/* ---------- Start ---------- */

const loaded = load();
logMsg("DRAGON'S DEBT — Bordsysteme hochgefahren.");
logMsg(loaded ? "Logbuch wiederhergestellt." : "Neue Schicht. Schuld offen: " + fmt(currentDebt()) + " Credits.");
renderDeck();
renderBuyAmt();
renderShop();
lastShopSignature = CREW.map(c => state.crew[c.id]).join(",") + "|" + MODULES.map(e => state.modules[e.id] ? 1 : 0).join(",");
updateReadout();
renderStats();
renderDebt();
renderAchievements();
renderPerks();
renderContract();
renderAbilities();
checkAchievements();
