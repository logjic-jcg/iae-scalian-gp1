// ---------------------------------------------------------------------------
// Couche d'authentification ACIA (v15)
// ---------------------------------------------------------------------------
//  1. Le COMPTE (identifiant + mot de passe) est vérifié par Firebase
//     Authentication (firebase-session.js, connexion.js). C'est lui qui ouvre
//     l'accès aux données Firestore, grâce aux règles de sécurité.
//  2. L'IDENTITÉ affichée (nom, profil, mode démo) vient de la table
//     Firestore « utilisateurs » ; elle est gardée ici le temps de l'onglet.
// Le profil détermine les écrans : il ne donne aucun droit sur la base. Les
// droits (lecture, écriture réservée au HRBP) sont vérifiés par les règles.
// Rappel : les fichiers du site restent publics (dépôt GitHub public).
// ---------------------------------------------------------------------------
window.ACIA_AUTH = (function () {
  const KEY = "acia.identite";
  const KEY_MAQUETTE = "acia.maquette";
  const ROLES = ["collab", "manager", "hrbp", "hrbp_demo", "dir"];

  function sansAccent(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase(); }
  function oui(v) { return ["oui", "o", "yes", "true", "1"].indexOf(sansAccent(v)) !== -1; }

  // Profil + ModeDemo de la table -> écrans de l'application.
  function roleDepuisFiche(f) {
    const p = sansAccent(f && f.Profil), demo = oui(f && f.ModeDemo);
    if (p === "hrbp") return demo ? "hrbp_demo" : "hrbp";
    if (p === "manager") return "manager";
    if (p.indexOf("collabor") === 0) return "collab";
    if (p.indexOf("direct") === 0 || p.indexOf("dirige") === 0) return "dir";
    return null;
  }

  function lire() { try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function ecrire(v) { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* stockage bloqué */ } }
  function clear() { try { sessionStorage.removeItem(KEY); sessionStorage.removeItem(KEY_MAQUETTE); } catch (e) { /* rien */ } }

  // Mode maquette : entrée sans compte quand Firebase est injoignable
  // (écrans du HRBP de démo seulement, aucune donnée de la base).
  function modeMaquette(oui) {
    try {
      if (oui === true) sessionStorage.setItem(KEY_MAQUETTE, "1");
      return sessionStorage.getItem(KEY_MAQUETTE) === "1";
    } catch (e) { return false; }
  }

  function identite() { const v = lire(); return v && ROLES.indexOf(v.role) !== -1 ? v : null; }
  function currentRole() { const v = identite(); return v ? v.role : null; }

  // Après vérification du compte : mémorise l'identité et ouvre l'application.
  function ouvrir(fiche) {
    const role = roleDepuisFiche(fiche);
    if (!role) return false;
    ecrire({ role: role, login: fiche.Login || fiche.id, utilisateur: fiche.Utilisateur || fiche.Login || "", profil: fiche.Profil || "", modeDemo: oui(fiche.ModeDemo) });
    location.href = "app.html";
    return true;
  }
  function ouvrirMaquette() {
    modeMaquette(true);
    ecrire({ role: "hrbp_demo", login: "", utilisateur: "Mode maquette", profil: "HRBP · sans la base", modeDemo: true });
    location.href = "app.html";
  }

  // Page application : renvoie le profil, ou redirige vers la connexion.
  function requireRole() {
    const r = currentRole();
    if (!r) { location.replace("index.html"); return null; }
    if (location.search) history.replaceState(null, "", location.pathname);
    return r;
  }

  // Déconnexion : efface l'identité, ferme la session Firebase (fonction fournie
  // par firebase-donnees.js), puis retour à la connexion.
  function signOut() {
    clear();
    const fin = function () { location.href = "index.html"; };
    if (typeof window.aciaFbDeconnexion === "function") {
      window.aciaFbDeconnexion().then(fin, fin);
      setTimeout(fin, 3000);
    } else fin();
  }

  return { ouvrir: ouvrir, ouvrirMaquette: ouvrirMaquette, identite: identite, currentRole: currentRole, requireRole: requireRole, signOut: signOut, modeMaquette: modeMaquette, roleDepuisFiche: roleDepuisFiche };
})();
