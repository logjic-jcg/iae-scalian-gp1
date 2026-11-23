// v44 : onglet HRBP « Revue des agents IA » (inspiré de « Améliorer dans la durée », maquette v12).
// Chaque mois, pour chaque agent en service (décision « Validé · Assister »), l'assistant recommande
// de conserver, adapter, retirer ou suspendre l'agent ; le HRBP décide.
// Deux sortes de valeurs, jamais mélangées :
//   - MESURÉ : lu dans la base (signaux avant / après, fiches d'arrivée écrites par l'agent) ;
//   - SAISI : valeurs que la base ne connaît pas (brouillons, erreurs, satisfaction, incident),
//     saisies chaque mois par le HRBP dans la collection « revues_agents ». Vide = non saisi.
// Aucune valeur par défaut, aucun nom de personne affiché.

// Agents dont le volume se mesure par les fiches d'arrivée (agent d'intégration, compétence acia-mail-arrivee).
const RA_INTEGRATION = ["ANNONCE_INCOMPLETE", "DEMANDE_TARDIVE"];
const RA_DECISIONS = [
  { id: "CONSERVER", label: "Conserver", cls: "b-emerald" },
  { id: "ADAPTER",   label: "Adapter",   cls: "b-amber" },
  { id: "RETIRER",   label: "Retirer",   cls: "b-rose" },
  { id: "SUSPENDRE", label: "Suspendre", cls: "b-rose" },
];
// Champs saisis : [clé, libellé, min, max, pas, unité].
const RA_CHAMPS = [
  ["ouverts",      "Brouillons ouverts par la RH",                      0, 100, 1,   "%"],
  ["sans_modif",   "Brouillons envoyés sans modification",              0, 100, 1,   "%"],
  ["ignores",      "Brouillons ignorés",                                0, 100, 1,   "%"],
  ["erronees",     "Sorties erronées (date, information manquante non vue)", 0, 100, 1, "%"],
  ["satisfaction", "Satisfaction de la RH (1 à 5)",                     1, 5,   0.1, ""],
  ["nouveaux_cas", "Cas non couverts par la spécification",             0, 20,  1,   ""],
];
state.raMois = state.raMois || {};
state.raMsg = state.raMsg || {};

function raMoisCourant() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
function raMoisLib(m) {
  const p = String(m).split("-"); if (p.length !== 2) return m;
  return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}
function raRevues(code) {
  const fb = window.ACIA_FB.revues_agents;
  return fb && fb.statut === "ok" ? fb.docs.filter(function (d) { return d.code === code; }).sort(function (a, b) { return a.mois < b.mois ? 1 : -1; }) : [];
}
function raRevue(code, mois) { return raRevues(code).find(function (d) { return d.mois === mois; }) || null; }
function raNum(v) { return typeof v === "number" && isFinite(v) ? v : null; }
function raFr(v) { return String(v).replace(".", ","); }

// Fiches d'arrivée écrites par l'agent (collection arrivees) : seulement des comptes, jamais de nom.
function raFiches(mois) {
  const fb = window.ACIA_FB.arrivees;
  if (!fb || fb.statut !== "ok") return null;
  const duMois = fb.docs.filter(function (a) {
    const t = a.maj && a.maj.toDate ? a.maj.toDate() : null;
    return t && t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") === mois;
  });
  const incompletes = duMois.filter(function (a) { return String(a.manquants || "").split(";").some(function (s) { return s.trim(); }); }).length;
  return { total: fb.docs.length, mois: duMois.length, incompletes: incompletes };
}

// Mesures lues dans la base pour un agent.
function raMesures(code, mois, sig) {
  const d = decisionDe(code), p = sig.parCode[code];
  const M = { effet: null, fiches: null, jour1: null };
  if (p && d && d.semaine_effet && typeof tdbEffet === "function") M.effet = tdbEffet(p, Number(d.semaine_effet));
  if (RA_INTEGRATION.indexOf(code) >= 0) {
    M.fiches = raFiches(mois);
    const pj = sig.parCode.PREMIER_JOUR_DEGRADE;
    if (pj && d && d.semaine_effet) {
      let n = 0; for (let s = Number(d.semaine_effet); s <= pj.semMax; s++) n += pj.parSem[s] || 0;
      M.jour1 = { apres: n, observe: pj.semMax >= Number(d.semaine_effet) };
    }
  }
  return M;
}

// Règles d'évolution (maquette v12, généralisées) : une suspension prime, puis un « retirer », puis un « adapter ».
function raEvaluer(M, R) {
  const T = [], add = function (n, c, a, src) { T.push({ niv: n, critere: c, action: a, src: src }); };
  const long = R && R.duree === 3;
  const v = function (k) { return R ? raNum(R[k]) : null; };
  if (R && R.incident) add("suspendre", "Incident : envoi sans validation, pièce lue ou contenu confidentiel analysé", "Arrêter l'agent, revenir au traitement manuel, informer le DPO et analyser l'incident", "SAISI");
  if (v("erronees") !== null && v("erronees") > 10) add("suspendre", "Sorties erronées : " + v("erronees") + " %, au-delà de 10 %", "Arrêter l'agent : une erreur peut coûter un premier jour", "SAISI");
  else if (v("erronees") !== null && v("erronees") > 5) add("adapter", "Sorties erronées : " + v("erronees") + " %, au-delà de 5 %", "Revoir l'extraction des informations et la checklist", "SAISI");
  if (v("ouverts") !== null && v("ouverts") < 50) add(long ? "retirer" : "adapter", "Brouillons ouverts : " + v("ouverts") + " %, sous 50 %" + (long ? " après 3 mois et une adaptation" : ""), long ? "Retirer : la RH travaille sans l'agent" : "Comprendre pourquoi la RH ne s'en sert pas", "SAISI");
  else if (v("ouverts") !== null && v("ouverts") < 80) add("adapter", "Brouillons ouverts : " + v("ouverts") + " %, sous 80 %", "Demander à la RH dans quels cas elle ne s'en sert pas", "SAISI");
  if (v("sans_modif") !== null && v("sans_modif") < 60) add(long ? "retirer" : "adapter", "Brouillons envoyés sans modification : " + v("sans_modif") + " %, sous 60 %" + (long ? " après 3 mois et une adaptation" : ""), long ? "Retirer : l'adaptation n'a pas suffi" : "Revoir la rédaction des brouillons", "SAISI");
  if (v("ignores") !== null && v("ignores") > 25) add("adapter", "Brouillons ignorés : " + v("ignores") + " %, au-delà de 25 %", "Analyser les brouillons ignorés (destinataire inutile, information déjà connue)", "SAISI");
  if (v("satisfaction") !== null && v("satisfaction") < 3) add("adapter", "Satisfaction de la RH : " + raFr(v("satisfaction")) + " sur 5", "Recueillir les retours détaillés de la RH", "SAISI");
  if (v("nouveaux_cas") !== null && v("nouveaux_cas") >= 2) add("adapter", v("nouveaux_cas") + " cas non couverts par la spécification", "Compléter la spécification (et le skill)", "SAISI");
  if (R && R.chg_processus) add("adapter", "Changement de processus signalé", "Mettre à jour la spécification et les délais de l'agent", "SAISI");
  if (M.fiches && R && R.duree) {
    if (M.fiches.mois < 2) add(long ? "retirer" : "adapter", M.fiches.mois + " fiche(s) d'arrivée écrite(s) par l'agent ce mois, moins de 2" + (long ? " depuis 3 mois" : ""), long ? "Retirer : le formulaire d'annonce et la checklist suffisent" : "Surveiller : retrait à envisager si cela dure 3 mois", "MESURÉ");
  }
  if (M.effet && M.effet.verdict === "HAUSSE") add("adapter", "Signaux en hausse depuis la mise en service (" + tdbFr(M.effet.mAv, 1) + " → " + tdbFr(M.effet.mAp, 1) + " par semaine)", "L'agent ne règle pas l'irritant : revoir la réponse retenue", "MESURÉ");
  if (M.jour1 && M.jour1.observe && M.jour1.apres > 0) add("adapter", M.jour1.apres + " premier(s) jour(s) dégradé(s) signalé(s) depuis la mise en service", "Vérifier si les demandes partent à temps mais restent bloquées chez l'informatique", "MESURÉ");
  const rang = { suspendre: 3, retirer: 2, adapter: 1 };
  T.sort(function (a, b) { return rang[b.niv] - rang[a.niv]; });
  const top = T.reduce(function (m, t) { return Math.max(m, rang[t.niv]); }, 0);
  return { top: top, list: T };
}
const RA_RECO = [["CONSERVER", "Conserver l'agent", "b-emerald"], ["ADAPTER", "Adapter l'agent", "b-amber"], ["RETIRER", "Retirer l'agent", "b-rose"], ["SUSPENDRE", "Suspendre l'agent immédiatement", "b-rose"]];

function raChoisirMois(code, m) { state.raMois[code] = m; render(); }
function raEnregistrer(code) {
  const mois = state.raMois[code] || raMoisCourant();
  const v = function (id) { const el = document.getElementById("ra-" + code + "-" + id); return el ? el : null; };
  const data = { code: code, mois: mois, duree: parseInt((v("duree") || {}).value, 10) === 3 ? 3 : 1,
    chg_processus: !!(v("chg") && v("chg").checked), incident: !!(v("inc") && v("inc").checked),
    decision: (v("dec") || {}).value || "", commentaire: String((v("comm") || {}).value || "").slice(0, 280) };
  for (let i = 0; i < RA_CHAMPS.length; i++) {
    const c = RA_CHAMPS[i], el = v(c[0]), t = el ? String(el.value).trim().replace(",", ".") : "";
    if (t === "") continue;
    const n = c[4] < 1 ? Math.round(parseFloat(t) * 10) / 10 : parseInt(t, 10);
    if (!isFinite(n) || n < c[2] || n > c[3]) { state.raMsg[code] = "« " + c[1] + " » : valeur entre " + c[2] + " et " + c[3] + " attendue."; render(); return; }
    data[c[0]] = n;
  }
  if (typeof window.aciaEcrireRevueAgent !== "function") { state.raMsg[code] = "Écriture impossible : connexion à la base absente."; render(); return; }
  state.raMsg[code] = "Enregistrement…"; render();
  window.aciaEcrireRevueAgent(code + "__" + mois, data)
    .then(function () { state.raMsg[code] = "Revue de " + raMoisLib(mois) + " enregistrée dans la base."; render(); })
    .catch(function (e) { state.raMsg[code] = "Refusé par la base : " + ((e && e.message) || e) + " (règles Firestore v44 publiées ?)"; render(); });
}

function raCarte(code, sig) {
  const mois = state.raMois[code] || raMoisCourant();
  const R = raRevue(code, mois), M = raMesures(code, mois, sig), E = raEvaluer(M, R), d = decisionDe(code);
  const reco = RA_RECO[E.top];
  const saisi = !!R;
  // Mesures de la base
  const mes = [];
  if (M.effet) mes.push(["Signaux de l'irritant", "avant S" + d.semaine_effet + " : " + tdbFr(M.effet.mAv, 1) + " par semaine · après : " + tdbFr(M.effet.mAp, 1), badge(TDB_VERDICT[M.effet.verdict][0], TDB_VERDICT[M.effet.verdict][1])]);
  if (RA_INTEGRATION.indexOf(code) >= 0) {
    mes.push(["Fiches d'arrivée écrites par l'agent", M.fiches ? M.fiches.mois + " en " + raMoisLib(mois) + " (" + M.fiches.total + " au total)" : "Collection indisponible", ""]);
    if (M.fiches && M.fiches.mois) mes.push(["Annonces incomplètes détectées", M.fiches.incompletes + " sur " + M.fiches.mois + " ce mois", ""]);
    mes.push(["Premiers jours dégradés depuis la mise en service", M.jour1 ? (M.jour1.observe ? String(M.jour1.apres) : "pas encore de semaine observée") : "—", ""]);
  }
  const tabMes = '<table class="ra-t"><tbody>' + mes.map(function (r) { return "<tr><td>" + esc(r[0]) + "</td><td>" + esc(r[1]) + (r[2] ? " " + r[2] : "") + "</td></tr>"; }).join("") + "</tbody></table>";
  // Saisie du mois
  const val = function (k) { return R && raNum(R[k]) !== null ? raFr(R[k]) : ""; };
  const moisOpts = (function () {
    const L = [raMoisCourant()]; raRevues(code).forEach(function (r) { if (L.indexOf(r.mois) < 0) L.push(r.mois); });
    if (L.indexOf(mois) < 0) L.push(mois);
    return L.sort().reverse().map(function (m) { return '<option value="' + esc(m) + '"' + (m === mois ? " selected" : "") + ">" + esc(raMoisLib(m)) + (raRevue(code, m) ? " · saisi" : "") + "</option>"; }).join("");
  })();
  const champs = RA_CHAMPS.map(function (c) {
    return '<label class="fl">' + esc(c[1]) + (c[5] ? " (" + c[5] + ")" : "") + '<input id="ra-' + code + "-" + c[0] + '" inputmode="decimal" placeholder="non saisi" value="' + esc(val(c[0])) + '"></label>';
  }).join("");
  const form = '<div class="ra-form">' +
    '<label class="fl">Mois de la revue<select onchange="raChoisirMois(\'' + code + '\', this.value)">' + moisOpts + "</select></label>" +
    '<label class="fl">Situation observée depuis<select id="ra-' + code + '-duree"><option value="1"' + (R && R.duree === 3 ? "" : " selected") + '>1 mois</option><option value="3"' + (R && R.duree === 3 ? " selected" : "") + ">3 mois, après une adaptation</option></select></label>" +
    '<div class="ra-champs">' + champs + "</div>" +
    '<label class="chkl" style="display:block;margin-top:10px"><input type="checkbox" id="ra-' + code + '-chg"' + (R && R.chg_processus ? " checked" : "") + "> Changement de processus (délais, formulaire, outil)</label>" +
    '<label class="chkl" style="display:block;margin-top:6px"><input type="checkbox" id="ra-' + code + '-inc"' + (R && R.incident ? " checked" : "") + "> Incident : envoi sans validation, pièce lue ou contenu confidentiel analysé</label>" +
    '<label class="fl">Décision du HRBP pour ce mois<select id="ra-' + code + '-dec"><option value="">À décider</option>' + RA_DECISIONS.map(function (x) { return '<option value="' + x.id + '"' + (R && R.decision === x.id ? " selected" : "") + ">" + esc(x.label) + "</option>"; }).join("") + "</select></label>" +
    '<label class="fl">Commentaire (280 caractères maximum, sans nom de personne)<input id="ra-' + code + '-comm" maxlength="280" value="' + esc(R && R.commentaire ? R.commentaire : "") + '"></label>' +
    '<div class="btns" style="margin-top:12px"><button class="btn ok" onclick="raEnregistrer(\'' + code + '\')">Enregistrer la revue du mois</button></div>' +
    (state.raMsg[code] ? '<p class="note">' + esc(state.raMsg[code]) + "</p>" : "") +
    (R && R.maj && R.maj.toDate ? '<p class="note">Saisie enregistrée le ' + esc(R.maj.toDate().toLocaleString("fr-FR")) + ".</p>" : "") + "</div>";
  // Recommandation
  const L = { suspendre: ["Suspendre", "b-rose"], retirer: ["Retirer", "b-rose"], adapter: ["Adapter", "b-amber"] };
  const recoHtml = '<div class="ra-reco"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><div class="spechead">Recommandation de l\'assistant · ' + esc(raMoisLib(mois)) + "</div>" + badge(reco[2], reco[1]) + "</div>" +
    (E.list.length
      ? '<div class="tw" style="margin-top:8px"><table><thead><tr><th>Niveau</th><th>Critère déclenché</th><th>Action proposée</th></tr></thead><tbody>' +
        E.list.map(function (t) { return "<tr><td>" + badge(L[t.niv][1], L[t.niv][0]) + ' <small class="tdb-sub">' + t.src.toLowerCase() + "</small></td><td>" + esc(t.critere) + "</td><td>" + esc(t.action) + "</td></tr>"; }).join("") + "</tbody></table></div>"
      : '<p style="margin-top:8px;font-size:14px">' + (saisi ? "Aucun critère d'évolution atteint : l'agent reste pertinent ce mois-ci." : "Aucun critère atteint sur les mesures de la base. Les valeurs à saisir ne le sont pas encore : recommandation provisoire.") + "</p>") +
    (R && R.decision ? '<p class="note">Décision du HRBP : ' + badge((RA_DECISIONS.find(function (x) { return x.id === R.decision; }) || {}).cls || "b-slate", (RA_DECISIONS.find(function (x) { return x.id === R.decision; }) || {}).label || R.decision) +
      (R.decision !== reco[0] ? " · différente de la recommandation" : "") + "</p>" : "") + "</div>";
  // Historique
  const hist = raRevues(code);
  const histHtml = hist.length > 1 || (hist.length === 1 && hist[0].mois !== mois)
    ? '<p class="note" style="margin-top:10px"><b>Historique :</b> ' + hist.map(function (r) { const x = RA_DECISIONS.find(function (y) { return y.id === r.decision; }); return esc(raMoisLib(r.mois)) + " · " + (x ? x.label : "à décider"); }).join(" ; ") + "</p>" : "";
  return '<div class="card ra-carte" id="ra-' + code + '" style="margin-top:16px">' +
    '<div class="kpi-h">' + (typeof specIcone === "function" ? specIcone("ASSISTER") : "") + '<div class="spechead">Agent en service depuis la semaine ' + esc(d.semaine_effet) + "</div></div>" +
    '<div class="spech3">' + esc(libelleType(code)) + "</div>" +
    (typeof allerSpec === "function" ? '<a href="#" class="pick-fiche" onclick="allerSpec(\'' + code + '\');return false">Voir la spécification →</a>' : "") +
    '<div class="row c-2-3" style="margin-top:12px"><div><div class="spechead" style="margin-bottom:4px">Saisie du mois ' + badge("b-slate", "saisi par le HRBP") + "</div>" + form + "</div>" +
    '<div><div class="spechead" style="margin-bottom:4px">Mesuré dans la base ' + badge("b-emerald", "● En direct") + "</div>" + tabMes + recoHtml + histHtml + "</div></div></div>";
}

function viewRevueAgents() {
  const sig = aciaSignaux();
  if (!sig.ok) return messageSansBase("Revue des agents IA", sig);
  const fbR = window.ACIA_FB.revues_agents;
  const agents = typesPilotage().map(function (t) { return t.code; }).filter(function (c) { const d = decisionDe(c); return d && d.statut === "VALIDE" && d.reponse === "ASSISTER"; });
  const intro = '<p style="font-size:14px;color:#2f2745;margin:0 0 12px">Chaque mois, l\'assistant regarde si chaque agent IA en service sert encore, et recommande de le conserver, de l\'adapter ou de le retirer. Un incident grave le suspend immédiatement. Le HRBP, propriétaire du processus, décide.</p>' +
    '<p class="note" style="margin:0 0 12px">' + badge("b-emerald", "mesuré") + " = lu dans la base. " + badge("b-slate", "saisi") + " = la base ne le connaît pas (brouillons restés dans la messagerie, erreurs, satisfaction) : saisi par le HRBP, vide tant que non mesuré.</p>" +
    (fbR && fbR.statut !== "ok" && fbR.statut !== "chargement" ? '<p class="note">' + badge("b-rose", "Saisies indisponibles") + " " + esc(fbR.erreur || "") + " Publier les règles Firestore v44.</p>" : "");
  const cartes = agents.length ? agents.map(function (c) { return raCarte(c, sig); }).join("")
    : '<div class="card"><p style="font-size:14px;margin:0">Aucun agent IA en service.</p><p class="note">Un agent est en service quand la décision du HRBP est « Validé » avec la réponse « Assister (agent IA) », dans l\'onglet « Décisions ».</p></div>';
  const regles = '<div class="card" style="margin-top:16px"><div class="kpi-h">' + tendIcone("liste") + '<div class="spechead">Règles d\'évolution</div></div><div class="tw" style="margin-top:8px"><table><thead><tr><th>Décision</th><th>Critères (un seul suffit)</th></tr></thead><tbody>' +
    "<tr><td>" + badge("b-rose", "Suspendre") + "</td><td>Incident (envoi sans validation, pièce lue, contenu confidentiel analysé) ; plus de 10 % de sorties erronées</td></tr>" +
    "<tr><td>" + badge("b-rose", "Retirer") + "</td><td>Après 3 mois et une adaptation : brouillons ouverts sous 50 %, envoyés sans modification sous 60 %, ou moins de 2 fiches d'arrivée par mois</td></tr>" +
    "<tr><td>" + badge("b-amber", "Adapter") + "</td><td>Ouverts sous 80 % ; envoyés sans modification sous 60 % ; ignorés au-delà de 25 % ; sorties erronées au-delà de 5 % ; satisfaction sous 3 ; 2 cas non couverts ou plus ; changement de processus ; signaux en hausse ; premiers jours dégradés encore signalés</td></tr>" +
    "<tr><td>" + badge("b-emerald", "Conserver") + "</td><td>Aucun critère atteint</td></tr></tbody></table></div>" +
    '<p class="note">Seuils proposés par l\'équipe, à valider par le HRBP. Les réponses sans IA (Simplifier, Automatiser) se suivent dans la « Revue mensuelle ».</p></div>';
  const cibles = '<div class="card" style="margin-top:16px"><div class="kpi-h">' + tendIcone("courbe") + '<div class="spechead">Indicateurs de succès d\'un agent · cibles proposées à 3 mois</div></div><div class="tw" style="margin-top:8px"><table><thead><tr><th>Indicateur</th><th>Source</th><th>Cible proposée</th></tr></thead><tbody>' +
    [["Signaux de l'irritant", "mesuré (classement des mails, comptes rendus)", "En baisse de 20 % ou plus"],
     ["Premiers jours dégradés (agent d'intégration)", "mesuré (signaux)", "0"],
     ["Annonces incomplètes détectées avant le premier jour", "mesuré (fiches d'arrivée)", "Toutes"],
     ["Brouillons envoyés sans modification", "saisi", "70 % ou plus"],
     ["Sorties erronées", "saisi", "5 % au plus"],
     ["Contenus confidentiels analysés, envois sans validation", "saisi (incident)", "0"],
     ["Satisfaction de la RH", "saisi", "4 sur 5 ou plus"]].map(function (r) { return "<tr><td>" + esc(r[0]) + '</td><td class="tdb-sub">' + esc(r[1]) + "</td><td>" + esc(r[2]) + "</td></tr>"; }).join("") +
    "</tbody></table></div></div>";
  return "<h2>Revue des agents IA</h2>" + intro + cartes + regles + cibles;
}
