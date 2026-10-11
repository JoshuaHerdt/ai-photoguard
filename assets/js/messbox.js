/* AI-Photoguard – die Messbox als 3D-Rundgang (three.js r128, lokal unter assets/vendor), v4.
   8 Stationen von außen nach innen. Weiter/Zurück, Striche, Pfeiltasten oder automatischer Rundgang;
   Ziehen dreht das Modell. Kein Scroll-Pinning – die Seite scrollt ganz normal (wichtig für Safari/iOS).
   v4: Nachtstudio statt hellem Studio; Station 5: Lichtfarbe selbst wählen; Station 6: Lichttakt in Echtzeit
   (11 s an, 4 s messen) mit Anzeige, was das Spektrometer sieht; Station 8: die ganze Box aufgeschnitten.
   Beschriftungen zeigen auf echte Bauteile – in der Explosionsansicht sinkt der Boden mit ab, damit nichts
   darin verschwindet.
   Direkt verlinkbar: messbox.html#station-5 öffnet Station 5 (praktisch für einen QR-Code an der Box).
   Modell: assets/data/messbox-data.js (erzeugt von _werkzeuge/build_model.py aus dem Gesamtmodell v4.1). */
(function () {
  "use strict";

  const section = document.querySelector(".mbx");
  if (!section) return;
  const N = 8;
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, el = section) => el.querySelector(s);
  const $$ = (s, el = section) => Array.from(el.querySelectorAll(s));
  const canvas = $(".mbx__canvas");
  const svg = $(".mbx__lines");
  const labWrap = $(".mbx__labels");
  const ui = $(".mbx__ui");
  const panels = $$(".mbx__panel");
  const dots = $$(".mbx__dots button");
  const stationBtns = $$(".mbx__stations button");
  const prevBtn = $(".mbx__btn--prev");
  const nextBtn = $(".mbx__btn--next:not(.mbx__btn--chapter)");
  const chapterBtn = $(".mbx__btn--chapter");
  const playBtn = $(".mbx__play");
  const hint = $(".mbx__hint");
  const ledBtns = $$(".ledsel button");
  const ledA = $("[data-li='a']");
  const ledE = $("[data-li='e']");
  const ledBar = $(".absbar i");
  const takt = $(".takt");
  const taktLabel = $(".takt__label");
  const taktLeft = $(".takt__left");
  const taktHead = $(".takt__bar i");
  const scopeState = $(".scope__state");
  const scopeLed = $(".scope .sc-led");

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const sio = (u) => 0.5 - 0.5 * Math.cos(Math.PI * u);
  const easeIO = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

  // ── Die vier LEDs: Farbe, Beschriftung, Absorption von Methylenblau (Literaturdaten, Quelle [18]) und Photonenenergie ──
  const LEDS = [
    { nm: 660, hex: 0xff3b2f, css: "#ff4a3d", txt: "660 nm · tiefrot", abs: 97 },
    { nm: 590, hex: 0xffa21a, css: "#ffab2e", txt: "590 nm · gelb", abs: 30 },
    { nm: 480, hex: 0x12c6d6, css: "#22cfdc", txt: "480 nm · türkis", abs: 3 },
    { nm: 450, hex: 0x4d5bff, css: "#6f7cff", txt: "450 nm · königsblau", abs: 2 },
  ];
  const fmt = (v, d) => v.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
  let ledTarget = 0;   // gewählte Farbe
  let ledShown = 0;    // Farbe, die gerade im Modell leuchtet
  let swapT0 = -1e9;   // Beginn des letzten Modulwechsels
  let lastPick = -1e9; // letzte Auswahl von Hand (dann kein automatischer Farbwechsel im Rundgang)
  function setLedUI(i) {
    const L = LEDS[i];
    ledBtns.forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
    if (ledA) ledA.textContent = "≈ " + L.abs + " % des Maximums";
    if (ledE) ledE.textContent = fmt(1239.84 / L.nm, 2) + " eV pro Photon";
    if (ledBar) { ledBar.style.setProperty("--w", Math.max(2, L.abs) + "%"); ledBar.style.setProperty("--c", L.css); }
    if (scopeLed) {
      scopeLed.setAttribute("transform", "translate(" + (((L.nm - 660) / 350) * 300).toFixed(1) + " 0)");
      scopeLed.style.stroke = L.css;
      scopeLed.style.fill = L.css + "55";
    }
  }
  function pickLed(i, byHand) {
    if (byHand) lastPick = performance.now();
    if (i === ledTarget) return;
    ledTarget = i;
    swapT0 = performance.now();
    setLedUI(i);
    if (api) api.kick();
  }
  ledBtns.forEach((b, j) => b.addEventListener("click", () => pickLed(j, true)));
  setLedUI(0);

  // ── Station aus der Adresse (#station-1 … #station-8) ──
  const m = /station-(\d)/.exec(location.hash);
  let target = m ? Math.max(0, Math.min(N - 1, parseInt(m[1], 10) - 1)) : 0;

  // ── Bedienung (funktioniert schon, bevor das 3D-Modell geladen ist) ──
  let api = null; // wird von init() gesetzt
  function setUI(i) {
    panels.forEach((p, j) => p.classList.toggle("is-on", j === i));
    dots.forEach((d, j) => {
      d.classList.toggle("is-on", j === i);
      d.classList.toggle("is-past", j < i);
      if (j === i) d.setAttribute("aria-current", "step"); else d.removeAttribute("aria-current");
    });
    stationBtns.forEach((b, j) => b.classList.toggle("is-on", j === i));
    prevBtn.disabled = i === 0;
    // An der letzten Station führt der Knopf direkt zum nächsten Kapitel.
    const last = i === N - 1;
    nextBtn.hidden = last;
    if (chapterBtn) { if (last && chapterBtn.hidden) chapterArmed = performance.now(); chapterBtn.hidden = !last; }
    const sc = $(".mbx__panels");
    if (sc) { sc.scrollTop = 0; requestAnimationFrame(moreHint); setTimeout(moreHint, 700); }
    try { history.replaceState(null, "", i === 0 ? location.pathname + location.search : "#station-" + (i + 1)); } catch (e) { /* eingebettete Ansicht ohne Verlauf */ }
  }
  // Handy: Textfeld einklappen, damit das 3D-Modell mehr Platz bekommt (wird gemerkt)
  const foldBtn = $(".mbx__fold");
  function setFold(on) {
    section.classList.toggle("is-folded", on);
    if (foldBtn) { foldBtn.setAttribute("aria-expanded", String(!on)); foldBtn.querySelector("span").textContent = on ? "Mehr Text" : "Weniger Text"; }
    try { localStorage.setItem("apg-mbx-fold", on ? "1" : "0"); } catch (e) { /* privat */ }
    if (typeof moreHint === "function") { requestAnimationFrame(moreHint); setTimeout(moreHint, 450); }
  }
  if (foldBtn) foldBtn.addEventListener("click", () => setFold(!section.classList.contains("is-folded")));
  try { if (localStorage.getItem("apg-mbx-fold") === "1") setFold(true); } catch (e) { /* privat */ }

  // Passt der Text nicht ganz ins Textfeld (Handy), blendet der untere Rand weich aus – Zeichen zum Weiterscrollen.
  const panelsBox = $(".mbx__panels");
  function moreHint() {
    if (!panelsBox) return;
    const more = panelsBox.scrollHeight - panelsBox.clientHeight - panelsBox.scrollTop > 6;
    panelsBox.classList.toggle("is-more", more);
  }
  if (panelsBox) {
    panelsBox.addEventListener("scroll", moreHint, { passive: true });
    window.addEventListener("resize", moreHint);
    setTimeout(moreHint, 400);
  }
  function go(i, fromTour) {
    i = Math.max(0, Math.min(N - 1, i));
    if (!fromTour) setTour(false);
    if (i === target && !(api && api.moving())) return;
    target = i;
    setUI(i);
    if (api) api.goTo(i);
  }
  // Erscheint „Kapitel 2“ an der Stelle von „Weiter“, zählt ein versehentlicher Doppeltipp nicht als Klick
  var chapterArmed = 0; // var: wird schon in setUI() benutzt
  if (chapterBtn) chapterBtn.addEventListener("click", (e) => { if (performance.now() - chapterArmed < 700) e.preventDefault(); });
  prevBtn.addEventListener("click", () => go(target - 1));
  nextBtn.addEventListener("click", () => go(target + 1));
  dots.forEach((d, j) => d.addEventListener("click", () => go(j)));
  stationBtns.forEach((b, j) => b.addEventListener("click", () => go(j)));
  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, textarea, select, .carousel__track")) return;
    const r = section.getBoundingClientRect();
    if (r.bottom < window.innerHeight * 0.4 || r.top > window.innerHeight * 0.6) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(target + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(target - 1); }
  });

  // Automatischer Rundgang
  let touring = false;
  let tourTimer = 0;
  function setTour(on) {
    touring = on;
    playBtn.classList.toggle("is-playing", on);
    $("span", playBtn).textContent = on ? "Pause" : "Automatisch";
    playBtn.setAttribute("aria-label", on ? "Rundgang anhalten" : "Rundgang automatisch abspielen");
    clearTimeout(tourTimer);
    if (on) {
      if (target === N - 1) go(0, true);
      else scheduleTour(api ? 600 : 7000);
    }
  }
  function scheduleTour(ms) {
    clearTimeout(tourTimer);
    tourTimer = setTimeout(() => {
      if (!touring) return;
      if (target >= N - 1) { setTour(false); return; }
      go(target + 1, true);
    }, ms);
  }
  playBtn.addEventListener("click", () => setTour(!touring));

  setUI(target);

  // ── Ohne WebGL: Stationen als Liste ──
  function goStatic(why) {
    if (why) console.warn("Messbox: Textfassung, weil", why);
    setTour(false);
    section.classList.add("is-static");
    section.classList.remove("is-gl");
    section.style.setProperty("--dark", "0");
  }

  // ── three.js und Modelldaten nachladen (beides liegt lokal – läuft auch ohne Internet) ──
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = res;
      s.onerror = () => rej(new Error("Laden fehlgeschlagen: " + src));
      document.head.appendChild(s);
    });
  }
  // Bei sehr langsamem Netz erscheint nach 20 s erst die Textfassung – kommt das Modell danach doch noch an,
  // wird automatisch auf 3D umgeschaltet.
  const slow = setTimeout(() => goStatic("das Laden dauert sehr lange"), 20000);
  const THREE_SRC = window.APG_THREE_SRC || "assets/vendor/three.min.js";
  Promise.all([window.THREE ? Promise.resolve() : loadScript(THREE_SRC), loadScript("assets/data/messbox-data.js")])
    .then(() => {
      clearTimeout(slow);
      section.classList.remove("is-static");
      try { init(); } catch (e) { goStatic(e); }
    })
    .catch((e) => { clearTimeout(slow); goStatic(e); });

  // ── Szene ──
  function init() {
    const THREE = window.THREE;
    const D = window.MESSBOX_DATA;
    if (!THREE || !D || !window.MESSBOX_BIN) throw new Error("Daten fehlen");

    const SX = -42; // optische Achse (Küvette / LED-Kopf)
    const small = () => window.innerWidth < 1000;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.localClippingEnabled = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); goStatic("WebGL-Kontext verloren"); });

    // Nachtstudio (außen) und Dunkelkammer (innen): zwischen beiden wird mit --dark weich überblendet
    const NIGHT = { hemi: 0.95, hemiSky: 0xdfe3ea, hemiGround: 0x26282e, key: 0.95, fill: 0.34, rim: 0.8, fog: 0x121317, near: 1100, far: 3300, floor: 0x1a1b20, grid: 0x45484f, gridA: 0.38 };   // v6: neutral statt Nachtblau
    const DARKROOM = { hemi: 0.66, hemiSky: 0xcfd5e0, hemiGround: 0x1b1c21, key: 0.9, fill: 0.3, rim: 0.95, fog: 0x0b0c0f, near: 1100, far: 3300, floor: 0x131418, grid: 0x393c43, gridA: 0.46 };

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(NIGHT.fog, NIGHT.near, NIGHT.far);
    const camera = new THREE.PerspectiveCamera(30, 1, 20, 9000);
    camera.up.set(0, 0, 1);
    const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 400); // schneidet y > Wert weg
    const CLIP = [cutPlane];

    // Licht
    const hemi = new THREE.HemisphereLight(NIGHT.hemiSky, NIGHT.hemiGround, NIGHT.hemi);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, NIGHT.key);
    key.position.set(320, 520, 640);
    key.castShadow = true;
    const sm = small() ? 1024 : 2048;
    key.shadow.mapSize.set(sm, sm);
    Object.assign(key.shadow.camera, { left: -460, right: 460, top: 460, bottom: -460, near: 10, far: 2400 });
    key.shadow.bias = -0.0008;
    scene.add(key, key.target);
    const fill = new THREE.DirectionalLight(0xffd7b0, NIGHT.fill);
    fill.position.set(-420, 320, 220);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xc9d3e6, NIGHT.rim);
    rim.position.set(-520, -420, 300);
    scene.add(rim);
    const ledLight = new THREE.PointLight(0xff2a1f, 0, 170, 2);
    ledLight.position.set(SX, 0, 62);
    scene.add(ledLight);
    const liquidLight = new THREE.PointLight(0x2e6bff, 0.9, 150, 2);
    liquidLight.position.set(SX, 14, 30);
    scene.add(liquidLight);

    const FLOOR_Z = -50.8;
    const floorMat = new THREE.MeshPhongMaterial({ color: NIGHT.floor, shininess: 22, specular: 0x1c2436 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), floorMat);
    floor.position.z = FLOOR_Z;
    floor.receiveShadow = true;
    scene.add(floor);
    const grid = new THREE.GridHelper(2400, 48, 0xffffff, 0xffffff);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = FLOOR_Z + 0.2;
    grid.material.transparent = true;
    grid.material.opacity = NIGHT.gridA;
    grid.material.color.setHex(NIGHT.grid);
    scene.add(grid);

    function envCube() {
      const faces = [];
      for (let f = 0; f < 6; f++) {
        const c = document.createElement("canvas");
        c.width = c.height = 64;
        const g = c.getContext("2d");
        const lg = g.createLinearGradient(0, 0, 0, 64);
        lg.addColorStop(0, "#dfe8ff");
        lg.addColorStop(1, "#0f1626");
        g.fillStyle = f === 4 ? "#eef3ff" : f === 5 ? "#0a0f1a" : lg;
        g.fillRect(0, 0, 64, 64);
        faces.push(c);
      }
      const t = new THREE.CubeTexture(faces);
      t.needsUpdate = true;
      return t;
    }
    const ENV = envCube();

    // Modelldaten: Int16-Eckpunkte (0,01 mm) + Int8-Normalen
    const raw = atob(window.MESSBOX_BIN);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const POS = new Int16Array(bytes.buffer, 0, D.tris * 9);
    const NOR = new Int8Array(bytes.buffer, D.tris * 18, D.tris * 3);
    const SC = 1 / D.scale;
    function partGeometry(p) {
      const n = p.count;
      const pos = new Float32Array(n * 9);
      const nor = new Float32Array(n * 9);
      for (let i = 0; i < n; i++) {
        const t = p.first + i;
        const nx = NOR[t * 3] / 127, ny = NOR[t * 3 + 1] / 127, nz = NOR[t * 3 + 2] / 127;
        for (let v = 0; v < 3; v++) {
          const j = i * 9 + v * 3;
          pos[j] = POS[t * 9 + v * 3] * SC;
          pos[j + 1] = POS[t * 9 + v * 3 + 1] * SC;
          pos[j + 2] = POS[t * 9 + v * 3 + 2] * SC;
          nor[j] = nx; nor[j + 1] = ny; nor[j + 2] = nz;
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
      return g;
    }
    function mat(color, shin, specAmt, extra) {
      const spec = new THREE.Color(0xffffff).multiplyScalar(specAmt);
      return new THREE.MeshPhongMaterial(Object.assign({ color, specular: spec, shininess: shin, side: THREE.DoubleSide, clippingPlanes: CLIP }, extra || {}));
    }
    // etwas heller als das echte schwarze PLA, damit die Form auf dunklem Grund gut lesbar bleibt
    const PLA = { box: 0x3c3f46, wand: 0x44474f, deckel: 0x3f4249, optik: 0x4c5058, kopf: 0x575b64, geraet: 0x4c5058, elek: 0x3c3f46 };   // v6: schwarzes PLA, etwas aufgehellt
    const edgeMats = [], cables = [], objs = [], NAMED = {};
    function add(obj, id, grp, shadow) {
      obj.castShadow = shadow !== false;
      obj.receiveShadow = true;
      scene.add(obj);
      objs.push({ obj, base: obj.position.clone(), id, grp });
      return obj;
    }
    D.teile.forEach((t) => {
      const geo = partGeometry(t);
      const isModule = t.id.indexOf("p10") === 0;
      const pm = mat(isModule ? 0x6a7383 : PLA[t.grp] || 0x535b68, 26, 0.18, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      // Berührende Teile teilen Ebenen: jede Fläche 0,08 mm nach innen – kein Flimmern.
      const gp = geo.attributes.position.array;
      const od = geo.attributes.normal.array.map((v) => -v);
      (t.thin || []).forEach(([tri, ax, dir]) => {
        for (let v = 0; v < 3; v++) for (let c = 0; c < 3; c++) od[tri * 9 + v * 3 + c] = c === ax ? dir : 0;
      });
      for (let k = 0; k < gp.length; k++) gp[k] += od[k] * 0.08;
      const mesh = new THREE.Mesh(geo, pm);
      mesh.position.set(t.pos[0], t.pos[1], t.pos[2]);
      if (t.rot) mesh.rotation.z = (t.rot * Math.PI) / 180;
      const bg = geo.clone();
      const bp = bg.attributes.position.array;
      for (let k = 0; k < bp.length; k++) bp[k] += od[k] * 0.3;
      mesh.add(new THREE.Mesh(bg, pm));
      const em = new THREE.LineBasicMaterial({ color: 0x7fa2ff, transparent: true, opacity: 0, clippingPlanes: CLIP });
      edgeMats.push(em);
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 35), em));
      add(mesh, t.id, t.grp);
      NAMED[t.id] = mesh;
    });
    const metal = (c) => mat(c, 70, 0.6, { envMap: ENV, reflectivity: 0.55, combine: THREE.MixOperation });
    const ZUB_MAT = {
      sv: () => mat(0x74849b, 30, 0.22), svslot: () => mat(0x0e121a, 4, 0.02), bme: () => mat(0x2a7a4c, 30, 0.25),
      fuehler: () => metal(0xc9d0d8), star: () => mat(0xf2f4f7, 40, 0.3, { emissive: 0xff2a1f, emissiveIntensity: 0.1 }),
      pad: () => mat(0x9aa0aa, 10, 0.05), hs: () => metal(0xb8c1cb), esp: () => mat(0x1d4a8a, 40, 0.3), ldd: () => mat(0x343a44, 30, 0.2),
      mos1: () => mat(0x15181d, 30, 0.3), mos2: () => mat(0x15181d, 30, 0.3), reed: () => metal(0x9aa2ab),
    };
    const liquidMat = mat(0x1747b8, 90, 0.5, { transparent: true, opacity: 0.94, emissive: 0x2a63ff, emissiveIntensity: 0.4 });
    const twinMat = mat(0x1747b8, 90, 0.5, { transparent: true, opacity: 0.94, emissive: 0x2a63ff, emissiveIntensity: 0.32 });
    const glass = () => mat(0xe8f0ff, 120, 0.9, { transparent: true, opacity: 0.22, depthWrite: false, envMap: ENV, reflectivity: 0.4, combine: THREE.MixOperation });
    D.zub.forEach((z) => {
      const [id, art, , , pos, dim, grp] = z;
      const w = dim[0] - (art === "box" ? 0.4 : 0), d = dim[1] - (art === "box" ? 0.4 : 0), h = dim[2] - (art === "box" ? 0.4 : 0);
      let material;
      if (id === "loes") material = liquidMat;
      else if (id === "loes2") material = twinMat;
      else if (art === "glas") material = glass();
      else if (ZUB_MAT[id]) material = ZUB_MAT[id]();
      else material = metal(0x59616c);
      const geo = art === "box" || art === "glas" ? new THREE.BoxGeometry(w, d, h) : new THREE.CylinderGeometry(w / 2, w / 2, h, art === "rohr" ? 48 : 32);
      const mesh = new THREE.Mesh(geo, material);
      if (art === "zyl" || art === "rohr") mesh.rotation.x = Math.PI / 2;
      mesh.position.set(pos[0], pos[1], pos[2] + dim[2] / 2);
      add(mesh, id, grp, art !== "glas" && id !== "loes" && id !== "loes2");
      NAMED[id] = mesh;
      if (art === "rohr") {
        for (let i = 0; i < 12; i++) {
          const fin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, 1.6, h * 0.86), metal(0xb8c1cb));
          fin.position.set(pos[0], pos[1], pos[2] + dim[2] / 2);
          fin.rotation.z = (i * Math.PI) / 12;
          add(fin, "hs", grp);
        }
      }
    });
    ["loes", "loes2"].forEach((id) => (NAMED[id].renderOrder = 1));
    ["kuev", "kuev2"].forEach((id) => (NAMED[id].renderOrder = 2));
    D.kab.forEach((k) => {
      const [id, col, r, grp, , pkt] = k;
      const curve = new THREE.CatmullRomCurve3(pkt.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
      cables.push(add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, pkt.length * 10), r, 10, false), mat(new THREE.Color(col).multiplyScalar(0.7), 18, 0.1)), id, grp));
    });
    [[-28.6, 28.6], [28.6, 28.6], [0, -30.8]].forEach(([px, py]) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 6, 18), mat(0x18a07c, 50, 0.4, { emissive: 0x0f6e56, emissiveIntensity: 0.5 }));
      c.rotation.x = Math.PI / 2;
      c.position.set(SX + px, py, 47);
      add(c, "pin", "optik");
    });
    [-1, 1].forEach((sy) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 20, 20), metal(0x8a96a6));
      c.rotation.x = Math.PI / 2;
      c.position.set(SX, sy * 40, 56);
      add(c, "guide", "kopf");
    });

    // Lichteffekte
    function radialTexture(stops) {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const g = c.getContext("2d");
      const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      stops.forEach(([o, col]) => r.addColorStop(o, col));
      g.fillStyle = r;
      g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    }
    const GLOW = radialTexture([[0, "rgba(255,255,255,1)"], [0.22, "rgba(255,255,255,0.55)"], [1, "rgba(255,255,255,0)"]]);
    const DOT = radialTexture([[0, "rgba(255,255,255,1)"], [0.35, "rgba(255,255,255,0.9)"], [0.6, "rgba(255,255,255,0.2)"], [1, "rgba(255,255,255,0)"]]);
    const additive = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const fx = (mm) => { mm.renderOrder = 3; scene.add(mm); return mm; };
    const beamCore = fx(new THREE.Mesh(new THREE.BoxGeometry(4.5, 4.5, 33), additive(0xff2a1f, 0)));
    beamCore.position.set(SX, 0, 71.5);
    const beamSoft = fx(new THREE.Mesh(new THREE.BoxGeometry(11, 11, 33), additive(0xff2a1f, 0)));
    beamSoft.position.set(SX, 0, 71.5);
    const beamFan = fx(new THREE.Mesh(new THREE.CylinderGeometry(5, 9, 16, 32, 1, true), additive(0xff2a1f, 0)));
    beamFan.rotation.x = Math.PI / 2;
    beamFan.position.set(SX, 0, 49);
    const beamIn = fx(new THREE.Mesh(new THREE.CylinderGeometry(4.5, 3.2, 38, 24, 1, true), additive(0xff2a1f, 0)));
    beamIn.rotation.x = Math.PI / 2;
    beamIn.position.set(SX, 0, 30);
    const sprite = (map, scale, color) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
      s.scale.set(scale, scale, 1);
      s.renderOrder = 4;
      scene.add(s);
      return s;
    };
    const glowStar = sprite(GLOW, 52, 0xff2a1f);
    const glowMouth = sprite(GLOW, 40, 0xff2a1f);
    glowMouth.position.set(SX, 0, 56);
    const glowLiquid = sprite(GLOW, 64, 0x2a63ff);
    glowLiquid.position.set(SX, 0, 30);
    const glowTwin = sprite(GLOW, 54, 0x2a63ff);
    glowTwin.position.set(83.5, 0, 22);
    const SPARK_N = 90;
    const sparkPos = new Float32Array(SPARK_N * 3);
    const sparkCol = new Float32Array(SPARK_N * 3);
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    sparkGeo.setAttribute("color", new THREE.BufferAttribute(sparkCol, 3));
    const sparkMat = new THREE.PointsMaterial({ map: DOT, color: 0xffb3a8, size: 2.4, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    fx(new THREE.Points(sparkGeo, sparkMat));
    const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    const measBeam = fx(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 66, 16), additive(0xfff1d6, 0)));
    measBeam.rotation.z = Math.PI / 2;
    measBeam.position.set(SX, 0, 24);
    const measSoft = fx(new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 66, 16), additive(0xffe2b0, 0)));
    measSoft.rotation.z = Math.PI / 2;
    measSoft.position.set(SX, 0, 24);

    // ── Explosionsansicht ──
    const EXG = { deckel: [0, 0, 175], kopf: [0, 0, 120], optik: [0, 0, 64], geraet: [0, 0, 0], box: [0, 0, -72], elek: [0, -125, -12], wand: [0, 0, 0], kabel: [0, 0, 0] };
    const EXI = {
      p4a: [0, 115, 0], p4b: [0, -105, 0], p4c1: [-112, 0, 0], p4c2: [112, 0, 0],
      p3: [0, 0, -30], p2: [0, 100, -72], p10a: [0, 100, -72], p10b: [0, 100, -72], p10c: [0, 100, -72], p2b: [0, 60, -46],
      kuev: [0, 0, 44], loes: [0, 0, 44], kuev2: [44, 0, 26], loes2: [44, 0, 26], fuehler: [44, 0, 26], p12: [44, 0, 26],
      bme: [0, 48, 28], p14: [0, 48, 28], "vs-30": [0, -105, 0], vs28: [0, -105, 0], vs50: [0, -105, 0], vs75: [0, -105, 0],
    };
    const FLOOR_DROP = 80; // so tief sinkt der Boden in der Explosionsansicht – die Schublade (−72) bleibt sichtbar
    const SWAP_SET = { p10: 1, star: 1, pad: 1, hs: 1 };

    // ── Stationen: Kamera (Blickpunkt q, Richtung, Abstand) und Zustände ──
    const KF = [
      { p: [340, 600, 310], q: [0, -10, 30], fov: 30 },   // 0 außen
      { p: [-330, -600, 250], q: [0, -55, 10], fov: 30 }, // 1 Elektronik
      { p: [260, 500, 540], q: [-15, 0, 115], fov: 30 },  // 2 Deckel
      { p: [640, 880, 560], q: [0, 10, 72], fov: 32 },    // 3 Aufbau (Explosion)
      { p: [SX + 200, 380, 210], q: [SX, 0, 75], fov: 30 }, // 4 Lichtfarben
      { p: [10, 310, 92], q: [10, 0, 34], fov: 30 },      // 5 Messung
      { p: [30, 410, 155], q: [25, 0, 32], fov: 30 },     // 6 Kontrolle
      { p: [-250, 545, 255], q: [5, 0, 42], fov: 30 },    // 7 ganze Box, aufgeschnitten
    ];
    const VAL = {
      explode: [0, 0, 0, 1, 0, 0, 0, 0],
      elek: [0, 0.5, 0, 0, 0, 0, 0, 0],
      lid: [0, 0, 95, 175, 520, 520, 520, 0],
      klappe: [0, 0, 45, 0, 0, 0, 0, 0],
      cut: [400, 400, 400, 400, 7, 7, 22, 7],
      beam: [0, 0, 0, 0, 1, 1, 1, 1],
      glowL: [0, 0, 0, 0, 1, 1, 1, 1],
      twin: [0, 0, 0, 0, 0, 1, 1, 1],
      dark: [0, 0, 0, 0, 1, 1, 1, 0.6], // im Inneren: Dunkelkammer
    };
    const ST = KF.map((k, i) => {
      const v = [k.p[0] - k.q[0], k.p[1] - k.q[1], k.p[2] - k.q[2]];
      const r = Math.hypot(v[0], v[1], v[2]);
      const vals = {};
      Object.keys(VAL).forEach((n) => (vals[n] = VAL[n][i]));
      return { q: k.q.slice(), az: Math.atan2(v[1], v[0]), el: Math.asin(v[2] / r), r, fov: k.fov, v: vals };
    });
    const copyState = (S) => ({ q: S.q.slice(), az: S.az, el: S.el, r: S.r, fov: S.fov, v: Object.assign({}, S.v) });
    const angleTo = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
    // Direkte Überblendung A → B: Blickpunkt linear, Richtung auf dem kürzesten Bogen, Abstand logarithmisch.
    // Bei großen Schwenks fährt die Kamera kurz etwas zurück und höher – so bleibt sie immer außerhalb des Modells.
    function blendState(A, B, u, out) {
      const daz = angleTo(A.az, B.az);
      const arc = Math.sin(Math.PI * u);
      const swing = Math.min(1, Math.abs(daz) / Math.PI);
      out.q[0] = lerp(A.q[0], B.q[0], u); out.q[1] = lerp(A.q[1], B.q[1], u); out.q[2] = lerp(A.q[2], B.q[2], u);
      out.az = A.az + daz * u;
      out.el = lerp(A.el, B.el, u) + 0.12 * arc * Math.min(1, Math.abs(daz) / 1.2);
      out.r = Math.exp(lerp(Math.log(A.r), Math.log(B.r), u)) * (1 + (0.04 + 0.24 * swing) * arc);
      out.fov = lerp(A.fov, B.fov, u);
      for (const n in A.v) out.v[n] = lerp(A.v[n], B.v[n], u);
      return out;
    }
    function offsetFor(id, grp, S, ex) {
      const v = EXI[id] || EXG[grp] || [0, 0, 0];
      let x = v[0] * ex, y = v[1] * ex, z = v[2] * ex;
      if (grp === "deckel") z = S.v.lid + (id === "p25" ? S.v.klappe : 0);
      if (grp === "elek") { const e = S.v.elek; y += -110 * e; z += -6 * e; }
      return [x, y, z];
    }

    // ── Beschriftungen an echten Bauteilpositionen (Punkt liegt auf dem Bauteil) ──
    const LABELS = [
      { st: 1, id: "esp", grp: "elek", at: [0, -92.5, -12], dx: -150, dy: 70, k: "Steuerung", t: "ESP32" },
      { st: 1, id: "ldd", grp: "elek", at: [0, -92.5, 8], dx: 150, dy: -70, k: "Treiber", t: "LDD-350L · 350 mA" },
      { st: 2, id: "p25", grp: "deckel", at: [-42, 0, 146], dx: -170, dy: -30, k: "Wechselklappe", t: "einzige Öffnung" },
      { st: 2, id: "p5", grp: "deckel", at: [50, 30, 143], dx: 120, dy: 80, k: "Deckel", t: "mit Labyrinth-Lippe", desk: true },
      { st: 3, id: "star", grp: "kopf", at: [SX, 0, 100], dx: -160, dy: -50, k: "Lichtkopf", t: "LED-Modul" },
      { st: 3, id: "sv", grp: "geraet", at: [40, -10, 40], dx: 170, dy: 30, k: "Spektrometer", t: "SpectroVis Plus" },
      { st: 3, id: "kuev", grp: "geraet", at: [SX, 0, 48], dx: -180, dy: 50, k: "Probe", t: "Küvette", desk: true },
      { st: 3, id: "p24a", grp: "optik", at: [40, 41, 52], dx: 170, dy: -90, k: "Kulisse", t: "Führung für den Kopf", desk: true },
      { st: 3, id: "p10b", grp: "box", at: [0, 0, -38], dx: -150, dy: 70, k: "Schublade", t: "3 Ersatz-LED-Module" },
      { st: 4, id: "star", grp: "kopf", at: [SX, 0, 100], dx: 150, dy: -80, k: "LED-Modul", t: LEDS[0].txt, led: true },
      { st: 5, id: "loes", grp: "geraet", at: [SX, 0, 40], dx: -160, dy: -80, k: "Probe", t: "Methylenblau" },
      { st: 5, id: "meas", grp: "geraet", at: [SX + 30, 0, 24], dx: 140, dy: 80, k: "Messstrahl", t: "quer zum Licht · 90°" },
      { st: 6, id: "loes", grp: "geraet", at: [SX, 0, 40], dx: 120, dy: -110, k: "bestrahlt", t: "bleicht aus" },
      { st: 6, id: "loes2", grp: "geraet", at: [83.5, 0, 30], dx: -130, dy: 100, k: "Zwillingsküvette", t: "bleibt blau" },
      { st: 6, id: "fuehler", grp: "geraet", at: [83.5, 0, 52], dx: -160, dy: -40, k: "Referenz", t: "Fühler ±0,2 °C", desk: true },
      { st: 7, id: "star", grp: "kopf", at: [SX, 0, 96], dx: 170, dy: -70, k: "Lichtkopf", t: LEDS[0].txt, led: true },
      { st: 7, id: "loes", grp: "geraet", at: [SX, 0, 30], dx: 190, dy: 30, k: "Probe", t: "Methylenblau" },
      { st: 7, id: "loes2", grp: "geraet", at: [83.5, 0, 28], dx: -150, dy: -60, k: "Kontrolle", t: "Zwillingsprobe" },
      { st: 7, id: "sv", grp: "geraet", at: [30, -10, 8], dx: -160, dy: 90, k: "Messgerät", t: "Spektrometer", desk: true },
    ];
    const NS = "http://www.w3.org/2000/svg";
    LABELS.forEach((L) => {
      L.el = document.createElement("div");
      L.el.className = "mb-label";
      L.el.innerHTML = "<b>" + L.k + "</b><span>" + L.t + "</span>";
      L.txt = L.el.querySelector("span");
      labWrap.appendChild(L.el);
      L.line = document.createElementNS(NS, "line");
      L.dot = document.createElementNS(NS, "circle");
      L.dot.setAttribute("r", "3.5");
      svg.appendChild(L.line);
      svg.appendChild(L.dot);
      L.a = 0;
    });

    // ── Größe und Bildausschnitt: Modell in der freien Fläche neben/über dem Textfeld ──
    let W = 1, H = 1, uiBox = null;
    const headerH = () => (document.querySelector(".site-header") || { offsetHeight: 60 }).offsetHeight;
    function resize() {
      const w = section.clientWidth, h = section.clientHeight;
      if (Math.abs(w - W) < 2 && Math.abs(h - H) < 2 && uiBox) return;
      W = w; H = h;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small() ? 2 : 1.75));
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      measureUI();
      dirty = true;
    }
    function measureUI() {
      const s = section.getBoundingClientRect();
      const u = ui.getBoundingClientRect();
      uiBox = { left: u.left - s.left, right: u.right - s.left, top: u.top - s.top, bottom: u.bottom - s.top };
    }
    function applyView(fov) {
      const aspect = W / H;
      const topFree = headerH() + 52; // Kopfzeile + Kapitel/Automatisch-Leiste
      if (aspect < 1.2) {
        // Hochformat: Bildwinkel so, dass die Box in der Breite passt; Mitte der freien Fläche über dem Textfeld
        const freeH = Math.max(160, uiBox.top - topFree);
        const hf = 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * 1.6 * 0.78);
        const vf = 2 * Math.atan(Math.tan(hf / 2) / aspect);
        const need = 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * (H / freeH) * 0.95);
        camera.fov = (Math.max(vf, Math.min(need, 1.9)) * 180) / Math.PI;
        const yFree = topFree + freeH / 2;
        camera.setViewOffset(W, H, 0, H / 2 - yFree, W, H);
      } else {
        // Querformat: Textfeld links (Desktop, iPad quer, iPhone quer) → Modell mittig in der Fläche rechts davon
        const side = uiBox.right < W * 0.66; // Textfeld nimmt nicht die ganze Breite ein → es steht links
        const freeW = side ? W - uiBox.right : W;
        const frac = freeW / W;
        camera.fov = side && frac < 0.62 ? Math.min(fov * (0.62 / frac), fov * 1.5) : fov;
        const xFree = side ? (uiBox.right + W) / 2 : W / 2;
        const yFree = side ? (topFree + H) / 2 - (W >= 1000 ? 4 : 0) : (topFree + uiBox.top) / 2;
        camera.setViewOffset(W, H, W / 2 - xFree, H / 2 - yFree, W, H);
      }
      camera.updateProjectionMatrix();
    }

    // ── Zustand ──
    const S = copyState(ST[target]); // aktueller (überblendeter) Zustand
    let tw = null;                   // laufender Übergang { from, to, t0, dur }
    let arrivedAt = performance.now();
    let dirty = true;
    let yaw = 0, pitch = 0, dragging = false, lastTouch = 0;
    let bleach = 0;
    let lastLedTxt = -1;
    let lastFrame = performance.now();
    let lastDark = -1;
    let lastSec = -1, lastOn = null;
    let uiTopS = null;

    function goTo(i) {
      const now = performance.now();
      const B = ST[i];
      const daz = Math.abs(angleTo(S.az, B.az));
      const zoom = Math.abs(Math.log(B.r / S.r));
      const explode = Math.abs(S.v.explode - B.v.explode);
      const dur = REDUCED ? 1 : Math.round(Math.min(2300, 1150 + 700 * (daz / Math.PI) + 320 * zoom + 300 * explode));
      tw = { from: copyState(S), to: i, t0: now, dur };
      lastTouch = Math.min(lastTouch, now - 2000); // Drehung beim Stationswechsel zurückführen
      lastSec = -1; lastOn = null;
      kick();
    }
    api = { goTo, moving: () => !!tw, kick: () => kick() };

    // Ziehen zum Drehen (Maus: beide Richtungen; Finger: waagerecht, senkrecht scrollt die Seite)
    let sx = 0, sy = 0, y0 = 0, p0 = 0, pid = null;
    canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      pid = e.pointerId; dragging = true; sx = e.clientX; sy = e.clientY; y0 = yaw; p0 = pitch;
      canvas.classList.add("is-drag");
      try { canvas.setPointerCapture(pid); } catch (err) { /* Safari < 13 */ }
      hint.classList.remove("is-show");
      kick();
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!dragging || e.pointerId !== pid) return;
      yaw = Math.max(-1.1, Math.min(1.1, y0 - (e.clientX - sx) * 0.006));
      if (e.pointerType === "mouse") pitch = Math.max(-0.35, Math.min(0.35, p0 + (e.clientY - sy) * 0.004));
      lastTouch = performance.now();
      dirty = true;
    });
    const endDrag = () => { dragging = false; pid = null; canvas.classList.remove("is-drag"); lastTouch = performance.now(); };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("lostpointercapture", endDrag);

    const V = new THREE.Vector3();
    const C = new THREE.Color();
    const CB = new THREE.Color();
    const WHITE = new THREE.Color(0xffffff);
    const DEEP = new THREE.Color(0x1747b8);
    const PALE = new THREE.Color(0xc2d8f4);
    const MB_GLOW = new THREE.Color(0x2a63ff);
    const mixHex = (tgt, a, b, u) => tgt.setHex(a).lerp(CB.setHex(b), u);

    // Nachtstudio ↔ Dunkelkammer
    function setDark(d) {
      if (d === lastDark) return;
      lastDark = d;
      hemi.intensity = lerp(NIGHT.hemi, DARKROOM.hemi, d);
      mixHex(hemi.color, NIGHT.hemiSky, DARKROOM.hemiSky, d);
      mixHex(hemi.groundColor, NIGHT.hemiGround, DARKROOM.hemiGround, d);
      key.intensity = lerp(NIGHT.key, DARKROOM.key, d);
      fill.intensity = lerp(NIGHT.fill, DARKROOM.fill, d);
      rim.intensity = lerp(NIGHT.rim, DARKROOM.rim, d);
      mixHex(scene.fog.color, NIGHT.fog, DARKROOM.fog, d);
      scene.fog.near = lerp(NIGHT.near, DARKROOM.near, d);
      scene.fog.far = lerp(NIGHT.far, DARKROOM.far, d);
      mixHex(floorMat.color, NIGHT.floor, DARKROOM.floor, d);
      mixHex(grid.material.color, NIGHT.grid, DARKROOM.grid, d);
      grid.material.opacity = lerp(NIGHT.gridA, DARKROOM.gridA, d);
      section.style.setProperty("--dark", d.toFixed(3));
    }

    function frame(now) {
      const t = now / 1000;
      const dt = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000));
      lastFrame = now;
      const ease = (k) => 1 - Math.exp(-dt * k); // zeitbasiert, unabhängig von der Bildrate
      if (tw) {
        const u = clamp01((now - tw.t0) / tw.dur);
        blendState(tw.from, ST[tw.to], easeIO(u), S);
        if (u >= 1) {
          tw = null; arrivedAt = now;
          if (touring) scheduleTour(target === 4 ? 9000 : target === 5 ? 16000 : target === 6 ? 9000 : 6500);
        }
      }
      const station = tw ? -1 : target;
      const st = station >= 0 ? (now - arrivedAt) / 1000 : 0;

      // Kamera: Stationspose + Drehung durch Ziehen + leichtes Schweben; an der letzten Station langsames Pendeln
      if (!dragging && now - lastTouch > 2500) { yaw *= 1 - ease(4); pitch *= 1 - ease(4); }
      const showcase = station === 7 && !REDUCED ? 0.42 * Math.sin(st * 0.32) : 0;
      const sway = REDUCED ? 0 : 0.05 * Math.sin(t * 0.35);
      const az = S.az + yaw + sway + showcase;
      const el = Math.max(0.04, Math.min(1.4, S.el + pitch));
      camera.position.set(S.q[0] + S.r * Math.cos(el) * Math.cos(az), S.q[1] + S.r * Math.cos(el) * Math.sin(az), S.q[2] + S.r * Math.sin(el));
      // Textfeld kann je Station unterschiedlich hoch sein (Handy): Bildausschnitt gleitet weich mit
      const s0 = section.getBoundingClientRect(), u0 = ui.getBoundingClientRect();
      const topNow = u0.top - s0.top;
      uiTopS = uiTopS == null || !isFinite(uiTopS) ? topNow : uiTopS + (topNow - uiTopS) * ease(5);
      uiBox.top = uiTopS; uiBox.right = u0.right - s0.left;
      applyView(S.fov);
      camera.lookAt(S.q[0], S.q[1], S.q[2]);
      camera.updateMatrixWorld();
      cutPlane.constant = S.v.cut;
      setDark(sio(clamp01(S.v.dark)));

      const ex = sio(clamp01(S.v.explode));
      floor.position.z = FLOOR_Z - FLOOR_DROP * ex;
      grid.position.z = FLOOR_Z + 0.2 - FLOOR_DROP * ex;

      // Lichtfarbe: Im automatischen Rundgang wechselt sie in Station 5 alle 2,2 s von selbst (solange niemand wählt)
      if (station === 4 && touring && now - lastPick > 4000 && st > 0.8) {
        const want = Math.floor((st - 0.8) / 2.2) % 4;
        if (want !== ledTarget) pickLed(want, false);
      }
      // Modulwechsel: Kopf hebt ab, oben wird das Modul getauscht, dann senkt er sich wieder
      let lift = 0, swapBeam = 1;
      const su = (now - swapT0) / 1100;
      if (su >= 0 && su < 1) {
        lift = 26 * Math.sin(Math.PI * su);
        swapBeam = clamp01(Math.abs(su - 0.5) * 6 - 2);
        if (su >= 0.5) ledShown = ledTarget;
      } else ledShown = ledTarget;
      C.setHex(LEDS[ledShown].hex);

      // Lichttakt in Station 6 (Messung): in Echtzeit, 15 s – 11 s an, 4 s aus
      let chopBeam = 1, scan = 0;
      if (station === 5) {
        const ph = REDUCED ? 12 : st % 15;
        const on = ph < 11;
        if (on) chopBeam = Math.min(1, ph / 0.25, (11 - ph) / 0.25);
        else { chopBeam = 0; scan = Math.min(1, (ph - 11) / 0.3, (15 - ph) / 0.3); }
        if (takt) {
          if (taktHead) taktHead.style.left = ((ph / 15) * 100).toFixed(2) + "%";
          const sec = Math.ceil((on ? 11 : 15) - ph);
          if (on !== lastOn) {
            takt.classList.toggle("is-off", !on);
            if (taktLabel) taktLabel.textContent = on ? "LED an · Probe wird bestrahlt" : "LED aus · Spektrometer misst";
            if (scopeState) scopeState.textContent = on ? "geblendet" : "misst ✓";
            lastOn = on;
          }
          if (sec !== lastSec) { if (taktLeft) taktLeft.textContent = "noch " + sec + " s"; lastSec = sec; }
        }
      }
      const beam = clamp01(S.v.beam) * swapBeam * (station === 5 ? chopBeam : 1);

      objs.forEach((o) => {
        const off = offsetFor(o.id, o.grp, S, ex);
        o.obj.position.set(o.base.x + off[0], o.base.y + off[1], o.base.z + off[2] + (SWAP_SET[o.id] ? lift : 0));
      });
      edgeMats.forEach((mm) => { mm.visible = ex > 0.002; mm.opacity = 0.6 * ex; });
      cables.forEach((c) => (c.visible = ex < 0.15));
      const shown = 1 - ex;

      [beamCore, beamSoft, beamFan, beamIn].forEach((mm) => mm.material.color.copy(C));
      beamCore.material.opacity = 0.9 * beam * shown;
      beamSoft.material.opacity = 0.28 * beam * shown;
      beamFan.material.opacity = 0.2 * beam * shown;
      beamIn.material.opacity = 0.34 * beam * shown;
      glowStar.material.color.copy(C);
      glowStar.position.set(SX, 0, 87 + lift);
      glowStar.material.opacity = 0.9 * beam;
      glowMouth.material.color.copy(C);
      glowMouth.material.opacity = 0.9 * beam * shown;
      ledLight.color.copy(C);
      ledLight.intensity = 1.7 * beam;
      NAMED.star.material.emissive.copy(C);
      NAMED.star.material.emissiveIntensity = 0.1 + 1.4 * beam;

      // Ausbleichen in Station 7 (Kontrolle); die Zwillingsprobe bleibt blau
      const want = station === 6 ? 0.74 * sio(clamp01((st - 0.4) / 6)) : 0;
      bleach = want > bleach ? want : bleach + (want - bleach) * ease(3);
      liquidMat.color.copy(DEEP).lerp(PALE, bleach);
      liquidMat.opacity = 0.94 - 0.3 * bleach;
      liquidMat.emissive.copy(MB_GLOW).lerp(C, 0.35 * beam);
      liquidMat.emissiveIntensity = 0.4 * (1 - bleach) + 0.35 * beam;
      glowLiquid.material.color.copy(MB_GLOW).lerp(C, 0.5);
      glowLiquid.material.opacity = (0.22 + 0.55 * beam) * (1 - 0.5 * bleach) * shown * clamp01(S.v.glowL);
      glowTwin.material.opacity = 0.3 * shown * clamp01(S.v.twin);
      liquidLight.intensity = 0.9 * (1 - bleach) + 0.6 * beam;
      // Der Messstrahl des Spektrometers ist immer da; hell nur, solange gemessen wird
      const measBase = station === 5 ? 0.32 : 0;
      measBeam.material.opacity = measBase + (0.9 - measBase) * scan;
      measSoft.material.opacity = measBase * 0.25 + 0.2 * scan;

      for (let i = 0; i < SPARK_N; i++) {
        const fall = (hash(i * 3) * 34 + (REDUCED ? 0 : t) * (22 + hash(i * 7) * 26)) % 34;
        sparkPos[i * 3] = SX + (hash(i * 11) - 0.5) * 7;
        sparkPos[i * 3 + 1] = (hash(i * 13) - 0.5) * 7;
        sparkPos[i * 3 + 2] = 88 - fall + lift;
        const fade = Math.min(1, fall / 5, (34 - fall) / 5);
        sparkCol[i * 3] = sparkCol[i * 3 + 1] = sparkCol[i * 3 + 2] = fade;
      }
      sparkGeo.attributes.position.needsUpdate = true;
      sparkGeo.attributes.color.needsUpdate = true;
      sparkMat.color.copy(C).lerp(WHITE, 0.45);
      sparkMat.opacity = 0.95 * beam * shown;

      renderer.render(scene, camera);

      if (ledShown !== lastLedTxt) {
        LABELS.forEach((L) => L.led && (L.txt.textContent = LEDS[ledShown].txt));
        lastLedTxt = ledShown;
      }

      // Beschriftungen: erscheinen nach der Ankunft, verschwinden beim Wechsel
      const mobile = W < 700;
      const kx = mobile ? 0.55 : 1, ky = mobile ? 0.6 : 1;
      const top = headerH() + 60;
      const sidePanel = uiBox.right < W * 0.66 && W / H >= 1.2;
      const bottomLimit = (sidePanel ? H : uiBox.top) - 16;
      // 1. Position jeder sichtbaren Beschriftung berechnen
      const vis = [];
      LABELS.forEach((L) => {
        const wantA = station === L.st && !(mobile && L.desk) ? clamp01((st - 0.15) * 2.5) : 0;
        L.a += (wantA - L.a) * ease(wantA > L.a ? 10 : 14);
        if (L.a < 0.01) {
          if (L.vis) { L.el.style.opacity = "0"; L.line.setAttribute("opacity", "0"); L.dot.setAttribute("opacity", "0"); L.vis = false; L.sy = null; }
          return;
        }
        L.vis = true;
        const off = L.id === "meas" ? [0, 0, 0] : offsetFor(L.id, L.grp, S, ex);
        V.set(L.at[0] + off[0], L.at[1] + off[1], L.at[2] + off[2] + (SWAP_SET[L.id] ? lift : 0)).project(camera);
        L.x = ((V.x + 1) / 2) * W;
        L.y = ((1 - V.y) / 2) * H;
        L.lw = L.el.offsetWidth || 120;
        L.lh = L.el.offsetHeight || 40;
        let lx = L.x + L.dx * kx;
        if (L.dx < 0) lx = Math.max(lx, L.lw + 8); else lx = Math.min(lx, W - L.lw - 8);
        if (sidePanel && L.dx < 0) lx = Math.max(lx, uiBox.right + L.lw + 16);
        L.lx = lx;
        L.ly = Math.min(Math.max(L.y + L.dy * ky, top + L.lh / 2), bottomLimit - L.lh / 2);
        vis.push(L);
      });
      // 2. Überlappende Beschriftungen auseinanderschieben (oben/unten), innerhalb der freien Fläche
      const box = (L) => { const x0 = L.dx < 0 ? L.lx - L.lw : L.lx; return [x0 - 4, x0 + L.lw + 4]; };
      for (let it = 0; it < 4; it++) {
        vis.sort((a, b) => a.ly - b.ly);
        for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
          const A = vis[i], B = vis[j], ba = box(A), bb = box(B);
          if (ba[1] < bb[0] || bb[1] < ba[0]) continue;
          const need = (A.lh + B.lh) / 2 + 8 - (B.ly - A.ly);
          if (need <= 0) continue;
          A.ly -= need / 2; B.ly += need / 2;
          const minA = top + A.lh / 2, maxB = bottomLimit - B.lh / 2;
          if (A.ly < minA) { B.ly += minA - A.ly; A.ly = minA; }
          if (B.ly > maxB) { A.ly -= B.ly - maxB; B.ly = maxB; }
        }
      }
      // 3. Zeichnen (weich nachgeführt, damit beim Ausweichen nichts springt)
      vis.forEach((L) => {
        L.sy = L.sy == null ? L.ly : L.sy + (L.ly - L.sy) * ease(12);
        const lx = L.lx, ly = L.sy, x = L.x, y = L.y;
        L.line.setAttribute("x1", x.toFixed(1)); L.line.setAttribute("y1", y.toFixed(1));
        L.line.setAttribute("x2", lx.toFixed(1)); L.line.setAttribute("y2", ly.toFixed(1));
        L.line.setAttribute("opacity", L.a.toFixed(3));
        L.dot.setAttribute("cx", x.toFixed(1)); L.dot.setAttribute("cy", y.toFixed(1));
        L.dot.setAttribute("opacity", L.a.toFixed(3));
        L.el.style.transform = "translate(" + lx.toFixed(1) + "px," + ly.toFixed(1) + "px) translate(" + (L.dx < 0 ? "-100%" : "0") + ",-50%)";
        L.el.style.opacity = L.a.toFixed(3);
      });
    }

    // ── Schleife: nur solange die Messbox sichtbar ist ──
    let visible = true, raf = 0;
    function loop(now) {
      raf = 0;
      if (!visible || document.hidden) return;
      const swapping = now - swapT0 < 1200;
      const busy = tw || dragging || swapping || Math.abs(yaw) > 0.001 || Math.abs(pitch) > 0.001 || target >= 4 || LABELS.some((L) => L.vis && L.a < 0.99);
      if (dirty || busy || !REDUCED) { frame(now); dirty = false; }
      if (busy || !REDUCED) raf = requestAnimationFrame(loop);
    }
    function kick() { if (!raf && visible) raf = requestAnimationFrame(loop); }
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; kick(); }).observe(section);
    document.addEventListener("visibilitychange", kick);
    if ("ResizeObserver" in window) new ResizeObserver(() => { resize(); kick(); }).observe(section);
    else window.addEventListener("resize", () => { resize(); kick(); });
    window.addEventListener("orientationchange", () => setTimeout(() => { W = 0; resize(); kick(); }, 250));

    resize();
    frame(performance.now());
    section.classList.add("is-gl");
    // Bedienhinweis: kurz einblenden, verschwindet beim ersten Ziehen von selbst
    if (!REDUCED) {
      setTimeout(() => hint.classList.add("is-show"), 700);
      setTimeout(() => hint.classList.remove("is-show"), 6500);
    }
    kick();
  }
})();
