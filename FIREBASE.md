# Branchement Firebase (à faire)

État au 18/11/2026 : projet `iae-scalian-gp1` créé (Firestore, europe-west9), collection `irritants` lue en direct dans l'onglet « Données Firebase ». Restent : l'authentification (étape 2) et l'enregistrement de l'état de la démo (étape 3).

## 1. Créer le projet Firebase
1. https://console.firebase.google.com > Ajouter un projet.
2. Paramètres du projet > Vos applications > icône Web `</>` : enregistrer l'application.
3. Copier l'objet `firebaseConfig` dans `assets/js/firebase-config.js`.
   Ces valeurs ne sont pas secrètes : elles seront visibles par tout visiteur, c'est normal.

## 2. Authentification (`assets/js/auth.js`)
- Console > Authentication > activer une méthode (e-mail / mot de passe, ou Google).
- Authentication > Paramètres > Domaines autorisés : ajouter `logjic-jcg.github.io`.
- Remplacer le contenu de `signIn`, `currentRole`, `requireRole`, `signOut` par les appels Firebase.
  Le profil (collab, manager, hrbp, dir) devra être stocké quelque part, par exemple dans un document Firestore `utilisateurs/{uid}`.
- Les pages n'appellent que ces quatre fonctions : elles n'auront pas à changer.

## 3. Données (`assets/js/etat.js`)
- Console > Firestore Database > créer la base.
- Remplacer `charger` / `sauver` par une lecture / écriture Firestore.
- Aujourd'hui l'état est mémorisé dans l'onglet (sessionStorage) : il disparaît à la fermeture et n'est pas partagé entre visiteurs.
  Avec Firestore il deviendra partagé : prévoir un bouton « remettre la démo à zéro ».

## 4. Sécurité : à lire avant de mettre des données
- Le dépôt GitHub et le site sont publics. La protection des données repose uniquement sur les **règles de sécurité Firestore** (lecture / écriture réservées aux utilisateurs connectés, et selon leur profil).
- Ne jamais laisser les règles en « mode test » (ouvertes à tous) au-delà d'une séance de travail.
- Rester sur des données fictives : c'est un projet de hackathon, pas un outil RH.

## Chargement du SDK
Pas d'outil de compilation nécessaire : le SDK Firebase se charge depuis le CDN officiel (`https://www.gstatic.com/firebasejs/<version>/...`) avec des `<script type="module">`.
