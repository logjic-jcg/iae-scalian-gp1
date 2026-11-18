// ---------------------------------------------------------------------------
// Lecture des données Firestore (module ES, SDK Firebase chargé depuis le CDN)
// ---------------------------------------------------------------------------
// Lit la collection « irritants » et range le résultat dans window.ACIA_FB :
//   { statut: "chargement" | "ok" | "repli", irritants: [...], erreur: "..." }
// En cas d'échec (pas de config, réseau, règles), statut = "repli" :
// l'écran affiche alors les données de la maquette, jamais une page vide.
// ---------------------------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const DELAI_MAX_MS = 8000;

function publier(etat) {
  window.ACIA_FB = etat;
  if (typeof window.aciaFbMisAJour === "function") window.aciaFbMisAJour();
}

async function charger() {
  const config = window.ACIA_FIREBASE_CONFIG;
  if (!config) { publier({ statut: "repli", irritants: [], erreur: "Configuration Firebase absente (firebase-config.js)." }); return; }
  try {
    const app = initializeApp(config);
    const db = getFirestore(app);
    const lecture = getDocs(query(collection(db, "irritants"), orderBy("ordre")));
    const delai = new Promise(function (_, rejeter) { setTimeout(function () { rejeter(new Error("Pas de réponse de Firebase en " + DELAI_MAX_MS / 1000 + " s.")); }, DELAI_MAX_MS); });
    const resultat = await Promise.race([lecture, delai]);
    const irritants = resultat.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
    publier({ statut: "ok", irritants: irritants, erreur: "", lu: new Date() });
  } catch (e) {
    publier({ statut: "repli", irritants: [], erreur: (e && e.message) || String(e) });
  }
}

window.ACIA_FB_RECHARGER = function () { publier({ statut: "chargement", irritants: [], erreur: "" }); charger(); };
charger();
