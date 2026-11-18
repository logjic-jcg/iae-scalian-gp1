// ---------------------------------------------------------------------------
// Onglet « Données Firebase » : affiche la collection Firestore « irritants »
// ---------------------------------------------------------------------------
window.ACIA_FB = window.ACIA_FB || { statut: "chargement", irritants: [], erreur: "" };

// Appelée par firebase-donnees.js quand la lecture se termine.
function aciaFbMisAJour() { if (state.tab === "firebase") render(); }

// Si le SDK Firebase ne se charge pas du tout (CDN bloqué, hors ligne),
// le module ne s'exécute jamais : on bascule nous-mêmes sur le repli.
setTimeout(function () {
  if (window.ACIA_FB.statut === "chargement" && !window.ACIA_FB_ACTIF) {
    window.ACIA_FB = { statut: "repli", irritants: [], erreur: "Le SDK Firebase n'a pas pu être chargé (réseau ou bloqueur)." };
    aciaFbMisAJour();
  }
}, 10000);

function viewFirebase() {
  const fb = window.ACIA_FB;
  let lignes, source;
  if (fb.statut === "ok") {
    lignes = fb.irritants;
    source = badge("b-emerald", "● Source : Firebase, en direct") +
      ' <span class="note">Dernière mise à jour à ' + esc(fb.lu.toLocaleTimeString("fr-FR")) + " · " + lignes.length + " document(s)</span>";
  } else if (fb.statut === "chargement") {
    lignes = [];
    source = badge("b-sky", "Lecture de Firebase en cours…");
  } else {
    // Repli : données de la maquette, pour que la démo ne tombe jamais sur une page vide.
    lignes = IRRITANTS.map(function (i, k) { return { id: i.id, titre: i.court, note: i.note, traitement: i.traitement, reponse: i.reponse, ordre: k + 1 }; });
    source = badge("b-amber", "Source : maquette (Firebase indisponible)") +
      '<p class="note">Raison : ' + esc(fb.erreur) + "</p>";
  }
  const corps = lignes.length
    ? lignes.map(function (r) {
        const neuf = (fb.modifies || []).indexOf(r.id) >= 0;
        return "<tr" + (neuf ? ' class="fb-neuf"' : "") + "><td>" + esc(r.ordre != null ? r.ordre : "") + "</td><td><b>" + esc(r.titre || "") + "</b><br><small>" + esc(r.id) + "</small></td><td>" +
          esc(r.note != null ? r.note : "") + "</td><td>" + esc(r.traitement || "") + "</td><td>" + esc(r.reponse || "") + "</td></tr>";
      }).join("")
    : '<tr><td colspan="5">' + (fb.statut === "chargement" ? "…" : "La collection est vide.") + "</td></tr>";
  return "<h2>Données Firebase</h2>" +
    '<div class="card"><div>' + source + "</div>" +
    '<div class="tw" style="margin-top:12px"><table><thead><tr><th>Ordre</th><th>Irritant</th><th>Note</th><th>Traitement</th><th>Réponse</th></tr></thead><tbody>' +
    corps + "</tbody></table></div>" +
    '<p class="note">Collection Firestore « irritants », en lecture seule depuis le site et mise à jour en temps réel : une modification dans la base apparaît ici sans recharger la page (ligne surlignée).</p></div>';
}
