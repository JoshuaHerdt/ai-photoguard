/* AI-Photoguard – Vorhersage zum Ausprobieren (v4).
   Regler für die fünfte Wellenlänge λ₅. Live gerechnet und als Formel gezeigt:
   Photonenenergie E = h·c/λ, Absorbanz A = ε·c·d (ε aus Literaturdaten, assets/data/methylenblau.js),
   geschluckter Anteil 1 − 10^(−A), Photonen bei gleicher Leistung ∝ λ und daraus – als Hypothese, nicht als
   Messwert – die erwartete Bleichrate k ∝ λ·(1 − 10^(−A)) mit Halbwertszeit t½ = ln 2 / k.
   Alles relativ zur roten LED (660 nm); Beispielprobe c = 10 µmol/L, d = 1 cm. */
(function () {
  "use strict";
  const lab = document.querySelector(".lab");
  if (!lab) return;
  const svg = lab.querySelector(".lab__svg");
  const range = lab.querySelector(".lab__range");
  const out = lab.querySelector(".lab__ctl output");
  const $ = (s) => lab.querySelector(s);
  const T = window.MB_SPEKTRUM;
  if (!svg || !range || !T) return;

  const NS = "http://www.w3.org/2000/svg";
  const X0 = 70, X1 = 616, Y0 = 290, Y1 = 50;
  const L0 = 400, L1 = 750;
  const C_MOL = 10e-6, D_CM = 1; // Beispielprobe
  const xs = (l) => X0 + ((l - L0) / (L1 - L0)) * (X1 - X0);
  const ys = (v) => Y0 - v * (Y0 - Y1);
  const fmt = (v, d) => v.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });

  // ε(λ) linear zwischen den 2-nm-Stützstellen
  function eps(l) {
    if (l <= T[0][0]) return T[0][1];
    for (let i = 1; i < T.length; i++) {
      if (T[i][0] >= l) { const a = T[i - 1], b = T[i]; return a[1] + ((b[1] - a[1]) * (l - a[0])) / (b[0] - a[0]); }
    }
    return T[T.length - 1][1];
  }
  const EPS_MAX = Math.max.apply(null, T.map((r) => r[1]));
  const absorbed = (l) => 1 - Math.pow(10, -eps(l) * C_MOL * D_CM);
  // Form der erwarteten Kurve (Hypothese: jedes geschluckte Photon zählt gleich). Hier kann später
  // Max’ Regressionsmodell eingesetzt werden.
  const modellForm = (l) => l * absorbed(l);
  const rate = modellForm;
  const RATE_REF = rate(660);
  let RATE_MAX = 0;
  for (let l = L0; l <= L1; l += 1) RATE_MAX = Math.max(RATE_MAX, rate(l));

  function wl2rgb(l) {
    let r = 0, g = 0, b = 0;
    if (l < 440) { r = -(l - 440) / 60; b = 1; }
    else if (l < 490) { g = (l - 440) / 50; b = 1; }
    else if (l < 510) { g = 1; b = -(l - 510) / 20; }
    else if (l < 580) { r = (l - 510) / 70; g = 1; }
    else if (l < 645) { r = 1; g = -(l - 645) / 65; }
    else r = 1;
    const f = l < 420 ? 0.3 + (0.7 * (l - 380)) / 40 : l > 700 ? 0.3 + (0.7 * (780 - l)) / 80 : 1;
    const c = (v) => Math.round(255 * Math.pow(v * f, 0.8));
    return "rgb(" + c(r) + "," + c(g) + "," + c(b) + ")";
  }
  const NAMES = [[430, "violett"], [470, "königsblau"], [500, "türkis"], [565, "grün"], [600, "gelb"], [625, "orange"], [650, "rot"], [751, "tiefrot"]];
  const colorName = (l) => NAMES.find((n) => l < n[0])[1];

  // ── Diagramm aufbauen ──
  const mk = (name, attrs, text) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  };
  const g = mk("g", {});
  svg.appendChild(g);
  [0.25, 0.5, 0.75, 1].forEach((v) => g.appendChild(mk("line", { class: "grid", x1: X0, x2: X1, y1: ys(v), y2: ys(v) })));
  g.appendChild(mk("line", { class: "ax", x1: X0, x2: X1, y1: Y0, y2: Y0 }));
  g.appendChild(mk("line", { class: "ax", x1: X0, x2: X0, y1: Y1 - 10, y2: Y0 }));
  g.appendChild(mk("rect", { x: X0, y: Y0 + 5, width: X1 - X0, height: 6, rx: 3, fill: "url(#lab-rainbow)" }));
  for (let l = 400; l <= 750; l += 50) g.appendChild(mk("text", { x: xs(l), y: Y0 + 32, "text-anchor": "middle", class: l % 100 ? "t-odd" : "" }, l === 700 ? "700 nm" : l));
  g.appendChild(mk("text", { x: X0 - 8, y: ys(1) + 4, "text-anchor": "end" }, "100 %"));
  g.appendChild(mk("text", { x: X0 - 8, y: ys(0.5) + 4, "text-anchor": "end" }, "50 %"));
  g.appendChild(mk("text", { x: X0 - 8, y: ys(0) + 4, "text-anchor": "end" }, "0"));

  let dA = "", dR = "";
  for (let l = L0; l <= L1; l += 2) {
    dA += (l === L0 ? "M" : "L") + xs(l).toFixed(1) + " " + ys(eps(l) / EPS_MAX).toFixed(1) + " ";
    dR += (l === L0 ? "M" : "L") + xs(l).toFixed(1) + " " + ys(rate(l) / RATE_MAX).toFixed(1) + " ";
  }
  g.appendChild(mk("path", { class: "absorb", d: dA + "L" + xs(L1) + " " + Y0 + " L" + X0 + " " + Y0 + " Z" }));
  const pred = mk("path", { class: "pred", d: dR });
  g.appendChild(pred);
  // Legende
  const lg = mk("g", { transform: "translate(" + X0 + " " + (Y0 + 68) + ")" });
  lg.appendChild(mk("rect", { x: 0, y: -10, width: 22, height: 10, fill: "rgba(42,99,255,.4)", stroke: "#6f95ff" }));
  lg.appendChild(mk("text", { x: 32, y: 0, class: "lbl-abs" }, "Absorption (Literatur)"));
  const lgPredLine = mk("line", { x1: 0, x2: 22, y1: 21, y2: 21, class: "pred" });
  lg.appendChild(lgPredLine);
  const lgPredTxt = mk("text", { x: 32, y: 26, class: "lbl-pred" }, "erwartete Bleichrate (Schema)");
  lg.appendChild(lgPredTxt);
  g.appendChild(lg);
  // ── Echte Messdaten (assets/data/messdaten.js): Punkte, angepasstes Modell, R² ──
  const MD = window.MB_MESSDATEN || {};
  const PTS = (MD.punkte || []).filter((p) => p && isFinite(p.nm) && isFinite(p.k) && p.nm >= L0 && p.nm <= L1);
  const HAS = PTS.length > 0;
  const UNIT = MD.einheit || "1/min";
  let S = 0, R2 = null;
  if (HAS) {
    // kleinste Quadrate für k = S · modellForm(λ), gewichtet mit 1/σ² (falls Fehler angegeben)
    let num = 0, den = 0;
    PTS.forEach((p) => { const w = p.fehler > 0 ? 1 / (p.fehler * p.fehler) : 1; const f = modellForm(p.nm); num += w * f * p.k; den += w * f * f; });
    S = den > 0 ? num / den : 0;
    if (PTS.length > 1) {
      const mean = PTS.reduce((a, p) => a + p.k, 0) / PTS.length;
      const ssr = PTS.reduce((a, p) => a + Math.pow(p.k - S * modellForm(p.nm), 2), 0);
      const sst = PTS.reduce((a, p) => a + Math.pow(p.k - mean, 2), 0);
      R2 = sst > 0 ? 1 - ssr / sst : null;
    }
    lab.classList.add("has-data");
  }
  const kAbs = (l) => S * modellForm(l);           // Modellwert in echten Einheiten
  const yOf = (k) => k / (S * RATE_MAX);             // auf die Diagrammhöhe bezogen
  const LEDCOL = { 450: "#6f7cff", 480: "#22cfdc", 590: "#ffab2e", 660: "#ff4a3d" };
  if (!HAS) {
    // noch keine Messung: unsere vier LEDs auf der erwarteten Kurve
    [450, 480, 590, 660].forEach((l) => g.appendChild(mk("circle", { class: "pt", cx: xs(l), cy: ys(rate(l) / RATE_MAX), r: 7, fill: LEDCOL[l] })));
  } else {
    pred.setAttribute("class", "pred pred--fit");
    lgPredLine.setAttribute("class", "pred pred--fit");
    lgPredTxt.textContent = "Modell, angepasst an unsere Messpunkte";
    PTS.forEach((p) => {
      const x = xs(p.nm), y = ys(Math.min(1.15, yOf(p.k)));
      if (p.fehler > 0) {
        const y1 = ys(Math.min(1.15, yOf(p.k + p.fehler))), y2 = ys(Math.max(0, yOf(p.k - p.fehler)));
        g.appendChild(mk("line", { class: "err", x1: x, x2: x, y1, y2 }));
        g.appendChild(mk("line", { class: "err", x1: x - 6, x2: x + 6, y1, y2: y1 }));
        g.appendChild(mk("line", { class: "err", x1: x - 6, x2: x + 6, y1: y2, y2 }));
      }
      g.appendChild(mk("circle", { class: "pt pt--data", cx: x, cy: y, r: 7, fill: LEDCOL[p.nm] || "#fff" }));
    });
    if (MD.lambda5 && isFinite(MD.lambda5.k) && isFinite(MD.lambda5.nm)) {
      const p = MD.lambda5, x = xs(p.nm), y = ys(Math.min(1.15, yOf(p.k)));
      g.appendChild(mk("rect", { class: "pt--check", x: x - 7, y: y - 7, width: 14, height: 14, transform: "rotate(45 " + x + " " + y + ")" }));
    }
  }
  // Regler-Markierung
  const cur = mk("g", {});
  const cLine = mk("line", { class: "cursor", y1: Y1 - 6, y2: Y0 });
  const cRing = mk("circle", { class: "cursor-ring", r: 12 });
  const cDot = mk("circle", { class: "cursor-dot", r: 7 });
  const cTxt = mk("text", { y: Y1 - 12, "text-anchor": "middle", class: "lbl-pred" });
  [cLine, cRing, cDot, cTxt].forEach((e) => cur.appendChild(e));
  g.appendChild(cur);

  // Ziehen direkt im Diagramm
  function fromEvent(e) {
    const r = svg.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * 640;
    return Math.round(L0 + ((vx - X0) / (X1 - X0)) * (L1 - L0));
  }
  let dragging = false;
  svg.addEventListener("pointerdown", (e) => { dragging = true; try { svg.setPointerCapture(e.pointerId); } catch (err) {} set(fromEvent(e)); });
  svg.addEventListener("pointermove", (e) => { if (dragging) set(fromEvent(e)); });
  const stop = () => (dragging = false);
  svg.addEventListener("pointerup", stop);
  svg.addEventListener("pointercancel", stop);

  // ── Rechnung anzeigen ──
  const el = {
    sw: $(".calc__swatch"), nm: $("[data-c='nm']"), name: $("[data-c='name']"),
    e: $("[data-c='e']"), a: $("[data-c='a']"), ab: $("[data-c='ab']"), abBar: $("[data-c='abbar']"),
    n: $("[data-c='n']"), k: $("[data-c='k']"), kBar: $("[data-c='kbar']"), t: $("[data-c='t']"),
  };
  // Zahl mit drei gültigen Stellen, deutsch formatiert
  function num3(v) {
    if (!isFinite(v) || v === 0) return "0";
    const d = Math.max(0, 2 - Math.floor(Math.log10(Math.abs(v))));
    return fmt(v, Math.min(6, d));
  }
  // Hinweistext unter dem Diagramm
  const cap = lab.querySelector(".lab__fig figcaption");
  if (cap && HAS) {
    let t = "Punkte: unsere Messwerte (" + PTS.length + " Lichtfarben, Bleichrate k in " + UNIT + (PTS.some((p) => p.datum) ? ", Stand " + PTS.filter((p) => p.datum).pop().datum : "") + "). Linie: Modell, angepasst an die Punkte" + (R2 != null ? ", R² = " + fmt(R2, 3) : "") + ". Blau: Absorption aus Literaturdaten [18].";
    if (MD.lambda5 && isFinite(MD.lambda5.k)) {
      const pk = kAbs(MD.lambda5.nm), dev = (MD.lambda5.k - pk) / pk * 100;
      t += " Raute: Nachmessung bei " + MD.lambda5.nm + " nm – " + (Math.abs(dev) < 0.5 ? "trifft die Vorhersage" : "weicht " + fmt(Math.abs(dev), 0) + " % " + (dev > 0 ? "nach oben" : "nach unten") + " von der Vorhersage ab") + ".";
    }
    cap.textContent = t;
  }
  function set(l) {
    l = Math.max(L0, Math.min(L1, Math.round(l)));
    if (+range.value !== l) range.value = l;
    const col = wl2rgb(l);
    const E_J = 1.98645e-25 / (l * 1e-9);
    const E_eV = 1239.84 / l;
    const ep = eps(l);
    const A = ep * C_MOL * D_CM;
    const ab = absorbed(l);
    const nRel = l / 660;
    const kRel = rate(l) / RATE_REF;
    const kOfMax = rate(l) / RATE_MAX;
    // Diagramm
    const x = xs(l), y = ys(Math.min(1.15, kOfMax));
    cLine.setAttribute("x1", x); cLine.setAttribute("x2", x);
    cDot.setAttribute("cx", x); cDot.setAttribute("cy", y);
    cRing.setAttribute("cx", x); cRing.setAttribute("cy", y);
    cTxt.setAttribute("x", Math.min(X1 - 30, Math.max(X0 + 30, x)));
    cTxt.textContent = "λ₅ = " + l + " nm";
    // Text
    if (out) out.textContent = l + " nm";
    lab.style.setProperty("--sw", col);
    if (el.nm) el.nm.textContent = l + " nm";
    if (el.name) el.name.textContent = colorName(l);
    if (el.e) el.e.innerHTML = "= 6,626·10⁻³⁴ J·s · 2,998·10⁸ m/s ÷ (" + l + "·10⁻⁹ m)<br><b>= " + fmt(E_J * 1e19, 2) + "·10⁻¹⁹ J ≈ " + fmt(E_eV, 2) + " eV</b>";
    if (el.a) el.a.innerHTML = "= " + fmt(Math.round(ep), 0) + " L/(mol·cm) · 10 µmol/L · 1 cm<br><b>= " + fmt(A, A < 0.1 ? 3 : 2) + "</b>";
    if (el.ab) el.ab.innerHTML = "1 − 10<sup>−" + fmt(A, A < 0.1 ? 3 : 2) + "</sup> = <b>" + fmt(ab * 100, ab < 0.1 ? 1 : 0) + " %</b> des Lichts";
    if (el.abBar) el.abBar.style.setProperty("--w", (ab * 100).toFixed(1) + "%");
    if (el.n) el.n.innerHTML = "λ ÷ 660 nm = <b>" + fmt(nRel, 2) + "</b>";
    if (el.k) el.k.innerHTML = HAS
      ? "Vorhersage: <b>k ≈ " + num3(kAbs(l)) + " " + UNIT + "</b> (" + fmt(kRel * 100, kRel < 0.1 ? 1 : 0) + " % von k bei 660 nm)"
      : "<b>" + (kRel >= 0.995 && kRel <= 1.005 ? "gleich schnell wie" : fmt(kRel * 100, kRel < 0.1 ? 1 : 0) + " % von") + "</b> k bei 660 nm";
    if (el.kBar) el.kBar.style.setProperty("--w", Math.min(100, kOfMax * 100).toFixed(1) + "%");
    if (el.t && HAS && kAbs(l) > 0) {
      const th = Math.LN2 / kAbs(l);
      el.t.innerHTML = "Halbwertszeit etwa <b>" + num3(th) + " " + UNIT.replace(/^1\//, "") + "</b> (Modell)";
    } else if (el.t) {
      const ratio = 1 / kRel;
      el.t.innerHTML = ratio > 1.05 ? "Halbwertszeit etwa <b>" + fmt(ratio, ratio < 10 ? 1 : 0) + "-mal so lang</b> wie bei 660 nm"
        : ratio < 0.95 ? "Halbwertszeit etwa <b>" + fmt(ratio, 2) + "-mal</b> so lang wie bei 660 nm"
        : "Halbwertszeit <b>etwa gleich</b> wie bei 660 nm";
    }
  }
  range.addEventListener("input", () => set(+range.value));
  lab.querySelectorAll(".lab__presets button").forEach((b) => b.addEventListener("click", () => set(+b.dataset.nm)));
  set(+range.value || 530);
})();
