// Agent Boss sound design. Pure Web Audio synthesis, no assets.
// The game calls window.abSfx(event, ...args) at key moments; UI taps are picked up via DOM events.
// Toggle with the "M" key (outside text fields) or ?mute in the URL. State persists in localStorage.
(() => {
  const VOLUME = 0.5;
  const STORE = "ab-sound-muted";

  let muted = localStorage.getItem(STORE) === "1" || /[?&]mute\b/.test(location.search);
  let ctx = null;
  let out = null;
  let master = null;
  let verb = null;

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : VOLUME;
      const tame = ctx.createBiquadFilter();
      tame.type = "lowpass";
      tame.frequency.value = 6500;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.2;
      master.connect(tame).connect(comp).connect(ctx.destination);
      out = ctx.createGain();
      out.connect(master);
      verb = ctx.createConvolver();
      verb.buffer = room(1.1);
      const wet = ctx.createGain();
      wet.gain.value = 0.22;
      verb.connect(wet).connect(master);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function room(sec) {
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return buf;
  }

  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function bus(pan, wet) {
    const g = ctx.createGain();
    let node = g;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      node = p;
    }
    node.connect(out);
    if (wet) {
      const s = ctx.createGain();
      s.gain.value = wet;
      node.connect(s).connect(verb);
    }
    return g;
  }

  // One enveloped oscillator voice. `at` is seconds from now.
  function tone({ m, f, to, type = "triangle", at = 0, dur = 0.15, vol = 0.12, atk = 0.005, pan = 0, wet = 0.25, cut, detune = 0 }) {
    if (!audio() || muted) return;
    const t0 = ctx.currentTime + at + 0.005;
    const o = ctx.createOscillator();
    o.type = type;
    o.detune.value = detune;
    const f0 = f || hz(m);
    o.frequency.setValueAtTime(f0, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur * 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = o;
    if (cut) {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = cut;
      o.connect(lp);
      node = lp;
    }
    node.connect(g).connect(bus(pan, wet));
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  // Soft pluck: sine body plus a quiet triangle overtone.
  function pluck(m, o = {}) {
    tone({ m, type: "sine", dur: 0.22, vol: 0.12, ...o });
    tone({ m: m + 12, type: "triangle", dur: 0.08, ...o, vol: (o.vol || 0.12) * 0.25 });
  }

  function whoosh({ at = 0, dur = 0.35, from = 400, to = 2400, vol = 0.05, pan = 0, panTo }) {
    if (!audio() || muted) return;
    const t0 = ctx.currentTime + at + 0.005;
    const src = ctx.createBufferSource();
    src.buffer = noise();
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(from, t0);
    bp.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = g;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(pan, t0);
      if (panTo != null) p.pan.linearRampToValueAtTime(panTo, t0 + dur);
      g.connect(p);
      node = p;
    }
    src.connect(bp).connect(g);
    node.connect(out);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  const throttles = {};
  function every(key, ms) {
    const now = performance.now();
    if (throttles[key] && now - throttles[key] < ms) return false;
    throttles[key] = now;
    return true;
  }

  const side = (player) => (player === 0 ? -0.45 : player === 1 ? 0.45 : 0);

  // D major pentatonic around D5, keeps everything consonant with whatever the café plays-ish.
  const PENTA = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86];

  const sfx = {
    tap: () => tone({ m: 84, type: "sine", dur: 0.05, vol: 0.06, wet: 0.05 }),
    confirm: () => {
      pluck(74, { vol: 0.1 });
      pluck(81, { at: 0.06, vol: 0.1 });
    },
    back: () => {
      pluck(76, { vol: 0.07 });
      pluck(69, { at: 0.06, vol: 0.07 });
    },
    pickOn: (i) => {
      const base = [69, 74, 78][i] || 74;
      pluck(base, { vol: 0.1 });
      pluck(base + 7, { at: 0.05, vol: 0.08 });
    },
    pickOff: () => tone({ m: 66, to: hz(62), type: "sine", dur: 0.14, vol: 0.08 }),
    nope: () => {
      tone({ m: 50, type: "square", dur: 0.07, vol: 0.05, cut: 700, wet: 0.05 });
      tone({ m: 50, type: "square", at: 0.09, dur: 0.07, vol: 0.05, cut: 700, wet: 0.05 });
    },
    slide: (up) => tone({ f: up ? 520 : 820, to: up ? 820 : 520, type: "sine", dur: 0.12, vol: 0.07, wet: 0.1 }),
    check: (on) => pluck(on ? 81 : 74, { vol: 0.08, dur: 0.12 }),
    sparkle: (pan = 0, vol = 0.05) => {
      [86, 90, 93, 98].forEach((m, i) => tone({ m, type: "sine", at: i * 0.045, dur: 0.25, vol, pan, wet: 0.5 }));
    },
    error: () => {
      tone({ m: 57, type: "triangle", dur: 0.14, vol: 0.1, cut: 1800 });
      tone({ m: 53, type: "triangle", at: 0.12, dur: 0.22, vol: 0.1, cut: 1800 });
    },
    start: () => {
      [62, 66, 69, 74].forEach((m, i) => pluck(m, { at: i * 0.07, vol: 0.09 }));
    },
    reveal: () => {
      whoosh({ dur: 0.5, from: 300, to: 3000, vol: 0.04 });
      [74, 78, 81, 86].forEach((m, i) => pluck(m, { at: 0.25 + i * 0.08, vol: 0.1 }));
      tone({ m: 50, type: "triangle", at: 0.25, dur: 1.2, vol: 0.07, atk: 0.05 });
      sfx.sparkle(0, 0.035);
    },
    ready: () => {
      pluck(69, { vol: 0.08, pan: -0.4 });
      pluck(74, { at: 0.12, vol: 0.08, pan: 0.4 });
      pluck(78, { at: 0.24, vol: 0.09 });
    },
    planStart: () => {
      tone({ m: 74, type: "triangle", dur: 0.12, vol: 0.09 });
      tone({ m: 74, type: "triangle", at: 0.14, dur: 0.12, vol: 0.09 });
      tone({ m: 81, type: "triangle", at: 0.28, dur: 0.35, vol: 0.11 });
    },
    countdown: (last) => tone({ m: last ? 86 : 79, type: "sine", dur: 0.06, vol: last ? 0.09 : 0.06, wet: 0.1 }),
    planDone: () => {
      [62, 69, 74, 78, 81].forEach((m, i) => pluck(m, { at: i * 0.06, vol: 0.09, dur: 0.6 }));
      tone({ m: 50, type: "sine", dur: 1.4, vol: 0.08, atk: 0.04 });
    },
    taskDone: (pan) => {
      if (!every("taskDone", 140)) return;
      const m = PENTA[4 + Math.floor(Math.random() * 5)];
      pluck(m, { vol: 0.05, pan, dur: 0.15 });
    },
    penalty: (pan) => {
      if (!every("penalty", 200)) return;
      tone({ m: 50, to: hz(45), type: "triangle", dur: 0.25, vol: 0.09, pan, cut: 1200 });
    },
    warn: (pan) => {
      if (!every("warn", 250)) return;
      tone({ m: 71, type: "sine", dur: 0.09, vol: 0.05, pan });
      tone({ m: 71, type: "sine", at: 0.11, dur: 0.09, vol: 0.04, pan });
    },
    superpower: (pan) => {
      if (!every("super", 200)) return;
      tone({ f: 300, to: 1200, type: "sine", dur: 0.18, vol: 0.05, pan, wet: 0.3 });
      sfx.sparkle(pan, 0.06);
    },
    send: (pan) => {
      tone({ f: 500, to: 1400, type: "sine", dur: 0.16, vol: 0.07, pan });
      whoosh({ dur: 0.25, from: 800, to: 4000, vol: 0.025, pan });
    },
    verdict: (k, pan) => {
      const v = 0.1;
      if (k <= 0) {
        tone({ m: 62, to: hz(55), type: "triangle", dur: 0.3, vol: v, pan, cut: 1500 });
        tone({ m: 55, to: hz(50), type: "triangle", at: 0.25, dur: 0.45, vol: v, pan, cut: 1200 });
      } else if (k === 1) {
        pluck(66, { vol: v, pan });
        pluck(62, { at: 0.12, vol: v, pan, dur: 0.35 });
      } else if (k === 2) {
        pluck(69, { vol: v, pan });
        pluck(71, { at: 0.12, vol: v, pan, dur: 0.35 });
      } else {
        const notes = k === 3 ? [69, 74, 78] : k === 4 ? [69, 74, 78, 81] : [69, 74, 78, 81, 86];
        notes.forEach((m, i) => pluck(m, { at: i * 0.075, vol: v, pan, dur: 0.4 }));
        if (k === 5) sfx.sparkle(pan, 0.05);
      }
    },
    battleStart: () => {
      whoosh({ dur: 0.6, from: 200, to: 1600, vol: 0.04 });
      [62, 69, 74].forEach((m, i) => tone({ m, type: "triangle", at: 0.2 + i * 0.1, dur: 0.5, vol: 0.08 }));
    },
    guest: (player, count) => {
      if (!every("guest" + player, 55)) return;
      const m = PENTA[count % PENTA.length] + (player ? 0 : -12) + 12;
      tone({ m, type: "sine", dur: 0.09, vol: 0.045, pan: side(player) * 1.4, wet: 0.15 });
    },
    steal: (from) => {
      whoosh({ dur: 0.9, from: 600, to: 1800, vol: 0.05, pan: side(from) * 1.6, panTo: side(1 - from) * 1.6 });
      tone({ m: 64, to: hz(76), type: "sine", at: 0.1, dur: 0.5, vol: 0.05, pan: side(1 - from) });
    },
    card: (player, good, skill) => {
      if (!every("card" + player, 150)) return;
      const pan = side(player);
      if (skill) return sfx.superpower(pan);
      if (good) {
        pluck(74, { vol: 0.06, pan });
        pluck(78, { at: 0.06, vol: 0.06, pan });
      } else {
        tone({ m: 57, to: hz(52), type: "triangle", dur: 0.22, vol: 0.07, pan, cut: 1400 });
      }
    },
    battleEnd: () => {
      tone({ m: 81, type: "sine", dur: 0.5, vol: 0.08 });
      tone({ m: 86, type: "sine", at: 0.16, dur: 0.8, vol: 0.08 });
    },
    fanfare: (winner) => {
      const pan = side(winner) * 0.6;
      const line = [[62, 0], [66, 0.12], [69, 0.24], [74, 0.36], [69, 0.52], [74, 0.64]];
      line.forEach(([m, at]) => {
        tone({ m, type: "square", at, dur: 0.16, vol: 0.035, cut: 2200, pan });
        tone({ m, type: "triangle", at, dur: 0.18, vol: 0.07, pan });
      });
      [62, 66, 69, 74, 78].forEach((m) => tone({ m, type: "triangle", at: 0.8, dur: 1.6, vol: 0.05, atk: 0.02, pan }));
      tone({ m: 38, type: "sine", at: 0.8, dur: 1.6, vol: 0.08, atk: 0.02 });
      setTimeout(() => sfx.sparkle(pan, 0.04), 900);
    },
    board: (rows) => {
      for (let i = 0; i < Math.min(rows, 10); i++) tone({ m: PENTA[i], type: "sine", at: i * 0.08, dur: 0.18, vol: 0.04, wet: 0.3 });
    },
  };

  // Phone ring when the agent needs its human. Repeats until the player types, answers or leaves.
  let ringTimer = null;
  function ringOnce(player) {
    const pan = side(player);
    for (let burst = 0; burst < 2; burst++) {
      for (let i = 0; i < 8; i++) {
        const at = burst * 0.55 + i * 0.05;
        tone({ m: i % 2 ? 88 : 84, type: "sine", at, dur: 0.05, vol: 0.07, atk: 0.003, pan, wet: 0.2 });
      }
    }
  }
  function ring(player) {
    stopRing();
    let n = 0;
    tone({ f: 200, to: 900, type: "sine", dur: 0.25, vol: 0.04, pan: side(player) });
    const go = () => {
      ringOnce(player);
      if (++n < 4) ringTimer = setTimeout(go, 2200);
    };
    ringTimer = setTimeout(go, 150);
  }
  function stopRing() {
    clearTimeout(ringTimer);
    ringTimer = null;
  }

  // Soft computer "thinking" bleeps while the AI works.
  let thinkTimer = null;
  function think(pan = 0, vol = 0.025) {
    stopThink();
    const go = () => {
      tone({ m: PENTA[3 + Math.floor(Math.random() * 7)] + 12, type: "sine", dur: 0.06, vol, pan, wet: 0.35 });
      thinkTimer = setTimeout(go, 140 + Math.random() * 160);
    };
    go();
  }
  function stopThink() {
    clearTimeout(thinkTimer);
    thinkTimer = null;
  }

  let screen = null;
  let errSig = "";
  let lastSec = null;
  let pendingLogs = [];
  let waiting = false;

  function onScreen(s, winner) {
    stopRing();
    stopThink();
    waiting = false;
    lastSec = null;
    if (s === "making") think();
    else if (s === "summary") sfx.reveal();
    else if (s === "ready") sfx.ready();
    else if (s === "plan") sfx.planStart();
    else if (s === "battle") sfx.battleStart();
    else if (s === "winner") sfx.fanfare(winner);
    else if (s === "board") setTimeout(() => sfx.board(document.querySelectorAll("#app .row").length), 150);
  }

  function checkErrors() {
    const texts = [...document.querySelectorAll("#app .err")].map((e) => e.textContent.trim()).filter(Boolean).join("|");
    if (texts && texts !== errSig) setTimeout(sfx.error, 90);
    errSig = texts;
  }

  const handlers = {
    render(s, winner) {
      if (s !== screen) {
        screen = s;
        errSig = "";
        onScreen(s, winner);
      }
      checkErrors();
    },
    plan(ev, t, total, player) {
      if (ev === "hitl") return ring(player);
      if (ev === "done") {
        pendingLogs = [];
        stopRing();
        return sfx.planDone();
      }
      const left = Math.ceil(total - t);
      if (left !== lastSec) {
        if (lastSec != null && left <= 5 && left > 0) sfx.countdown(left === 1);
        lastSec = left;
      }
    },
    log(tone, player) {
      if (screen !== "plan") return;
      pendingLogs.push([tone, player]);
      if (pendingLogs.length === 1)
        setTimeout(() => {
          const batch = pendingLogs;
          pendingLogs = [];
          for (const [t, p] of batch) {
            const pan = side(p);
            if (t === "done") sfx.taskDone(pan);
            else if (t === "pen") sfx.penalty(pan);
            else if (t === "skill") sfx.superpower(pan);
            else if (t === "warn") sfx.warn(pan);
          }
        }, 0);
    },
    hitlSend(player) {
      stopRing();
      sfx.send(side(player));
      waiting = true;
      setTimeout(() => waiting && think(side(player), 0.02), 200);
    },
    hitlResult(player, k) {
      waiting = false;
      stopThink();
      sfx.verdict(k, side(player));
    },
    err() {
      stopRing();
      sfx.error();
    },
    guest: (p, n) => sfx.guest(p, n),
    steal: (p) => sfx.steal(p),
    card: (p, good, skill) => sfx.card(p, good, skill),
    battleEnd: () => sfx.battleEnd(),
  };

  window.abSfx = (ev, ...args) => {
    try {
      handlers[ev] && handlers[ev](...args);
    } catch (e) {
      console.warn("sfx", ev, e);
    }
  };
  // Audition from the console: abSfx.demo("fanfare", 1), abSfx.demo("ring", 0). abSfx.list() shows all names.
  window.abSfx.demo = (name, ...args) => (name === "ring" ? ring(args[0] || 0) : name === "think" ? think() : sfx[name](...args));
  window.abSfx.stop = () => (stopRing(), stopThink());
  window.abSfx.list = () => Object.keys(sfx).concat("ring", "think");

  // UI taps. Capture phase on document runs before the game's own handler, so pre-click state is readable.
  document.addEventListener(
    "click",
    (e) => {
      audio();
      const el = e.target.closest("button, [data-act], label.check");
      if (!el || el.disabled) return;
      if (el.matches("label.check")) return;
      const act = el.dataset.act;
      if (act === "pick") {
        const on = el.getAttribute("aria-pressed") === "true";
        const count = document.querySelectorAll('[data-act="pick"][aria-pressed="true"]').length;
        if (on) return sfx.pickOff();
        if (count >= 3) return sfx.nope();
        return sfx.pickOn(count);
      }
      if (act === "up" || act === "down") return sfx.slide(act === "up");
      if (act === "insp") return sfx.sparkle(0, 0.04);
      if (act === "start" || act === "startPlan") return sfx.start();
      if (act === "hitlBack") return sfx.confirm();
      if (el.classList.contains("back")) return sfx.back();
      if (el.classList.contains("btn") && !el.classList.contains("ghost")) {
        if (el.type === "submit" && el.form && el.form.id === "hitlForm") return;
        return sfx.confirm();
      }
      sfx.tap();
    },
    true
  );

  document.addEventListener(
    "change",
    (e) => {
      if (e.target.matches && e.target.matches('input[type="checkbox"]')) sfx.check(e.target.checked);
    },
    true
  );

  document.addEventListener("submit", () => (errSig = ""), true);

  document.addEventListener(
    "input",
    (e) => {
      if (e.target.id === "hans") stopRing();
    },
    true
  );

  document.addEventListener(
    "keydown",
    (e) => {
      audio();
      if (e.key !== "m" && e.key !== "M") return;
      if (e.target.closest && e.target.closest("input, textarea, [contenteditable]")) return;
      muted = !muted;
      localStorage.setItem(STORE, muted ? "1" : "0");
      if (master) master.gain.setTargetAtTime(muted ? 0 : VOLUME, ctx.currentTime, 0.02);
      if (!muted) sfx.check(true);
    },
    true
  );

  document.addEventListener("pointerdown", audio, { capture: true, once: true });
})();
