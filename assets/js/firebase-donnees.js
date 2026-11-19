// ---------------------------------------------------------------------------
// Lecture EN TEMPS RÉEL des données Firestore (module ES, SDK Firebase via CDN)
// ---------------------------------------------------------------------------
// Écoute deux collections ; toute modification faite dans la base (console
// Firebase, scénario Make piloté par Claude…) s'affiche sans recharger :
//   - irritants : onglet « Données Firebase »
//   - arrivees  : fiches d'arrivée écrites par l'agent (via Make)
//   - decisions_hrbp : décisions du HRBP (lecture + écriture, onglets de pilotage)
//   - classement_mails : classement horaire de la boîte RH (Make + Claude), onglet HRBP « Tendances »
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
} else {
  try {
    const db = getFirestore(initializeApp(config));
    ecouter(db, "irritants", query(collection(db, "irritants"), orderBy("ordre")));
    ecouter(db, "arrivees", query(collection(db, "arrivees")));
    ecouter(db, "classement_mails", query(collection(db, "classement_mails")));
    ecouter(db, "decisions_hrbp", query(collection(db, "decisions_hrbp")));
    // Écriture d'une décision du HRBP (version C : sans compte, encadrée par les règles Firestore).
    window.aciaEcrireDecision = function (code, d) {
      return setDoc(doc(db, "decisions_hrbp", code), {
        statut: d.statut, reponse: d.reponse, commentaire: d.commentaire, semaine_effet: d.semaine_effet, maj: serverTimestamp()
      });
    };
  } catch (e) { repli("irritants", e); repli("arrivees", e); repli("classement_mails", e); repli("decisions_hrbp", e); }
}
