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

function veCarte(L) {
  const W = 640, H = 330, G = 56, R = 24, T = 22, B = 46;
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
    const nom = veNomCourt(o.l), w = nom.length * 6.1 + 4, d = o.r + 3;
    const essais = [[0, -d - lh / 2], [0, d + lh / 2], [d + w / 2, 0], [-d - w / 2, 0], [d * 0.75 + w / 2, -d * 0.75 - lh / 2], [-d * 0.75 - w / 2, -d * 0.75 - lh / 2], [d * 0.75 + w / 2, d * 0.75 + lh / 2], [-d * 0.75 - w / 2, d * 0.75 + lh / 2], [0, -d - lh * 1.6], [0, d + lh * 1.6]];
    // Petites bulles (souvent en rang serré) : d'abord à droite / à gauche, puis dessus / dessous.
    if (o.l.p.total < 3) essais.unshift(essais[2], essais[3]);
    let bx = null;
    for (let k = 0; k < essais.length && !bx; k++) {
      const cx = o.x + essais[k][0], cy = o.y + essais[k][1], b = { x0: cx - w / 2, x1: cx + w / 2, y0: cy - lh / 2, y1: cy + lh / 2, cx: cx, cy: cy };
      if (!chevauche(b)) bx = b;
    }
    if (!bx) { const cx = Math.max(G + w / 2, Math.min(W - R - w / 2, o.x)), cy = o.y - d - lh / 2; bx = { x0: cx - w / 2, x1: cx + w / 2, y0: cy - lh / 2, y1: cy + lh / 2, cx: cx, cy: cy }; }
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
  return l.label.length > 20 ? l.label.slice(0, 19).replace(/\s+\S*$/, "") + "…" : l.label;
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
    tuile("courbe", "Réponses efficaces", n("EFFICACE") + " / " + mesures, mesures ? "Parmi les réponses déjà mesurables (baisse de 20 % ou plus)" : "Aucune réponse encore mesurable") + "</div>";
  const totMail = L.filter(function (l) { return l.code !== CODE_CR; }).reduce(function (t, l) { return t + l.p.total; }, 0);
  const totCR = L.filter(function (l) { return l.code === CODE_CR; }).reduce(function (t, l) { return t + l.p.total; }, 0);
  const tot = Math.max(1, totMail + totCR), pM = Math.round(100 * totMail / tot), pC = 100 - pM;
  const barre = function (lib, v, pct, col) { return '<div class="ve-src"><div><span>' + esc(lib) + "</span><b>" + v + " signal(s) · " + pct + ' %</b></div><div class="ve-bar"><i style="width:' + pct + "%;background:" + col + '"></i></div></div>'; };
  const sources = '<div class="card"><div class="kpi-h">' + tendIcone("mail") + '<div class="spechead">Répartition par source</div></div>' +
    '<p class="note" style="margin:4px 0 12px">Part des signaux par origine. Chaque type d\'irritant vient d\'une seule source.</p>' +
    barre("Boîte RH partagée (mails)", totMail, pM, "#4b2882") + barre("Comptes rendus de réunion", totCR, pC, "#61b99a") +
    '<p class="note">Données de démonstration du hackathon : les volumes sont faibles, les tendances à lire avec prudence.</p></div>';
  const tri = L.slice().sort(function (a, b) { return (aExaminer(b.p) && !b.d) - (aExaminer(a.p) && !a.d) || b.p.total - a.p.total; });
  const table = '<div class="card" style="margin-top:16px"><div class="kpi-h">' + tendIcone("etiquette") + '<div class="spechead">Irritants à suivre</div></div>' +
    '<p class="note" style="margin:4px 0 8px">Les irritants à examiner sans décision d\'abord, puis par nombre de signaux. Clic sur un nom pour ouvrir sa fiche.</p>' +
    '<div class="tw"><table class="ve-table"><thead><tr><th>Irritant</th><th>Signaux</th><th>Évolution</th><th>Source</th><th>État</th><th>Réponse retenue</th></tr></thead><tbody>' +
    tri.map(function (l) {
      return "<tr><td><b>" + lienFiche(l.code, esc(l.label)) + "</b>" + (!l.d && aExaminer(l.p) ? " " + badge("b-rose", "À examiner") : "") + "</td><td>" + l.p.total + "</td><td>" + veSpark(l.p) + ' <span class="tdb-sub">' + esc(l.tend.lib) + "</span></td><td>" + esc(l.source) +
        '</td><td><span class="ve-etat" style="--c:' + VE_ETATS[l.etat][1] + '">' + esc(VE_ETATS[l.etat][0]) + "</span></td><td>" + (l.d ? esc(libReponse(l.d.reponse)) : '<span class="tdb-sub">—</span>') + "</td></tr>";
    }).join("") + "</tbody></table></div></div>";
  return "<h2>Vue d'ensemble des irritants</h2>" +
    '<p class="note" style="margin:-4px 0 12px">' + badge("b-emerald", "● En direct") + " Lecture seule : la Direction voit les tendances, le HRBP décide. Agrégats par type d'irritant, aucune donnée sur une personne ni sur une équipe.</p>" +
    kpis +
    '<div class="ve-duo"><div class="card"><div class="kpi-h">' + tendIcone("courbe") + '<div class="spechead">Carte des irritants</div></div>' +
    '<p class="note" style="margin:4px 0 6px">Plus une bulle est à droite, plus l\'irritant progresse ; plus elle est haute, plus il revient souvent. Clic sur une bulle : fiche de l\'irritant.</p>' + veCarte(L) + "</div>" + sources + "</div>" + table;
}
