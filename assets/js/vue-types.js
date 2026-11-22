// ---------------------------------------------------------------------------
// Onglet HRBP « Types d’irritants » (v13)
// ---------------------------------------------------------------------------
// Lit et écrit la collection Firestore « types_irritants » (un document par type) :
//   { code, titre, definition, exemple, processus, actif, ordre, source, protege, maj }
// « processus » (v14) : texte libre facultatif (Paie, onBoarding…), sert aux filtres, pas donné à l'IA.
// Le scénario Make de classement de la boîte RH relit cette table à chaque
// passage : les types actifs de la source « mails », avec leur définition et
// leur exemple, sont donnés à Claude. Un code inconnu est rangé dans « Autre ».
//
// Règles de gestion (doublées par les règles de sécurité Firestore) :
//   - le code est créé une fois, à partir du titre, puis ne change plus ;
//   - pas de suppression : on désactive (l'historique des tendances est gardé) ;
//   - « Autre » ne peut être ni supprimé ni désactivé ;
//   - la source (mails ou comptes rendus) ne se change pas.
// v15 : écriture réservée au HRBP connecté (table « utilisateurs »), encadrée par les règles.
// ---------------------------------------------------------------------------

const TYPE_LIMITES = { titre: 80, definition: 400, exemple: 300, processus: 60 };
// Suggestions de saisie du processus (en plus des valeurs déjà présentes dans la table).
const PROCESSUS_SUGGERES = ["onBoarding", "Paie", "Temps de travail", "Congés et absences"];
// Valeurs de processus distinctes de la table (sans tenir compte de la casse ni des espaces en trop).
function processusConnus(avecSuggestions) {
  const vus = {}, out = [];
  const ajoute = function (v) { v = String(v || "").trim().replace(/\s+/g, " "); const k = v.toLowerCase(); if (v && !vus[k]) { vus[k] = 1; out.push(v); } };
  (typesTable() || []).forEach(function (d) { ajoute(d.processus); });
  if (avecSuggestions) PROCESSUS_SUGGERES.forEach(ajoute);
  return out.sort(function (a, b) { return a.localeCompare(b, "fr"); });
}
// Normalise une saisie : espaces en trop retirés, et même écriture qu'une valeur existante si seule la casse diffère.
function normaliserProcessus(v) {
  v = String(v || "").trim().replace(/\s+/g, " ");
  const k = v.toLowerCase();
  const ex = processusConnus(true).find(function (x) { return x.toLowerCase() === k; });
  return ex || v;
}
const CODES_RESERVES = ["AUCUN", "ECARTE", "AUTRE", "FILTRE", "NA"];

state.selType = state.selType || null;     // code du type affiché, ou "_nouveau"
state.brType = state.brType || null;       // brouillon du formulaire (survit aux mises à jour en direct)
state.msgType = "";
// Filtre de la liste : tous, actifs, désactivés.
const FILTRES_TYPES = [
  { id: "TOUS",   label: "Tous",        test: function () { return true; } },
  { id: "ACTIFS", label: "Actifs",      test: function (d) { return d.actif !== false; } },
  { id: "INACTIFS", label: "Désactivés", test: function (d) { return d.actif === false; } },
];
state.filtreType = state.filtreType || "TOUS";
function filtreType(id) { state.filtreType = id; state.selType = null; state.brType = null; state.msgType = ""; render(); }

// Code stable fabriqué à partir du titre : majuscules, sans accent, mots séparés par « _ ».
function codeDepuisTitre(titre) {
  return String(titre || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[0-9_]+/, "").slice(0, 40).replace(/_+$/, "");
}

function libSource(s) { return s === "COMPTES_RENDUS" ? "Comptes rendus de réunion" : "Boîte RH partagée (mails)"; }

function selType(code) {
  state.selType = code; state.msgType = "";
  const d = code === "_nouveau" ? null : (typesTable() || []).find(function (x) { return x.id === code; });
  state.brType = d ? { titre: d.titre || "", definition: d.definition || "", exemple: d.exemple || "", processus: d.processus || "", ordre: Number(d.ordre) || 1, actif: d.actif !== false }
                   : { titre: "", definition: "", exemple: "", processus: "", ordre: prochainOrdre(), actif: true };
  render();
}
function prochainOrdre() {
  const t = typesTable() || [];
  const max = t.filter(function (d) { return Number(d.ordre) < 99; }).reduce(function (m, d) { return Math.max(m, Number(d.ordre) || 0); }, 0);
  return Math.min(98, max + 1);
}
// Saisie : on garde le brouillon dans l'état, sans redessiner l'écran (le curseur reste en place).
function majBrType(champ, el) {
  if (!state.brType) return;
  state.brType[champ] = el.type === "checkbox" ? el.checked : (champ === "ordre" ? parseInt(el.value, 10) : el.value);
  if (champ === "titre" && state.selType === "_nouveau") {
    const z = document.getElementById("ty-code");
    if (z) z.textContent = codeDepuisTitre(el.value) || "—";
  }
  const n = document.getElementById("ty-n-" + champ);
  if (n && TYPE_LIMITES[champ]) n.textContent = String(el.value.length) + " / " + TYPE_LIMITES[champ];
}

function verifierType(b, nouveau, code, existants) {
  const titre = (b.titre || "").trim(), def = (b.definition || "").trim(), ex = (b.exemple || "").trim();
  if (titre.length < 3 || titre.length > TYPE_LIMITES.titre) return "Le titre doit faire entre 3 et " + TYPE_LIMITES.titre + " caractères.";
  if (def.length < 10 || def.length > TYPE_LIMITES.definition) return "La définition doit faire entre 10 et " + TYPE_LIMITES.definition + " caractères.";
  if (ex.length > TYPE_LIMITES.exemple) return "L'exemple doit faire au plus " + TYPE_LIMITES.exemple + " caractères.";
  if ((b.processus || "").trim().length > TYPE_LIMITES.processus) return "Le processus doit faire au plus " + TYPE_LIMITES.processus + " caractères.";
  if (!(b.ordre >= 1 && b.ordre <= 99)) return "L'ordre d'affichage doit être compris entre 1 et 99.";
  if (nouveau) {
    if (!/^[A-Z][A-Z0-9_]{2,39}$/.test(code)) return "Le titre ne permet pas de fabriquer un code (au moins 3 lettres).";
    if (CODES_RESERVES.indexOf(code) >= 0) return "Ce code est réservé (" + code + ") : choisissez un autre titre.";
    if (existants.some(function (d) { return d.id === code; })) return "Un type porte déjà le code " + code + " : choisissez un autre titre, ou réactivez le type existant.";
  }
  return "";
}

function enregistrerType() {
  const b = state.brType, existants = typesTable() || [];
  const nouveau = state.selType === "_nouveau";
  const code = nouveau ? codeDepuisTitre(b.titre) : state.selType;
  const avant = nouveau ? null : existants.find(function (d) { return d.id === code; });
  if (!nouveau && !avant) { state.msgType = "Ce type n'existe plus dans la base."; render(); return; }
  const err = verifierType(b, nouveau, code, existants);
  if (err) { state.msgType = err; render(); return; }
  const protege = avant ? avant.protege === true : false;
  if (protege && !b.actif) { state.msgType = "« Autre » ne peut pas être désactivé : c'est la case des mails que l'IA ne sait pas ranger."; render(); return; }
  if (typeof window.aciaEcrireType !== "function") { state.msgType = "Écriture impossible : connexion à la base absente."; render(); return; }
  const data = { titre: b.titre.trim(), definition: b.definition.trim(), exemple: b.exemple.trim(), processus: normaliserProcessus(b.processus), ordre: b.ordre,
    actif: protege ? true : !!b.actif, source: avant ? avant.source : "MAILS", protege: protege };
  state.msgType = "Enregistrement…"; render();
  window.aciaEcrireType(code, data).then(function () {
    state.selType = code; state.msgType = nouveau ? "Type créé (code " + code + "). Il sera proposé à l'IA dès le prochain passage du classement." : "Modifications enregistrées dans la base.";
    render();
  }).catch(function (e) { state.msgType = "Refusé par la base : " + ((e && e.message) || e); render(); });
}

function viewTypesIrritants() {
  const fb = window.ACIA_FB.types_irritants;
  const titre = "<h2>Types d’irritants</h2>";
  if (!fb || fb.statut !== "ok") {
    const msg = !fb || fb.statut === "chargement" ? "Lecture de la base en cours…" : "Données indisponibles : " + fb.erreur;
    return titre + '<div class="card"><p class="note" style="margin:0">' + esc(msg) + '</p><p class="note">La liste des types n\'est affichée que depuis la base.</p></div>';
  }
  const types = typesTable() || [];
  // Filtre actif / désactivé.
  const filtre = FILTRES_TYPES.find(function (f) { return f.id === state.filtreType; }) || FILTRES_TYPES[0];
  const visibles = types.filter(filtre.test);
  if (!state.selType || (state.selType !== "_nouveau" && !visibles.some(function (d) { return d.id === state.selType; }))) {
    if (!visibles.length) { selTypeSansRendu("_nouveau"); } else { selTypeSansRendu(visibles[0].id); }
  }
  if (!state.brType) selTypeSansRendu(state.selType);

  const actifs = types.filter(function (d) { return d.actif !== false; }).length;
  const entete = '<p class="note" style="margin:-4px 0 12px">' + badge("b-emerald", "● En direct") + " " + actifs + " type(s) actif(s) sur " + types.length +
    ". L'IA du classement relit cette liste à chaque passage (toutes les heures) : une modification vaut pour les <b>prochains</b> mails, pas pour ceux déjà classés.</p>" +
    '<p class="note" style="margin:-6px 0 12px">Conservation : les classements, décisions et réponses de l\'IA sont gardés 24 mois (effacement à automatiser avant tout usage réel). <a href="notice.html" target="_blank" style="color:var(--accent)">Notice d\'information</a></p>';

  const chips = '<div class="chips" style="margin:0 0 10px">' + FILTRES_TYPES.map(function (f) {
    return '<button class="chip' + (f.id === filtre.id ? " active" : "") + '" onclick="filtreType(\'' + f.id + '\')">' + esc(f.label) + " (" + types.filter(f.test).length + ")</button>";
  }).join("") + "</div>";
  const picks = (visibles.length ? "" : '<div class="card" style="margin-bottom:8px"><p class="note" style="margin:0">Aucun type dans ce filtre.</p></div>') + visibles.map(function (d) {
    const etat = d.actif === false ? "désactivé" : "actif";
    return '<button class="pick' + (state.selType === d.id ? " selected" : "") + '" onclick="selType(\'' + esc(d.id) + '\')">' +
      '<div style="font-weight:700;font-size:14px">' + esc(d.titre || d.id) + (d.actif === false ? " (désactivé)" : "") + "</div>" +
      '<div class="psub">' + esc(d.id) + " · " + esc(etat) + (d.processus ? " · " + esc(d.processus) : "") + " · " + esc(libSource(d.source)) + (d.protege ? " · protégé" : "") + "</div></button>";
  }).join("") +
    '<button class="pick' + (state.selType === "_nouveau" ? " selected" : "") + '" onclick="selType(\'_nouveau\')"><div style="font-weight:700;font-size:14px">+ Nouveau type</div><div class="psub">Titre, définition, exemple</div></button>';

  const nouveau = state.selType === "_nouveau";
  const d = nouveau ? null : types.find(function (x) { return x.id === state.selType; });
  const b = state.brType;
  const ta = 'style="display:block;width:100%;margin-top:4px;font:inherit;font-size:14px;font-weight:400;padding:8px 10px;border:1px solid var(--lav2);border-radius:4px;color:var(--ink);background:#fff;resize:vertical"';
  const compteur = function (champ) { return ' <small id="ty-n-' + champ + '" style="font-weight:400;color:#64748b">' + String((b[champ] || "").length) + " / " + TYPE_LIMITES[champ] + "</small>"; };
  const codeAff = nouveau ? '<span id="ty-code">' + esc(codeDepuisTitre(b.titre) || "—") + "</span>" : esc(d.id);

  const right = '<div class="card">' +
    '<div class="spechead">' + (nouveau ? "Nouveau type d'irritant" : "Modifier le type") + "</div>" +
    '<p style="font-size:13px;margin-top:6px">Code : <b>' + codeAff + "</b>" + (nouveau ? " <small>(fabriqué à partir du titre, il ne changera plus)</small>" : " <small>(figé : renommer le titre ne casse pas les tendances)</small>") + "<br>" +
    "Source : " + esc(libSource(d ? d.source : "MAILS")) + (d && d.protege ? " · " + badge("b-amber", "protégé : ni suppression ni désactivation") : "") + "</p>" +
    '<label class="fl">Titre' + compteur("titre") + '<input maxlength="' + TYPE_LIMITES.titre + '" value="' + esc(b.titre) + '" oninput="majBrType(\'titre\', this)"></label>' +
    '<label class="fl">Définition (ce que l\'IA doit reconnaître)' + compteur("definition") + '<textarea rows="4" maxlength="' + TYPE_LIMITES.definition + '" ' + ta + ' oninput="majBrType(\'definition\', this)">' + esc(b.definition) + "</textarea></label>" +
    '<label class="fl">Exemple (une phrase typique, sans nom de personne)' + compteur("exemple") + '<textarea rows="2" maxlength="' + TYPE_LIMITES.exemple + '" ' + ta + ' oninput="majBrType(\'exemple\', this)">' + esc(b.exemple) + "</textarea></label>" +
    '<label class="fl">Processus (facultatif : Paie, Temps de travail, Congés et absences…)' + compteur("processus") + '<input list="ty-processus" maxlength="' + TYPE_LIMITES.processus + '" value="' + esc(b.processus) + '" oninput="majBrType(\'processus\', this)"></label>' +
    '<datalist id="ty-processus">' + processusConnus(true).map(function (v) { return '<option value="' + esc(v) + '">'; }).join("") + "</datalist>" +
    '<label class="fl">Ordre d\'affichage (1 à 99)<input type="number" min="1" max="99" value="' + esc(b.ordre) + '" oninput="majBrType(\'ordre\', this)"></label>' +
    (d && d.protege ? "" : '<label class="fl" style="display:flex;gap:8px;align-items:center"><input type="checkbox" style="width:auto;display:inline;margin:0"' + (b.actif ? " checked" : "") + ' onchange="majBrType(\'actif\', this)"> Actif (proposé à l\'IA et affiché dans les onglets)</label>') +
    '<div class="btns" style="margin-top:12px"><button class="btn ok" onclick="enregistrerType()">' + (nouveau ? "Créer le type" : "Enregistrer") + "</button></div>" +
    (state.msgType ? '<p class="note">' + esc(state.msgType) + "</p>" : "") +
    '<p class="note">Pas de suppression : un type désactivé n\'est plus proposé à l\'IA, mais ses signaux passés restent visibles dans les tendances. ' +
    (d && d.source === "COMPTES_RENDUS" ? "Ce type est détecté dans les comptes rendus Notion par un autre scénario : sa définition sert de référence, elle n'est pas donnée à l'IA du classement des mails." :
      "Un mail que l'IA ne sait pas ranger va dans « Autre ».") + "</p></div>";

  return titre + entete + '<p class="note" style="margin:0 0 12px">Enregistrement réservé au profil HRBP connecté. Les règles de la base vérifient aussi les champs, les longueurs, le code figé et l\'absence de suppression.</p>' + chips + '<div class="row c-1-2"><div>' + picks + "</div><div>" + right + "</div></div>" +
    '<p class="note">Un type décrit une étape du processus, jamais une personne ni une équipe.</p>';
}
// Sélection sans redessiner (appelée pendant le rendu).
function selTypeSansRendu(code) {
  const r = render; render = function () {}; try { selType(code); } finally { render = r; }
}
