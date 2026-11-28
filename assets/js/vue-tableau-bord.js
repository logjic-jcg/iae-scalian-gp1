// ---------------------------------------------------------------------------
// Onglet HRBP « Tableau de bord » (v17) : pilotage des irritants et des réponses
// ---------------------------------------------------------------------------
// Inspiré des écrans « Améliorer dans la durée » et « Pilotage » de la
// démonstration hors ligne, adapté à ACIA : 2 sources (boîte RH, comptes rendus
// Notion), réponse la plus simple qui suffit, décision du HRBP, aucun nom.
//
// v18 : BRANCHÉ SUR FIREBASE par défaut. donneesTdb() lit les mêmes
// collections que les autres onglets HRBP :
//   classement_mails  → signaux par type et par semaine (aciaSignaux), écartés, « Autre », confiance basse
//   comptes_rendus    → actions reportées ou sans responsable (signauxComptesRendus), CR analysés / écartés
//   decisions_hrbp    → statut, réponse retenue, semaine d'effet (decisionDe)
//   types_irritants   → libellés et types actifs (typesPilotage)
// Tout le reste de l'écran (calculs, règles, affichage) est commun aux deux modes.
// Secours pour la démo : bouton « Instantané de démonstration » (ou app.html?tdb=statique)
// = l'instantané v17 (corrigé du jeu de données + décisions d'exemple), bandeau jaune.
// Sans la base et sans ce choix explicite, aucun chiffre n'est affiché.
// ---------------------------------------------------------------------------

state.tdbStatique = state.tdbStatique || /[?&]tdb=statique\b/.test(location.search);
function tdbBascule(v) { state.tdbStatique = v; render(); }

// --- Instantané statique (même forme que les documents Firestore) ----------
// classement_mails : un document par mail, sans expéditeur ni objet.
// Codes = corrigé du jeu de données v5 (pas le résultat réel de l'IA).
const TDB_INSTANTANE = {
  classement_mails: [
    { jour_fictif: "J1",  type: "ANNONCE_INCOMPLETE" },
    { jour_fictif: "J2",  type: "DOC_DISPERSEE" },
    { jour_fictif: "J3",  type: "DOC_DISPERSEE", type_secondaire: "QUESTION_RECURRENTE" },
    { jour_fictif: "J4",  type: "ANNONCE_INCOMPLETE" },
    { jour_fictif: "J5",  type: "DOC_DISPERSEE", type_secondaire: "QUESTION_RECURRENTE" },
    { jour_fictif: "J8",  type: "DEMANDE_TARDIVE" },
    { jour_fictif: "J9",  type: "DEMANDE_TARDIVE" },
    { jour_fictif: "J9",  type: "PIECES_RENVOYEES" },
    { jour_fictif: "J10", type: "DOC_DISPERSEE" },
    { jour_fictif: "J11", type: "QUESTION_RECURRENTE" },
    { jour_fictif: "J12", type: "HORS_BOUCLE" },
    { jour_fictif: "J15", type: "PREMIER_JOUR_DEGRADE", type_secondaire: "DEMANDE_TARDIVE" },
    { jour_fictif: "J16", type: "DOC_DISPERSEE" },
    { jour_fictif: "J16", type: "ANNONCE_INCOMPLETE", type_secondaire: "DOC_DISPERSEE" },
    { jour_fictif: "J17", type: "QUESTION_RECURRENTE" },
    { jour_fictif: "J18", type: "DEMANDE_TARDIVE" },
    { jour_fictif: "J18", type: "ECARTE" },
    { jour_fictif: "J19", type: "AUTRE" },
    { jour_fictif: "J19", type: "AUTRE" },
    { jour_fictif: "J22", type: "ANNONCE_INCOMPLETE", type_secondaire: "DEMANDE_TARDIVE" },
  ],
  // Comptes rendus : signaux par semaine tels que calculés par le site v12 sur les CR 1 à 8.
  comptes_rendus: { analyses: 7, ecartes: 1, parSem: { 1: 2, 2: 3, 3: 4, 4: 4, 5: 1 } },
  // Décisions D'EXEMPLE (à saisir en vrai dans « Décisions »).
  decisions_hrbp: [
    { id: "ANNONCE_INCOMPLETE",  statut: "VALIDE",       reponse: "ASSISTER",    semaine_effet: 4 },
    { id: "DEMANDE_TARDIVE",     statut: "VALIDE",       reponse: "ASSISTER",    semaine_effet: 4 },
    { id: "DOC_DISPERSEE",       statut: "VALIDE",       reponse: "SIMPLIFIER",  semaine_effet: 3 },
    { id: "PIECES_RENVOYEES",    statut: "VALIDE",       reponse: "AUTOMATISER", semaine_effet: 3 },
    { id: "HORS_BOUCLE",         statut: "VALIDE",       reponse: "SIMPLIFIER",  semaine_effet: 3 },
    { id: "QUESTION_RECURRENTE", statut: "A_SURVEILLER", reponse: "SIMPLIFIER",  semaine_effet: 3 },
    { id: "ACTIONS_NON_FERMEES", statut: "VALIDE",       reponse: "SIMPLIFIER",  semaine_effet: 5 },
  ],
};

// Mesures réelles connues (hors base) : citées avec leur date et leur source.
const TDB_MESURES = {
  concordance: { ok: 20, total: 21, date: "20/11/2026", source: "reclassement de toute la boîte de démo, comparé au corrigé" },
  creditsMail: { valeur: "≈ 2", date: "20/11/2026", source: "1er passage : 22 mails, 47 crédits Make" },
  creditsCR:   { valeur: "≈ 8", date: "20/11/2026", source: "1er passage : 8 comptes rendus, environ 62 crédits Make" },
};

const TDB_CIBLE_AGENT = 30;   // % au plus de réponses « Assister (agent IA) » : cible proposée, à valider en comité.

// --- Lecture des données (seul endroit qui dépend du mode) ------------------
function tdbSemaineDe(jour) { const m = /^J(\d+)$/.exec(String(jour || "").trim()); return m ? Math.ceil(Number(m[1]) / 7) : null; }

function donneesStatiques() {
  const I = TDB_INSTANTANE;
  const types = TYPES_MAIL_DEFAUT.map(function (t) { return { code: t.code, label: t.label, actif: true }; });
  types.splice(types.length - 1, 0, { code: CODE_CR, label: "Actions de réunion non fermées", actif: true });
  const parCode = {}; let semMax = 0;
  types.forEach(function (t) { parCode[t.code] = { total: 0, parSem: {}, reels: [], semMax: 0 }; });
  I.classement_mails.forEach(function (d) {
    if (d.type === "ECARTE") return;
    const s = tdbSemaineDe(d.jour_fictif); if (s > semMax) semMax = s;
    [d.type, d.type_secondaire].forEach(function (c, i) {
      const p = parCode[c]; if (!p || (i === 1 && c === d.type)) return;
      p.total += 1; p.parSem[s] = (p.parSem[s] || 0) + 1;
    });
  });
  types.forEach(function (t) { parCode[t.code].semMax = semMax; });
  const cr = parCode[CODE_CR];
  Object.keys(I.comptes_rendus.parSem).forEach(function (s) { cr.parSem[s] = I.comptes_rendus.parSem[s]; cr.total += I.comptes_rendus.parSem[s]; cr.semMax = Math.max(cr.semMax, Number(s)); });
  const mails = I.classement_mails;
  return {
    mode: "statique", types: types, parCode: parCode,
    decision: function (code) { return I.decisions_hrbp.find(function (d) { return d.id === code; }) || null; },
    compteurs: {
      mails: mails.length, mailsEcartes: mails.filter(function (d) { return d.type === "ECARTE"; }).length,
      mailsAutre: mails.filter(function (d) { return d.type === "AUTRE"; }).length,
      confianceBasse: null,   // non disponible dans l'instantané
      crAnalyses: I.comptes_rendus.analyses, crEcartes: I.comptes_rendus.ecartes,
    },
  };
}

// Lecture Firebase (v18). Testée avec une base simulée, à confirmer sur la vraie base.
function donneesFirebase() {
  const fbm = window.ACIA_FB.classement_mails;
  if (!fbm || fbm.statut === "chargement") return { erreur: "Lecture de la base en cours…", attente: true };
  const sig = aciaSignaux();
  if (!sig.ok) return { erreur: "Données indisponibles : " + (sig.erreur || "base injoignable") };
  const mails = window.ACIA_FB.classement_mails.docs;
  const crfb = window.ACIA_FB.comptes_rendus;
  const crDocs = crfb && crfb.statut === "ok" ? crfb.docs : [];
  const dfb = window.ACIA_FB.decisions_hrbp;
  const crAna = crDocs.filter(function (d) { return d.statut === "ANALYSE"; });
  const reels = Object.keys(sig.parCode).reduce(function (t, k) { return t + ((sig.parCode[k].reels || []).length); }, 0);
  return {
    mode: "firebase", types: typesPilotage().filter(function (t) { return t.actif || (sig.parCode[t.code] && sig.parCode[t.code].total); }),
    parCode: sig.parCode, decision: decisionDe,
    etat: { crOk: !!(crfb && crfb.statut === "ok"), decOk: !!(dfb && dfb.statut === "ok"), nbDec: dfb && dfb.docs ? dfb.docs.length : 0, reels: reels },
    compteurs: {
      mails: mails.length, mailsEcartes: mails.filter(function (d) { return d.type === "ECARTE"; }).length,
      mailsAutre: mails.filter(function (d) { return d.type === "AUTRE"; }).length,
      confianceBasse: mails.filter(function (d) { return String(d.confiance || "").toUpperCase() === "BASSE"; }).length +
        (typeof lireAnalyseCR === "function" ? crAna.filter(function (d) { return lireAnalyseCR(d.analyse).confiance === "BASSE"; }).length : 0),
      crAnalyses: crAna.length,
      crEcartes: crDocs.filter(function (d) { return d.statut === "ECARTE"; }).length,
    },
  };
}
function donneesTdb() { return state.tdbStatique ? donneesStatiques() : donneesFirebase(); }

// --- Calculs communs --------------------------------------------------------
function tdbFr(x, d) { return x === null || x === undefined ? "—" : (Math.round(x * Math.pow(10, d || 0)) / Math.pow(10, d || 0)).toString().replace(".", ","); }

// Même règle que l'ancien onglet « Suivi des réponses » : moyenne par semaine avant / après la semaine d'effet.
function tdbEffet(p, se) {
  const semaines = []; for (let s = 1; s <= Math.max(p.semMax, se); s++) semaines.push(s);
  const av = semaines.filter(function (s) { return s < se; }), ap = semaines.filter(function (s) { return s >= se && s <= p.semMax; });
  const somme = function (l) { return l.reduce(function (t, s) { return t + (p.parSem[s] || 0); }, 0); };
  const mAv = av.length ? somme(av) / av.length : null, mAp = ap.length ? somme(ap) / ap.length : null;
  const nb = somme(av) + somme(ap);
  let v;
  if (mAp === null) v = "ATTENTE"; else if (mAv === null) v = "SANS_AVANT";
  else if (nb < 3) v = "TROP_PEU"; else if (mAp < mAv * 0.8) v = "BAISSE"; else if (mAp > mAv * 1.2) v = "HAUSSE"; else v = "STABLE";
  return { mAv: mAv, mAp: mAp, nbAp: ap.length, verdict: v, semaines: semaines };
}
const TDB_VERDICT = {
  BAISSE:     ["b-emerald", "En baisse"],   HAUSSE: ["b-rose", "En hausse"], STABLE: ["b-amber", "Stable"],
  TROP_PEU:   ["b-slate", "Trop peu de signaux"], ATTENTE: ["b-sky", "Pas encore de semaine après"], SANS_AVANT: ["b-sky", "Pas de semaine avant"],
};
// Revue mensuelle (inspirée de « conserver / adapter / retirer ») : l'assistant propose, le HRBP décide.
function tdbRecommandation(d, e) {
  if (d.statut === "A_SURVEILLER") return ["b-amber", "Statuer", "Décider de valider ou d'écarter à la prochaine revue."];
  if (e.verdict === "BAISSE") return ["b-emerald", "Conserver", "La réponse produit l'effet attendu : la garder et continuer le suivi."];
  if (e.verdict === "STABLE") return ["b-amber", "Adapter", "Pas d'effet visible : revoir le contenu ou la diffusion de la réponse."];
  if (e.verdict === "HAUSSE") return e.nbAp >= 2 ? ["b-rose", "Réorienter", "Hausse sur plusieurs semaines : choisir une autre réponse."]
                                                 : ["b-amber", "Adapter", "Hausse sur une seule semaine : vérifier avant de conclure."];
  return ["b-slate", "Attendre", "Pas assez de recul pour conclure : revoir à la prochaine revue."];
}
function tdbAExaminer(p) { const m = p.semMax; return ((p.parSem[m] || 0) + (p.parSem[m - 1] || 0)) >= 3; }

// --- Petits composants graphiques (une seule teinte, violet ACIA) ----------
// Carte de chaleur : intensité = nombre de signaux (échelle séquentielle lavande → indigo).
const TDB_RAMPE = ["#f7f5fa", "#e4dbf0", "#c9b8e2", "#a48bcf", "#7651b5", "#4b2882", "#290f50"];
function tdbCouleur(v, max) { if (!v) return TDB_RAMPE[0]; const i = Math.min(6, 1 + Math.round((v / Math.max(1, max)) * 5)); return TDB_RAMPE[i]; }
function tdbEncre(v, max) { const i = v ? Math.min(6, 1 + Math.round((v / Math.max(1, max)) * 5)) : 0; return i >= 4 ? "#ffffff" : "#1a1030"; }

function tdbTuile(valeur, libelle, cls, etat, sous) {
  return '<div class="kpi tdb-kpi"><div class="tdb-kpi-h"><span class="kv">' + esc(valeur) + "</span>" + (etat ? badge(cls, etat) : "") + "</div>" +
    '<div class="tdb-kpi-l">' + esc(libelle) + "</div>" + (sous ? '<div class="note" style="margin-top:4px">' + esc(sous) + "</div>" : "") + "</div>";
}
function tdbBarre(lbl, v, max, sous) {
  return '<div class="bar"><span class="lbl">' + esc(lbl) + (sous ? '<br><small class="tdb-sub">' + esc(sous) + "</small>" : "") +
    '</span><span class="track"><span class="fill" style="display:block;width:' + (max ? Math.round(v / max * 100) : 0) + '%"></span></span><span class="val">' + v + "</span></div>";
}

// --- Écran ------------------------------------------------------------------
// v21 : calcul commun au « Tableau de bord » (observer) et à la « Revue mensuelle » (décider).
// Renvoie le HTML d'erreur (texte) si la base n'est pas lisible, sinon les sections.
// v38 : filtrerProcessus = true (Tableau de bord seulement) restreint les irritants au filtre « Processus »
// (le même que dans Décisions et Types d'irritants). La Revue mensuelle et le partage restent sur tous les irritants.
function tdbSections(titre, filtrerProcessus) {
  const D = donneesTdb();
  if (D.erreur) return "<h2>" + titre + "</h2>" + '<div class="card"><p class="note" style="margin:0">' + esc(D.erreur) + "</p>" +
    '<p class="note">Aucun chiffre n\'est affiché sans la base.' + (D.attente ? "" : " En secours pour une démonstration :") + "</p>" +
    (D.attente ? "" : '<button class="btn" onclick="tdbBascule(true)">Afficher l\'instantané de démonstration</button>') + "</div>";
  const C = D.compteurs;
  // v41 : option « Masquer les irritants sans signal » (Tableau de bord seulement, comme le filtre Processus).
  const lignes = D.types.filter(function (t) { return !filtrerProcessus || (passeProcessus(t.code) && (!state.masquerVides || (D.parCode[t.code] && D.parCode[t.code].total))); }).map(function (t) {
    const p = D.parCode[t.code] || { total: 0, parSem: {}, semMax: 0 };
    const d = D.decision(t.code);
    return { code: t.code, label: t.label, p: p, d: d, examiner: tdbAExaminer(p), effet: d && d.statut !== "ECARTE" ? tdbEffet(p, Number(d.semaine_effet) || 0) : null };
  });
  const signales = lignes.filter(function (l) { return l.p.total > 0 && l.code !== "AUTRE"; });
  const aExaminer = signales.filter(function (l) { return l.examiner; });
  const sansDecision = signales.filter(function (l) { return !l.d; });
  const suivis = lignes.filter(function (l) { return l.effet; });
  const enPlace = suivis.filter(function (l) { return l.d.statut === "VALIDE"; });
  const baisse = enPlace.filter(function (l) { return l.effet.verdict === "BAISSE"; });
  const nbRep = { SIMPLIFIER: 0, AUTOMATISER: 0, ASSISTER: 0 };
  suivis.forEach(function (l) { if (nbRep[l.d.reponse] !== undefined) nbRep[l.d.reponse] += 1; });
  const totRep = nbRep.SIMPLIFIER + nbRep.AUTOMATISER + nbRep.ASSISTER;
  const partAgent = totRep ? Math.round(100 * nbRep.ASSISTER / totRep) : null;
  const couvert = signales.length ? Math.round(100 * signales.filter(function (l) { return l.d; }).length / signales.length) : null;
  const classes = C.mails - C.mailsEcartes;

  // Bandeau de mode
  const E = D.etat || {};
  const bandeau = D.mode === "statique"
    ? '<div class="tdb-bandeau">' + badge("b-amber", "Instantané de démonstration") +
      " Construit sur le corrigé du jeu de données (mails 1 à 20, comptes rendus 1 à 8) et sur des <b>décisions d'exemple</b>. Ce n'est pas une lecture de la base. " +
      '<button class="chip" onclick="tdbBascule(false)">Revenir aux données de la base</button></div>'
    : '<p class="note" style="margin:0 0 12px">' + badge("b-emerald", "● En direct") + " " +
      esc(C.mails + " mail(s) traité(s) · " + C.crAnalyses + " compte(s) rendu(s) analysé(s) · " + E.nbDec + " décision(s) du HRBP") +
      (E.crOk ? "" : " · " + badge("b-rose", "Comptes rendus indisponibles")) + (E.decOk ? "" : " · " + badge("b-rose", "Décisions indisponibles")) +
      (E.reels ? " · " + esc(E.reels + " signal(s) de mails réels sans semaine fictive, non placés dans les semaines") : "") + "</p>";

  // 1. Tuiles
  const tuiles = '<div class="tdb-kpis">' +
    tdbTuile(String(aExaminer.length), "irritants à examiner", aExaminer.length ? "b-amber" : "b-emerald", aExaminer.length ? "À traiter" : "Rien en attente",
      "3 signaux ou plus sur les 2 dernières semaines observées") +
    tdbTuile(couvert === null ? "—" : couvert + " %", "des irritants signalés ont une décision", couvert === 100 ? "b-emerald" : "b-amber", sansDecision.length + " sans décision",
      signales.length + " irritants signalés, hors « Autre »") +
    tdbTuile(baisse.length + " sur " + enPlace.length, "réponses en place avec un effet visible", baisse.length ? "b-emerald" : "b-slate", "En baisse",
      "Au moins 20 % de signaux en moins par semaine") +
    tdbTuile(partAgent === null ? "—" : partAgent + " %", "des réponses font appel à un agent IA", partAgent !== null && partAgent <= TDB_CIBLE_AGENT ? "b-emerald" : "b-amber",
      partAgent !== null && partAgent <= TDB_CIBLE_AGENT ? "Dans la cible" : "Au-dessus de la cible", "Cible proposée : " + TDB_CIBLE_AGENT + " % au plus") +
    "</div>";

  // 2. Carte de chaleur des signaux par semaine
  const semMax = Math.max.apply(null, lignes.map(function (l) { return l.p.semMax || 0; }).concat([1]));
  const sems = []; for (let s = 1; s <= semMax; s++) sems.push(s);
  const maxCase = Math.max.apply(null, lignes.map(function (l) { return Math.max.apply(null, sems.map(function (s) { return l.p.parSem[s] || 0; })); }).concat([1]));
  const chaleur = '<div class="tw"><table class="tdb-heat"><thead><tr><th>Irritant</th>' + sems.map(function (s) { return '<th class="c">' + semLib(s) + '<div class="tdb-sub" style="font-weight:400">' + semJJMM(semLundi(s)) + "</div></th>"; }).join("") +
    '<th class="c">Total</th></tr></thead><tbody>' +
    lignes.map(function (l) {
      const horsSource = function (s) { return s > l.p.semMax; };
      return "<tr><td>" + lienFiche(l.code, esc(l.label), D.mode === "statique") + (l.code === CODE_CR ? ' <small class="tdb-sub">comptes rendus</small>' : "") + (l.examiner ? " " + badge("b-amber", "À examiner") : "") + "</td>" +
        sems.map(function (s) {
          const v = l.p.parSem[s] || 0;
          if (horsSource(s)) return '<td class="c tdb-na" title="Semaine pas encore observée pour cette source">·</td>';
          return '<td class="c"><span class="tdb-cell" style="background:' + tdbCouleur(v, maxCase) + ";color:" + tdbEncre(v, maxCase) + '" title="' + esc(l.label) + " · " + semLong(s) + " : " + v + ' signal(s)">' + (v || "") + "</span></td>";
        }).join("") + '<td class="c"><b>' + l.p.total + "</b></td></tr>";
    }).join("") + "</tbody></table></div>" +
    '<p class="note">Un signal = un mail classé dans ce type (principal ou secondaire), ou une action de réunion reportée ou sans responsable. Plus la case est foncée, plus il y a de signaux. « · » = semaine pas encore observée pour cette source.</p>';

  // 3. Portefeuille des décisions et des réponses
  const st = { VALIDE: 0, A_SURVEILLER: 0, ECARTE: 0 };
  signales.forEach(function (l) { if (l.d && st[l.d.statut] !== undefined) st[l.d.statut] += 1; });
  const maxSt = Math.max(st.VALIDE, st.A_SURVEILLER, st.ECARTE, sansDecision.length, 1);
  const maxRep = Math.max(nbRep.SIMPLIFIER, nbRep.AUTOMATISER, nbRep.ASSISTER, 1);
  const portefeuille = '<div class="card"><h3>Décisions du HRBP</h3>' +
    tdbBarre("Validés", st.VALIDE, maxSt) + tdbBarre("À surveiller", st.A_SURVEILLER, maxSt) + tdbBarre("Écartés", st.ECARTE, maxSt) + tdbBarre("Sans décision", sansDecision.length, maxSt) +
    '<h3 style="margin-top:18px">Réponses retenues</h3>' +
    tdbBarre("Simplifier", nbRep.SIMPLIFIER, maxRep, "sans IA") + tdbBarre("Automatiser", nbRep.AUTOMATISER, maxRep, "règle, sans jugement") + tdbBarre("Assister", nbRep.ASSISTER, maxRep, "agent IA, un humain valide") +
    '<p class="note">La réponse la plus simple qui suffit d\'abord : un agent IA seulement quand une page, une règle ou un modèle ne suffit pas.</p></div>';

  // 4. Qualité de l'assistant et garde-fous
  const M = TDB_MESURES;
  const qualite = '<div class="card"><h3>Qualité de l\'assistant et garde-fous</h3><div class="tdb-q">' +
    tdbQ("Classement conforme au corrigé", Math.round(100 * M.concordance.ok / M.concordance.total) + " %", M.concordance.ok + " mails sur " + M.concordance.total + " · mesure du " + M.concordance.date, "b-emerald", "Mesuré") +
    tdbQ("Mails classés « Autre »", classes ? Math.round(100 * C.mailsAutre / classes) + " %" : "—", C.mailsAutre + " sur " + classes + " mails classés · à relire", C.mailsAutre ? "b-amber" : "b-emerald", C.mailsAutre ? "À relire" : "Aucun") +
    tdbQ("Contenus écartés sans IA", String(C.mailsEcartes + C.crEcartes), C.mailsEcartes + " mail(s), " + C.crEcartes + " compte(s) rendu(s) · jamais envoyés à l'IA", "b-emerald", "Garde-fou actif") +
    tdbQ("Classements en confiance basse", C.confianceBasse === null ? "—" : String(C.confianceBasse), C.confianceBasse === null ? "Non disponible dans l'instantané" : "Mails et comptes rendus · auto-évaluation de l'IA, à vérifier", C.confianceBasse ? "b-amber" : "b-slate", C.confianceBasse === null ? "Non mesuré ici" : (C.confianceBasse ? "À vérifier" : "Aucun")) +
    "</div><p class=\"note\">Aucune donnée individuelle : la base ne garde ni expéditeur, ni objet, ni nom. Les indicateurs portent sur des types d'irritants, jamais sur des personnes.</p></div>";

  // 5. Effet des réponses et revue mensuelle
  const effets = '<div class="tw"><table class="tdb-wide"><thead><tr><th>Irritant</th><th>Réponse</th><th class="c">Effet dès</th><th>Signaux par semaine</th><th class="c">Avant</th><th class="c">Après</th><th>Mesure</th><th>Revue mensuelle</th></tr></thead><tbody>' +
    suivis.map(function (l) {
      const e = l.effet, se = Number(l.d.semaine_effet) || 0, v = TDB_VERDICT[e.verdict], r = tdbRecommandation(l.d, e);
      const spark = '<span class="tdb-spark">' + e.semaines.map(function (s) {
        const val = l.p.parSem[s] || 0, h = s > l.p.semMax ? 0 : Math.max(3, Math.round(26 * val / Math.max(1, maxCase)));
        return '<span class="' + (s >= se ? "ap" : "av") + (s > l.p.semMax ? " vide" : "") + '" style="height:' + h + 'px" title="' + semLib(s) + " : " + (s > l.p.semMax ? "pas encore observée" : val + " signal(s)") + '"></span>';
      }).join("") + "</span>";
      return "<tr><td><b>" + lienFiche(l.code, esc(l.label), D.mode === "statique") + "</b>" + (l.d.statut === "A_SURVEILLER" ? " " + badge("b-amber", "À surveiller") : "") + "</td><td>" + esc(libReponse(l.d.reponse)) + '</td><td class="c">' + semLib(se) + "</td><td>" + spark +
        '</td><td class="c">' + tdbFr(e.mAv, 1) + '</td><td class="c">' + tdbFr(e.mAp, 1) + "</td><td>" + badge(v[0], v[1]) + "</td><td>" + badge(r[0], r[1]) + '<div class="tdb-sub" style="margin-top:4px">' + esc(r[2]) + "</div></td></tr>";
    }).join("") + "</tbody></table></div>" +
    '<p class="note">Moyenne de signaux par semaine avant et après la semaine d\'effet (barres foncées = après). Règles de la revue : en baisse → conserver ; stable → adapter ; en hausse sur plusieurs semaines → réorienter ; trop peu de recul → attendre. L\'assistant propose, le HRBP décide.</p>';

  // 6. Indicateurs détaillés
  const R = [
    ["Irritants", "Irritants à examiner", "Types avec 3 signaux ou plus sur les 2 dernières semaines", "classement_mails, comptes_rendus", "Hebdomadaire", "0 en attente de décision", String(aExaminer.length), aExaminer.filter(function (l) { return !l.d; }).length ? "b-amber" : "b-emerald", true],
    ["Irritants", "Signaux par semaine", "Mails classés + actions reportées ou sans responsable", "classement_mails, comptes_rendus", "Hebdomadaire", "En baisse après chaque réponse", "Voir la carte de chaleur", "b-slate", false],
    ["Décisions", "Couverture des décisions", "Irritants avec décision ÷ irritants signalés", "decisions_hrbp", "Mensuelle", "100 %", couvert === null ? "—" : couvert + " %", couvert === 100 ? "b-emerald" : "b-amber", true],
    ["Décisions", "Part des agents IA", "Réponses « Assister » ÷ réponses retenues", "decisions_hrbp", "Trimestrielle", TDB_CIBLE_AGENT + " % au plus (proposée)", partAgent === null ? "—" : partAgent + " % (" + nbRep.ASSISTER + " sur " + totRep + ")", partAgent !== null && partAgent <= TDB_CIBLE_AGENT ? "b-emerald" : "b-amber", true],
    ["Décisions", "Délai de décision", "Date de décision − 1re semaine « à examiner »", "decisions_hrbp (maj)", "Mensuelle", "À fixer en comité", "Non mesuré", "b-slate", false],
    ["Effet", "Réponses avec effet visible", "Réponses validées « en baisse » ÷ réponses validées", "decisions_hrbp + signaux", "Mensuelle", "À fixer en comité", baisse.length + " sur " + enPlace.length, baisse.length ? "b-emerald" : "b-slate", true],
    ["Effet", "Temps gagné par l'équipe RH", "Chronométrage avant / après sur un échantillon", "À mesurer (hors base)", "Trimestrielle", "À fixer en comité", "Non mesuré", "b-slate", true],
    ["Effet", "Satisfaction des arrivants et des managers", "Question courte après le premier jour", "À mesurer (hors base)", "Mensuelle", "À fixer en comité", "Non mesuré", "b-slate", false],
    ["Qualité", "Classement conforme au corrigé", "Codes principaux conformes ÷ mails classés", "Scénario de mesure Make", "À chaque changement de types", "90 % ou plus (proposée)", M.concordance.ok + " sur " + M.concordance.total + " (" + M.concordance.date + ")", "b-emerald", true],
    ["Qualité", "Mails classés « Autre »", "« Autre » ÷ mails classés", "classement_mails", "Hebdomadaire", "Relire dès qu'un motif revient", C.mailsAutre + " sur " + classes, C.mailsAutre ? "b-amber" : "b-emerald", false],
    ["Garde-fous", "Contenus écartés sans IA", "Mails et comptes rendus marqués « écarté »", "classement_mails, comptes_rendus", "Hebdomadaire", "Aucun envoyé à l'IA", String(C.mailsEcartes + C.crEcartes), "b-emerald", true],
    ["Coût", "Crédits Make par mail classé", "Crédits consommés ÷ mails classés", "Historique Make", "Mensuelle", "À fixer en comité", M.creditsMail.valeur + " (" + M.creditsMail.date + ")", "b-slate", false],
    ["Coût", "Crédits Make par compte rendu", "Crédits consommés ÷ comptes rendus analysés", "Historique Make", "Mensuelle", "À fixer en comité", M.creditsCR.valeur + " (" + M.creditsCR.date + ")", "b-slate", false],
  ];
  const etatLib = { "b-emerald": "Atteint", "b-amber": "À surveiller", "b-rose": "Hors cible", "b-slate": "Non évalué" };
  const detail = '<div class="tw"><table class="tdb-wide"><thead><tr><th>Famille</th><th>Indicateur</th><th>Formule</th><th>Source</th><th>Fréquence</th><th>Cible</th><th>Valeur</th><th>Statut</th><th>Comité</th></tr></thead><tbody>' +
    R.map(function (r) {
      return '<tr><td class="tdb-sub">' + esc(r[0]) + "</td><td><b>" + esc(r[1]) + "</b></td><td>" + esc(r[2]) + '</td><td class="tdb-sub"><code>' + esc(r[3]) + "</code></td><td>" + esc(r[4]) + "</td><td>" + esc(r[5]) + "</td><td>" + esc(r[6]) + "</td><td>" + badge(r[7], etatLib[r[7]]) + "</td><td>" + (r[8] ? badge("b-violet", "Comité") : "") + "</td></tr>";
    }).join("") + "</tbody></table></div>" +
    '<p class="note">Les cibles marquées « proposée » sont à valider en comité ; « Non mesuré » = aucune valeur n\'est affichée tant qu\'elle n\'a pas été mesurée.</p>';

  // 7. Décisions attendues
  const A = [];
  aExaminer.filter(function (l) { return !l.d; }).forEach(function (l) { A.push("Statuer sur « " + l.label + " » : irritant à examiner sans décision."); });
  suivis.forEach(function (l) { const r = tdbRecommandation(l.d, l.effet); if (r[1] === "Statuer" || r[1] === "Adapter" || r[1] === "Réorienter") A.push(r[1] + " : « " + l.label + " » (" + TDB_VERDICT[l.effet.verdict][1].toLowerCase() + ")."); });
  if (C.mailsAutre) A.push("Relire les " + C.mailsAutre + " mail(s) classé(s) « Autre » : si un motif revient, créer un type dans « Types d’irritants ».");
  if (partAgent !== null && partAgent > TDB_CIBLE_AGENT) A.push("Vérifier qu'une réponse plus simple ne suffirait pas pour les irritants confiés à un agent IA.");
  A.push("Valider les cibles proposées et organiser la mesure du temps gagné et de la satisfaction (aujourd'hui non mesurés).");

  return { D: D, C: C, lignes: lignes, partAgent: partAgent, bandeau: bandeau, tuiles: tuiles, chaleur: chaleur, portefeuille: portefeuille, qualite: qualite, effets: effets, detail: detail, A: A };
}

// Tableau de bord : observer (signaux, décisions, qualité, indicateurs).
function viewTableauBordHrbp() {
  const S = tdbSections("Tableau de bord · pilotage des irritants", true);
  if (typeof S === "string") return S;
  // v38 : le renvoi vers la Revue mensuelle compte toujours sur tous les irritants (la revue n'est pas filtrée).
  const filtre = filtreProcActif().length > 0 || !!state.masquerVides;
  const T = filtre ? tdbSections("Revue mensuelle") : S;
  const ligneFiltre = '<div class="tdb-outils" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 10px">' + filtreProcessusHtml().replace("margin:0 0 10px", "margin:0") + boutonSansSignal() + "</div>" +
    (filtre ? '<p class="note" style="margin:0 0 10px">Filtre appliqué aux irritants (tuiles, carte de chaleur, décisions et réponses). Les compteurs de mails et de comptes rendus et la qualité de l\'assistant restent globaux.' +
      (S.lignes.length ? "" : " Aucun irritant à afficher avec ce filtre.") + "</p>" : "");
  // Renvoi vers la Revue mensuelle : nombre de décisions attendues et de suggestions de l'IA en attente.
  let attente = 0;
  if (S.D.mode !== "statique" && typeof revueDerniere === "function") {
    const der = revueDerniere();
    if (der) attente = revueLire(der.texte, T.lignes.map(function (l) { return l.code; })).filter(function (x, i) { return (der["s" + (i + 1)] || "PROPOSEE") === "PROPOSEE"; }).length;
  }
  const renvoi = '<div class="card tdb-renvoi"><div><b>Revue mensuelle</b> · ' + T.A.length + " décision(s) attendue(s)" +
    (attente ? " · " + badge("b-rose", attente + " suggestion(s) de l'IA en attente") : "") +
    '<div class="tdb-sub">Effet des réponses, décisions à prendre et contradicteur de revue (IA).</div></div>' +
    '<button class="btn slim" onclick="setTab(\'b_revue\')">Ouvrir la revue →</button></div>';
  return "<h2>Tableau de bord · pilotage des irritants</h2>" + S.bandeau + ligneFiltre + S.tuiles + renvoi +
    '<h3 class="tdb-h">Signaux par semaine et par irritant</h3>' + S.chaleur +
    '<div class="tdb-duo">' + S.portefeuille + S.qualite + "</div>" +
    '<h3 class="tdb-h">Indicateurs détaillés</h3>' + S.detail;
}

// v21 : onglet « Revue mensuelle » (remplace « Suivi des réponses ») : décider.
// Un ancien onglet mémorisé « Suivi des réponses » bascule sur la revue.
if (state.tab === "b_suivre") state.tab = "b_revue";
function viewRevueMensuelle() {
  const S = tdbSections("Revue mensuelle");
  if (typeof S === "string") return S;
  const revue = typeof carteRevueIa === "function" ? carteRevueIa({ mode: S.D.mode, lignes: S.lignes, C: S.C, partAgent: S.partAgent }) : "";
  return "<h2>Revue mensuelle</h2>" + S.bandeau +
    '<p class="note" style="margin:0 0 4px">Une fois par mois, le HRBP passe en revue l\'effet des réponses en place et décide : conserver, adapter, réorienter ou attendre. Le contradicteur (IA) peut préparer la revue ; il propose, le HRBP décide.</p>' +
    revue +
    '<h3 class="tdb-h">Effet des réponses</h3>' + S.effets +
    '<div class="card" style="margin-top:16px"><h3>Décisions attendues à la prochaine revue</h3><ul class="tdb-list">' + S.A.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + "</ul></div>";
}
function tdbQ(titre, valeur, sous, cls, etat) {
  return '<div class="tdb-qi"><div class="tdb-sub">' + esc(titre) + '</div><div class="tdb-qv">' + esc(valeur) + " " + badge(cls, etat) + '</div><div class="tdb-sub">' + esc(sous) + "</div></div>";
}
