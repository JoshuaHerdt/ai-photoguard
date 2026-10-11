/* AI-Photoguard – Webseite v6 */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var root = document.documentElement;
  root.classList.remove("no-js"); root.classList.add("js");

  var still = /[?&]still\b/.test(location.search);          // Standbilder statt Videos (zum Prüfen)
  var ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var schmal = window.matchMedia("(max-width: 900px)").matches;

  function abspielen(v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }

  // ── Videos: passende Größe, nur abspielen solange sichtbar ──────────────
  $$("video[data-src-lg]").forEach(function (v) {
    if (still || ruhig) {
      var img = document.createElement("img");
      img.className = "standbild"; img.alt = ""; img.src = v.getAttribute("poster");
      v.replaceWith(img); return;
    }
    v.muted = true; v.setAttribute("playsinline", "");
    v.src = (schmal && v.dataset.srcSm) ? v.dataset.srcSm : v.dataset.srcLg;
    var sichtbar = false;
    function los() { if (sichtbar && document.visibilityState === "visible") abspielen(v); }
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { sichtbar = e.isIntersecting; if (sichtbar) los(); else v.pause(); });
    }, { rootMargin: "120px 0px" }).observe(v);
    v.addEventListener("canplay", los);
    document.addEventListener("visibilitychange", los);
  });

  // ── Einblenden ─────────────────────────────────────────────────────────
  var zeig = $$("[data-zeigen]");
  if ("IntersectionObserver" in window && !ruhig) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("da"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    zeig.forEach(function (el) { io.observe(el); });
  } else zeig.forEach(function (el) { el.classList.add("da"); });

  // ── Wortmarke: groß im Bild → klein in der Kopfzeile ────────────────────
  var marke = $("#marke"), kopf = $("#kopf"), heroText = $("#heroText"), dunkel = $("#dunkel");
  var heroBild = $(".hero video, .hero img.standbild");
  var abschnitte = $$("[data-ton], .uebergang");
  var start = { x: 0, y: 0, s: 1 }, ziel = { x: 0, y: 0, s: .2 };
  var hatHero = !!heroText;

  function messen() {
    if (!marke) return;
    marke.style.transform = "none";
    var r = marke.getBoundingClientRect();
    var gutter = Math.max(16, Math.min(56, innerWidth * .04));        // wie --gutter
    var oben = parseFloat(getComputedStyle(kopf).paddingTop) || 0;
    var zielHoehe = 26;
    ziel = { x: gutter, y: oben + (72 - zielHoehe) / 2, s: zielHoehe / r.height };
    if (hatHero) {
      var t = heroText.getBoundingClientRect().height;
      start = { x: gutter, y: innerHeight - t - 40 - r.height - 18, s: 1 };
    } else start = ziel;
    zeichnen();
  }
  function weich(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  var geplant = false;
  function zeichnen() {
    geplant = false;
    var y = window.scrollY || 0;
    var menueAuf = document.body.classList.contains("menue-offen");          // offenes Menü: Wortmarke klein
    var p = (ruhig || !hatHero || menueAuf) ? 1 : Math.min(1, Math.max(0, y / (innerHeight * .55)));
    var e = weich(p);
    if (marke) {
      marke.style.transform = "translate3d(" + (start.x + (ziel.x - start.x) * e) + "px," + (start.y + (ziel.y - start.y) * e) + "px,0) scale(" + (start.s + (ziel.s - start.s) * e) + ")";
      marke.classList.toggle("klein", p > .98);
    }
    if (hatHero) {
      heroText.style.opacity = String(1 - Math.min(1, p * 1.8));
      if (dunkel) dunkel.style.opacity = String(Math.min(.55, p * .7));
      if (heroBild && !ruhig) heroBild.style.transform = "scale(" + (1 + .06 * Math.min(1, y / innerHeight)) + ")";
    }
    kopf.classList.toggle("voll", !hatHero || y > innerHeight * .9);
    // Kopfzeile hell oder dunkel – je nach Abschnitt darunter
    var ton = "dunkel";
    for (var i = 0; i < abschnitte.length; i++) {
      var r = abschnitte[i].getBoundingClientRect();
      if (r.top <= 40 && r.bottom > 40) {
        var el = abschnitte[i], k = el.className.match(/uebergang--(\w)(\w)/);
        if (k) ton = ((40 - r.top) / r.height > .55 ? k[2] : k[1]) === "h" ? "hell" : "dunkel";
        else ton = el.dataset.ton;
        break;
      }
    }
    document.body.dataset.kopf = ton;
  }
  addEventListener("scroll", function () { if (!geplant) { geplant = true; requestAnimationFrame(zeichnen); } }, { passive: true });
  addEventListener("resize", messen);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(messen);
  messen();

  // ── Menü ─────────────────────────────────────────────────────────────
  var knopf = $("#menueKnopf"), menue = $("#menue");
  function menueSetzen(auf) {
    document.body.classList.toggle("menue-offen", auf);
    knopf.setAttribute("aria-expanded", String(auf));
    knopf.querySelector("span").textContent = auf ? "Schließen" : "Menü";
    menue.setAttribute("aria-hidden", String(!auf));
    if (marke) { marke.classList.add("gleitet"); zeichnen(); setTimeout(function () { marke.classList.remove("gleitet"); }, 600); }
    if (auf) { var a = menue.querySelector("a"); if (a) a.focus({ preventScroll: true }); }
  }
  if (knopf && menue) {
    knopf.addEventListener("click", function () { menueSetzen(!document.body.classList.contains("menue-offen")); });
    addEventListener("keydown", function (e) { if (e.key === "Escape" && document.body.classList.contains("menue-offen")) { menueSetzen(false); knopf.focus(); } });
    $$("a", menue).forEach(function (a) { a.addEventListener("click", function () { menueSetzen(false); }); });
  }

  // ── Foto-Blue-Bottle: Modell + echtes Foto aus dem Versuch 2025 ────────
  $$(".fbb").forEach(function (box) {
    var buehne = $(".fbb__buehne", box), text = $(".fbb__text", box), zustand = $(".fbb__zustand span", box);
    var reihe = box.parentNode.querySelector(".echt2025");
    var GELB = "#e9d335", BLAU = "#2f5aa8";
    var FAELLE = {
      weiss: { strahl: "rgba(255,255,255,.95)", fl: BLAU, z: "blau · EV⁺• entstanden", foto: "weiss",
        t: "<b>Weißes Licht: Die Lösung wird blau.</b> Weißes Licht enthält auch Blau. Proflavin schluckt diesen Anteil und gibt ein Elektron an Ethylviologen weiter – das blaue EV⁺• entsteht." },
      blau: { strahl: "rgba(77,107,255,.95)", fl: BLAU, z: "blau · EV⁺• entstanden", foto: "blau",
        t: "<b>Blaues Licht: kräftige Blaufärbung.</b> Blaues Licht um 450 nm trifft genau die Absorption von Proflavin – die gelbe Form hat ihr Maximum bei 444 nm." },
      gruen: { strahl: "rgba(47,209,90,.9)", fl: GELB, z: "gelb · keine Veränderung", foto: "gruen",
        t: "<b>Grünes Licht: nichts passiert.</b> Proflavin schluckt grünes Licht kaum – ohne Anregung kein Elektronentransfer." },
      rot: { strahl: "rgba(255,59,47,.9)", fl: GELB, z: "gelb · keine Veränderung", foto: "rot",
        t: "<b>Rotes Licht: nichts passiert.</b> Die Lichtteilchen sind zu energiearm, um Proflavin anzuregen." },
      hitze: { strahl: "transparent", fl: GELB, z: "gelb · keine Veränderung", foto: "start",
        t: "<b>Erhitzen bis zum Sieden: keine Farbänderung.</b> Wärme allein reicht nicht – die Reaktion wird durch Licht ausgelöst, sie ist photochemisch." },
      luft: { strahl: "transparent", fl: GELB, z: "gelb · Rückreaktion", foto: "start",
        t: "<b>Luft: Das Blau verschwindet wieder.</b> Luftsauerstoff kann EV⁺• das Elektron wieder abnehmen. Diese Rückreaktion haben wir 2025 als mögliche Fehlerquelle bedacht." },
      start: { strahl: "transparent", fl: GELB, z: "gelb · Ausgangszustand", foto: "start",
        t: "<b>Noch nichts passiert.</b> Die Lösung aus EDTA, Proflavin und Ethylviologen ist gelb – die Farbe kommt vom Proflavin." }
    };
    function zeigen(name) {
      var f = FAELLE[name]; if (!f) return;
      $$("[data-fbb]", box).forEach(function (x) { x.setAttribute("aria-pressed", String(x.dataset.fbb === name)); });
      buehne.style.setProperty("--strahl", f.strahl);
      box.style.setProperty("--fl", f.fl);
      if (reihe) reihe.style.setProperty("--fl", f.fl);
      if (zustand) zustand.textContent = f.z;
      if (text) text.innerHTML = f.t;
      if (reihe) $$("[data-echt]", reihe).forEach(function (x) { x.setAttribute("aria-pressed", String(x.dataset.echt === f.foto)); });
    }
    if (reihe) $$("[data-echt]", reihe).forEach(function (b) { b.addEventListener("click", function () { zeigen(b.dataset.echt); }); });
    $$("[data-fbb]", box).forEach(function (b) { b.addEventListener("click", function () { zeigen(b.dataset.fbb); }); });
  });

  // ── Spektrum: Wie viel Licht schluckt Methylenblau? ─────────────────────
  var spek = $("#spektrum");
  if (spek && window.MB_SPEKTRUM) {
    var D = window.MB_SPEKTRUM, L0 = D[0][0], L1 = D[D.length - 1][0];
    var MAX = D.reduce(function (m, p) { return p[1] > m[1] ? p : m; });
    var LEDS = [[450, "#4d6bff"], [480, "#22c7d8"], [590, "#ffb21f"], [660, "#ff3b2f"]];
    var x = function (l) { return (l - L0) / (L1 - L0) * 1000; };
    var y = function (e) { return 290 - e / MAX[1] * 270; };

    // Wellenlänge → ungefähre Farbe (nach D. Bruton)
    function farbe(l) {
      var r = 0, g = 0, b = 0;
      if (l < 440) { r = -(l - 440) / 60; b = 1; } else if (l < 490) { g = (l - 440) / 50; b = 1; }
      else if (l < 510) { g = 1; b = -(l - 510) / 20; } else if (l < 580) { r = (l - 510) / 70; g = 1; }
      else if (l < 645) { r = 1; g = -(l - 645) / 65; } else r = 1;
      var f = l > 700 ? .3 + .7 * (760 - l) / 60 : (l < 420 ? .3 + .7 * (l - 380) / 40 : 1);
      var k = function (c) { return Math.round(255 * Math.pow(c * f, .8)); };
      return "rgb(" + k(r) + "," + k(g) + "," + k(b) + ")";
    }
    // Farbband aus denselben Farben
    var stops = []; for (var l = L0; l <= L1; l += 20) stops.push(farbe(l) + " " + ((l - L0) / (L1 - L0) * 100).toFixed(1) + "%");
    $(".spek__band", spek).style.background = "linear-gradient(90deg," + stops.join(",") + ")";

    // Kurve zeichnen
    var pfad = D.map(function (p, i) { return (i ? "L" : "M") + x(p[0]).toFixed(1) + " " + y(p[1]).toFixed(1); }).join(" ");
    $("#spekLinie").setAttribute("d", pfad);
    $("#spekFlaeche").setAttribute("d", pfad + " L1000 290 L0 290 Z");
    var leds = $(".spek__leds", spek);
    LEDS.forEach(function (d) {
      var m = document.createElement("span"); m.className = "spek__led"; m.style.left = (x(d[0]) / 10) + "%"; m.style.setProperty("--c", d[1]);
      m.innerHTML = "<span>" + d[0] + "<em> nm</em></span>"; leds.appendChild(m);
    });

    var regler = $("input", spek), griff = $(".spek__griff", spek), wert = $("#spekWert"), satz = $("#spekSatz"), punkt = $("#spekPunkt");
    function eps(l) { for (var i = 0; i < D.length; i++) if (D[i][0] >= l) return D[i][1]; return D[D.length - 1][1]; }
    function setzen() {
      var l = +regler.value, e = eps(l), anteil = e / MAX[1] * 100;
      var px = x(l) / 10;
      griff.style.left = px + "%"; griff.style.setProperty("--farbe", farbe(l));
      punkt.style.left = px + "%"; punkt.style.top = (y(e) / 300 * 100) + "%"; punkt.style.background = farbe(l);
      wert.innerHTML = l + " nm<small>" + (anteil < 10 ? anteil.toFixed(1) : Math.round(anteil)) + " % vom Maximum</small>";
      var led = LEDS.filter(function (d) { return Math.abs(d[0] - l) <= 3; })[0];
      var stark = anteil > 60 ? "sehr viel" : anteil > 25 ? "viel" : anteil > 8 ? "wenig" : "kaum";
      satz.innerHTML = "Methylenblau schluckt hier <b>" + stark + "</b> Licht. " + (led
        ? "Das ist eine unserer vier LED-Farben: Hier <b>messen</b> wir, wie schnell die Lösung ausbleicht."
        : "Diese Farbe messen wir nicht. Unser Modell soll aus den vier gemessenen Farben <b>vorhersagen</b>, wie schnell Methylenblau hier ausbleicht – danach prüfen wir es nach.");
      regler.setAttribute("aria-valuetext", l + " Nanometer, " + Math.round(anteil) + " Prozent der maximalen Absorption");
    }
    regler.min = L0; regler.max = L1; regler.value = regler.getAttribute("value") || 540;
    regler.addEventListener("input", setzen);
    setzen();
  }
})();
