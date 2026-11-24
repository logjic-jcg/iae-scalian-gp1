// ---------------------------------------------------------------------------
// v30 : onglet « Vue d'ensemble » du profil Direction (lecture seule, en direct)
// ---------------------------------------------------------------------------
// Tout est calculé depuis la base (signaux, décisions du HRBP, mesure avant / après).
// Pas de tonalité, de score de priorité ni de délai de traitement : la base ne les a pas.
// Pas de vue par équipe : aucune donnée d'équipe, aucune donnée sur une personne.
// La Direction voit ; le HRBP décide (pas de bouton « Décider » dans la fiche).
// ---------------------------------------------------------------------------

const VE_ETATS = {
  DETECTE:    ["Sans décision",    "#e11d48"],
  SURVEILLER: ["À surveiller",     "#d97706"],
  EN_PLACE:   ["Réponse en place", "#7c5cc4"],
  A_REVOIR:   ["À revoir",         "#b45309"],
  EFFICACE:   ["Efficace",         "#059669"],
};

// Tendance récente : dernière semaine observée vs moyenne des semaines précédentes.
// Moins de 3 signaux ou moins de 3 semaines : pas de tendance (trop peu pour conclure).
function veTendance(p) {
  const m = p.semMax || 0;
  if (m < 3) return { t: 0, lib: "recul insuffisant" };
  if (p.total < 3) return { t: 0, lib: "trop peu de signaux" };
  const rec = p.parSem[m] || 0;
  let av = 0; for (let s = 1; s < m; s++) av += p.parSem[s] || 0; av = av / (m - 1);
  const t = Math.max(-1, Math.min(1, (rec - av) / Math.max(av, rec, 0.5)));
  return { t: t, lib: t <= -0.2 ? "en baisse" : t >= 0.2 ? "en hausse" : "stable", rec: rec, av: av };
}
function veRecurrence(p) {
  const m = p.semMax || 0; let n = 0; for (let s = 1; s <= m; s++) if (p.parSem[s]) n++;
  return { n: n, sur: m };
}

function veLignes(sig) {
  return typesPilotage().map(function (t) { return t.code; })
    .filter(function (c) { return c !== "AUTRE" && sig.parCode[c] && sig.parCode[c].total > 0 && (typeof passeProcessus !== "function" || passeProcessus(c)); })
    .map(function (c) {
      const p = sig.parCode[c], d = decisionDe(c);
      return { code: c, label: libelleType(c), p: p, d: d, etat: suivColonne(c, p, d), tend: veTendance(p), rec: veRecurrence(p),
        source: c === CODE_CR ? "Comptes rendus" : "Boîte RH" };
    }).filter(function (l) { return l.etat && l.etat !== "ECARTE"; });
}

// v48 : seuil d'affichage sur la carte (lisibilité avec 80 types). Les irritants sous le seuil restent dans le
// tableau « Irritants à suivre » et dans le dossier envoyé à l'IA ; la carte dit combien ne sont pas dessinés.
const VE_SEUIL_CARTE = 4;
function veCarteFiltree(L) {
  const Lc = L.filter(function (l) { return l.p.total >= VE_SEUIL_CARTE; }), n = L.length - Lc.length;
  const note = n ? '<p class="note" style="margin:6px 0 0">' + n + " irritant" + (n > 1 ? "s" : "") + " à moins de " + VE_SEUIL_CARTE + " signaux " + (n > 1 ? "ne sont pas dessinés" : "n'est pas dessiné") + " : voir le tableau « Irritants à suivre ».</p>" : "";
  if (!Lc.length) return '<p class="note" style="margin:10px 0">Aucun irritant n\'atteint ' + VE_SEUIL_CARTE + " signaux pour l'instant.</p>" + note;
  return veCarte(Lc) + note;
}

// v48 : largeur réelle d'un nom (police du site, en unités de la carte) ; repli sur une estimation.
let veCanvas = null;
function veLargeurNom(t, fs) {
  try {
    veCanvas = veCanvas || document.createElement("canvas");
    const cx = veCanvas.getContext("2d");
    cx.font = "600 " + fs + "px " + getComputedStyle(document.body).fontFamily;
    const m = cx.measureText(t).width; if (m > 0) return m;
  } catch (e) { /* estimation ci-dessous */ }
  return t.length * 6.4;
}
function veCarte(L) {
  // v31 : carte pleine largeur (plus large sur ordinateur, plus haute en proportion sur mobile).
  const etroit = window.innerWidth < 760;
  const W = etroit ? 520 : 960, H = etroit ? 360 : 380, G = 56, R = 24, T = 22, B = 46;
  const maxRec = Math.max(1, Math.max.apply(null, L.map(function (l) { return l.rec.sur; })));
  const maxTot = Math.max(1, Math.max.apply(null, L.map(function (l) { return l.p.total; })));
  const X = function (t) { return G + (t + 1) / 2 * (W - G - R); };
  const Y = function (n) { return H - B - (n / maxRec) * (H - B - T); };
  let h = '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" role="img" aria-label="Carte des irritants : tendance et récurrence">';
  h += '<rect x="' + X(0) + '" y="' + T + '" width="' + (W - R - X(0)) + '" height="' + (Y(maxRec / 2) - T) + '" fill="#fdecef" opacity=".55"/>' +
       '<text x="' + (W - R - 6) + '" y="' + (T + 14) + '" text-anchor="end" font-size="11" font-weight="700" fill="#be123c">Récurrent et en hausse : agir</text>';
  [-1, 0, 1].forEach(function (v) { h += '<line x1="' + X(v) + '" y1="' + T + '" x2="' + X(v) + '" y2="' + (H - B) + '" stroke="' + (v ? "#f1edf7" : "#d9cdea") + '"' + (v ? "" : ' stroke-dasharray="4 3"') + "/>"; });
  for (let n = 0; n <= maxRec; n++) h += '<line x1="' + G + '" y1="' + Y(n) + '" x2="' + (W - R) + '" y2="' + Y(n) + '" stroke="#f1edf7"/><text x="' + (G - 8) + '" y="' + (Y(n) + 4) + '" text-anchor="end" font-size="11" fill="#8f87a3">' + n + "</text>";
  h += '<text x="' + X(-1) + '" y="' + (H - B + 18) + '" font-size="11" fill="#8f87a3">en baisse</text><text x="' + X(0) + '" y="' + (H - B + 18) + '" text-anchor="middle" font-size="11" fill="#8f87a3">stable</text><text x="' + X(1) + '" y="' + (H - B + 18) + '" text-anchor="end" font-size="11" fill="#8f87a3">en hausse</text>' +
       '<text x="' + ((G + W - R) / 2) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="11.5" font-weight="600" fill="#6b6280">Tendance : dernière semaine comparée aux précédentes</text>' +
       '<text transform="rotate(-90)" x="' + (-(T + H - B) / 2) + '" y="16" text-anchor="middle" font-size="11.5" font-weight="600" fill="#6b6280">Récurrence (semaines avec signal)</text>';
  // Positions, puis écartement des bulles qui se chevauchent (lisibilité seulement :
  // la position exacte reste dans l'infobulle et dans le tableau).
  const B2 = L.slice().sort(function (a, b) { return b.p.total - a.p.total; }).map(function (l) {
    return { l: l, r: 9 + 22 * Math.sqrt(l.p.total / maxTot), x: X(l.tend.t * 0.92), y: Y(l.rec.n) };
  });
  for (let k = 0; k < 60; k++) {
    B2.forEach(function (a, i) { B2.forEach(function (b, j) {
      if (j <= i) return;
      const dx = b.x - a.x, dy = b.y - a.y, dist = Math.sqrt(dx * dx + dy * dy) || 0.01, min = a.r + b.r + 3;
      if (dist < min) { const m = (min - dist) / 2, ux = dist > 0.01 ? dx / dist : 1, uy = dist > 0.01 ? dy / dist : 0;
        a.x -= ux * m; a.y -= uy * m * 0.5; b.x += ux * m; b.y += uy * m * 0.5; }
    }); });
    B2.forEach(function (o) { o.x = Math.max(G + o.r, Math.min(W - R - o.r, o.x)); o.y = Math.max(T + o.r, Math.min(H - B - o.r, o.y)); });
  }
  B2.forEach(function (o) {
    const l = o.l, col = VE_ETATS[l.etat][1], x = o.x, y = o.y, r = o.r;
    h += '<g class="ve-bulle" onclick="ouvrirFiche(\'' + l.code + '\', false)" tabindex="0"><title>' + esc(l.label + " : " + l.p.total + " signal(s), " + l.tend.lib + ", " + l.rec.n + " semaine(s) sur " + l.rec.sur + " · " + VE_ETATS[l.etat][0]) + "</title>" +
      '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r.toFixed(1) + '" fill="' + col + '" fill-opacity=".22" stroke="' + col + '" stroke-width="1.6"/>' +
      '<text x="' + x.toFixed(1) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="middle" font-size="12" font-weight="800" fill="#1a1030">' + l.p.total + "</text></g>";
  });
  // Noms courts à côté des bulles : première place libre parmi dessus, dessous, droite, gauche
  // et les diagonales (ni sur une autre bulle, ni sur un autre nom, ni hors du cadre).
  const pris = [], fs = 11, lh = 13; let traits = "", noms = "";
  const chevauche = function (b) {
    if (b.x0 < G || b.x1 > W - R || b.y0 < T || b.y1 > H - B) return true;
    if (pris.some(function (q) { return b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0; })) return true;
    return B2.some(function (o) { const cx = Math.max(b.x0, Math.min(o.x, b.x1)), cy = Math.max(b.y0, Math.min(o.y, b.y1)); return (cx - o.x) * (cx - o.x) + (cy - o.y) * (cy - o.y) < o.r * o.r; });
  };
  B2.forEach(function (o) {
    const nom = veNomCourt(o.l), w = veLargeurNom(nom, fs) + 8, d = o.r + 3;   // v48 : largeur mesurée (noms plus longs)
    const essais = [[0, -d - lh / 2], [0, d + lh / 2], [d + w / 2, 0], [-d - w / 2, 0], [d * 0.75 + w / 2, -d * 0.75 - lh / 2], [-d * 0.75 - w / 2, -d * 0.75 - lh / 2], [d * 0.75 + w / 2, d * 0.75 + lh / 2], [-d * 0.75 - w / 2, d * 0.75 + lh / 2], [0, -d - lh * 1.6], [0, d + lh * 1.6], [0, -d - lh * 2.8], [0, d + lh * 2.8], [d + w / 2, -lh * 1.4], [-d - w / 2, -lh * 1.4], [d + w / 2, lh * 1.4], [-d - w / 2, lh * 1.4]];
    // Petites bulles (souvent en rang serré) : d'abord à droite / à gauche, puis dessus / dessous.
    if (o.l.p.total < 3) essais.unshift(essais[2], essais[3]);
    let bx = null;
    for (let k = 0; k < essais.length && !bx; k++) {
      const cx = o.x + essais[k][0], cy = o.y + essais[k][1], b = { x0: cx - w / 2, x1: cx + w / 2, y0: cy - lh / 2, y1: cy + lh / 2, cx: cx, cy: cy };
      if (!chevauche(b)) bx = b;
    }
    // v48 : sinon, on éloigne le nom (dessus puis dessous, recadré dans la carte) avec un trait de rappel.
    const cxc = Math.max(G + w / 2, Math.min(W - R - w / 2, o.x));
    for (let k = 0; k < 10 && !bx; k++) [-1, 1].forEach(function (sg) {
      if (bx) return;
      const cy = o.y + sg * (d + lh * (0.5 + 1.15 * k)), b = { x0: cxc - w / 2, x1: cxc + w / 2, y0: cy - lh / 2, y1: cy + lh / 2, cx: cxc, cy: cy };
      if (!chevauche(b)) bx = b;
    });
    if (!bx) { const cy = o.y - d - lh / 2; bx = { x0: cxc - w / 2, x1: cxc + w / 2, y0: cy - lh / 2, y1: cy + lh / 2, cx: cxc, cy: cy }; }
    pris.push(bx);
    // Trait de rappel quand le nom n'est pas collé à sa bulle.
    const px = Math.max(bx.x0, Math.min(o.x, bx.x1)), py = Math.max(bx.y0, Math.min(o.y, bx.y1));
    const dx = px - o.x, dy = py - o.y, dist = Math.sqrt(dx * dx + dy * dy);
    if (dist - o.r > 6) traits += '<line x1="' + (o.x + dx / dist * o.r).toFixed(1) + '" y1="' + (o.y + dy / dist * o.r).toFixed(1) + '" x2="' + px.toFixed(1) + '" y2="' + py.toFixed(1) + '" stroke="#8f87a3" stroke-width="1"/>';
    noms += '<text class="ve-nom" x="' + bx.cx.toFixed(1) + '" y="' + (bx.cy + 4).toFixed(1) + '" text-anchor="middle" font-size="' + fs + '" font-weight="600" fill="#3b2a5c" onclick="ouvrirFiche(\'' + o.l.code + '\', false)">' + esc(nom) + "</text>";
  });
  h += traits + noms;
  h += "</svg>";
  const legende = '<div class="ve-leg">' + Object.keys(VE_ETATS).map(function (k) { return '<span><b style="background:' + VE_ETATS[k][1] + '"></b>' + esc(VE_ETATS[k][0]) + "</span>"; }).join("") + "<span>Taille = nombre de signaux</span></div>";
  return h + legende;
}

// Nom court pour la carte (les types sont pilotés par le métier : repli sur le libellé coupé).
const VE_NOMS_COURTS = { DOC_DISPERSEE: "Doc dispersée", DEMANDE_TARDIVE: "Support tardif", ANNONCE_INCOMPLETE: "Annonce incomplète",
  QUESTION_RECURRENTE: "Question récurrente", HORS_BOUCLE: "Hors boucle", PREMIER_JOUR_DEGRADE: "1er jour dégradé",
  PIECES_RENVOYEES: "Pièces renvoyées", ACTIONS_NON_FERMEES: "Actions non fermées" };
function veNomCourt(l) {
  if (VE_NOMS_COURTS[l.code]) return VE_NOMS_COURTS[l.code];
  // v48 : on retire le début générique des libellés importés (« Demande de », « Question sur le »…) avant de couper.
  let t = l.label.replace(/^(demande|question|signalement|déclaration|transmission|inscription)\s+(sur\s+)?(d'une?\s+|de la\s+|de l'|des\s+|du\s+|de\s+|d'|la\s+|le\s+|les\s+|l'|à une?\s+|à\s+)?/i, "");
  if (t.length < 4) t = l.label;
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return t.length > 26 ? t.slice(0, 25).replace(/\s+\S*$/, "").replace(/(\s+(et|ou|de|des|du|d'|à|la|le|les|en|pour))+$/i, "") + "…" : t;
}

function veSpark(p) {
  const m = p.semMax || 0, w = 64, hh = 22; if (m < 2) return "";
  let max = 1; for (let s = 1; s <= m; s++) max = Math.max(max, p.parSem[s] || 0);
  const pts = []; for (let s = 1; s <= m; s++) pts.push(((s - 1) * (w / (m - 1))).toFixed(1) + "," + (hh - 2 - ((p.parSem[s] || 0) / max) * (hh - 5)).toFixed(1));
  return '<svg width="' + w + '" height="' + hh + '" viewBox="0 0 ' + w + " " + hh + '" aria-hidden="true"><polyline fill="none" stroke="#4b2882" stroke-width="1.8" points="' + pts.join(" ") + '"/></svg>';
}

function viewVueEnsemble() {
  if (state.ficheCode) {
    // Fiche en lecture seule : pas de « Décider » ni de lien vers la spécification.
    return viewFicheIrritant().replace(/<div class="fi-btns">[\s\S]*?<\/div><\/div><\/div>/, "</div></div>");
  }
  const sig = aciaSignaux();
  if (!sig.ok) return messageSansBase("Vue d'ensemble", sig);
  const L = veLignes(sig);
  const n = function (e) { return L.filter(function (l) { return l.etat === e; }).length; };
  const aExam = L.filter(function (l) { return !l.d && aExaminer(l.p); }).length;
  const enPlace = n("EN_PLACE") + n("A_REVOIR") + n("EFFICACE");
  const mesures = n("A_REVOIR") + n("EFFICACE");
  const tuile = function (ic, titre, v, sous, cls) {
    return '<div class="kpi"><div class="kpi-h">' + tendIcone(ic) + '<div class="spechead">' + esc(titre) + '</div></div><div class="kv">' + esc(v) + '</div><div class="irrdetail" style="margin-top:4px">' + sous + "</div></div>";
  };
  const kpis = '<div class="kpis ve-kpis">' +
    tuile("drapeau", "Irritants signalés", String(L.length), "Boîte RH et comptes rendus, hors « Autre » et écartés") +
    tuile("loupe", "À examiner sans décision", String(aExam), aExam ? badge("b-rose", "À traiter par le HRBP") : badge("b-emerald", "Aucun en attente")) +
    tuile("liste", "Réponses en place", String(enPlace), "Décisions validées par le HRBP") +
    tuile("courbe", "Réponses efficaces", n("EFFICACE") + " / " + mesures, mesures ? "Parmi les réponses déjà mesurables (baisse de 20 % ou plus)" : "Aucune réponse encore mesurable") +
    // v43 : répartition des réponses retenues par le HRBP (base decisions_hrbp, hors écartées) : agent IA (Assister) ou sans IA (Simplifier, Automatiser).
    (function () {
      const fbD = window.ACIA_FB.decisions_hrbp;
      const rep = fbD && fbD.statut === "ok" ? fbD.docs.filter(function (x) { return x.statut !== "ECARTE" && x.reponse; }) : [];
      const ag = rep.filter(function (x) { return x.reponse === "ASSISTER"; }).length, sans = rep.length - ag;
      return tuile("bouclier", "Réponses retenues", rep.length ? ag + " agent" + (ag > 1 ? "s" : "") + " · " + sans + " sans IA" : "—",
        rep.length ? "La réponse la plus simple qui suffit" : "Aucune réponse retenue par le HRBP");
    })() + "</div>";
  const totMail = L.filter(function (l) { return l.code !== CODE_CR; }).reduce(function (t, l) { return t + l.p.total; }, 0);
  const totCR = L.filter(function (l) { return l.code === CODE_CR; }).reduce(function (t, l) { return t + l.p.total; }, 0);
  const tot = Math.max(1, totMail + totCR), pM = Math.round(100 * totMail / tot), pC = 100 - pM;
  const barre = function (lib, v, pct, col) { return '<div class="ve-src"><div><span>' + esc(lib) + "</span><b>" + v + " signal(s) · " + pct + ' %</b></div><div class="ve-bar"><i style="width:' + pct + "%;background:" + col + '"></i></div></div>'; };
  const sources = '<div class="card" style="margin-top:16px"><div class="kpi-h">' + tendIcone("mail") + '<div class="spechead">Répartition par source</div></div>' +
    '<p class="note" style="margin:4px 0 12px">Part des signaux par origine. Chaque type d\'irritant vient d\'une seule source.</p>' +
    barre("Boîte RH partagée (mails)", totMail, pM, "#4b2882") + barre("Comptes rendus de réunion", totCR, pC, "#61b99a") +
    '<p class="note">Données de démonstration du hackathon : les volumes sont faibles, les tendances à lire avec prudence.</p></div>';
  const tri = L.slice().sort(function (a, b) { return (aExaminer(b.p) && !b.d) - (aExaminer(a.p) && !a.d) || b.p.total - a.p.total; });
  const table = '<div class="card"><div class="kpi-h">' + tendIcone("etiquette") + '<div class="spechead">Irritants à suivre</div></div>' +
    '<p class="note" style="margin:4px 0 8px">Les irritants à examiner sans décision d\'abord, puis par nombre de signaux. Clic sur un nom pour ouvrir sa fiche.</p>' +
    '<div class="tw"><table class="ve-table"><thead><tr><th>Irritant</th><th>Signaux</th><th>Évolution</th><th>État</th><th>Réponse retenue</th></tr></thead><tbody>' +
    tri.map(function (l) {
      return "<tr><td><b>" + lienFiche(l.code, esc(l.label)) + "</b>" + (l.code === CODE_CR ? ' <small class="tdb-sub">comptes rendus</small>' : "") + (!l.d && aExaminer(l.p) ? " " + badge("b-rose", "À examiner") : "") + "</td><td>" + l.p.total + "</td><td>" + veSpark(l.p) + ' <span class="tdb-sub">' + esc(l.tend.lib) + "</span></td>" +
        '<td><span class="ve-etat" style="--c:' + VE_ETATS[l.etat][1] + '">' + esc(VE_ETATS[l.etat][0]) + "</span></td><td>" + (l.d ? esc(libReponse(l.d.reponse)) : '<span class="tdb-sub">—</span>') + "</td></tr>";
    }).join("") + "</tbody></table></div></div>";
  return "<h2>Vue d'ensemble des irritants</h2>" +
    '<p class="note" style="margin:-4px 0 12px">' + badge("b-emerald", "● En direct") + " Lecture seule : la Direction voit les tendances, le HRBP décide. Agrégats par type d'irritant, aucune donnée sur une personne ni sur une équipe.</p>" +
    kpis +
    '<div class="card ve-carte" style="margin-top:16px"><div class="kpi-h">' + tendIcone("courbe") + '<div class="spechead">Carte des irritants</div></div>' +
    '<p class="note" style="margin:4px 0 6px">Plus une bulle est à droite, plus l\'irritant progresse ; plus elle est haute, plus il revient souvent. Seuls les irritants à ' + VE_SEUIL_CARTE + ' signaux ou plus sont dessinés. Clic sur une bulle ou sur un nom : fiche de l\'irritant.</p>' + veCarteFiltree(L) + "</div>" +
    // v43 : « Répartition par source » avant « Irritants à suivre », pleine largeur ; « Pour en parler avec l'équipe » a son propre onglet.
    sources + '<div style="margin-top:16px">' + table + "</div>";
}

// v43 : onglet dédié « Pour en parler avec l'équipe » (profil Direction), à droite de la Vue d'ensemble.
function viewVedOnglet() {
  const sig = aciaSignaux();
  if (!sig.ok) return messageSansBase("Pour en parler avec l’équipe", sig);
  return "<h2>Pour en parler avec l’équipe</h2>" +
    '<p class="note" style="margin:-4px 0 12px">' + badge("b-emerald", "● En direct") + " L’IA ne reçoit que les agrégats de la Vue d’ensemble (par type d’irritant), jamais de mail, de nom ni de donnée sur une équipe.</p>" +
    vedCarte(veLignes(sig));
}

// ---------------------------------------------------------------------------
// v31 : « Pour en parler avec l'équipe » : l'IA propose au DRH 3 sujets d'échange
// avec ses HRBP, à partir des SEULS agrégats affichés sur cette page.
// Site → webhook Make (« ACIA : conseils Direction ») → Claude Haiku →
// Firestore suggestions_ia/x{date}, type DIRECTION. 1 demande par minute au plus.
// Format : SUJET|titre|constat|question (1 à 3)  VIGILANCE|…  CONFIANCE|…
// ---------------------------------------------------------------------------
const VED_WEBHOOK = "https://hook.eu1.make.com/jfq7waurc1ppszb88v8c3uchs8p3z7k9";
state.ved = state.ved || { envoi: "", msg: "", depuis: 0 };

function vedDossier(L) {
  const m = L.reduce(function (x, l) { return Math.max(x, l.p.semMax || 0); }, 0);
  const fbD = window.ACIA_FB.decisions_hrbp;
  const rep = fbD && fbD.statut === "ok" ? fbD.docs.filter(function (x) { return x.statut !== "ECARTE" && x.reponse; }) : [];
  const part = rep.length ? Math.round(100 * rep.filter(function (x) { return x.reponse === "ASSISTER"; }).length / rep.length) : null;
  const D = ["CONTEXTE|irritants suivis : " + L.length + "|semaines observées : " + m + "|réponses faisant appel à un agent IA : " + (part === null ? "aucune réponse retenue" : part + " %") +
    "|cible maximale : " + (typeof TDB_CIBLE_AGENT !== "undefined" ? TDB_CIBLE_AGENT : 30) + " %"];
  L.forEach(function (l) {
    const sem = []; for (let s = 1; s <= (l.p.semMax || 0); s++) sem.push("S" + s + "=" + (l.p.parSem[s] || 0));
    let effet = "";
    if (l.d && l.d.semaine_effet && typeof tdbEffet === "function" && l.etat !== "SURVEILLER") {
      const e = tdbEffet(l.p, Number(l.d.semaine_effet));
      if (e.mAv !== null && e.mAp !== null) effet = "|mesure : " + tdbFr(e.mAv, 1) + " signal(s) par semaine avant S" + l.d.semaine_effet + ", " + tdbFr(e.mAp, 1) + " après";
    }
    D.push("IRRITANT|" + l.label + "|signaux : " + l.p.total + "|par semaine : " + (sem.join(" ") || "aucune") + "|tendance : " + l.tend.lib +
      "|récurrence : " + l.rec.n + " semaine(s) sur " + l.rec.sur + "|état : " + VE_ETATS[l.etat][0].toLowerCase() +
      "|réponse retenue : " + (l.d ? libReponse(l.d.reponse) : "aucune") + effet);
  });
  return D.join("\n").replace(/\r/g, "");
}

function vedDerniere() {
  const fb = window.ACIA_FB.suggestions_ia;
  if (!fb || fb.statut !== "ok") return null;
  const t = function (d) { return d.demande && d.demande.toDate ? d.demande.toDate().getTime() : 0; };
  const docs = fb.docs.filter(function (d) { return d.type === "DIRECTION" && String(d.id).indexOf("test") !== 0; });
  return docs.length ? docs.sort(function (a, b) { return t(b) - t(a); })[0] : null;
}

function vedLire(texte) {
  const r = { sujets: [], vigilance: "", confiance: "BASSE" };
  String(texte || "").split(/\r?\n/).forEach(function (l) {
    const c = l.split("|").map(function (x) { return x.trim(); }), k = (c[0] || "").toUpperCase().replace(/[^A-Z]/g, "");
    if (k === "SUJET" && c.length >= 4 && r.sujets.length < 3) r.sujets.push({ titre: c[1].slice(0, 80), constat: c[2].slice(0, 260), question: c.slice(3).join(" ").slice(0, 240) });
    else if (k === "VIGILANCE" && !r.vigilance) r.vigilance = c.slice(1).join(" ").slice(0, 240);
    else if (k === "CONFIANCE") { const m = (c[1] || "").toUpperCase().match(/HAUTE|MOYENNE|BASSE/); if (m) r.confiance = m[0]; }
  });
  return r.sujets.length ? r : null;
}

function vedLancer() {
  const der = vedDerniere();
  const ilya = der && der.demande && der.demande.toDate ? Date.now() - der.demande.toDate().getTime() : Infinity;
  if (ilya < 60000 || Date.now() - (state.ved.depuis || 0) < 60000) {
    state.ved = { envoi: "", msg: "Des suggestions ont été demandées il y a moins d'une minute : attendez avant de relancer.", depuis: state.ved.depuis }; render(); return;
  }
  const sig = aciaSignaux();
  if (!sig.ok) { state.ved = { envoi: "", msg: "Données de la base indisponibles.", depuis: 0 }; render(); return; }
  const dossier = vedDossier(veLignes(sig));
  state.ved = { envoi: "attente", msg: "Demande envoyée. Les suggestions s'afficheront ici dans une trentaine de secondes.", depuis: Date.now() }; render();
  fetch(VED_WEBHOOK, { method: "POST", mode: "no-cors", body: new URLSearchParams({ dossier: dossier, origine: "site ACIA" }) })
    .catch(function (e) { state.ved.envoi = ""; state.ved.msg = "Envoi impossible : " + ((e && e.message) || e); render(); });
  const debut = state.ved.depuis;
  setTimeout(function () {
    if (state.ved.envoi === "attente" && state.ved.depuis === debut) { state.ved.envoi = ""; state.ved.msg = "Pas de suggestion reçue après 90 secondes : réessayez dans un instant."; render(); }
  }, 90000);
}

function vedCarte(L) {
  const fb = window.ACIA_FB.suggestions_ia, der = vedDerniere();
  if (state.ved.depuis && der && der.demande && der.demande.toDate && der.demande.toDate().getTime() >= state.ved.depuis - 5000) { state.ved.envoi = ""; state.ved.msg = ""; state.ved.depuis = 0; }
  const attente = state.ved.envoi === "attente";
  const bouton = '<button class="btn slim" ' + (attente || !L.length ? "disabled" : "") + ' onclick="vedLancer()">' + (attente ? "Suggestions en cours…" : der ? "Relancer les suggestions" : "Suggérer des sujets d’échange") + "</button>";
  const r = der ? vedLire(der.texte) : null;
  let corps;
  if (!fb || fb.statut === "chargement") corps = '<p class="note">Lecture des suggestions…</p>';
  else if (fb.statut !== "ok") corps = '<p class="note">Suggestions indisponibles : ' + esc(fb.erreur || "") + "</p>";
  else if (!der) corps = '<p class="note">Avant votre point avec les HRBP, demandez à l’IA les sujets qui méritent un échange : irritants qui reviennent, réponses à revoir, enseignements à partager.</p>';
  else if (!r) corps = '<p class="note">La dernière réponse de l’IA ne respecte pas le format attendu : relancez les suggestions.</p>';
  else {
    const dansDossier = String(der.entree || "").match(/\d+(?:,\d+)?/g) || [];
    const tout = r.sujets.map(function (x) { return x.constat + " " + x.question; }).join(" ") + " " + r.vigilance;
    const hors = der.entree ? (tout.match(/\d+(?:,\d+)?/g) || []).filter(function (n, i, t) { return t.indexOf(n) === i && dansDossier.indexOf(n) < 0; }) : [];
    corps = '<ol class="ved-l">' + r.sujets.map(function (x) {
      return "<li><b>" + esc(x.titre) + '</b><span class="ved-c">' + esc(x.constat) + '</span><span class="ved-q">' + esc(x.question) + "</span></li>";
    }).join("") + "</ol>" +
      (r.vigilance ? '<p class="note"><b>Vigilance :</b> ' + esc(r.vigilance) + "</p>" : "") +
      '<p class="note">' + badge(r.confiance === "HAUTE" ? "b-emerald" : r.confiance === "MOYENNE" ? "b-amber" : "b-slate", "Confiance " + r.confiance.toLowerCase()) +
      " Suggestions du " + esc(der.demande && der.demande.toDate ? der.demande.toDate().toLocaleString("fr-FR") : "?") + ". L’IA ne reçoit que les agrégats de cette page ; elle peut se tromper.</p>" +
      (hors.length ? '<p class="note">' + badge("b-rose", "Attention") + " Nombre(s) absent(s) des données envoyées : " + esc(hors.join(", ")) + ". Ne pas s’y fier.</p>" : "");
  }
  return '<div class="card ved-card"><div class="kpi-h">' + tendIcone("groupe") + '<div class="spechead">Pour en parler avec l’équipe ' + badge("b-violet", "IA") + "</div></div>" +
    '<p class="tdb-sub" style="margin:4px 0 10px">Des sujets et des questions ouvertes pour votre prochain échange avec les HRBP. L’IA suggère ; les HRBP décident des réponses.</p>' +
    '<div class="rv-actions" style="margin:0 0 10px">' + bouton + "</div>" +
    (state.ved.msg ? '<p class="note">' + esc(state.ved.msg) + "</p>" : "") + corps + "</div>";
}
