# Mise à jour v9 : 3 onglets HRBP reliés à la base (version C, provisoire)

Chez Julien (HRBP), « Valider et orienter », « Spécifications » et « Suivi des réponses » lisent désormais la base :
- **Valider et orienter** : chaque irritant avec ses signaux réels (`classement_mails`), la proposition de l'assistant, et un formulaire de décision (statut, réponse, semaine d'effet, commentaire) enregistré dans `decisions_hrbp`.
- **Spécifications** : une fiche remplie par la base pour chaque irritant **validé** en « Assister » ou « Automatiser » ; « Simplifier » = action sans IA, pas de fiche d'outil.
- **Suivi des réponses** : signaux par semaine avant / après la semaine d'effet, verdict « en baisse / stable / en hausse », ou « trop peu de signaux pour conclure ».
Garde-fou : pas de décision rétroactive (la semaine d'effet doit suivre la dernière semaine observée).

Base : **v6 en ligne + v8b** (sans connexion). Les anciens écrans de la maquette restent dans le code mais ne sont plus dans le menu du HRBP.

## 1. Fichiers à déposer sur GitHub (zip « mise-a-jour-pilotage-v9 »)
`app.html`, `assets/js/app.js`, `assets/js/vue-firebase.js`, `assets/js/firebase-donnees.js`, `assets/js/vue-pilotage.js` (NOUVEAU), `assets/js/vue-tendances.js` (inchangé, remis pour être sûr).

## 2. Règles Firestore : remplace TOUT le contenu par ce bloc, puis « Publier »
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /irritants/{doc}        { allow read: if true; allow write: if false; }
    match /arrivees/{doc}         { allow read: if true; allow write: if false; }
    match /classement_mails/{doc} { allow read: if true; allow write: if false; }

    // VERSION C PROVISOIRE : écriture sans compte, strictement encadrée.
    // À remplacer par « request.auth != null » quand la connexion v7 sera en ligne.
    match /decisions_hrbp/{code} {
      allow read: if true;
      allow delete: if false;
      allow create, update: if code in ['ANNONCE_INCOMPLETE','DEMANDE_TARDIVE','HORS_BOUCLE',
            'PREMIER_JOUR_DEGRADE','QUESTION_RECURRENTE','PIECES_RENVOYEES','DOC_DISPERSEE']
        && request.resource.data.keys().hasOnly(['statut','reponse','commentaire','semaine_effet','maj'])
        && request.resource.data.statut in ['VALIDE','A_SURVEILLER','ECARTE']
        && request.resource.data.reponse in ['SIMPLIFIER','AUTOMATISER','ASSISTER']
        && request.resource.data.commentaire is string
        && request.resource.data.commentaire.size() <= 280
        && request.resource.data.semaine_effet is int
        && request.resource.data.semaine_effet >= 1
        && request.resource.data.semaine_effet <= 53
        && request.resource.data.maj == request.time;
    }
  }
}
```
Make n'est pas concerné par ces règles (il écrit avec ton compte Google).

## 3. Vérifier
Julien > « Valider et orienter » > choisir « Annonce d'arrivée incomplète » > Validé, Assister, semaine 5 > Enregistrer. Message attendu : « Décision enregistrée dans la base ». Puis « Spécifications » (une fiche) et « Suivi » (« pas encore de semaine après la décision » : normal tant qu'aucun mail de semaine 5 n'est arrivé).

## Limite honnête
Tant que c'est la version C, n'importe quel visiteur qui connaît l'adresse peut modifier une décision (dans le cadre des valeurs autorisées). Passer en connexion v7 avant le jury.
