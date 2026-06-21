/* =========================================================
   HIVE — lebende Kolonie auf Canvas.
   Liest die gekauften Spezimen aus window.colonyData() und
   stellt sie als krabbelnde/glühende Wesen rund ums Ei dar.
   ========================================================= */
"use strict";

(function () {
  const canvas = document.getElementById("hive");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    const oldW = W || window.innerWidth, oldH = H || window.innerHeight;
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // bestehende Wesen proportional umsetzen
    const sx = W / oldW, sy = H / oldH;
    for (const c of creatures) { c.x *= sx; c.y *= sy; c.baseY *= sy; }
  }

  /* ---- Visuelle Spezifikation je Spezimen-Typ ---- */
  const SPEC = {
    facehugger: { kind: "hugger", cap: 36, size: 15, speed: 1.5, band: [0.30, 0.90] },
    burster:    { kind: "worm",   cap: 28, size: 18, speed: 0.9, band: [0.60, 0.92] },
    drone:      { kind: "xeno",   cap: 22, size: 34, speed: 0.55, band: [0.62, 0.92], tone: "#2b4a37" },
    warrior:    { kind: "xeno",   cap: 16, size: 42, speed: 0.6, band: [0.62, 0.92], tone: "#203a2c" },
    praetorian: { kind: "big",    cap: 9,  size: 60, speed: 0.42, band: [0.64, 0.92], tone: "#22402f" },
    queen:      { kind: "queen",  cap: 3,  size: 105, speed: 0.20, band: [0.66, 0.9], tone: "#1c3526" },
    hive:       { kind: "node",   cap: 12, size: 30, speed: 0, band: [0.66, 0.94] },
    derelict:   { kind: "node",   cap: 4,  size: 62, speed: 0, band: [0.7, 0.9] },
    lv426:      { kind: "node",   cap: 6,  size: 48, speed: 0, band: [0.7, 0.93] },
    wy:         { kind: "node",   cap: 6,  size: 42, speed: 0, band: [0.72, 0.93] },
  };

  /* ---- Sprite-Vorrendering (Performance) ---- */
  const spriteCache = {};
  function getSprite(spec) {
    const key = spec.kind + (spec.tone || "");
    if (spriteCache[key]) return spriteCache[key];
    const SS = 2, size = spec.size;
    const S = Math.ceil(size * 3.2 * SS);
    const off = document.createElement("canvas");
    off.width = S; off.height = S;
    const c = off.getContext("2d");
    c.translate(S / 2, S / 2);
    c.scale(SS, SS);
    c.lineJoin = "round"; c.lineCap = "round";
    c.shadowColor = "rgba(90,255,130,0.55)";
    c.shadowBlur = size * 0.5;
    DRAW[spec.kind](c, size, spec.tone || "#2b4a37");
    const sprite = { canvas: off, draw: S / SS };
    spriteCache[key] = sprite;
    return sprite;
  }

  /* ---- Zeichenfunktionen (stilisierte Silhouetten) ---- */
  const DRAW = {
    hugger(c, s) {
      c.strokeStyle = "#b7c7a4"; c.lineWidth = s * 0.07;
      for (let i = 0; i < 4; i++) for (const sg of [-1, 1]) {
        const a = 0.45 + i * 0.42;
        c.beginPath();
        c.moveTo(0, -s * 0.05);
        c.quadraticCurveTo(Math.cos(a) * s * 0.8 * sg, -Math.sin(a) * s * 0.5,
                           Math.cos(a) * s * 1.15 * sg, s * 0.55);
        c.stroke();
      }
      const g = c.createRadialGradient(0, -s * 0.1, 1, 0, 0, s * 0.7);
      g.addColorStop(0, "#e2ead2"); g.addColorStop(1, "#8c9c78");
      c.fillStyle = g;
      c.beginPath(); c.ellipse(0, 0, s * 0.62, s * 0.44, 0, 0, 7); c.fill();
      c.strokeStyle = "#9aaa86"; c.lineWidth = s * 0.13;
      c.beginPath(); c.moveTo(0, s * 0.25);
      c.quadraticCurveTo(s * 0.85, s * 0.85, s * 0.25, s * 1.35); c.stroke();
    },
    worm(c, s) {
      c.strokeStyle = "#cabaa9"; c.lineWidth = s * 0.5;
      c.beginPath();
      for (let i = 0; i <= 6; i++) {
        const px = (i / 6 - 0.5) * s * 1.7, py = Math.sin(i * 0.9) * s * 0.16;
        i ? c.lineTo(px, py) : c.moveTo(px, py);
      }
      c.stroke();
      c.fillStyle = "#d9cbbb";
      c.beginPath(); c.ellipse(s * 0.85, Math.sin(6 * 0.9) * s * 0.16, s * 0.34, s * 0.3, 0, 0, 7); c.fill();
      c.fillStyle = "rgba(120,255,120,0.25)";
      c.beginPath(); c.arc(0, 0, s * 0.18, 0, 7); c.fill();
    },
    xeno(c, s, tone) {
      drawXeno(c, s, tone, false);
    },
    big(c, s, tone) {
      drawXeno(c, s, tone, true);
    },
    queen(c, s, tone) {
      drawXeno(c, s, tone, true, true);
    },
    node(c, s) {
      const clusters = [[0, 0, 1], [-0.55, 0.25, 0.7], [0.55, 0.3, 0.62]];
      for (const [ox, oy, r] of clusters) {
        const rr = s * 0.52 * r;
        const g = c.createRadialGradient(ox * s, oy * s - rr * 0.3, 1, ox * s, oy * s, rr);
        g.addColorStop(0, "rgba(160,255,120,0.6)");
        g.addColorStop(0.45, "#33502f");
        g.addColorStop(1, "#0f180e");
        c.fillStyle = g;
        c.beginPath(); c.ellipse(ox * s, oy * s, rr * 0.78, rr, 0, 0, 7); c.fill();
      }
    },
  };

  // Stilisierter Xenomorph (Seitenansicht, blickt nach +x)
  function drawXeno(c, s, tone, crest, queen) {
    // Schwanz
    c.strokeStyle = tone; c.lineWidth = s * 0.1;
    c.beginPath();
    c.moveTo(-s * 0.45, -s * 0.05);
    c.quadraticCurveTo(-s * 1.05, -s * 0.1, -s * 1.25, -s * 0.3);
    c.stroke();
    // Körper (gewölbter Rücken)
    const bg = c.createLinearGradient(0, -s * 0.5, 0, s * 0.3);
    bg.addColorStop(0, lighten(tone, 18)); bg.addColorStop(1, "#0d1710");
    c.fillStyle = bg;
    c.beginPath();
    c.moveTo(-s * 0.45, 0);
    c.quadraticCurveTo(-s * 0.12, -s * 0.58, s * 0.34, -s * 0.36);
    c.quadraticCurveTo(s * 0.56, -s * 0.22, s * 0.5, 0);
    c.quadraticCurveTo(s * 0.12, s * 0.08, -s * 0.45, 0);
    c.fill();
    // Beine
    c.strokeStyle = "#0d1710"; c.lineWidth = s * 0.08;
    for (const lx of [-0.22, 0.08, 0.32]) {
      c.beginPath(); c.moveTo(s * lx, 0);
      c.lineTo(s * lx - s * 0.08, s * 0.4); c.stroke();
    }
    // biolumineszente Rückenpunkte
    c.fillStyle = "rgba(130,255,120,0.5)";
    for (const dx of [-0.2, 0, 0.2]) {
      c.beginPath(); c.arc(s * dx, -s * 0.3, s * 0.045, 0, 7); c.fill();
    }
    // Kopf (langgezogen)
    c.save();
    c.translate(s * 0.48, -s * 0.3); c.rotate(-0.45);
    c.fillStyle = lighten(tone, 8);
    c.beginPath(); c.ellipse(s * 0.2, 0, s * 0.46, s * 0.16, 0, 0, 7); c.fill();
    if (crest) { // Praetorian/Queen: Kopfkamm
      c.fillStyle = "#0f1b12";
      c.beginPath(); c.ellipse(s * 0.05, -s * 0.05, s * 0.28, s * 0.22, 0, 0, 7); c.fill();
    }
    c.restore();
    if (queen) { // Krone aus Stacheln
      c.strokeStyle = lighten(tone, 22); c.lineWidth = s * 0.05;
      for (let i = -2; i <= 2; i++) {
        c.beginPath(); c.moveTo(s * 0.0, -s * 0.5);
        c.lineTo(s * 0.0 + i * s * 0.16, -s * 0.85); c.stroke();
      }
    }
  }

  function lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.min(255, r); g = Math.min(255, g); b = Math.min(255, b);
    return `rgb(${r},${g},${b})`;
  }

  /* ---- Wesen ---- */
  let creatures = [];
  function rand(a, b) { return a + Math.random() * (b - a); }

  function spawn(id, spec) {
    const band = spec.band;
    const baseY = rand(H * band[0], H * band[1]);
    return {
      id, spec, kind: spec.kind,
      x: rand(0, W), y: baseY, baseY,
      dir: Math.random() < 0.5 ? -1 : 1,
      speed: spec.speed * rand(0.7, 1.3),
      phase: rand(0, Math.PI * 2),
      bob: rand(2, 6),
      vx: 0, vy: 0,
      skT: 0, agit: 0,
    };
  }

  function sync() {
    const data = (window.colonyData && window.colonyData()) || { gens: {} };
    for (const id in SPEC) {
      const spec = SPEC[id];
      const owned = (data.gens && data.gens[id]) || 0;
      const want = Math.min(spec.cap, owned);
      let have = 0;
      for (const c of creatures) if (c.id === id) have++;
      while (have < want) { creatures.push(spawn(id, spec)); have++; }
      if (have > want) {
        let rm = have - want;
        creatures = creatures.filter(c => (c.id === id && rm > 0) ? (rm--, false) : true);
      }
    }
  }

  // Klick-Erschütterung: Wesen in der Nähe stieben auseinander
  window.__hiveAgitate = function (x, y, radius) {
    radius = radius || 200;
    for (const c of creatures) {
      if (c.kind === "node") continue;
      const dx = c.x - x, dy = c.y - y, d = Math.hypot(dx, dy);
      if (d < radius) {
        c.agit = 0.6;
        c.vx += (dx / (d || 1)) * 4;
        if (dx !== 0) c.dir = dx > 0 ? 1 : -1;
      }
    }
  };

  /* ---- Update + Render ---- */
  let last = performance.now(), syncT = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    syncT += dt;
    if (syncT > 0.4) { sync(); syncT = 0; }

    ctx.clearRect(0, 0, W, H);

    // hinten zeichnen: größere/langsamere zuerst (Tiefe)
    creatures.sort((a, b) => a.baseY - b.baseY);

    for (const c of creatures) {
      c.phase += dt * (c.kind === "hugger" ? 7 : 2);
      const agit = c.agit > 0 ? (c.agit -= dt, 2.4) : 1;

      if (c.kind === "node") {
        // statisch, pulsiert
      } else if (c.kind === "hugger") {
        c.skT -= dt;
        if (c.skT <= 0) { // neuer Dart
          c.skT = rand(0.3, 1.1);
          c.vx = rand(-1, 1) * c.speed * 2;
          c.vy = rand(-1, 1) * c.speed * 1.4;
          if (c.vx !== 0) c.dir = c.vx > 0 ? 1 : -1;
        }
        c.x += c.vx * agit * 60 * dt;
        c.y += c.vy * agit * 60 * dt;
      } else {
        c.vx += (c.dir * c.speed - c.vx) * 0.05; // sanft auf Zielspeed
        c.x += c.vx * agit * 60 * dt;
        c.y = c.baseY + Math.sin(c.phase) * c.bob;
      }

      // Grenzen
      const m = 40;
      if (c.x < m) { c.x = m; c.dir = 1; c.vx = Math.abs(c.vx); }
      if (c.x > W - m) { c.x = W - m; c.dir = -1; c.vx = -Math.abs(c.vx); }
      if (c.kind === "hugger") {
        const lo = H * c.spec.band[0], hi = H * c.spec.band[1];
        if (c.y < lo) { c.y = lo; c.vy = Math.abs(c.vy); }
        if (c.y > hi) { c.y = hi; c.vy = -Math.abs(c.vy); }
      }

      // Zeichnen
      const sprite = getSprite(c.spec);
      let scale = 1;
      if (c.kind === "node") scale = 1 + Math.sin(c.phase) * 0.05;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(c.dir * scale, scale);
      if (c.kind === "worm") ctx.rotate(Math.sin(c.phase) * 0.12 * c.dir);
      const d = sprite.draw;
      ctx.globalAlpha = 0.92;
      ctx.drawImage(sprite.canvas, -d / 2, -d / 2, d, d);
      ctx.restore();
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  sync();
  requestAnimationFrame(frame);
})();
