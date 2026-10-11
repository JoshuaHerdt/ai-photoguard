/* AI-Photoguard – ECHTE MESSERGEBNISSE (hier eintragen, sobald gemessen)
   ------------------------------------------------------------------------------------------------
   Solange "punkte" leer ist, zeigt der Regler in Kapitel 3 nur die Erwartung (Schema).
   Sobald hier Werte stehen, erscheinen automatisch:
     - die echten Messpunkte (mit Fehlerbalken) im Diagramm,
     - die an die Punkte angepasste Kurve (Modell) und das Bestimmtheitsmaß R²,
     - die Vorhersage für die gewählte Wellenlänge in echten Einheiten samt Halbwertszeit,
     - und – wenn "lambda5" eingetragen ist – der Vergleich Vorhersage ↔ Nachmessung.

   Format eines Messpunkts:
     { nm: 660, k: 0.0123, fehler: 0.0008, n: 3, datum: "05.11.2026" }
       nm      Wellenlänge der LED in nm (450, 480, 590, 660)
       k       Bleichrate (Mittelwert der Wiederholungen) in der Einheit unten
       fehler  Standardabweichung oder Unsicherheit von k (gleiche Einheit), darf fehlen
       n       Anzahl der Wiederholungen, darf fehlen
       datum   Messdatum als Text, darf fehlen

   Das Modell der Webseite ist bewusst einfach: k(λ) = s · λ · (1 − 10^(−ε(λ)·c·d)) – die Form kommt aus der
   Literatur-Absorption, angepasst wird nur der Faktor s (kleinste Quadrate). Max’ Regressionsmodell kann es
   ersetzen: Funktion "modellForm" in assets/js/vorhersage.js.

   Beispiel (NICHT echt – nur zum Ausprobieren auskommentiert lassen):
     punkte: [
       { nm: 450, k: 0.0006, fehler: 0.0002 },
       { nm: 480, k: 0.0011, fehler: 0.0002 },
       { nm: 590, k: 0.0080, fehler: 0.0006 },
       { nm: 660, k: 0.0190, fehler: 0.0010 },
     ],
*/
window.MB_MESSDATEN = {
  einheit: "1/min",   // Einheit von k, z. B. "1/min" oder "1/s"
  konzentration: "10 µmol/L", // nur zur Anzeige
  punkte: [
  ],
  lambda5: null       // Nachmessung der Vorhersage, z. B. { nm: 530, k: 0.0021, fehler: 0.0003, datum: "…" }
};
