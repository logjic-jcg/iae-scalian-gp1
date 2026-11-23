// v45 : onglet Direction « Pilotage et ROI » (structure inspirée de l'onglet « 6. Pilotage »
// de la démonstration hors ligne ; aucun de ses chiffres n'est repris : autre cas d'usage).
// Trois sortes de valeurs, toujours étiquetées : MESURÉ (base), SAISI (Revue des agents IA), HYPOTHÈSE
// (saisie dans cette page par la Direction, non enregistrée). Aucune valeur par défaut.

state.roi = state.roi || { taux: "", minutes: "", credit: "", claude: "", autres: "", build: "" };
const ROI_SEM_PAR_MOIS = 52 / 12;
const ROI_CREDITS = { mail: 47 / 22, cr: 62 / 8, date: "20/11/2026" };   // mesures du 20/11 (TDB_MESURES)

function roiNum(k) { const t = String(state.roi[k] || "").replace(/\s/g, "").replace(",", "."); if (t === "") return null; const v = parseFloat(t); return isFinite(v) && v >= 0 ? v : null; }
function roiSet(k, v) { state.roi[k] = v; render(); }
function roiEur(v) { return v === null ? "—" : Math.round(v).toLocaleString("fr-FR") + " €"; }
function roiH(v) { return v === null ? "—" : tdbFr(v, 1) + " h"; }

// Temps gagné : baisse mesurée des signaux après chaque réponse validée × minutes par signal évité (hypothèse).
function roiCalcul() {
  const sig = aciaSignaux();
  const lignes = typesPilotage().map(function (t) {
    const d = decisionDe(t.code), p = sig.parCode[t.code];
    if (!d || d.statut !== "VALIDE" || !p || !d.semaine_effet) return null;
    const e = tdbEffet(p, Number(d.semaine_effet));
    if (e.mAv === null || e.mAp === null) return { code: t.code, label: t.label, rep: d.reponse, e: e, evites: null };
    return { code: t.code, label: t.label, rep: d.reponse, e: e, evites: Math.max(0, e.mAv - e.mAp) * ROI_SEM_PAR_MOIS };
  }).filter(Boolean);
  const evites = lignes.reduce(function (s, l) { return s + (l.evites || 0); }, 0);
  const minutes = roiNum("minutes"), taux = roiNum("taux");
  const heures = minutes === null ? null : evites * minutes / 60;
  const valeur = heures === null || taux === null ? null : heures * taux;
  // Volumes mensuels mesurés (moyenne par semaine observée).
  const fbm = window.ACIA_FB.classement_mails, fbc = window.ACIA_FB.comptes_rendus;
  const semMails = Math.max(1, sig.semMax || 1);
  const mailsMois = fbm && fbm.statut === "ok" ? fbm.docs.length / semMails * ROI_SEM_PAR_MOIS : null;
  const crDocs = fbc && fbc.statut === "ok" ? fbc.docs.filter(function (d) { return d.statut === "ANALYSE"; }) : [];
  const semCR = Math.max(1, (sig.parCode[CODE_CR] && sig.parCode[CODE_CR].semMax) || 1);
  const crMois = crDocs.length / semCR * ROI_SEM_PAR_MOIS;
  const credits = mailsMois === null ? null : mailsMois * ROI_CREDITS.mail + crMois * ROI_CREDITS.cr;
  const prix = roiNum("credit"), claude = roiNum("claude"), autres = roiNum("autres"), build = roiNum("build");
  const coutMake = credits === null || prix === null ? null : credits * prix;
  const cout = [coutMake, claude, autres, build].some(function (x) { return x === null; }) ? null : coutMake + claude + autres + build / 24;
  const roi = valeur === null || cout === null || cout <= 0 ? null : (valeur - cout) / cout;
  return { sig: sig, lignes: lignes, evites: evites, heures: heures, valeur: valeur, mailsMois: mailsMois, crMois: crMois, credits: credits, coutMake: coutMake, cout: cout, roi: roi };
}

function roiSaisies() {
  const fb = window.ACIA_FB.revues_agents, docs = fb && fb.statut === "ok" ? fb.docs : [];
  const der = {}; docs.forEach(function (r) { if (!der[r.code] || r.mois > der[r.code].mois) der[r.code] = r; });
  const L = Object.keys(der).map(function (k) { return der[k]; });
  const moy = function (k) { const v = L.map(function (r) { return r[k]; }).filter(function (x) { return typeof x === "number"; }); return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null; };
  return { n: L.length, incidents: docs.filter(function (r) { return r.incident; }).length, satisfaction: moy("satisfaction"), sansModif: moy("sans_modif") };
}

function viewPilotageRoi() {
  const sig = aciaSignaux();
  if (!sig.ok) return messageSansBase("Pilotage et ROI", sig);
  const R = roiCalcul(), Q = roiSaisies();
  const fbD = window.ACIA_FB.decisions_hrbp;
  const rep = fbD && fbD.statut === "ok" ? fbD.docs.filter(function (x) { return x.statut !== "ECARTE" && x.reponse; }) : [];
  const partAgent = rep.length ? Math.round(100 * rep.filter(function (x) { return x.reponse === "ASSISTER"; }).length / rep.length) : null;
  const src = function (t) { return { "mesuré": "b-emerald", "saisi": "b-slate", "hypothèse": "b-amber", "non mesuré": "b-slate" }[t] ? badge({ "mesuré": "b-emerald", "saisi": "b-slate", "hypothèse": "b-amber", "non mesuré": "b-slate" }[t], t) : t; };
  const tuile = function (ic, titre, v, sous, b) {
    return '<div class="kpi"><div class="kpi-h">' + tendIcone(ic) + '<div class="spechead">' + esc(titre) + '</div></div><div class="kv">' + esc(v) + '</div><div class="irrdetail" style="margin-top:4px">' + sous + "</div>" + (b ? '<div style="margin-top:6px">' + b + "</div>" : "") + "</div>";
  };
  const kpis = '<div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">' +
    tuile("horloge", "Temps gagné estimé", R.heures === null ? "—" : roiH(R.heures) + " / mois", tdbFr(R.evites, 1) + " signal(s) évité(s) par mois × minutes par signal", R.heures === null ? badge("b-amber", "Hypothèse à saisir") : src("hypothèse")) +
    tuile("etiquette", "Coût mensuel", roiEur(R.cout), "Make + Claude + autres + mise en place ÷ 24", R.cout === null ? badge("b-amber", "Coûts à saisir") : "") +
    tuile("courbe", "Retour sur investissement", R.roi === null ? "—" : Math.round(100 * R.roi) + " %", "(valeur du temps gagné − coût) ÷ coût", R.roi === null ? badge("b-slate", "À calculer") : badge(R.roi >= 0 ? "b-emerald" : "b-rose", R.roi >= 0 ? "Valeur supérieure au coût" : "Coût supérieur à la valeur")) +
    tuile("bouclier", "Incidents des agents IA", String(Q.incidents), Q.n ? "Saisis dans la Revue des agents IA" : "Aucune revue d'agent saisie", Q.incidents ? badge("b-rose", "À traiter") : badge("b-emerald", "Aucun")) + "</div>";

  const champ = function (k, lib, aide) {
    return '<label class="fl">' + esc(lib) + '<input inputmode="decimal" placeholder="à saisir" value="' + esc(state.roi[k]) + '" onchange="roiSet(\'' + k + '\', this.value)"></label>' + (aide ? '<div class="tdb-sub" style="margin-top:2px">' + aide + "</div>" : "");
  };
  const hypo = '<div class="card"><div class="kpi-h">' + tendIcone("liste") + '<div class="spechead">Hypothèses ' + badge("b-amber", "non enregistrées") + "</div></div>" +
    '<p class="note" style="margin:4px 0 0">Aucune valeur n\'est proposée : à fournir par le contrôle de gestion et la DSI. Elles restent dans cette page et disparaissent à la fermeture.</p>' +
    champ("taux", "Coût horaire chargé (€ / h)", "") +
    champ("minutes", "Minutes gagnées par signal évité", "Temps moyen de traitement d'un mail ou d'une action de réunion évité") +
    champ("credit", "Prix d'un crédit Make (€)", "Selon l'offre souscrite") +
    champ("claude", "Coût mensuel de Claude (€)", "") +
    champ("autres", "Autres coûts mensuels (€)", "Hébergement, maintenance, temps d'administration") +
    champ("build", "Coût de mise en place (€)", "Amorti sur 24 mois") + "</div>";
  const kv = function (k, v, s) { return "<tr><td>" + esc(k) + "</td><td><b>" + v + "</b>" + (s ? " " + s : "") + "</td></tr>"; };
  const calc = '<div class="card"><div class="kpi-h">' + tendIcone("courbe") + '<div class="spechead">Calcul du retour sur investissement</div></div>' +
    '<table class="ra-t" style="margin-top:8px"><tbody>' +
    kv("Signaux évités par mois", tdbFr(R.evites, 1), src("mesuré")) +
    kv("Temps gagné par mois", R.heures === null ? "—" : tdbFr(R.evites, 1) + " × " + esc(state.roi.minutes) + " min = " + roiH(R.heures), src("hypothèse")) +
    kv("Valeur mensuelle du temps gagné", R.valeur === null ? "—" : roiH(R.heures) + " × " + esc(state.roi.taux) + " € = " + roiEur(R.valeur), src("hypothèse")) +
    kv("Volume traité par mois", R.mailsMois === null ? "—" : tdbFr(R.mailsMois, 0) + " mails, " + tdbFr(R.crMois, 0) + " comptes rendus", src("mesuré")) +
    kv("Crédits Make par mois", R.credits === null ? "—" : "≈ " + tdbFr(R.credits, 0), src("mesuré")) +
    kv("Coût Make par mois", roiEur(R.coutMake), src("hypothèse")) +
    kv("Coût mensuel total", roiEur(R.cout), "") +
    kv("Retour sur investissement", R.roi === null ? "—" : Math.round(100 * R.roi) + " %", "") + "</tbody></table>" +
    '<p class="note">Crédits par mail et par compte rendu mesurés le ' + ROI_CREDITS.date + " avec 9 types d'irritants ; avec les types ajoutés depuis, le coût par mail est probablement plus élevé (non mesuré). Seul le temps lié à des signaux évités est compté ; le gain de qualité (premiers jours réussis) n'est pas valorisé.</p></div>";

  const detail = '<div class="card" style="margin-top:16px"><div class="kpi-h">' + tendIcone("etiquette") + '<div class="spechead">D\'où vient le temps gagné</div></div>' +
    (R.lignes.length ? '<div class="tw" style="margin-top:8px"><table><thead><tr><th>Irritant</th><th>Réponse</th><th class="c">Avant</th><th class="c">Après</th><th class="c">Signaux évités / mois</th></tr></thead><tbody>' +
      R.lignes.map(function (l) { return "<tr><td>" + esc(l.label) + "</td><td>" + (typeof specIcone === "function" ? specIcone(l.rep, 20) + " " : "") + esc(libReponse(l.rep)) + '</td><td class="c">' + tdbFr(l.e.mAv, 1) + '</td><td class="c">' + tdbFr(l.e.mAp, 1) + '</td><td class="c"><b>' + (l.evites === null ? "pas encore mesurable" : tdbFr(l.evites, 1)) + "</b></td></tr>"; }).join("") + "</tbody></table></div>"
      : '<p class="note">Aucune réponse validée par le HRBP : pas encore de temps gagné à mesurer.</p>') +
    '<p class="note">Moyenne de signaux par semaine avant et après la semaine d\'effet de chaque réponse validée (même règle que la Revue mensuelle), ramenée au mois. Une hausse compte pour zéro.</p></div>';

  const M = TDB_MESURES;
  const comite = [
    ["Collaborateur", "Temps gagné par l'équipe RH", R.heures === null ? "—" : roiH(R.heures) + " / mois", "hypothèse", "À fixer en comité"],
    ["Collaborateur", "Satisfaction de la RH", Q.satisfaction === null ? "—" : tdbFr(Q.satisfaction, 1) + " / 5", Q.satisfaction === null ? "non mesuré" : "saisi", "4 sur 5 ou plus"],
    ["Entreprise", "Retour sur investissement", R.roi === null ? "—" : Math.round(100 * R.roi) + " %", "hypothèse", "Positif à 12 mois"],
    ["Entreprise", "Réponses validées avec effet visible", R.lignes.filter(function (l) { return l.e.verdict === "BAISSE"; }).length + " sur " + R.lignes.length, "mesuré", "À fixer en comité"],
    ["Entreprise", "Part des agents IA", partAgent === null ? "—" : partAgent + " %", "mesuré", TDB_CIBLE_AGENT + " % au plus"],
    ["Qualité", "Classement conforme au corrigé", M.concordance.ok + " sur " + M.concordance.total + " (" + M.concordance.date + ")", "mesuré", "90 % ou plus"],
    ["Qualité", "Brouillons envoyés sans modification", Q.sansModif === null ? "—" : Math.round(Q.sansModif) + " %", Q.sansModif === null ? "non mesuré" : "saisi", "70 % ou plus"],
    ["Garde-fous", "Incidents des agents IA", String(Q.incidents), Q.n ? "saisi" : "non mesuré", "0"],
  ];
  const table = '<div class="card" style="margin-top:16px"><div class="kpi-h">' + tendIcone("liste") + '<div class="spechead">Indicateurs pour le comité</div></div><div class="tw" style="margin-top:8px"><table><thead><tr><th>Famille</th><th>Indicateur</th><th>Valeur</th><th>Source</th><th>Cible proposée</th></tr></thead><tbody>' +
    comite.map(function (r) { return '<tr><td class="tdb-sub">' + esc(r[0]) + "</td><td><b>" + esc(r[1]) + "</b></td><td>" + esc(r[2]) + "</td><td>" + src(r[3]) + "</td><td>" + esc(r[4]) + "</td></tr>"; }).join("") + "</tbody></table></div>" +
    '<p class="note">' + src("mesuré") + " lu dans la base · " + src("saisi") + " par le HRBP dans la Revue des agents IA · " + src("hypothèse") + " saisie dans cette page · " + src("non mesuré") + " aucune valeur affichée.</p></div>";

  const D = [];
  if (Q.incidents) D.push("Valider la suspension de l'agent concerné, l'information du DPO et l'analyse de l'incident.");
  if (R.cout === null || R.heures === null) D.push("Faire chiffrer le coût horaire chargé, le temps par signal évité et les coûts (Make, Claude, mise en place) pour calculer le retour sur investissement.");
  if (R.roi !== null && R.roi < 0) D.push("Retour sur investissement négatif : vérifier si le volume réel des demandes justifie les réponses mises en place, en commençant par les agents IA.");
  if (partAgent !== null && partAgent > TDB_CIBLE_AGENT) D.push("Part des agents IA au-dessus de la cible : vérifier qu'une réponse plus simple ne suffirait pas.");
  D.push("Organiser une mesure du temps de traitement avant / après sur un échantillon, pour remplacer l'hypothèse par une mesure.");
  const dec = '<div class="card" style="margin-top:16px"><div class="kpi-h">' + tendIcone("drapeau") + '<div class="spechead">Décisions attendues du comité</div></div><ul class="tdb-list">' + D.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>";

  return "<h2>Pilotage et retour sur investissement</h2>" +
    '<p class="note" style="margin:-4px 0 12px">' + badge("b-emerald", "● En direct") + " Lecture seule pour la base. Le retour sur investissement repose sur des hypothèses à fournir : chaque valeur indique sa source.</p>" +
    kpis + '<div class="row c-2-3" style="margin-top:16px"><div>' + hypo + "</div><div>" + calc + "</div></div>" + detail + table + dec;
}
