// ---------------------------------------------------------------------------
// Mémoire de la démonstration ACIA
// ---------------------------------------------------------------------------
// Depuis que connexion et application sont deux pages, changer de profil
// recharge la page. Pour garder le fil de la démo (ex. Camille reçoit le
// mail 21, puis Isabelle complète l'annonce), l'état est mémorisé le temps
// de l'onglet. Fermer l'onglet remet la démo à zéro.
//
// Demain : c'est ce fichier qui lira et écrira dans Firestore (voir
// FIREBASE.md). Le reste de l'application n'aura pas à changer.
// ---------------------------------------------------------------------------
window.ACIA_ETAT = (function () {
  const KEY = "acia.etat";
  // Champs liés à une animation en cours : jamais restaurés tels quels.
  const TRANSITOIRES = { playing: false, generating: false, agentRunning: false, fresh: null, justAdded: false };

  function charger(state) {
    try {
      const brut = sessionStorage.getItem(KEY);
      if (!brut) return null;
      const avant = JSON.parse(brut);
      Object.assign(state, avant, TRANSITOIRES);
      return avant;                // l'appelant peut terminer une animation interrompue
    } catch (e) { return null; /* mémoire indisponible : la démo repart de zéro */ }
  }

  function sauver(state) {
    try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* rien */ }
  }

  function effacer() {
    try { sessionStorage.removeItem(KEY); } catch (e) { /* rien */ }
  }

  return { charger: charger, sauver: sauver, effacer: effacer };
})();
