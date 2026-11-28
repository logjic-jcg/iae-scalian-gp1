// ---------------------------------------------------------------------------
// v29 : « Tableau de suivi » dans l'onglet Décisions (interrupteur Liste · Tableau de suivi)
// ---------------------------------------------------------------------------
// Où en est chaque irritant, du signal à l'effet mesuré. Les colonnes sont CALCULÉES
// à partir de la base (signaux, décision du HRBP, mesure avant / après) : rien à saisir,
// pas de glisser-déposer (changer de colonne = changer de décision, dans le formulaire).
// Pas de responsable nommé ni d'échéance : la base n'en a pas (principe : aucune
// donnée sur une personne).
// ---------------------------------------------------------------------------

const SUIV_COLONNES = [
  { id: "DETECTE",    titre: "Détecté",           aide: "Des signaux, aucune décision" },
  { id: "SURVEILLER", titre: "À surveiller",      aide: "Statut choisi par le HRBP" },
  { id: "EN_PLACE",   titre: "Réponse en place",  aide: "Validé, pas encore assez de recul" },
  { id: "A_REVOIR",   titre: "À revoir",          aide: "Mesure stable ou en hausse" },
  { id: "EFFICACE",   titre: "Efficace",          aide: "Mesure en baisse : conserver" },
];
state.vuePilot = state.vuePilot || "liste";
function suivVue(v) { state.vuePilot = v; state.msgPilot = ""; render(); window.scrollTo(0, 0); }

// Colonne d'un irritant (null = aucun signal ni décision : non affiché).
function suivColonne(c, p, d) {
  if (!d) return p.total > 0 && c !== "AUTRE" ? "DETECTE" : null;   // « Autre » se relit dans Types d’irritants
  if (d.statut === "ECARTE") return "ECARTE";
  if (d.statut === "A_SURVEILLER") return "SURVEILLER";
  const e = tdbEffet(p, Number(d.semaine_effet) || 0);
  if (e.verdict === "BAISSE") return "EFFICACE";
  if (e.verdict === "STABLE" || e.verdict === "HAUSSE") return "A_REVOIR";
  return "EN_PLACE";
}

function suivInterrupteur() {
  const b = function (v, ic, txt) {
    return '<button type="button" class="' + (state.vuePilot === v ? "on" : "") + '" aria-pressed="' + (state.vuePilot === v) + '" onclick="suivVue(\'' + v + '\')">' + ic + " " + txt + "</button>";
  };
  return '<span class="suiv-switch" role="group" aria-label="Affichage">' + b("liste", "☰", "Liste") + b("tableau", "▦", "Tableau de suivi") + "</span>";
}

// Petites barres des signaux par semaine (foncées à partir de la semaine d'effet).
function suivBarres(p, se) {
  const fin = p.semMax || 0; if (!fin) return "";
  let max = 1; for (let s = 1; s <= fin; s++) max = Math.max(max, p.parSem[s] || 0);
  let h = '<span class="suiv-spark" title="Signaux par semaine">';
  for (let s = 1; s <= fin; s++) {
    const v = p.parSem[s] || 0;
    h += '<i class="' + (se && s >= se ? "ap" : "") + '" style="height:' + Math.max(2, Math.round(18 * v / max)) + 'px" title="' + semLib(s) + " : " + v + '"></i>';
  }
  return h + "</span>";
}

function suivCarte(c, sig, codes) {
  const p = sig.parCode[c], d = decisionDe(c), se = d ? Number(d.semaine_effet) || 0 : 0;
  const e = d && d.statut !== "ECARTE" && se ? tdbEffet(p, se) : null;
  const proc = typeof processusDe === "function" ? processusDe(c) : "";
  const attente = typeof ficheSuggestions === "function" ? ficheSuggestions(c, codes).filter(function (x) { return x.statut === "PROPOSEE"; }).length : 0;
  const lignes = [];
  if (d) lignes.push(esc(libReponse(d.reponse)) + (se ? " · effet dès " + semLib(se) : ""));
  else lignes.push("Proposition : " + esc(libReponse(confDe(c).reco)));
  const badges = [];
  if (!d && aExaminer(p)) badges.push(badge("b-rose", "À examiner"));
  if (e) badges.push(badge(TDB_VERDICT[e.verdict][0], TDB_VERDICT[e.verdict][1]));
  if (attente) badges.push(badge("b-violet", "IA : " + attente + " suggestion(s)"));
  return '<button type="button" class="suiv-carte" onclick="ouvrirFiche(\'' + c + '\', false)" title="Ouvrir la fiche de l\'irritant">' +
    '<b>' + esc(libelleType(c)) + (actifType(c) ? "" : " (désactivé)") + "</b>" +
    (proc ? '<span class="suiv-proc">' + esc(proc) + "</span>" : "") +
    '<span class="suiv-l"><span>' + p.total + " signal(s)</span>" + suivBarres(p, se) + "</span>" +
    '<span class="suiv-sub">' + lignes.join("") + "</span>" +
    (badges.length ? '<span class="suiv-badges">' + badges.join(" ") + "</span>" : "") + "</button>";
}

// v57 : aide « Comment lire cet onglet » du tableau de suivi (même composant que Spécifications).
function suivAide() {
  const li = function (t, x) { return "<li><b>" + t + " :</b> " + x + "</li>"; };
  return '<details class="spec-aide"><summary title="Comment lire cet onglet">ⓘ Comment lire cet onglet</summary>' +
    '<p class="note" style="margin:0 0 6px">Chaque carte est un type d\'irritant. Sa colonne est <b>calculée</b> à partir de la base : on ne la déplace pas à la main.</p>' +
    '<ul class="note" style="margin:0 0 6px;padding-left:18px">' +
    li("Détecté", "des signaux, aucune décision du HRBP.") +
    li("À surveiller", "le HRBP a choisi « À surveiller ».") +
    li("Réponse en place", "décision « Validé », mais pas encore assez de recul : aucune semaine après la semaine d\'effet, aucune semaine avant, ou moins de 3 signaux au total.") +
    li("À revoir", "décision « Validé » ; en moyenne par semaine, les signaux après la semaine d\'effet sont stables ou en hausse (au moins 80 % d\'avant).") +
    li("Efficace", "décision « Validé » ; en moyenne par semaine, les signaux après la semaine d\'effet baissent de 20 % ou plus.") +
    li("Écartés", "le HRBP a choisi « Écarté » (liste repliée sous le tableau).") + "</ul>" +
    '<p class="note" style="margin:0 0 6px"><b>Pour qu\'un irritant arrive dans « À revoir » ou « Efficace » :</b> cliquez sur sa carte, puis « Décider » ; choisissez « Validé », une réponse, et une semaine d\'effet qui laisse des semaines avant et après (ni la première, ni après la dernière semaine de signaux).</p>' +
    '<p class="note" style="margin:0">Les semaines sont celles du calendrier (jour 1 du scénario = lundi 19/10/2026, semaine 43), comme dans le formulaire de décision : la période choisie dans « Tendances » ne s\'applique pas ici. La mesure compte des signaux, elle ne prouve pas à elle seule que la réponse en est la cause.</p></details>';
}

function viewSuiviTableau() {
  const sig = aciaSignaux();
  if (!sig.ok) return messageSansBase("Décisions", sig);
  const codes = typesPilotage().map(function (t) { return t.code; });
  const groupes = { ECARTE: [] }; SUIV_COLONNES.forEach(function (k) { groupes[k.id] = []; });
  const avantPropo = codes.filter(function (c) { return passeProcessus(c) && sig.parCode[c] && suivColonne(c, sig.parCode[c], decisionDe(c)); });
  codes.filter(function (c) { return passeProcessus(c) && passePropo(c) && sig.parCode[c]; }).forEach(function (c) {
    const col = suivColonne(c, sig.parCode[c], decisionDe(c));
    if (col) groupes[col].push(c);
  });
  Object.keys(groupes).forEach(function (k) { groupes[k].sort(function (a, b) { return sig.parCode[b].total - sig.parCode[a].total; }); });
  const colonnes = SUIV_COLONNES.map(function (k) {
    const l = groupes[k.id];
    return '<div class="suiv-col suiv-' + k.id.toLowerCase() + '"><div class="suiv-ch"><span>' + esc(k.titre) + '</span><span class="suiv-n">' + l.length + "</span></div>" +
      '<div class="suiv-aide">' + esc(k.aide) + "</div>" +
      (l.map(function (c) { return suivCarte(c, sig, codes); }).join("") || '<div class="suiv-vide">Aucun irritant</div>') + "</div>";
  }).join("");
  const ec = groupes.ECARTE;
  const ecartes = ec.length ? '<details class="suiv-ecartes"><summary>Écartés (' + ec.length + ")</summary><div class=\"suiv-ecartes-l\">" +
    ec.map(function (c) { return suivCarte(c, sig, codes); }).join("") + "</div></details>" : "";
  return '<h2 class="exp-h2"><span>Décisions</span>' + suivInterrupteur() + "</h2>" + bandeauVersionC() + suivAide() +
    '<div class="filtres-ligne">' + filtreProcessusHtml() + filtrePropoHtml(avantPropo) + "</div>" +
    '<div class="suiv-board">' + colonnes + "</div>" + ecartes +
    '<p class="note" style="margin-top:10px">Colonnes calculées à partir de la base : signaux, décision du HRBP et mesure avant / après la semaine d\'effet (en baisse = moins 20 % ou plus). ' +
    "Pour changer un irritant de colonne, on change sa décision : cliquez sur la carte, puis « Décider ». Aucune donnée sur une personne.</p>";
}

// Onglet Décisions : interrupteur dans le titre ; la fiche irritant garde la priorité.
(function () {
  const orig = window.viewPilotOrienter;
  if (typeof orig !== "function") return;
  window.viewPilotOrienter = function () {
    if (state.ficheCode) return orig();
    if (state.vuePilot === "tableau") return viewSuiviTableau();
    const h = orig();
    return h.replace("<h2>Décisions</h2>", '<h2 class="exp-h2"><span>Décisions</span>' + suivInterrupteur() + "</h2>");
  };
})();
// « Décider » depuis la fiche : retour en mode Liste, sur cet irritant.
(function () {
  const orig = window.ficheDecider;
  if (typeof orig !== "function") return;
  window.ficheDecider = function (code) { state.vuePilot = "liste"; return orig(code); };
})();
