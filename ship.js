/* =========================================================
   SHIP — lässt die Crew-Figuren in ihren Raum-Zonen
   umherwandern (Top-Down: 2D-Bewegung zu Zufallszielen).
   Liest die .runner-Elemente, die game.js je Raum erzeugt.
   ========================================================= */
"use strict";

(function () {
  const states = new WeakMap();
  let last = performance.now();

  function pickTarget(s, w, h, rw, rh) {
    s.tx = Math.random() * Math.max(1, w - rw);
    s.ty = Math.random() * Math.max(1, h - rh);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    // Einheitliche Figurengröße an die Schiffshöhe koppeln (nur bei Änderung setzen)
    const deck = document.getElementById("deck");
    if (deck) {
      const ch = Math.round(deck.clientHeight * 0.115);
      if (ch && deck.__ch !== ch) { deck.style.setProperty("--charh", ch + "px"); deck.__ch = ch; }
    }

    // Zonen-Maße einmal pro Frame cachen (kein Layout-Thrashing)
    const zoneDim = new Map();

    document.querySelectorAll(".region .runner").forEach((r) => {
      const zone = r.parentElement;
      let zd = zoneDim.get(zone);
      if (!zd) { zd = { w: zone.clientWidth, h: zone.clientHeight }; zoneDim.set(zone, zd); }
      const w = zd.w, h = zd.h;
      if (!w || !h) return;
      const rw = r.offsetWidth || 24, rh = r.offsetHeight || 40;

      let s = states.get(r);
      if (!s) {
        s = {
          x: Math.random() * Math.max(1, w - rw),
          y: Math.random() * Math.max(1, h - rh),
          tx: 0, ty: 0, dir: 1,
          speed: 22 + Math.random() * 20,
          pause: 0, bobT: Math.random() * 6,
        };
        pickTarget(s, w, h, rw, rh);
        states.set(r, s);
      }

      if (s.pause > 0) {
        s.pause -= dt;
      } else {
        const dx = s.tx - s.x, dy = s.ty - s.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 4) {
          // Ziel erreicht: kurz verschnaufen, neues Ziel
          if (Math.random() < 0.5) s.pause = 0.4 + Math.random() * 1.4;
          pickTarget(s, w, h, rw, rh);
        } else {
          const step = Math.min(dist, s.speed * dt);
          s.x += (dx / dist) * step;
          s.y += (dy / dist) * step;
          if (Math.abs(dx) > 2) s.dir = dx > 0 ? 1 : -1;
          s.bobT += dt;
        }
      }

      const moving = s.pause <= 0;
      const bob = moving ? Math.abs(Math.sin(s.bobT * 9)) * 2 : 0;
      r.style.transform =
        `translate(${s.x.toFixed(1)}px, ${(s.y - bob).toFixed(1)}px) scaleX(${s.dir})`;
      const z = Math.round(s.y); // weiter unten = weiter vorn
      if (s.lastZ !== z) { r.style.zIndex = String(z); s.lastZ = z; }
    });

    requestAnimationFrame(frame);
  }

  // Figurengröße auch unabhängig vom Animations-Loop setzen (robust bei Load/Resize)
  function setCharSize() {
    const deck = document.getElementById("deck");
    if (deck && deck.clientHeight) {
      deck.style.setProperty("--charh", Math.round(deck.clientHeight * 0.115) + "px");
      deck.__ch = Math.round(deck.clientHeight * 0.115);
    }
  }
  window.addEventListener("resize", setCharSize);
  window.addEventListener("load", setCharSize);
  const shipImg = document.getElementById("shipImg");
  if (shipImg) shipImg.addEventListener("load", setCharSize);
  setCharSize();
  setTimeout(setCharSize, 300);

  requestAnimationFrame(frame);
})();
