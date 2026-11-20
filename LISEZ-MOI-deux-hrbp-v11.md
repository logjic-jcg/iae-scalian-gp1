# Mise à jour v11 : deux profils HRBP (en direct / démo) + bloc des comptes rendus (v10)

Ce zip CONTIENT AUSSI la v10 (« Actions de réunion qui traînent ») : si la v10 n'est pas encore en ligne, déposer seulement celui-ci.

## Les deux profils

| Profil (page de connexion) | Onglets | Données |
|---|---|---|
| **HRBP · Julien, données en direct** | Tendances de la boîte · Valider et orienter · Spécifications · Suivi des réponses | Uniquement Firebase, alimenté par Make + Claude depuis la boîte RH partagée et les comptes rendus Notion. Bandeau vert. |
| **HRBP de démo · maquette** | Registre RH · Valider et orienter · Spécifications · Suivi des réponses · Données Firebase | Uniquement les écrans scénarisés de la maquette (données fictives écrites dans le code). Bandeau jaune. |

« Données Firebase » (collection `irritants`) est rangé chez le HRBP de démo : son contenu est la copie des irritants de la maquette, et il bascule sur la maquette si Firebase ne répond pas.

## Fichiers à déposer (par-dessus le site en ligne)

`index.html`, `app.html`, `assets/js/app.js`, `assets/js/auth.js`, `assets/js/vue-reunions.js`, `assets/js/firebase-donnees.js`, `assets/js/vue-firebase.js`.

Dépôt `iae-scalian-gp1` → « Add file » → « Upload files » → glisser le contenu du zip en gardant les dossiers → « Commit changes ». Attendre 1 à 2 minutes, recharger (Ctrl+F5).

## Règle Firestore (si pas déjà faite pour la v10)

Console Firebase → Firestore → Règles, ajouter sous la ligne `classement_mails`, puis « Publier » :

```
    match /comptes_rendus/{doc}   { allow read: if true; allow write: if false; }
```
