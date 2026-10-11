/* Rundgang durch die Messbox: 500 Einzelbilder aus Blender, gesteuert über die Scroll-Position.
   Bild i zeigt Blender-Bild 2·i+1 (Stationen sind in Blender-Bildern 1–1000 angegeben). */
(function () {
  "use strict";
  var N = 500;
  var buehne = document.getElementById("rundgang");
  var canvas = document.getElementById("rgBild");
  if (!buehne || !canvas) return;
  var ctx = canvas.getContext("2d");
  var schmal = Math.min(screen.width, screen.height) < 700 || innerWidth < 900;
  var ORDNER = "assets/rundgang/" + (schmal ? "854" : "1280") + "/";
  var bilder = new Array(N), geladen = new Uint8Array(N), anzahl = 0;
  var laden = document.getElementById("rgLaden");
  var fuellung = document.getElementById("rgFuellung");
  var karten = Array.prototype.slice.call(document.querySelectorAll(".rg__karte"));
  var punkte = document.getElementById("rgPunkte");
  var aktuell = -1;

  function datei(i) { return ORDNER + "f_" + ("00" + i).slice(-3) + ".webp"; }

  // Laden in Durchgängen: erst jedes 16. Bild (grob), dann immer feiner – so ist sofort etwas zu sehen
  var reihenfolge = [], gesehen = new Uint8Array(N);
  [16, 8, 4, 2, 1].forEach(function (s) { for (var i = 0; i < N; i += s) if (!gesehen[i]) { gesehen[i] = 1; reihenfolge.push(i); } });
  var pos = 0, laufend = 0, PARALLEL = 6;
  function weiter() {
    while (laufend < PARALLEL && pos < reihenfolge.length) {
      (function (i) {
        laufend++;
        var img = new Image();
        img.decoding = "async";
        img.onload = function () {
          bilder[i] = img; geladen[i] = 1; anzahl++; laufend--;
          if (laden) laden.textContent = anzahl < N ? "Bilder werden geladen … " + Math.round(anzahl / N * 100) + " %" : "Alle 500 Bilder geladen – scrolle los.";
          if (Math.abs(i - aktuell) < 20 || anzahl < 3) zeichnen(true);
          weiter();
        };
        img.onerror = function () { laufend--; weiter(); };
        img.src = datei(i);
      })(reihenfolge[pos++]);
    }
  }
  weiter();

  function naechstesGeladenes(i) {
    if (geladen[i]) return i;
    for (var d = 1; d < N; d++) {
      if (i - d >= 0 && geladen[i - d]) return i - d;
      if (i + d < N && geladen[i + d]) return i + d;
    }
    return -1;
  }

  // Leinwand an Bildschirmgröße anpassen
  var dpr = 1;
  function groesse() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    zeichnen(true);
  }

  var zuletzt = -2;
  function zeichnen(erzwingen) {
    var i = naechstesGeladenes(Math.max(0, aktuell));
    if (i < 0 || (!erzwingen && i === zuletzt)) return;
    zuletzt = i;
    var img = bilder[i], cw = canvas.width, ch = canvas.height;
    var hochkant = ch > cw;
    var s = hochkant ? cw / img.width : Math.max(cw / img.width, ch / img.height);   // hochkant: ganz zeigen, sonst füllen
    var w = img.width * s, h = img.height * s;
    var x = (cw - w) / 2, y = hochkant ? Math.max(ch * 0.12, (ch * 0.5 - h) / 2) : (ch - h) / 2;
    ctx.fillStyle = "#07080b"; ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, x, y, w, h);
  }

  // Stationen: Punkte auf der Leiste
  karten.forEach(function (k, n) {
    var b = document.createElement("button");
    b.type = "button";
    b.style.left = (k.dataset.von / 1000 * 100) + "%";
    b.innerHTML = "<span>" + k.querySelector("h2").textContent + "</span>";
    b.setAttribute("aria-label", "Station " + (n + 1) + ": " + k.querySelector("h2").textContent);
    b.addEventListener("click", function () {
      var ziel = buehne.offsetTop + (Number(k.dataset.von) + 12) / 1000 * (buehne.offsetHeight - innerHeight);
      window.scrollTo({ top: ziel, behavior: "smooth" });
    });
    punkte.appendChild(b);
  });
  var knoepfe = Array.prototype.slice.call(punkte.children);

  var geplant = false;
  function scrollen() {
    geplant = false;
    var hoehe = buehne.offsetHeight - innerHeight;
    var p = Math.min(1, Math.max(0, (window.scrollY - buehne.offsetTop) / hoehe));
    var i = Math.min(N - 1, Math.round(p * (N - 1)));
    if (i !== aktuell) { aktuell = i; zeichnen(false); }
    fuellung.style.width = (p * 100) + "%";
    var blender = i * 2 + 1;
    karten.forEach(function (k, n) {
      var an = blender >= Number(k.dataset.von) && blender < Number(k.dataset.bis);
      k.classList.toggle("da", an);
      knoepfe[n].classList.toggle("da", an);
    });
  }
  addEventListener("scroll", function () { if (!geplant) { geplant = true; requestAnimationFrame(scrollen); } }, { passive: true });
  addEventListener("resize", function () { groesse(); scrollen(); });
  addEventListener("load", function () { groesse(); scrollen(); });     // Lage nach dem Laden neu bestimmen
  groesse(); scrollen();
})();
