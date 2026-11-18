// ---------------------------------------------------------------------------
// Couche d'authentification ACIA
// ---------------------------------------------------------------------------
// Aujourd'hui : connexion de DÉMONSTRATION. L'utilisateur choisit un profil,
// mémorisé le temps de l'onglet. Aucun mot de passe, aucune sécurité réelle :
// n'importe quel visiteur du site peut entrer.
//
// Demain : Firebase Authentication. Seul ce fichier changera ; les pages
// appellent uniquement ACIA_AUTH.signIn / currentRole / requireRole / signOut.
// ---------------------------------------------------------------------------
window.ACIA_AUTH = (function () {
  const KEY = "acia.role";
  const ROLES = ["collab", "manager", "hrbp", "dir"];

  function store(role) { try { sessionStorage.setItem(KEY, role); } catch (e) { /* stockage bloqué : repli sur l'URL */ } }
  function stored() { try { return sessionStorage.getItem(KEY); } catch (e) { return null; } }
  function clear() { try { sessionStorage.removeItem(KEY); } catch (e) { /* rien */ } }

  // Profil courant : paramètre ?role= de l'URL (prioritaire), sinon mémoire de l'onglet.
  function currentRole() {
    const q = new URLSearchParams(location.search).get("role");
    if (q && ROLES.indexOf(q) !== -1) { store(q); return q; }
    const r = stored();
    return ROLES.indexOf(r) !== -1 ? r : null;
  }

  // Page de connexion -> application.
  function signIn(role) {
    if (ROLES.indexOf(role) === -1) return;
    store(role);
    location.href = "app.html?role=" + encodeURIComponent(role);
  }

  // Page application : renvoie le profil, ou redirige vers la connexion.
  function requireRole() {
    const r = currentRole();
    if (!r) { location.replace("index.html"); return null; }
    if (location.search) history.replaceState(null, "", location.pathname);
    return r;
  }

  function signOut() {
    clear();
    location.href = "index.html";
  }

  return { signIn: signIn, currentRole: currentRole, requireRole: requireRole, signOut: signOut };
})();
