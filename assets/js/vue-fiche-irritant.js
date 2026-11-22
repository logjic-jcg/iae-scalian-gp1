// ---------------------------------------------------------------------------
// Fiche irritant (v20) : tout le parcours d'un irritant sur un seul écran,
// du signal à l'effet. Pas d'onglet dédié : la fiche s'ouvre en cliquant sur
// un irritant depuis « Tendances des irritants », « Valider et orienter » ou
// le « Tableau de bord », et remplace le contenu de l'onglet courant
// (« ← Retour » ramène à l'onglet d'origine).
// Données : celles déjà lues par le site (classement_mails, comptes_rendus,
// types_irritants, decisions_hrbp, suggestions_ia). Aucun texte de mail,
// aucun nom : seulement des agrégats, la définition et l'exemple fictif du type.
// La base ne garde que la dernière décision : l'historique est reconstitué
// à partir des dates disponibles, donc partiel.
// ---------------------------------------------------------------------------
state.ficheCode = state.ficheCode || null;

// Libellé des onglets d'origine, pour le lien « Retour ».
const FICHE_ORIGINES = { tendances: "Tendances des irritants", b_orienter: "Valider et orienter", b_spec: "Spécifications", b_pilotage: "Tableau de bord", b_revue: "Revue mensuelle", types: "Types des irritants" };

function ouvrirFiche(code, statique) {
  state.ficheCode = code;
  state.ficheStatique = !!statique;   // vrai seulement depuis l'instantané du Tableau de bord
  render(); window.scrollTo(0, 0);
}
function fermerFiche() { state.ficheCode = null; render(); window.scrollTo(0, 0); }
// Lien vers la fiche, réutilisé par les autres onglets.
function lienFiche(code, texte, statique) {
  return '<a href="#" class="fi-lien" title="Ouvrir la fiche de cet irritant" onclick="ouvrirFiche(\'' + code + "'," + (statique ? "true" : "false") + ');return false">' + texte + "</a>";
}
function ficheDecider(code) {
  state.selPilot = code; state.filtrePilot = "TOUS"; state.filtreProc = []; state.msgPilot = "";
  setTab("b_orienter");
}
function ficheVoirSpec(code) {
  state.filtreSpec = "TOUS";
  setTab("b_spec");
  setTimeout(function () {
    const el = document.getElementById("spec-" + code), h = document.querySelector("header");
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - (h ? h.offsetHeight : 0) - 12);
  }, 0);
}

// Changer d'onglet ferme la fiche.
const ficheSetTabOrigine = setTab;
setTab = function (t) { state.ficheCode = null; ficheSetTabOrigine(t); };
// Les onglets HRBP affichent la fiche à la place de leur contenu quand elle est ouverte.
["viewTendances", "viewPilotOrienter", "viewPilotSpec", "viewTableauBordHrbp", "viewRevueMensuelle", "viewTypesIrritants"].forEach(function (nom) {
  const orig = window[nom];
  if (typeof orig !== "function") return;
  window[nom] = function () { return state.ficheCode ? viewFicheIrritant() : orig(); };
});

// Suggestions de l'IA qui portent sur ce code, de la plus récente à la plus ancienne.
function ficheSuggestions(code, codes) {
  const fb = window.ACIA_FB.suggestions_ia;
  if (!fb || fb.statut !== "ok" || typeof revueLire !== "function") return [];
  const t = function (d) { return d.demande && d.demande.toDate ? d.demande.toDate() : null; };
  const res = [];
  fb.docs.filter(function (d) { return String(d.id).indexOf("test") !== 0 && d.type !== "AVANT_DECISION"; })
    .sort(function (a, b) { return (t(b) || 0) - (t(a) || 0); })
    .forEach(function (doc) {
      revueLire(doc.texte, codes).forEach(function (s, i) {
        if (s.code !== code) return;
        const n = i + 1;
        res.push({ s: s, date: t(doc), statut: doc["s" + n] || "PROPOSEE", motif: doc["m" + n] || "" });
      });
    });
  return res;
}

// Barres par semaine, zone « après la décision » à partir de la semaine d'effet.
function ficheGraphe(p, se) {
  const fin = Math.max(p.semMax || 0, se || 0, 1);
  const sems = []; for (let s = 1; s <= fin; s++) sems.push(s);
  const max = Math.max(1, Math.max.apply(null, sems.map(function (s) { return p.parSem[s] || 0; })));
  const W = 560, H = 190, L = 40, R = 20, T = 26, B = 40, pas = (W - L - R) / sems.length, bw = Math.min(60, pas * 0.55);
  const Y = function (v) { return H - B - (v / max) * (H - B - T); };
  let h = '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" role="img" aria-label="Signaux par semaine">';
  [0, max].forEach(function (v) { h += '<line x1="' + L + '" y1="' + Y(v) + '" x2="' + (W - R) + '" y2="' + Y(v) + '" stroke="' + (v ? "#f1edf7" : "#e3dcee") + '"/><text x="' + (L - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end" font-size="11" fill="#8f87a3">' + v + "</text>"; });
  if (se && se <= fin) {
    const x0 = L + (se - 1) * pas;
    h += '<rect x="' + x0 + '" y="' + (T - 10) + '" width="' + (W - R - x0) + '" height="' + (H - B - T + 10) + '" fill="#eee8f5" opacity=".7"/>' +
      '<line x1="' + x0 + '" y1="' + (T - 14) + '" x2="' + x0 + '" y2="' + (H - B) + '" stroke="#4b2882" stroke-dasharray="5 4" stroke-width="1.6"/>' +
      '<text x="' + (x0 + 8) + '" y="' + (T + 2) + '" font-size="12" font-weight="700" fill="#4b2882">Après la décision</text>';
  }
  sems.forEach(function (s, i) {
    const cx = L + pas * i + pas / 2, v = p.parSem[s] || 0, vide = s > p.semMax;
    const col = se && s >= se ? "#8b6fb8" : "#4b2882";
    if (!vide) {
      h += v ? '<rect x="' + (cx - bw / 2) + '" y="' + Y(v) + '" width="' + bw + '" height="' + (H - B - Y(v)) + '" rx="4" fill="' + col + '"><title>Semaine ' + s + " : " + v + " signal(s)</title></rect>"
             : '<rect x="' + (cx - bw / 2) + '" y="' + (H - B - 2) + '" width="' + bw + '" height="2" fill="#bfb3d2"/>';
      h += '<text x="' + cx + '" y="' + (Y(v) - 6) + '" text-anchor="middle" font-size="13" font-weight="700" fill="#1a1030">' + v + "</text>";
    } else {
      h += '<text x="' + cx + '" y="' + (H - B - 6) + '" text-anchor="middle" font-size="11" fill="#8f87a3">pas encore observée</text>';
    }
    h += '<text x="' + cx + '" y="' + (H - B + 20) + '" text-anchor="middle" font-size="12" fill="#5f5873">S' + s + (s === se ? " · effet" : "") + "</text>";
  });
  return h + "</svg>";
}

function viewFicheIrritant() {
  const code = state.ficheCode;
  const retour = '<div class="fi-top"><a class="fi-back" href="#" onclick="fermerFiche();return false">← Retour à ' + esc(FICHE_ORIGINES[state.tab] || "l'onglet") + "</a></div>";
  const D = state.ficheStatique ? donneesStatiques() : donneesFirebase();
  if (D.erreur) return retour + "<h2>Fiche irritant</h2>" + '<div class="card"><p style="margin:0">' + esc(D.erreur) + '</p><p class="note">Aucun chiffre n\'est affiché sans la base.</p></div>';
  const p = D.parCode[code];
  if (!p) return retour + "<h2>Fiche irritant</h2>" + '<div class="card"><p style="margin:0">Irritant inconnu : ' + esc(code) + ".</p></div>";

  const codes = D.types.map(function (t) { return t.code; });
  const t = D.types.find(function (x) { return x.code === code; }) || { label: code, actif: true };
  const tb = (typeof typesTable === "function" && !state.ficheStatique && typesTable()) ? typesTable().find(function (x) { return x.id === code; }) : null;
  const d = D.decision(code), st = libStatut(d && d.statut), conf = confDe(code);
  const se = d && Number(d.semaine_effet) || 0;
  const e = d && se ? tdbEffet(p, se) : null;
  const sugg = state.ficheStatique ? [] : ficheSuggestions(code, codes);
  const nbAtraiter = sugg.filter(function (x) { return x.statut === "PROPOSEE"; }).length;
  const proc = tb && tb.processus ? tb.processus : (typeof processusDe === "function" ? processusDe(code) : "");
  const source = code === CODE_CR ? "comptes rendus de réunion (Notion)" : "boîte RH partagée";

  // En-tête
  const badges = [badge(st.cls || "b-slate", st.label)];
  if (d) badges.push(badge("b-violet", libReponse(d.reponse)));
  if (e) badges.push(badge(TDB_VERDICT[e.verdict][0], "Mesure : " + TDB_VERDICT[e.verdict][1].toLowerCase()));
  if (tdbAExaminer(p)) badges.push(badge("b-amber", "À examiner"));
  if (!t.actif) badges.push(badge("b-slate", "Type désactivé"));
  if (nbAtraiter) badges.push(badge("b-rose", nbAtraiter + " suggestion(s) de l'IA à traiter"));
  const tete = '<div class="card"><div class="fi-head"><div>' +
    '<div class="fi-title">' + esc(t.label) + "</div>" +
    '<div class="fi-meta">' + (proc ? "Processus : " + esc(proc) + " · " : "") + "Source : " + esc(source) + " · Code " + esc(code) + "</div>" +
    '<div class="fi-badges">' + badges.join("") + "</div></div>" +
    '<div class="fi-btns"><button class="btn" onclick="ficheDecider(\'' + code + '\')">Décider</button>' +
    (d && d.statut === "VALIDE" && !state.ficheStatique ? '<button class="btn fi-ghost" onclick="ficheVoirSpec(\'' + code + '\')">Voir la spécification</button>' : "") +
    "</div></div></div>";

  // Signaux
  const resume = '<div class="fi-sum"><span><b>' + p.total + "</b> signal(s) au total</span>" +
    (e ? "<span>Moyenne avant : <b>" + tdbFr(e.mAv, 1) + "</b> / semaine</span><span>Après : <b>" + tdbFr(e.mAp, 1) + "</b> / semaine</span><span>Verdict : <b>" + esc(TDB_VERDICT[e.verdict][1].toLowerCase()) + "</b></span>"
       : "<span>Pas de décision avec semaine d'effet : pas de mesure avant / après.</span>") + "</div>" +
    (p.reels && p.reels.length ? '<p class="note">Dont ' + p.reels.length + " mail(s) réel(s) sans semaine fictive, non placés sur le graphique.</p>" : "") +
    (code === CODE_CR && p.disponible === false ? '<p class="note">Comptes rendus indisponibles dans la base : compteur à zéro par défaut.</p>' : "");
  const signaux = '<div class="card"><div class="fi-h">Signaux par semaine</div>' + ficheGraphe(p, se) + resume + "</div>";

  // Type
  const def = tb && tb.definition ? tb.definition : "";
  const ex = tb && tb.exemple ? tb.exemple : "";
  const type = '<div class="card"><div class="fi-h">Ce que recouvre ce type</div>' +
    (def ? '<div style="font-size:14px">' + esc(def) + "</div>" : '<p class="note" style="margin:0">Définition ' + (state.ficheStatique ? "non incluse dans l'instantané." : "non renseignée dans la table des types.") + "</p>") +
    (ex ? '<div class="fi-ex"><b>Exemple (fictif) :</b> ' + esc(ex) + "</div>" : "") +
    '<p class="note" style="margin-top:8px">Définition et exemple tenus par le HRBP (onglet Types des irritants). Aucun extrait de mail réel n\'est affiché.</p></div>';

  // Décision
  const kv = function (k, v, fin) { return v ? "<dt>" + esc(k) + "</dt><dd" + (fin ? ' class="fin"' : "") + ">" + esc(v) + "</dd>" : ""; };
  const decision = '<div class="card"><div class="fi-h">Décision et réponse</div>' +
    (d ? '<dl class="fi-kv">' + kv("Statut", st.label) + kv("Réponse retenue", libReponse(d.reponse)) + kv("Effet à partir de", se ? "Semaine " + se : "") +
      kv("Commentaire", d.commentaire || "", true) + kv("Besoin", conf.besoin || conf.action || "", true) + kv("Sorties", conf.sorties || "", true) + kv("Indicateur", conf.indicateur || "", true) + "</dl>" +
      (e ? '<p class="note">Revue mensuelle : ' + badge(tdbRecommandation(d, e)[0], tdbRecommandation(d, e)[1]) + " " + esc(tdbRecommandation(d, e)[2]) + "</p>" : "")
       : '<p style="font-size:14px;margin:0">Aucune décision enregistrée.</p><p class="note">Proposition de l\'assistant : ' + esc(libReponse(conf.reco)) + (conf.action ? " : " + esc(conf.action) : "") + "</p>") + "</div>";

  // Suggestions de l'IA
  const libSt = { PROPOSEE: ["b-slate", "Proposée"], ACCEPTEE: ["b-emerald", "Acceptée"], REJETEE: ["b-slate", "Rejetée"] };
  // v22 : objections demandées avant décision (Valider et orienter), séparées des suggestions de revue.
  const avdFiche = function (c) {
    if (state.ficheStatique || typeof avdToutes !== "function") return "";
    const l = avdToutes(c).slice(0, 2).map(function (doc) {
      const r = avdLire(doc.texte); if (!r) return "";
      const cc = AVD_CONCLUSIONS[r.conclusion] || ["b-slate", "Conclusion non lisible"];
      return '<div class="fi-sug contra">' + badge("b-rose", "Objection avant décision") + " " + badge(cc[0], cc[1]) +
        (r.reponse ? " " + badge("b-violet", libReponse(r.reponse)) : "") + '<div class="a">' + esc(r.objection) + "</div>" +
        '<div class="tdb-sub">' + (doc.demande && doc.demande.toDate ? "Demandée le " + esc(doc.demande.toDate().toLocaleDateString("fr-FR")) + ". " : "") + "</div></div>";
    }).join("");
    return l ? '<div class="fi-h" style="margin-top:14px">Avant décision</div>' + l : "";
  };
  const ia = '<div class="card"><div class="fi-h">Suggestions de l\'IA sur cet irritant</div>' +
    (state.ficheStatique ? '<p class="note" style="margin:0">Pas de suggestion sur l\'instantané de démonstration.</p>'
     : !sugg.length ? '<p class="note" style="margin:0">Aucune suggestion pour l\'instant. Le contradicteur se lance depuis la Revue mensuelle.</p>'
     : sugg.slice(0, 4).map(function (x) {
        const ls = libSt[x.statut] || libSt.PROPOSEE;
        return '<div class="fi-sug' + (x.s.genre === "CONTRADICTION" ? " contra" : "") + '">' +
          badge(x.s.genre === "CONTRADICTION" ? "b-rose" : "b-violet", x.s.genre === "CONTRADICTION" ? "Contradiction" : "Action") + " " +
          badge(x.s.confiance === "HAUTE" ? "b-emerald" : x.s.confiance === "MOYENNE" ? "b-amber" : "b-slate", "Confiance " + x.s.confiance.toLowerCase()) + " " +
          badge(ls[0], ls[1] + (x.statut === "REJETEE" && x.motif ? " : " + x.motif : "")) +
          '<div class="a">' + esc(x.s.action) + "</div>" +
          '<div class="tdb-sub">' + (x.s.reponse !== "AUCUNE" && !(d && d.reponse === x.s.reponse) ? "Réponse proposée : " + esc(libReponse(x.s.reponse)) + ". " : "") +
          (x.date ? "Revue du " + esc(x.date.toLocaleDateString("fr-FR")) + "." : "") + "</div></div>";
      }).join("") + '<p class="note" style="margin-top:8px">Accepter ou rejeter se fait depuis la Revue mensuelle ; l\'IA n\'écrit jamais de décision.</p>') + avdFiche(code) + "</div>";

  // Historique reconstitué
  const ev = [];
  const semsSig = Object.keys(p.parSem).map(Number).filter(function (s) { return p.parSem[s]; }).sort(function (a, b) { return a - b; });
  if (semsSig.length) ev.push(["", "Premiers signaux", "Semaine " + semsSig[0] + " · " + p.parSem[semsSig[0]] + " signal(s) " + sourceDe(code)]);
  if (p.reels && p.reels.length) {
    const r = p.reels.slice().sort(function (a, b) { return a - b; });
    ev.push(["", "Signaux réels", r.length + " mail(s) reçu(s) entre le " + r[0].toLocaleDateString("fr-FR") + " et le " + r[r.length - 1].toLocaleDateString("fr-FR")]);
  }
  if (tdbAExaminer(p)) ev.push(["", "À examiner", "3 signaux ou plus sur les 2 dernières semaines observées (S" + (p.semMax - 1) + " et S" + p.semMax + ")"]);
  if (d) ev.push(["hum", "Décision du HRBP : " + st.label + ", " + libReponse(d.reponse),
    (d.maj && d.maj.toDate ? "Enregistrée le " + d.maj.toDate().toLocaleString("fr-FR") + " · " : "") + (se ? "effet à partir de la semaine " + se : "sans semaine d'effet")]);
  if (e && e.verdict !== "ATTENTE") ev.push(["", "Mesure après la décision : " + TDB_VERDICT[e.verdict][1].toLowerCase(),
    "Moyenne " + tdbFr(e.mAv, 1) + " par semaine avant, " + tdbFr(e.mAp, 1) + " après (" + e.nbAp + " semaine(s) observée(s) après)"]);
  else if (e) ev.push(["", "Mesure en attente", "Aucune semaine observée après la semaine " + se]);
  sugg.slice().reverse().forEach(function (x) {
    const suite = x.statut === "ACCEPTEE" ? "acceptée par le HRBP" : x.statut === "REJETEE" ? "rejetée par le HRBP" + (x.motif ? " (" + x.motif + ")" : "") : "en attente du HRBP";
    ev.push(["ia", "Revue IA : " + (x.s.genre === "CONTRADICTION" ? "remise en cause" : "action") + " " + suite,
      (x.date ? x.date.toLocaleDateString("fr-FR") + " · " : "") + x.s.action]);
  });
  const histo = '<div class="card" style="margin-top:12px"><div class="fi-h">Historique</div>' +
    (ev.length ? '<ul class="fi-tl">' + ev.map(function (x) { return '<li class="' + x[0] + '">' + esc(x[1]) + "<small>" + esc(x[2]) + "</small></li>"; }).join("") + "</ul>" : '<p class="note">Aucun événement pour l\'instant.</p>') +
    '<p class="note">Historique reconstitué à partir des données de la base. Seule la dernière décision est conservée : les décisions antérieures n\'apparaissent pas.</p></div>';

  const bandeau = state.ficheStatique ? '<div class="tdb-bandeau">Instantané de démonstration : données du jeu de démo et décisions d\'exemple, pas la base.</div>' : "";
  return retour + "<h2>Fiche irritant</h2>" + bandeau + tete +
    '<div class="fi-grid">' + signaux + type + "</div>" +
    '<div class="fi-grid">' + decision + ia + "</div>" + histo +
    '<p class="note">Cette fiche ne montre aucun mail, aucun expéditeur, aucun nom : seulement des agrégats et ce que le HRBP a décidé.</p>';
}
