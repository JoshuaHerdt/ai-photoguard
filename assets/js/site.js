/* AI-Photoguard v5 – gemeinsame Seitenlogik (alle Seiten).
   Grundfunktionen laufen ohne Bibliotheken (Kopfzeile, Menü, Einblenden, Zähler, Videos, Film, Fachwörter,
   Prinzip-Schema, Lichttakt, Diagramm 2025). Die Scroll-Effekte im Stil von reverion.com (weiches Scrollen,
   Hero schrumpft, Wörter füllen sich, Karten stapeln sich, waagrechte Galerie) nutzen GSAP + ScrollTrigger
   und Lenis, alles lokal in assets/vendor. Fehlen die Bibliotheken, bleibt die Seite vollständig lesbar. */
(function () {
  "use strict";
  const root = document.documentElement;
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FINE = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  if (REDUCED) root.classList.add("reduced");

  // ── Testhilfe: ?debug zeigt JavaScript-Fehler direkt auf der Seite (Safari ohne Konsole) ──
  if (/[?&]debug/.test(location.search)) {
    const box = document.createElement("div");
    box.className = "debug-log";
    box.textContent = "debug aktiv · " + navigator.userAgent;
    const log = (m) => { box.textContent += "\n" + m; if (document.body) document.body.appendChild(box); };
    window.addEventListener("error", (e) => log("Fehler: " + e.message + " (" + (e.filename || "").split("/").pop() + ":" + e.lineno + ")"));
    window.addEventListener("unhandledrejection", (e) => log("Promise: " + (e.reason && e.reason.message ? e.reason.message : e.reason)));
    window.__debugLog = log;
    document.addEventListener("DOMContentLoaded", () => document.body.appendChild(box));
    // ?debug&autoscroll scrollt langsam nach unten, ?debug&autonav=seite.html wechselt nach 4 s per Link
    if (/[?&]autoscroll/.test(location.search)) {
      window.addEventListener("load", () => setTimeout(() => {
        let last = performance.now();
        (function step(now) {
          window.scrollBy(0, ((now - last) / 1000) * 700);
          last = now;
          if (window.scrollY + window.innerHeight < document.documentElement.scrollHeight - 2) requestAnimationFrame(step);
          else log("autoscroll fertig");
        })(last);
      }, 1500));
    }
    const autonav = /[?&]autonav=([\w-]+\.html)/.exec(location.search);
    if (autonav) window.addEventListener("load", () => setTimeout(() => {
      const a = document.createElement("a");
      a.href = autonav[1] + "?debug";
      document.body.appendChild(a);
      a.click();
    }, 4000));
  }

  // ── Jede geöffnete Seite beginnt oben (außer bei gezielter Sprungmarke oder beim Zurückwischen) ──
  (function () {
    try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch (e) { /* egal */ }
    const navType = (performance.getEntriesByType && (performance.getEntriesByType("navigation")[0] || {}).type) || "navigate";
    if (navType === "back_forward") return;
    let target = null;
    try { target = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null; } catch (e) { target = null; }
    if (target) return;
    let touched = false;
    ["wheel", "touchstart", "keydown", "mousedown"].forEach((t) => addEventListener(t, () => { touched = true; }, { passive: true, once: true }));
    const toTop = () => { if (!touched && (window.scrollY || window.pageYOffset) > 0) window.scrollTo(0, 0); };
    toTop();
    addEventListener("load", () => { toTop(); setTimeout(toTop, 60); }, { once: true });
  })();

  // ── Kein Doppeltipp-Zoom auf Bedienelementen (iOS Safari) ──
  let lastTapEnd = 0;
  document.addEventListener("touchend", (e) => {
    if (e.touches.length || e.changedTouches.length !== 1) return;
    const t = e.target.closest && e.target.closest("button, a, .mbx__ui, .ledsel, .lab__ctl, .pv__tabs, .fbb");
    const now = Date.now();
    if (t && now - lastTapEnd < 350) e.preventDefault();
    lastTapEnd = t ? now : 0;
  }, { passive: false });

  // ── Aktuelle Seite in der Navigation ──
  const pageFile = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  $$(".desk-nav a, .menu__list a").forEach((a) => {
    if ((a.getAttribute("href") || "").toLowerCase() === pageFile) a.setAttribute("aria-current", "page");
  });

  // ── Kopfzeile: Hintergrund nach dem ersten Scrollen, Farbe des Abschnitts darunter, Lesefortschritt ──
  const header = $(".site-header");
  const bar = header ? $(".progress span", header) : null;
  const themed = $$("main [data-theme], .next[data-theme], .site-footer[data-theme]").filter((s) => !s.closest(".site-header"));
  let ticking = false;
  function updateHeader() {
    ticking = false;
    if (!header) return;
    const y = window.scrollY || window.pageYOffset;
    header.classList.toggle("is-solid", y > 24);
    const probe = header.offsetHeight * 0.5;
    let theme = "dark";
    for (let i = themed.length - 1; i >= 0; i--) {
      const r = themed[i].getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) { theme = themed[i].dataset.theme || "dark"; break; }
    }
    if (header.dataset.theme !== theme) header.dataset.theme = theme;
    if (bar) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? clamp01(y / max) : 0).toFixed(4) + ")";
    }
  }
  const requestHeader = () => { if (!ticking) { ticking = true; requestAnimationFrame(updateHeader); } };
  window.addEventListener("scroll", requestHeader, { passive: true });
  window.addEventListener("resize", requestHeader);
  window.APG = { updateHeader: requestHeader };
  updateHeader();

  // ── Menü ──
  const menuBtn = $(".menu-btn");
  const menu = $("#menu");
  let lenis = null;
  function setMenu(open) {
    if (!menu || !menuBtn) return;
    menuBtn.setAttribute("aria-expanded", String(open));
    const lbl = $(".menu-btn__label", menuBtn);
    if (lbl) lbl.textContent = open ? "Schließen" : "Menü";
    root.classList.toggle("menu-open", open);
    menu.hidden = !open;
    if (lenis) { if (open) lenis.stop(); else lenis.start(); }
    if (open) { const a = $(".menu__list a", menu); if (a) a.focus({ preventScroll: true }); }
  }
  if (menuBtn) menuBtn.addEventListener("click", () => setMenu(menuBtn.getAttribute("aria-expanded") !== "true"));
  if (menu) $$("a", menu).forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && root.classList.contains("menu-open")) { setMenu(false); menuBtn.focus(); } });
  window.addEventListener("pageshow", (e) => { if (e.persisted) { setMenu(false); requestHeader(); } });

  // ── Einblenden + Zähler ──
  const pending = new Set($$("[data-reveal]"));
  function countUp(el) {
    if (REDUCED || el.dataset.counted) return;
    el.dataset.counted = "1";
    const target = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.dec || "0", 10);
    const fmt = (v) => v.toLocaleString("de-DE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const t0 = performance.now();
    (function step(now) {
      const u = clamp01((now - t0) / 1600);
      el.textContent = fmt(target * (1 - Math.pow(1 - u, 4)));
      if (u < 1) requestAnimationFrame(step);
    })(t0);
  }
  function reveal(el) {
    if (!pending.has(el)) return;
    pending.delete(el);
    el.classList.add("is-in");
    $$("[data-count]", el).forEach(countUp);
    if (el.matches("[data-count]")) countUp(el);
  }
  function sweep() { const limit = window.innerHeight; pending.forEach((el) => { if (el.getBoundingClientRect().top < limit) reveal(el); }); }
  if (REDUCED || !("IntersectionObserver" in window)) Array.from(pending).forEach(reveal);
  else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); } });
      sweep();
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0 });
    pending.forEach((el) => io.observe(el));
    let q = false;
    window.addEventListener("scroll", () => { if (q || !pending.size) return; q = true; setTimeout(() => { q = false; sweep(); }, 120); }, { passive: true });
    window.addEventListener("load", sweep);
  }
  // Zähler außerhalb von [data-reveal]
  $$("[data-count]").forEach((el) => {
    if (el.closest("[data-reveal]")) return;
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); countUp(el); } }, { threshold: 0.4 });
    io.observe(el);
  });

  // ── Videos: nur abspielen, solange sie zu sehen sind. Quelle passend zur Bildschirmbreite. ──
  const vids = $$("video[data-auto]");
  // Testhilfe ?still: Standbilder statt Videos (manche Bildschirmfotos zeigen keine Videoebene)
  if (/[?&]still/.test(location.search)) vids.forEach((v) => { const i = document.createElement("img"); i.src = v.poster; i.alt = ""; i.style.cssText = "position:absolute;top:0;bottom:0;width:100%;height:100%;object-fit:cover"; v.replaceWith(i); });
  vids.forEach((v) => {
    if (!v.isConnected) return;
    const big = v.dataset.srcLg, small = v.dataset.srcSm || big;
    const src = window.innerWidth >= 900 ? big : small;
    v.muted = true; v.defaultMuted = true; v.playsInline = true;
    v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", "");
    v.loop = true; v.preload = "none";
    if (REDUCED) return; // Standbild bleibt stehen
    let loaded = false;
    const play = () => {
      if (!loaded && src) { v.src = src; loaded = true; }
      const p = v.play(); if (p && p.catch) p.catch(() => { /* Autoplay verweigert: Standbild bleibt */ });
    };
    v._play = play;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => { es.forEach((e) => { v._inView = e.isIntersecting; if (e.isIntersecting) play(); else if (loaded) v.pause(); }); }, { rootMargin: "200px 0px" }).observe(v);
    } else { v._inView = true; play(); }
    // Manche Browser halten ein Video beim ersten Laden an (z. B. im Hintergrund-Tab) – dann sanft nachstarten
    v.addEventListener("canplay", () => { if (v._inView && v.paused && !document.hidden) play(); });
  });
  document.addEventListener("visibilitychange", () => {
    vids.forEach((v) => { if (document.hidden) v.pause(); else if (v._inView && v._play) v._play(); });
  });

  // ── Film-Fenster ──
  const film = $("#film");
  if (film) {
    const fv = $("video", film);
    const open = (e) => {
      if (e) e.preventDefault();
      if (typeof film.showModal === "function") film.showModal(); else film.setAttribute("open", "");
      if (lenis) lenis.stop();
      if (fv) { if (!fv.src) fv.src = fv.dataset.src; const p = fv.play(); if (p && p.catch) p.catch(() => {}); }
    };
    const close = () => { if (fv) fv.pause(); if (film.open && typeof film.close === "function") film.close(); else film.removeAttribute("open"); if (lenis) lenis.start(); };
    $$("[data-film]").forEach((b) => b.addEventListener("click", open));
    $$("[data-film-close]", film).forEach((b) => b.addEventListener("click", close));
    film.addEventListener("close", () => { if (fv) fv.pause(); if (lenis) lenis.start(); });
    film.addEventListener("click", (e) => { if (e.target === film) close(); });
  }

  // ── Großer Satz: Wörter einzeln einpacken ──
  const statements = $$(".statement");
  statements.forEach((st) => {
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const parts = n.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(p));
            else { const s = document.createElement("span"); s.className = "w"; s.textContent = p; frag.appendChild(s); }
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && !n.classList.contains("ref")) walk(n);
      });
    };
    walk(st);
  });
  function fillStatement(st, p) {
    const ws = st._ws || (st._ws = $$(".w", st));
    const n = Math.round(p * ws.length);
    ws.forEach((w, i) => w.classList.toggle("on", i < n));
  }

  // ── Schwebende Formelkürzel ──
  const chemLayers = $$(".chems");
  function floatChems() {
    if (REDUCED) return;
    chemLayers.forEach((layer) => {
      const items = $$(".chem", layer).map((el, i) => ({ el, ph: i * 1.7, amp: 8 + (i % 3) * 5, sp: 0.00035 + (i % 4) * 0.00009, depth: parseFloat(el.dataset.depth || (0.4 + (i % 3) * 0.3)) }));
      let mx = 0, my = 0, tx = 0, ty = 0, on = true, scrollOff = 0;
      if (FINE) layer.parentElement.addEventListener("pointermove", (e) => {
        const r = layer.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - 0.5) * 2; ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      });
      if ("IntersectionObserver" in window) new IntersectionObserver((es) => { on = es[0].isIntersecting; if (on) requestAnimationFrame(tick); }).observe(layer);
      function tick(now) {
        if (!on) return;
        mx += (tx - mx) * 0.05; my += (ty - my) * 0.05;
        const r = layer.getBoundingClientRect();
        scrollOff = -r.top;
        items.forEach((it) => {
          const y = Math.sin(now * it.sp + it.ph) * it.amp - mx * 0 + my * -18 * it.depth - scrollOff * 0.25 * it.depth;
          const x = Math.cos(now * it.sp * 0.8 + it.ph) * it.amp * 0.6 + mx * -22 * it.depth;
          it.el.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)";
        });
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }
  floatChems();

  // ── Scroll-Effekte mit GSAP / Lenis (falls vorhanden) ──
  function scrollFx() {
    const G = window.gsap, ST = window.ScrollTrigger;
    if (!G || !ST || REDUCED) {
      // Ohne Bibliothek: Sätze werden beim Erscheinen vollständig gefüllt
      statements.forEach((st) => {
        if (!("IntersectionObserver" in window) || REDUCED) { fillStatement(st, 1); return; }
        const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); fillStatement(st, 1); } }, { threshold: 0.3 });
        io.observe(st);
      });
      return;
    }
    G.registerPlugin(ST);
    // Weiches Scrollen nur mit Maus/Trackpad, nicht auf Touch-Geräten und nicht auf Seiten mit 3D-Rundgang
    if (window.Lenis && FINE && !document.body.hasAttribute("data-nolenis")) {
      lenis = new window.Lenis({ duration: 1.15, smoothWheel: true, anchors: { offset: -90 } });
      lenis.on("scroll", ST.update);
      G.ticker.add((t) => lenis.raf(t * 1000));
      G.ticker.lagSmoothing(0);
      root.classList.add("has-lenis");
    }
    const mm = G.matchMedia();

    // Hero: Das Video schrumpft beim Scrollen zu einer abgerundeten Karte
    $$("[data-hero-shrink]").forEach((sec) => {
      const media = $(".hero__media", sec);
      const inner = $(".hero__inner", sec);
      if (!media) return;
      G.fromTo(media, { clipPath: "inset(0% 0% 0% 0% round 0px)" }, {
        clipPath: "inset(6% 4% 10% 4% round 28px)", ease: "none",
        scrollTrigger: { trigger: sec, start: "top top", end: "bottom top", scrub: true }
      });
      G.to($$("video, img", media), { scale: 1.12, ease: "none", scrollTrigger: { trigger: sec, start: "top top", end: "bottom top", scrub: true } });
      if (inner) G.to(inner, { yPercent: -18, opacity: 0, ease: "none", scrollTrigger: { trigger: sec, start: "35% top", end: "bottom top", scrub: true } });
    });

    // Wörter füllen sich
    statements.forEach((st) => {
      ST.create({ trigger: st, start: "top 82%", end: "bottom 45%", scrub: true, onUpdate: (s) => fillStatement(st, s.progress) });
    });

    // Parallaxe in Bildrahmen
    $$("[data-parallax]").forEach((el) => {
      G.fromTo(el, { yPercent: -6 }, { yPercent: 6, ease: "none", scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
    });

    // Zeitstrahl füllt sich
    $$(".tline").forEach((tl) => {
      ST.create({ trigger: tl, start: "top 70%", end: "bottom 60%", scrub: true, onUpdate: (s) => tl.style.setProperty("--p", s.progress.toFixed(3)) });
    });

    // Gestapelte Karten: die vordere schiebt sich über die hintere, die hintere wird kleiner und dunkler
    mm.add("(min-width: 1000px)", () => {
      $$(".stack").forEach((stack) => {
        const cards = $$(".stack__card", stack);
        cards.forEach((c, i) => {
          const nextCard = cards[i + 1];
          if (!nextCard) return;
          G.to(c, { scale: 0.94, filter: "brightness(0.6)", ease: "none", scrollTrigger: { trigger: nextCard, start: "top 70%", end: "top " + (78 + 28 + (i + 1) * 18) + "px", scrub: true } });
        });
      });
      // Waagrechte Galerie: beim Scrollen nach unten fährt die Reihe nach links
      $$(".hscroll--pin").forEach((wrap) => {
        const track = $(".hscroll__track", wrap);
        if (!track) return;
        const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
        G.to(track, { x: () => -dist(), ease: "none", scrollTrigger: { trigger: wrap, start: "top top", end: () => "+=" + dist(), pin: true, scrub: true, invalidateOnRefresh: true, anticipatePin: 1 } });
      });
    });

    // Große Überschriften gleiten leicht
    $$("[data-drift]").forEach((el) => {
      G.fromTo(el, { xPercent: parseFloat(el.dataset.drift) || 6 }, { xPercent: 0, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom 40%", scrub: true } });
    });

    window.addEventListener("load", () => ST.refresh());
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scrollFx); else scrollFx();

  // ── Fotostrecke (Wischen, Pfeile, Tastatur) ──
  $$(".carousel").forEach((car) => {
    const track = $(".carousel__track", car);
    const slides = Array.from(track.children);
    const prog = $(".carousel__bar span", car);
    const count = $(".carousel__count", car);
    const prev = $('.carousel__btn[data-dir="-1"]', car);
    const next = $('.carousel__btn[data-dir="1"]', car);
    const n = slides.length;
    let idx = -1;
    if (prog) prog.style.width = 100 / n + "%";
    function set(i) {
      if (i === idx) return;
      idx = i;
      if (prog) prog.style.transform = "translateX(" + i * 100 + "%)";
      if (count) count.textContent = i + 1 + " / " + n;
      if (prev) prev.disabled = i === 0;
      if (next) next.disabled = i === n - 1;
    }
    function nearest() {
      const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      const x = track.scrollLeft, max = track.scrollWidth - track.clientWidth;
      if (max > 4 && x >= max - 4) return n - 1;
      let best = 0, bd = Infinity;
      slides.forEach((s, j) => { const d = Math.abs(s.offsetLeft - pad - x); if (d < bd) { bd = d; best = j; } });
      return best;
    }
    let quietUntil = 0, raf = 0;
    track.addEventListener("scroll", () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; if (performance.now() > quietUntil) set(nearest()); }); }, { passive: true });
    function go(i) {
      i = Math.max(0, Math.min(n - 1, i));
      const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      quietUntil = performance.now() + 700;
      track.scrollTo({ left: slides[i].offsetLeft - pad, behavior: REDUCED ? "auto" : "smooth" });
      set(i);
    }
    if (prev) prev.addEventListener("click", () => go(idx - 1));
    if (next) next.addEventListener("click", () => go(idx + 1));
    track.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") { e.preventDefault(); go(idx + 1); } if (e.key === "ArrowLeft") { e.preventDefault(); go(idx - 1); } });
    set(0);
  });

  // ── Prinzip-Schema: vier Schritte, weiter per Knopf ──
  $$(".pv").forEach((pv) => {
    const scheme = $(".scheme", pv);
    const tabs = $$(".pv__tabs button", pv);
    const texts = $$(".pv__text", pv);
    const back = $("[data-pv='-1']", pv);
    const fwd = $("[data-pv='1']", pv);
    const fwdLabel = fwd ? $("span", fwd) : null;
    let cur = 0;
    function show(i, focusTab) {
      cur = Math.max(0, Math.min(3, i));
      scheme.classList.remove("is-0", "is-1", "is-2", "is-3");
      scheme.classList.add("is-" + cur);
      tabs.forEach((t, j) => { t.setAttribute("aria-selected", String(j === cur)); t.tabIndex = j === cur ? 0 : -1; });
      texts.forEach((t, j) => t.classList.toggle("is-on", j === cur));
      if (back) back.disabled = cur === 0;
      if (fwdLabel) fwdLabel.textContent = cur === 3 ? "Von vorn" : "Nächster Schritt";
      if (focusTab) tabs[cur].focus();
    }
    tabs.forEach((t, j) => t.addEventListener("click", () => show(j)));
    if (back) back.addEventListener("click", () => show(cur - 1));
    if (fwd) fwd.addEventListener("click", () => show(cur === 3 ? 0 : cur + 1));
    $(".pv__tabs", pv).addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); show(cur + (e.key === "ArrowRight" ? 1 : -1), true); }
    });
    if ("IntersectionObserver" in window && !REDUCED) {
      const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); show(0); } }, { threshold: 0.35 });
      io.observe(scheme);
    } else show(0);
  });

  // ── Lichttakt in Echtzeit (15 s: 11 s an, 4 s aus) ──
  const cycle = $(".cycle__bar");
  if (cycle && !REDUCED) {
    const head = $(".cycle__head", cycle);
    let on = false;
    new IntersectionObserver((es) => { on = es[0].isIntersecting; if (on) requestAnimationFrame(tick); }).observe(cycle);
    const t0 = performance.now();
    function tick(now) {
      if (!on) return;
      const u = (((now - t0) / 1000) % 15) / 15;
      head.style.transform = "translateX(" + (u * (cycle.clientWidth - 3)).toFixed(1) + "px)";
      requestAnimationFrame(tick);
    }
  }

  // ── Diagramm 2025: Spannung der Konzentrationszelle (eigene Messwerte aus dem Poster) ──
  const volt = $(".volt");
  if (volt) {
    const DATA = [[0, 0], [10, 21], [30, 50], [35, 81], [40, 105], [45, 129], [50, 150], [55, 170], [60, 188], [65, 207], [70, 225], [75, 241], [80, 257], [85, 273], [90, 287], [95, 301], [100, 315], [105, 327], [110, 338], [125, 373], [150, 414], [180, 466], [210, 509], [240, 532], [270, 542], [300, 546], [600, 550], [1200, 549]];
    const NS = "http://www.w3.org/2000/svg";
    const X0 = 70, X1 = 520, Y0 = 300, Y1 = 30;
    const xs = (t) => X0 + (t / 1400) * (X1 - X0);
    const ys = (u) => Y0 - (u / 600) * (Y0 - Y1);
    const mk = (name, attrs, text) => { const e = document.createElementNS(NS, name); Object.keys(attrs).forEach((k) => e.setAttribute(k, attrs[k])); if (text != null) e.textContent = text; return e; };
    const g = $(".volt__grid", volt);
    for (let u = 0; u <= 600; u += 200) { g.appendChild(mk("line", { x1: X0, x2: X1, y1: ys(u), y2: ys(u) })); g.appendChild(mk("text", { x: X0 - 10, y: ys(u) + 5, "text-anchor": "end" }, u)); }
    for (let t = 0; t <= 1200; t += 400) g.appendChild(mk("text", { x: xs(t), y: Y0 + 24, "text-anchor": "middle" }, t));
    g.appendChild(mk("text", { x: X1, y: Y0 + 50, "text-anchor": "end" }, "Zeit in s"));
    g.appendChild(mk("text", { x: X0 - 10, y: Y1 - 12, "text-anchor": "start" }, "mV"));
    const line = $(".volt__line", volt);
    line.setAttribute("d", DATA.map(([t, u], i) => (i ? "L" : "M") + xs(t).toFixed(1) + " " + ys(u).toFixed(1)).join(" "));
    const dots = $(".volt__dots", volt);
    DATA.forEach(([t, u]) => dots.appendChild(mk("circle", { cx: xs(t).toFixed(1), cy: ys(u).toFixed(1), r: 4 })));
    if (!REDUCED && "IntersectionObserver" in window && line.getTotalLength) {
      const L = line.getTotalLength();
      line.style.strokeDasharray = L; line.style.strokeDashoffset = L;
      dots.style.opacity = 0;
      const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); line.style.transition = "stroke-dashoffset 2.4s cubic-bezier(.19,1,.22,1)"; line.style.strokeDashoffset = 0; dots.style.transition = "opacity 1s ease 1.4s"; dots.style.opacity = 1; } }, { threshold: 0.4 });
      io.observe(volt);
    }
  }

  // ── Foto-Blue-Bottle zum Ausprobieren (Beobachtungen aus der Arbeit 2025) ──
  $$(".fbb").forEach((box) => {
    const stage = $(".fbb__stage", box);
    const out = $(".fbb__out", box);
    const stateTxt = $(".fbb__state span", box);
    const YELLOW = "#e9d335", BLUE = "#2f5aa8";
    const CASES = {
      weiss: { beam: "rgba(255,255,255,.95)", liq: BLUE, state: "blau · EV⁺• entstanden", t: "<b>Weißes Licht: Die Lösung wird blau.</b> Weißes Licht enthält auch Blau. Proflavin schluckt diesen Anteil, gibt ein Elektron an Ethylviologen weiter – das blaue EV⁺• entsteht." },
      blau: { beam: "rgba(77,107,255,.95)", liq: BLUE, state: "blau · EV⁺• entstanden", t: "<b>Blaues Licht: kräftige Blaufärbung.</b> Blaues Licht um 450 nm trifft genau die Absorption von Proflavin – die gelbe Form hat ihr Maximum bei 444 nm." },
      gruen: { beam: "rgba(47,209,90,.9)", liq: YELLOW, state: "gelb · keine Veränderung", t: "<b>Grünes Licht: nichts passiert.</b> Proflavin schluckt grünes Licht kaum – ohne Anregung kein Elektronentransfer." },
      rot: { beam: "rgba(255,59,47,.9)", liq: YELLOW, state: "gelb · keine Veränderung", t: "<b>Rotes Licht: nichts passiert.</b> Die Lichtteilchen sind zu energiearm, um Proflavin anzuregen." },
      hitze: { beam: "transparent", liq: YELLOW, state: "gelb · keine Veränderung", t: "<b>Erhitzen bis zum Sieden: keine Farbänderung.</b> Wärme allein reicht nicht – die Reaktion wird durch Licht ausgelöst, sie ist photochemisch." },
      luft: { beam: "transparent", liq: YELLOW, state: "gelb · Rückreaktion", t: "<b>Luft: Das Blau verschwindet wieder.</b> Luftsauerstoff kann EV⁺• das Elektron wieder abnehmen. Diese Rückreaktion haben wir 2025 als mögliche Fehlerquelle bedacht." }
    };
    $$("[data-fbb]", box).forEach((b) => b.addEventListener("click", () => {
      const c = CASES[b.dataset.fbb];
      if (!c) return;
      $$("[data-fbb]", box).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      stage.style.setProperty("--beam", c.beam);
      stage.style.setProperty("--liq", c.liq);
      box.style.setProperty("--liq", c.liq);
      if (stateTxt) stateTxt.textContent = c.state;
      if (out) out.innerHTML = c.t;
    }));
  });

  // ── Fachwörter: Erklärung zum Antippen (popover; für ältere Safari per Skript) ──
  const glosses = $$(".gloss");
  if (glosses.length) {
    const native = typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;
    if (!native) {
      root.classList.add("no-popover");
      let open = null;
      const close = () => { if (open) { open.classList.remove("is-open"); open = null; } };
      $$("[popovertarget]").forEach((b) => b.addEventListener("click", (e) => {
        e.stopPropagation();
        const el = document.getElementById(b.getAttribute("popovertarget"));
        if (!el) return;
        const was = open === el;
        close();
        if (!was && b.getAttribute("popovertargetaction") !== "hide") { el.classList.add("is-open"); open = el; }
      }));
      glosses.forEach((g) => g.addEventListener("click", (e) => e.stopPropagation()));
      document.addEventListener("click", close);
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    }
  }
})();
