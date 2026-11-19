// ---------------------------------------------------------------------------
// Lecture EN TEMPS RÉEL des données Firestore (module ES, SDK Firebase via CDN)
// ---------------------------------------------------------------------------
// Écoute deux collections ; toute modification faite dans la base (console
// Firebase, scénario Make piloté par Claude…) s'affiche sans recharger :
//   - irritants : onglet « Données Firebase »
//   - arrivees  : fiches d'arrivée écrites par l'agent (via Make)
//   - classement_mails : classement horaire de la boîte RH (Make + Claude), onglet HRBP « Tendances »
// Résultat rangé dans window.ACIA_FB[collection] :
//   { statut: "chargement" | "ok" | "repli", docs: [...], modifies: [ids], erreur, lu }
// En cas d'échec, statut = "repli" : l'écran garde les données de la maquette.
// Les règles Firestore réservent la lecture aux comptes connectés : on attend
// donc l'utilisateur Firebase avant d'écouter. Sans compte : retour à la
// connexion (sauf « mode maquette », choisi quand Firebase est injoignable).
// ---------------------------------------------------------------------------
import { app, utilisateurInitial, deconnecter } from "./firebase-session.js";
import { getFirestore, collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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
// Déconnexion complète, appelée par le menu du compte (app.html).
window.aciaFbDeconnexion = deconnecter;

function replis(msg) { repli("irritants", msg); repli("arrivees", msg); repli("classement_mails", msg); }

if (!app) {
  replis("Configuration Firebase absente (firebase-config.js).");
} else {
  const user = await utilisateurInitial();
  if (!user) {
    if (ACIA_AUTH.modeMaquette()) replis("Mode maquette : aucun compte connecté, les données Firebase ne sont pas lues.");
    else ACIA_AUTH.signOut();     // session absente ou expirée : retour à la connexion
  } else {
    try {
      const db = getFirestore(app);
      ecouter(db, "irritants", query(collection(db, "irritants"), orderBy("ordre")));
      ecouter(db, "arrivees", query(collection(db, "arrivees")));
      ecouter(db, "classement_mails", query(collection(db, "classement_mails")));
    } catch (e) { replis(e); }
  }
}
