// ---------------------------------------------------------------------------
// Lecture EN TEMPS RÉEL des données Firestore (module ES, SDK Firebase via CDN)
// ---------------------------------------------------------------------------
// Écoute la collection « irritants » : toute modification faite dans la base
// (console Firebase, Make, Claude…) s'affiche sur le site sans recharger.
// Résultat rangé dans window.ACIA_FB :
//   { statut: "chargement" | "ok" | "repli", irritants: [...], modifies: [ids], erreur, lu }
// En cas d'échec (pas de config, réseau, règles), statut = "repli" :
// l'écran affiche alors les données de la maquette, jamais une page vide.
// ---------------------------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const DELAI_MAX_MS = 8000;

function publier(etat) {
  window.ACIA_FB = etat;
  if (typeof window.aciaFbMisAJour === "function") window.aciaFbMisAJour();
}

function ecouter() {
  const config = window.ACIA_FIREBASE_CONFIG;
  if (!config) { publier({ statut: "repli", irritants: [], modifies: [], erreur: "Configuration Firebase absente (firebase-config.js)." }); return; }
  let premiere = true;
  const garde = setTimeout(function () {
    if (premiere) publier({ statut: "repli", irritants: [], modifies: [], erreur: "Pas de réponse de Firebase en " + DELAI_MAX_MS / 1000 + " s." });
  }, DELAI_MAX_MS);
  try {
    const db = getFirestore(initializeApp(config));
    onSnapshot(query(collection(db, "irritants"), orderBy("ordre")), function (snap) {
      clearTimeout(garde);
      // Documents ajoutés ou modifiés depuis la dernière lecture (rien à la première).
      const modifies = premiere ? [] : snap.docChanges().filter(function (c) { return c.type !== "removed"; }).map(function (c) { return c.doc.id; });
      premiere = false;
      const irritants = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      publier({ statut: "ok", irritants: irritants, modifies: modifies, erreur: "", lu: new Date() });
    }, function (e) {
      clearTimeout(garde);
      publier({ statut: "repli", irritants: [], modifies: [], erreur: (e && e.message) || String(e) });
    });
  } catch (e) {
    clearTimeout(garde);
    publier({ statut: "repli", irritants: [], modifies: [], erreur: (e && e.message) || String(e) });
  }
}

window.ACIA_FB_ACTIF = true;   // le module s'est chargé (sinon vue-firebase.js bascule en repli)
ecouter();
