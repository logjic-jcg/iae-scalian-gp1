# Mise à jour v8 : onglet HRBP « Tendances de la boîte »

Ce que ça ajoute : chez Julien (HRBP), un onglet « Tendances de la boîte » qui lit en direct la collection Firestore `classement_mails`, écrite toutes les heures par le scénario Make « ACIA : classement de la boîte HRBP (irritants) ».
L'écran ne montre que des agrégats : aucun mail, aucun expéditeur, aucun objet, aucun nom (la base ne les stocke pas). Sans la base, il affiche un message, jamais de chiffres simulés.

**Base : v7 (connexion Firebase Auth).** Si ta version en ligne n'est pas la v7, ne déploie pas ce zip : dis-le-moi et je fais la variante.

## 1. Fichiers à déposer sur GitHub (zip « mise-a-jour-tendances-v8 »)
- `app.html` (charge le nouveau script)
- `assets/js/vue-tendances.js` (NOUVEAU : l'écran)
- `assets/js/app.js` (ajout de l'onglet chez le HRBP)
- `assets/js/vue-firebase.js` et `assets/js/firebase-donnees.js` (écoute de `classement_mails`)

## 2. Règle Firestore à ajouter (console Firebase > Firestore > Règles)
À côté des blocs `irritants` et `arrivees`, ajoute le même bloc pour `classement_mails`, avec **la même condition de lecture que tes autres collections** :

```
match /classement_mails/{doc} {
  allow read: if request.auth != null;   // si tu as activé la connexion v7
  // allow read: if true;                 // si tes autres collections sont encore en lecture publique
  allow write: if false;                  // seul Make écrit (il passe par Google, pas par ces règles)
}
```
Puis « Publier ». Sans cette règle, l'onglet affiche « Données indisponibles ».

## 3. Vérifier
Connecte-toi en Julien Mercier > onglet « Tendances de la boîte » : 21 mails analysés, 1 écarté, badge vert « Firebase, en direct ».
