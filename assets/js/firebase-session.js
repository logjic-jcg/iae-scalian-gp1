// ---------------------------------------------------------------------------
// Session Firebase partagée (module ES) : une seule application Firebase par
// page, utilisée par la connexion (connexion.js) et par la lecture des données
// (firebase-donnees.js).
// v15 : connexion par IDENTIFIANT (ex. « Julien »). Le compte Firebase
// correspondant est <identifiant en minuscules>@example.com (domaine réservé
// aux exemples : aucun mail n'est jamais envoyé). Le mot de passe est vérifié
// par Firebase, jamais par le site. Le profil vient de la table « utilisateurs ».
// ---------------------------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const config = window.ACIA_FIREBASE_CONFIG;
export const app = config ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
const DOMAINE = "example.com";

export function emailDe(identifiant) { return String(identifiant || "").trim().toLowerCase() + "@" + DOMAINE; }
export function identifiantDe(user) { return user && user.email ? user.email.split("@")[0].toLowerCase() : ""; }

// Utilisateur connecté au chargement de la page (ou null), une fois que
// Firebase a relu sa session enregistrée dans le navigateur.
export function utilisateurInitial() {
  return new Promise(function (ok) {
    if (!auth) return ok(null);
    const stop = onAuthStateChanged(auth, function (u) { stop(); ok(u); });
  });
}

export function connecter(identifiant, motDePasse) {
  return signInWithEmailAndPassword(auth, emailDe(identifiant), motDePasse);
}

export function deconnecter() {
  return auth ? signOut(auth) : Promise.resolve();
}

// Fiche de l'utilisateur connecté dans la table « utilisateurs » (null si absente).
export async function ficheUtilisateur(user) {
  const id = identifiantDe(user);
  if (!id) return null;
  const s = await getDoc(doc(getFirestore(app), "utilisateurs", id));
  return s.exists() ? Object.assign({ id: id }, s.data()) : null;
}

// Messages d'erreur lisibles (codes Firebase Auth). Volontairement vagues sur
// l'identifiant et le mot de passe : on ne dit pas lequel des deux est faux.
export function messageErreur(e) {
  const code = (e && e.code) || "";
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-login-credentials", "auth/invalid-email", "auth/missing-password"].indexOf(code) !== -1)
    return "Identifiant ou mot de passe incorrect.";
  if (code === "auth/user-disabled") return "Ce compte a été désactivé.";
  if (code === "auth/too-many-requests") return "Trop de tentatives. Réessayez dans quelques minutes.";
  if (code === "auth/network-request-failed") return "Pas de réseau : la base est injoignable.";
  if (code === "auth/configuration-not-found") return "La connexion n'est pas encore activée sur ce projet.";
  if (code === "auth/operation-not-allowed") return "La connexion par mot de passe n'est pas activée sur ce projet.";
  return "Connexion impossible (" + (code || (e && e.message) || "erreur inconnue") + ").";
}
