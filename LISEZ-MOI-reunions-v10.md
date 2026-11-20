# Mise à jour v10 : « Actions de réunion qui traînent » (onglet HRBP « Tendances de la boîte »)

À déposer PAR-DESSUS le site en ligne (v6 + v8b + v9). Quatre fichiers seulement :

| Fichier | Changement |
|---|---|
| `app.html` | charge `assets/js/vue-reunions.js` |
| `assets/js/vue-reunions.js` | NOUVEAU : le bloc « Actions de réunion qui traînent », sous les tendances des mails |
| `assets/js/firebase-donnees.js` | écoute aussi la collection `comptes_rendus` |
| `assets/js/vue-firebase.js` | rafraîchit l'onglet Tendances quand `comptes_rendus` change |

## Étape 1 : la règle Firestore (OBLIGATOIRE, sinon le bloc affiche « Données indisponibles »)

Console Firebase → Firestore Database → Règles. Ajouter UNE ligne, juste sous celle de `classement_mails`, puis « Publier » :

```
    match /comptes_rendus/{doc}   { allow read: if true; allow write: if false; }
```

Le site ne fait que lire. Seul le scénario Make écrit dans cette collection (il passe par la connexion Google, pas par les règles).

## Étape 2 : déposer les 4 fichiers sur GitHub

Comme d'habitude : dépôt `iae-scalian-gp1` → « Add file » → « Upload files » → glisser le contenu du zip en gardant les dossiers → « Commit changes ». Attendre 1 à 2 minutes, puis recharger le site (Ctrl+F5).

## Vérifier

Se connecter en Julien Mercier (HRBP) → « Tendances de la boîte » → descendre sous le tableau des semaines. Avec les 8 comptes rendus actuels on doit voir : 7 comptes rendus analysés, 1 écarté, 2 actions qui traînent, livret d'accueil fermé en CR-8.

## Côté Make

Scénario « ACIA : lecture des comptes rendus Notion (actions) » : chaque jour à 18h, et à la demande. Il ne lit que les comptes rendus AJOUTÉS depuis son dernier passage. Un compte rendu ajouté dans la base Notion apparaît donc sur le site au plus tard le soir même, ou tout de suite si on lance le scénario à la main (« Run once » dans Make, ou en le demandant à Claude).

Ce qui est stocké par compte rendu : référence, instance, jours fictifs de réunion et de diffusion, services présents, et les lignes produites par l'IA (actions avec statut, services absents, confiance). AUCUN nom de personne.
