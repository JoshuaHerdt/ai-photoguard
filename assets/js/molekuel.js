/* AI-Photoguard – Methylenblau in 3D (three.js r128, lokal), v4.
   Kugel-Stab-Modell aus den PubChem-Koordinaten (assets/data/methylenblau.js): Kohlenstoff grau, Wasserstoff weiß,
   Stickstoff blau, Schwefel gelb; Doppelbindungen als Doppelstab. Dreht sich langsam, lässt sich ziehen.
   Kleine Animation: Alle paar Sekunden trifft ein rotes Lichtteilchen (660 nm) das Molekül – es leuchtet kurz auf
   („angeregt“, MB*) und fällt wieder zurück. Ohne WebGL bleibt das Standbild stehen. */
(function () {
  "use strict";
  const box = document.querySelector(".mol");
  if (!box) return;
  const stage = box.querySelector(".mol__stage");
  const canvas = box.querySelector(".mol__stage canvas");
  const pill = box.querySelector(".mol__state");
  const pillTxt = pill ? pill.querySelector("span") : null;
  const labWrap = box.querySelector(".mol__labels");
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.async = true; s.onload = res;
      s.onerror = () => rej(new Error("Laden fehlgeschlagen: " + src));
      document.head.appendChild(s);
    });
  }
  // erst laden, wenn das Molekül in die Nähe kommt
  let started = false;
  const go = () => {
    if (started) return;
    started = true;
    const THREE_SRC = window.APG_THREE_SRC || "assets/vendor/three.min.js";
    Promise.all([window.THREE ? Promise.resolve() : loadScript(THREE_SRC), window.MB_MOLEKUEL ? Promise.resolve() : loadScript("assets/data/methylenblau.js")])
      .then(() => { try { init(); } catch (e) { console.warn("Molekül: Standbild, weil", e); } })
      .catch((e) => console.warn("Molekül: Standbild, weil", e));
  };
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); go(); } }, { rootMargin: "400px 0px" });
    io.observe(box);
  } else go();

  function init() {
    const THREE = window.THREE;
    const M = window.MB_MOLEKUEL;
    if (!THREE || !M) throw new Error("Daten fehlen");
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 1, 200);
    camera.position.set(0, 0, 34);

    scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a2238, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(-8, 12, 14);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x7fa6ff, 0.9);
    rim.position.set(10, -6, -10);
    scene.add(rim);
    const front = new THREE.DirectionalLight(0xffffff, 0.25);
    front.position.set(0, 0, 20);
    scene.add(front);

    const COL = { C: 0x5a6273, H: 0xf3f5f9, N: 0x3f6dff, S: 0xf4c430 };
    const RAD = { C: 0.36, H: 0.22, N: 0.36, S: 0.5 };
    const mol = new THREE.Group();
    const tilt = new THREE.Group();
    tilt.add(mol);
    scene.add(tilt);
    tilt.rotation.x = -0.32;

    const mats = {};
    const atomMat = (el) => mats[el] || (mats[el] = new THREE.MeshPhongMaterial({ color: COL[el], shininess: 90, specular: 0x666666, emissive: 0x2a63ff, emissiveIntensity: 0 }));
    const sphere = new THREE.SphereGeometry(1, 32, 20);
    const atoms = M.atoms.map(([el, x, y, z]) => {
      const m = new THREE.Mesh(sphere, atomMat(el));
      m.scale.setScalar(RAD[el] || 0.3);
      m.position.set(x, y, z);
      mol.add(m);
      return { el, p: new THREE.Vector3(x, y, z), mesh: m };
    });
    // Bindungen: zwei Hälften in den Farben der beiden Atome; Doppelbindung als zwei dünnere Stäbe in der Molekülebene
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 14, 1);
    const UP = new THREE.Vector3(0, 1, 0);
    const NORMAL = new THREE.Vector3(0, 0, 1); // das Molekül liegt fast eben in der x-y-Ebene
    function stick(a, b, r, mat) {
      const d = new THREE.Vector3().subVectors(b, a);
      const len = d.length();
      const m = new THREE.Mesh(cyl, mat);
      m.scale.set(r, len, r);
      m.position.copy(a).addScaledVector(d, 0.5);
      m.quaternion.setFromUnitVectors(UP, d.normalize());
      mol.add(m);
    }
    const bondMats = {};
    const bondMat = (el) => bondMats[el] || (bondMats[el] = new THREE.MeshPhongMaterial({ color: new THREE.Color(COL[el]).multiplyScalar(el === "H" ? 0.85 : 1), shininess: 60, specular: 0x444444, emissive: 0x2a63ff, emissiveIntensity: 0 }));
    M.bonds.forEach(([i, j, o]) => {
      const A = atoms[i], B = atoms[j];
      const mid = new THREE.Vector3().addVectors(A.p, B.p).multiplyScalar(0.5);
      const offs = [];
      if (o === 2) {
        const side = new THREE.Vector3().subVectors(B.p, A.p).cross(NORMAL).normalize().multiplyScalar(0.12);
        offs.push(side, side.clone().negate());
      } else offs.push(new THREE.Vector3());
      const r = o === 2 ? 0.075 : 0.11;
      offs.forEach((off) => {
        const a = A.p.clone().add(off), b = B.p.clone().add(off), mm = mid.clone().add(off);
        stick(a, mm, r, bondMat(A.el));
        stick(mm, b, r, bondMat(B.el));
      });
    });

    // Lichtteilchen und Leuchten beim Anregen
    function glowTex(rgb) {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const g = c.getContext("2d");
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, "rgba(" + rgb + ",1)");
      gr.addColorStop(0.25, "rgba(" + rgb + ",0.5)");
      gr.addColorStop(1, "rgba(" + rgb + ",0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    }
    const photon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("255,70,55"), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    photon.scale.set(3.2, 3.2, 1);
    scene.add(photon);
    const trailN = 14;
    const trail = [];
    for (let i = 0; i < trailN; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: photon.material.map, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
      s.scale.set(1.3, 1.3, 1);
      scene.add(s);
      trail.push(s);
    }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("90,140,255"), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    halo.scale.set(22, 22, 1);
    scene.add(halo);

    // Beschriftungen: Schwefel, Stickstoff im Ring, eine Methylgruppe
    const LBL = [
      { i: 0, t: "S · Schwefel" },
      { i: 3, t: "N · Stickstoff" },
      { i: 18, t: "CH₃ · Methylgruppe" },
    ].filter((L) => atoms[L.i]);
    LBL.forEach((L) => {
      L.el = document.createElement("span");
      L.el.className = "mol__lbl";
      L.el.textContent = L.t;
      labWrap.appendChild(L.el);
    });

    let W = 1, H = 1;
    function resize() {
      const r = stage.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      // ganzes Molekül (ca. 15 Å breit) sicher im Bild – im Hochformat weiter weg
      const halfW = 9.2, halfH = 6.5;
      const vf = (camera.fov * Math.PI) / 180;
      const dW = halfW / (Math.tan(vf / 2) * camera.aspect);
      const dH = halfH / Math.tan(vf / 2);
      camera.position.z = Math.max(dW, dH);
      camera.updateProjectionMatrix();
    }
    resize();
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(stage);
    else window.addEventListener("resize", resize);

    // Ziehen zum Drehen
    // Das Molekül ist fast eben: Es pendelt langsam um ±35° und zeigt so meist seine ganze Form.
    // Ziehen dreht frei; danach kehrt es sanft ins Pendeln zurück.
    let userRot = 0, drag = false, lx = 0, lastInput = -1e9;
    canvas.addEventListener("pointerdown", (e) => { drag = true; lx = e.clientX; try { canvas.setPointerCapture(e.pointerId); } catch (err) {} });
    canvas.addEventListener("pointermove", (e) => { if (!drag) return; const dx = e.clientX - lx; lx = e.clientX; userRot += dx * 0.01; lastInput = performance.now(); });
    const end = () => { drag = false; lastInput = performance.now(); };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);

    const V = new THREE.Vector3();
    const START = new THREE.Vector3(-13, 9, 4);
    let last = performance.now();
    let visible = true;
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) requestAnimationFrame(loop); }).observe(box);
    let hitShown = false;
    const CYCLE = 6.5;   // alle 6,5 s ein Photon
    const FLY = 1.1;     // Flugzeit
    const GLOW = 1.6;    // so lange leuchtet das angeregte Molekül
    function loop(now) {
      if (!visible) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      if (!drag && now - lastInput > 2500) {
        // zurück zur nächsten „Vorderansicht“ (Vielfaches von 2π), dann wieder Pendeln
        const home = Math.round(userRot / (2 * Math.PI)) * 2 * Math.PI;
        userRot += (home - userRot) * Math.min(1, dt * 1.2);
      }
      mol.rotation.y = userRot + (REDUCED ? 0.35 : 0.6 * Math.sin(t * 0.32));
      tilt.position.y = REDUCED ? 0 : 0.25 * Math.sin(t * 0.8);

      // Photon: fliegt auf einer Wellenbahn zur Mitte, dann leuchtet das Molekül auf
      const ph = REDUCED ? 99 : t % CYCLE;
      let excite = 0;
      if (ph < FLY) {
        const u = ph / FLY;
        const p = START.clone().lerp(new THREE.Vector3(0, 0, 1.5), u);
        const wob = new THREE.Vector3(0.6, 0.9, 0).multiplyScalar(Math.sin(u * 24));
        photon.position.copy(p).add(wob);
        photon.material.opacity = Math.min(1, u * 6);
        trail.forEach((s, k) => {
          const uu = Math.max(0, u - (k + 1) * 0.022);
          const pp = START.clone().lerp(new THREE.Vector3(0, 0, 1.5), uu).add(new THREE.Vector3(0.6, 0.9, 0).multiplyScalar(Math.sin(uu * 24)));
          s.position.copy(pp);
          s.material.opacity = uu > 0 ? 0.7 * (1 - k / trailN) : 0;
        });
      } else {
        photon.material.opacity = 0;
        trail.forEach((s) => (s.material.opacity = 0));
        const g = ph - FLY;
        if (g < GLOW) excite = g < 0.15 ? g / 0.15 : Math.pow(1 - (g - 0.15) / (GLOW - 0.15), 1.6);
      }
      halo.material.opacity = 0.55 * excite;
      halo.scale.setScalar(18 + 8 * excite);
      Object.values(mats).forEach((mm) => (mm.emissiveIntensity = 0.55 * excite));
      Object.values(bondMats).forEach((mm) => (mm.emissiveIntensity = 0.45 * excite));
      const hit = excite > 0.08;
      if (pill && hit !== hitShown) {
        pill.classList.toggle("is-hit", hit);
        if (pillTxt) pillTxt.textContent = hit ? "angeregt · MB*" : "Grundzustand · MB";
        hitShown = hit;
      }

      renderer.render(scene, camera);

      // Beschriftungen mitführen (ausblenden, wenn das Atom hinten liegt)
      mol.updateMatrixWorld();
      LBL.forEach((L) => {
        V.copy(atoms[L.i].p).applyMatrix4(mol.matrixWorld);
        const depth = V.z;
        V.project(camera);
        const y = ((1 - V.y) / 2) * H;
        const half = (L.el.offsetWidth || 100) / 2;
        const x = Math.min(W - half - 6, Math.max(half + 6, ((V.x + 1) / 2) * W)); // nie über den Rand hinaus
        L.el.style.transform = "translate(" + x.toFixed(1) + "px," + (y - 22).toFixed(1) + "px) translate(-50%,-100%)";
        L.el.style.opacity = depth > -1.2 ? "1" : "0.25";
      });
      requestAnimationFrame(loop);
    }
    box.classList.add("is-gl");
    requestAnimationFrame(loop);
  }
})();
