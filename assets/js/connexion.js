// ---------------------------------------------------------------------------
// Page de connexion (v15) : identifiant + mot de passe vérifiés par Firebase
// Authentication, puis lecture de la fiche dans la table « utilisateurs ».
// Connexion refusée si le compte n'existe pas, si le mot de passe est faux,
// ou si l'identifiant n'a pas de fiche (ou un profil inconnu) dans la table.
// ---------------------------------------------------------------------------
import { auth, utilisateurInitial, connecter, deconnecter, ficheUtilisateur, messageErreur } from "./firebase-session.js?v=15diag2";

window.ACIA_CONNEXION_ACTIVE = true;
{ const v = document.getElementById("lg-version"); if (v) v.textContent += " · connexion v15-diag2"; }   // le module s'est chargé (voir index.html)
const $ = function (id) { return document.getElementById(id); };
const MSG_REFUS = "Identifiant ou mot de passe incorrect.";

function erreur(txt) { $("lg-err").textContent = txt || ""; }
function majBouton() { $("lg-go").disabled = !($("lg-id").value.trim() && $("lg-mdp").value); }
function attente(oui) { $("lg-go").disabled = oui; $("lg-go").textContent = oui ? "Connexion…" : "Se connecter"; }

// Lit la fiche de l'utilisateur connecté et ouvre l'application, ou refuse.
// DIAGNOSTIC TEMPORAIRE (v15-diag) : messages précis pour trouver ce qui bloque.
// À retirer ensuite : en temps normal, on ne dit pas lequel des deux est faux.
const DIAG = true;
async function entrer(user) {
  let fiche = null;
  try { fiche = await ficheUtilisateur(user); }
  catch (e) { await deconnecter(); erreur("Lecture de la table des utilisateurs impossible (" + ((e && e.code) || e) + ")."); return false; }
  if (!fiche) { await deconnecter(); erreur(DIAG ? "[diag v15] Mot de passe OK, mais aucune fiche « utilisateurs/" + (user.email || "").split("@")[0] + " » dans la base." : MSG_REFUS); return false; }
  if (typeof ACIA_AUTH.ouvrir !== "function") { await deconnecter(); erreur("[diag v15] Mot de passe OK, fiche trouvée, mais auth.js est une ANCIENNE version (cache du navigateur ou fichier non déposé)."); return false; }
  if (!ACIA_AUTH.ouvrir(fiche)) { await deconnecter(); erreur(DIAG ? "[diag v15] Mot de passe OK, fiche trouvée, mais profil non reconnu : « " + fiche.Profil + " » / ModeDemo « " + fiche.ModeDemo + " »." : MSG_REFUS); return false; }
  return true;
}

async function seConnecter(ev) {
  ev.preventDefault();
  const id = $("lg-id").value.trim(), mdp = $("lg-mdp").value;
  erreur("");
  if (!/^[A-Za-z0-9]{1,40}$/.test(id)) { erreur("L'identifiant ne contient que des lettres et des chiffres."); return; }
  attente(true);
  try {
    const cred = await connecter(id, mdp);
    if (await entrer(cred.user)) return;
  } catch (e) { erreur(DIAG ? "[diag v15] Refus de Firebase sur le mot de passe : " + ((e && e.code) || (e && e.message) || e) + " (compte " + id.toLowerCase() + "@example.com, " + mdp.length + " caractères saisis)." : messageErreur(e)); }
  attente(false); majBouton();
}

(async function () {
  $("lg-form").addEventListener("submit", seConnecter);
  ["lg-id", "lg-mdp"].forEach(function (id) { $(id).addEventListener("input", majBouton); });
  if (!auth) {
    erreur("Configuration Firebase absente : connexion impossible.");
    $("lg-attente").hidden = true; return;
  }
  const deja = await utilisateurInitial();
  // Session Firebase encore ouverte (même navigateur) : on reprend sans ressaisie.
  if (deja && await entrer(deja)) return;
  $("lg-attente").hidden = true;
  majBouton();
})();
