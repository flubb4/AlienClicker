/* =========================================================
   SHIP — animiert die Crew-Figuren, die in ihren Räumen
   hin- und herlaufen. Liest die .runner-Elemente, die
   game.js in den aktiven Räumen erzeugt.
   ========================================================= */
"use strict";

(function () {
  const states = new WeakMap();
  let last = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    document.querySelectorAll(".room.active .runner").forEach((r) => {
      const floor = r.parentElement;
      const fw = floor.clientWidth;
      const rw = r.offsetWidth || 30;
      if (!fw) return;

      let s = states.get(r);
      if (!s) {
        s = {
          x: Math.random() * Math.max(1, fw - rw),
          dir: Math.random() < 0.5 ? -1 : 1,
          speed: 26 + Math.random() * 26,
          t: Math.random() * 6,
          pause: 0,
        };
        states.set(r, s);
      }

      s.t += dt;
      // gelegentlich kurz stehen bleiben
      if (s.pause > 0) {
        s.pause -= dt;
      } else {
        if (Math.random() < 0.004) { s.pause = 0.3 + Math.random() * 0.9; }
        else if (Math.random() < 0.004) { s.dir *= -1; }
        s.x += s.dir * s.speed * dt;
      }

      const maxX = Math.max(0, fw - rw);
      if (s.x <= 0) { s.x = 0; s.dir = 1; }
      else if (s.x >= maxX) { s.x = maxX; s.dir = -1; }

      // leichtes Lauf-Wippen, nur wenn in Bewegung
      const moving = s.pause <= 0;
      const bob = moving ? Math.abs(Math.sin(s.t * 9)) * 2.5 : 0;
      // dir = 1 -> nach rechts (Originalblick), dir = -1 -> spiegeln
      r.style.transform = `translate(${s.x.toFixed(1)}px, ${(-bob).toFixed(1)}px) scaleX(${s.dir})`;
    });

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
