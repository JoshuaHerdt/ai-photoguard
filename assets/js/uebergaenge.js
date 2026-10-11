/* Fügt zwischen Abschnitten mit unterschiedlichem Ton einen weichen Übergang ein (Startseite: data-ton, Unterseiten: data-theme). */
(function () {
  "use strict";
  var TON = { dunkel: "d", dark: "d", hell: "h", light: "h", blue: "b" };
  var TEXT = { dh: "Methylenblau bleicht aus", hd: "Licht aus – gemessen wird im Dunkeln" };
  var main = document.querySelector("main") || document.body;
  var teile = Array.prototype.filter.call(main.children, function (el) { return el.hasAttribute("data-ton") || el.hasAttribute("data-theme"); });
  for (var i = 1; i < teile.length; i++) {
    var a = TON[teile[i - 1].getAttribute("data-ton") || teile[i - 1].getAttribute("data-theme")];
    var b = TON[teile[i].getAttribute("data-ton") || teile[i].getAttribute("data-theme")];
    if (!a || !b || a === b) continue;
    var u = document.createElement("div");
    u.className = "uebergang uebergang--" + a + b;
    u.setAttribute("aria-hidden", "true");
    if (TEXT[a + b]) u.innerHTML = "<span>" + TEXT[a + b] + "</span>";
    teile[i].parentNode.insertBefore(u, teile[i]);
  }
})();
