// ---------------------------------------------------------------------------
// Lecture EN TEMPS RÉEL des données Firestore (module ES, SDK Firebase via CDN)
// ---------------------------------------------------------------------------
// Écoute deux collections ; toute modification faite dans la base (console
// Firebase, scénario Make piloté par Claude…) s'affiche sans recharger :
//   - irritants : onglet « Données Firebase »
//   - arrivees  : fiches d'arrivée écrites par l'agent (via Make)
//   - decisions_hrbp : décisions du HRBP (lecture + écriture, onglets de pilotage)
//   - classement_mails : classement horaire de la boîte RH (Make + Claude), onglet HRBP « Tendances »
//   - comptes_rendus : actions des comptes rendus Notion (Make + Claude), même onglet (v10)
//   - types_irritants : types d'irritants administrés par le HRBP, lus aussi par Make (v13)
// Résultat rangé dans window.ACIA_FB[collection] :
//   { statut: "chargement" | "ok" | "repli", docs: [...], modifies: [ids], erreur, lu }
// En cas d'échec, statut = "repli" : l'écran garde les données de la maquette.
// ---------------------------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, query, orderBy, onSnapshot, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const DELAI_MAX_MS = 8000;

function publier(nom, etat) {
  window.ACIA_FB[nom] = etat;
  if (typeof window.aciaFbMisAJour === "function") window.aciaFbMisAJour(nom);
}
function repli(nom, e) {
  publier(nom, { statut: "repli", docs: [], modifies: [], erreur: (e && e.message) || String(e) });
}

function ecouter(db, nom, q) {
  let premiere = true;
  const garde = setTimeout(function () { if (premiere) repli(nom, "Pas de réponse de Firebase en " + DELAI_MAX_MS / 1000 + " s."); }, DELAI_MAX_MS);
  onSnapshot(q, function (snap) {
    clearTimeout(garde);
    // Documents ajoutés ou modifiés depuis la dernière lecture (rien à la première).
    const modifies = premiere ? [] : snap.docChanges().filter(function (c) { return c.type !== "removed"; }).map(function (c) { return c.doc.id; });
    premiere = false;
    const docs = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
    publier(nom, { statut: "ok", docs: docs, modifies: modifies, erreur: "", lu: new Date() });
  }, function (e) { clearTimeout(garde); repli(nom, e); });
}

window.ACIA_FB_ACTIF = true;   // le module s'est chargé (sinon vue-firebase.js bascule en repli)
const config = window.ACIA_FIREBASE_CONFIG;
if (!config) {
  repli("irritants", "Configuration Firebase absente (firebase-config.js).");
  repli("arrivees", "Configuration Firebase absente (firebase-config.js).");
  repli("classement_mails", "Configuration Firebase absente (firebase-config.js).");
  repli("decisions_hrbp", "Configuration Firebase absente (firebase-config.js).");
  repli("comptes_rendus", "Configuration Firebase absente (firebase-config.js).");
  repli("types_irritants", "Configuration Firebase absente (firebase-config.js).");
} else {
  try {
    const db = getFirestore(initializeApp(config));
    ecouter(db, "irritants", query(collection(db, "irritants"), orderBy("ordre")));
    ecouter(db, "arrivees", query(collection(db, "arrivees")));
    ecouter(db, "classement_mails", query(collection(db, "classement_mails")));
    ecouter(db, "decisions_hrbp", query(collection(db, "decisions_hrbp")));
    ecouter(db, "comptes_rendus", query(collection(db, "comptes_rendus")));
    ecouter(db, "types_irritants", query(collection(db, "types_irritants"), orderBy("ordre")));
    // v13 : création ou modification d'un type d'irritant (version C : sans compte,
    // encadrée par les règles Firestore : champs, longueurs, code figé, pas de suppression).
    window.aciaEcrireType = function (code, t) {
      return setDoc(doc(db, "types_irritants", code), {
        code: code, titre: t.titre, definition: t.definition, exemple: t.exemple,
        actif: t.actif, ordre: t.ordre, source: t.source, protege: t.protege, maj: serverTimestamp()
      });
    };
    // Écriture d'une décision du HRBP (version C : sans compte, encadrée par les règles Firestore).
    window.aciaEcrireDecision = function (code, d) {
      return setDoc(doc(db, "decisions_hrbp", code), {
        statut: d.statut, reponse: d.reponse, commentaire: d.commentaire, semaine_effet: d.semaine_effet, maj: serverTimestamp()
      });
    };
  } catch (e) { repli("irritants", e); repli("arrivees", e); repli("classement_mails", e); repli("decisions_hrbp", e); repli("comptes_rendus", e); repli("types_irritants", e); }
}
