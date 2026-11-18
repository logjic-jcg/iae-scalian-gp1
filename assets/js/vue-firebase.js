// ---------------------------------------------------------------------------
// Affichage des données Firestore
//   - onglet « Données Firebase » (HRBP, Direction) : collection irritants
//   - écran de Camille « Arrivées à préparer » : fiches écrites par l'agent
//     dans la collection arrivees (Claude → Make → Firestore → site)
// ---------------------------------------------------------------------------
window.ACIA_FB = {
  irritants: { statut: "chargement", docs: [], modifies: [], erreur: "" },
  arrivees:  { statut: "chargement", docs: [], modifies: [], erreur: "" },
};

// Appelée par firebase-donnees.js à chaque changement dans la base.
function aciaFbMisAJour(nom) {
  if (state.tab === "firebase" || (nom === "arrivees" && state.tab === "arrivees")) render();
}

// Si le SDK Firebase ne se charge pas du tout (CDN bloqué, hors ligne),
// le module ne s'exécute jamais : on bascule nous-mêmes sur le repli.
setTimeout(function () {
  if (window.ACIA_FB_ACTIF) return;
  ["irritants", "arrivees"].forEach(function (n) {
    window.ACIA_FB[n] = { statut: "repli", docs: [], modifies: [], erreur: "Le SDK Firebase n'a pas pu être chargé (réseau ou bloqueur)." };
  });
  aciaFbMisAJour("irritants"); aciaFbMisAJour("arrivees");
}, 10000);

function viewFirebase() {
  const fb = window.ACIA_FB.irritants;
  let lignes, source;
  if (fb.statut === "ok") {
    lignes = fb.docs;
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
    '<p class="note">Collection Firestore « irritants », en lecture seule depuis le site et mise à jour en temps réel : une modification dans la base apparaît ici sans recharger la page (ligne surlignée).</p></div>' +
    carteArriveesFirebase(true);
}

// Fiches d'arrivée écrites par l'agent. Rien n'est affiché tant que la
// collection est vide ou indisponible (l'écran scripté de la maquette reste).
function carteArriveesFirebase(toujours) {
  const fb = window.ACIA_FB.arrivees;
  if (fb.statut !== "ok" || !fb.docs.length) {
    if (!toujours) return "";
    const etat = fb.statut === "ok" ? "Aucune fiche pour l'instant." : fb.statut === "chargement" ? "Lecture en cours…" : "Indisponible : " + fb.erreur;
    return '<h2 style="margin-top:22px">Fiches d\'arrivée écrites par l\'agent</h2><div class="card"><p class="note" style="margin:0">' + esc(etat) + "</p></div>";
  }
  const cartes = fb.docs.map(function (a) {
    const neuf = (fb.modifies || []).indexOf(a.id) >= 0;
    const manquants = String(a.manquants || "").split(";").map(function (s) { return s.trim(); }).filter(Boolean);
    const maj = a.maj && a.maj.toDate ? a.maj.toDate().toLocaleString("fr-FR") : "";
    return '<div class="card fb-carte' + (neuf ? " fb-neuf" : "") + '" style="border-color:#10b981;margin-top:10px">' +
      '<div class="irrtitle">' + esc(a.nom || a.id) + "</div>" +
      '<div class="irrdetail" style="margin-top:2px">' + esc([a.poste, a.manager ? "manager : " + a.manager : "", a.date_arrivee].filter(Boolean).join(" · ")) + "</div>" +
      '<div class="irrtags" style="margin-top:8px">' + (a.statut ? badge("b-violet", a.statut) + " " : "") +
        manquants.map(function (m) { return badge("b-rose", "Manque : " + m); }).join(" ") + "</div>" +
      '<p class="note">' + esc([a.source ? "Source : " + a.source : "", a.ecrit_par ? "écrit par " + a.ecrit_par : "", maj ? "le " + maj : ""].filter(Boolean).join(" · ")) + "</p></div>";
  }).join("");
  return '<div style="margin-bottom:26px"><h2 style="margin-top:22px">Fiches d\'arrivée écrites par l\'agent ' + badge("b-emerald", "● Firebase, en direct") + "</h2>" + cartes + "</div>";
}

// Écran de Camille : les fiches écrites par l'agent s'ajoutent en tête.
const viewArriveesMaquette = viewArrivees;
viewArrivees = function () { return carteArriveesFirebase(false) + viewArriveesMaquette(); };
