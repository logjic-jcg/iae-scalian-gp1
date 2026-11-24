// ---------------------------------------------------------------------------
// Onglets HRBP reliés à la base (v9) : Décisions · Spécifications ·
// Suivi des réponses
// ---------------------------------------------------------------------------
// Lit  : classement_mails (écrit toutes les heures par Make + Claude)
//        comptes_rendus   (v12 : actions des comptes rendus Notion, 8e irritant)
//        decisions_hrbp   (écrit par cet écran, un document par irritant)
// Écrit: decisions_hrbp/{CODE} = { statut, reponse, commentaire, semaine_effet, maj }
// v15 : écriture réservée au HRBP connecté (table « utilisateurs »), encadrée par les règles
// Firestore (collection, champs et valeurs autorisés). À passer en connexion
// (v7) avant le jury. Aucun chiffre n'est affiché sans la base.
// ---------------------------------------------------------------------------

const STATUTS_HRBP = [
  { id: "VALIDE",       label: "Validé",        cls: "b-emerald" },
  { id: "A_SURVEILLER", label: "À surveiller",  cls: "b-amber" },
  { id: "ECARTE",       label: "Écarté",        cls: "b-slate" },
];
const REPONSES_HRBP = [
  { id: "SIMPLIFIER",  label: "Simplifier, sans IA", aide: "Page unique, FAQ, liste de diffusion, modèle" },
  { id: "AUTOMATISER", label: "Automatiser",         aide: "Règle ou workflow sans jugement (ex. accusé de réception)" },
  { id: "ASSISTER",    label: "Assister (agent IA)", aide: "L'agent prépare, un humain valide" },
];
// Réponse proposée par l'assistant (grille du livrable 01) et contenu des fiches.
const PILOTAGE = {
  ANNONCE_INCOMPLETE: { reco: "ASSISTER",
    besoin: "Chaque annonce d'arrivée arrive complète, sans aller-retour avec le manager.",
    entrees: "Mail d'annonce reçu dans la boîte RH partagée ; checklist d'intégration de référence (Notion).",
    sorties: "Liste des informations manquantes ; brouillon de demande au manager ; fiche d'arrivée (Firestore).",
    workflow: ["Le mail est classé « annonce incomplète »", "L'agent compare l'annonce à la checklist", "Il prépare les brouillons, rien n'est envoyé", "La RH relit et envoie"],
    indicateur: "Mails d'annonce incomplète par semaine" },
  DEMANDE_TARDIVE: { reco: "ASSISTER",
    besoin: "Les demandes de poste, comptes, badge et habilitation partent dans les délais.",
    entrees: "Date d'arrivée ; délais de référence (PC 10 jours ouvrés, habilitation 15, badge 3).",
    sorties: "Dates limites calculées ; brouillons de demande à l'informatique et aux services généraux.",
    workflow: ["Arrivée annoncée", "L'agent calcule les dates limites", "Alerte si un délai est déjà dépassé", "La RH envoie les demandes"],
    indicateur: "Signaux « demande tardive » par semaine" },
  HORS_BOUCLE: { reco: "SIMPLIFIER",
    action: "Liste de diffusion « arrivées » incluant les services généraux.", indicateur: "Signaux « hors de la boucle » par semaine" },
  PREMIER_JOUR_DEGRADE: { reco: "SIMPLIFIER",
    action: "Pas de réponse propre : se traite en amont (annonce complète, délais tenus). À suivre comme indicateur de résultat.", indicateur: "Premiers jours dégradés par semaine" },
  QUESTION_RECURRENTE: { reco: "SIMPLIFIER",
    action: "FAQ des arrivants jointe au mail de bienvenue (télétravail, mutuelle, premier jour, frais).", indicateur: "Questions récurrentes par semaine" },
  PIECES_RENVOYEES: { reco: "AUTOMATISER",
    besoin: "Chaque envoi de pièces reçoit un accusé de réception, pour éviter les renvois.",
    entrees: "Mail entrant avec pièces jointes dans la boîte RH (le contenu des pièces n'est jamais lu).",
    sorties: "Réponse automatique d'accusé de réception.",
    workflow: ["Mail avec pièces jointes reçu", "Réponse automatique standard", "Aucune IA : règle de messagerie"],
    indicateur: "Pièces renvoyées par semaine" },
  ACTIONS_NON_FERMEES: { reco: "SIMPLIFIER",
    action: "Modèle de compte rendu avec un tableau d'actions (responsable, échéance, statut), repris en tête du compte rendu suivant, diffusé le jour même.",
    besoin: "Chaque action de réunion a un responsable et une échéance, et son statut est repris à la réunion suivante.",
    entrees: "Notes de réunion tapées (jamais d'enregistrement) ; tableau d'actions du compte rendu précédent.",
    sorties: "Brouillon de compte rendu avec le tableau d'actions pré-rempli ; liste des actions sans responsable.",
    workflow: ["L'animateur tape ses notes", "L'assistant reprend les actions ouvertes du compte rendu précédent", "Il signale les actions sans responsable ni échéance", "L'animateur relit et diffuse le jour même"],
    indicateur: "Actions reportées ou sans responsable par semaine (comptes rendus)" },
  DOC_DISPERSEE: { reco: "SIMPLIFIER",
    action: "Page de référence unique, une seule version par document, un responsable nommé.", indicateur: "Signaux « documentation dispersée » par semaine" },
  AUTRE: { reco: "SIMPLIFIER",
    action: "Relire les mails classés « Autre » : si un même motif revient, créer un nouveau type dans l'onglet « Types d’irritants ».", indicateur: "Mails classés « Autre » par semaine" },
};
// v13 : un type créé par le HRBP n'a pas encore de fiche : contenu générique, à compléter.
function confDe(code) {
  return PILOTAGE[code] || { reco: "SIMPLIFIER", action: "À définir par le HRBP (type créé dans l'onglet « Types d’irritants »).",
    indicateur: "Signaux « " + libelleType(code) + " » par semaine" };
}

// Les types des mails (table « types_irritants ») + l'irritant des comptes rendus.
const CODE_CR = "ACTIONS_NON_FERMEES";
function typesPilotage() {
  const t = typesTable(), cr = t && t.find(function (d) { return d.id === CODE_CR; });
  return typesMail().concat([{ code: CODE_CR, label: cr && cr.titre ? cr.titre : "Actions de réunion jamais fermées", actif: !cr || cr.actif !== false, processus: processusDe(CODE_CR) }]);
}
function sourceDe(code) { return code === CODE_CR ? "dans les comptes rendus de réunion" : "dans la boîte partagée"; }
function libelleType(code) { const t = typesPilotage().find(function (x) { return x.code === code; }); return t ? t.label : code; }
function actifType(code) { const t = typesPilotage().find(function (x) { return x.code === code; }); return !t || t.actif; }
function libStatut(id) { const s = STATUTS_HRBP.find(function (x) { return x.id === id; }); return s || { label: "Sans décision", cls: "b-sky" }; }
function libReponse(id) { const r = REPONSES_HRBP.find(function (x) { return x.id === id; }); return r ? r.label : "—"; }

// Signaux par irritant : semaines fictives (Jxx) et mails réels datés.
function aciaSignaux() {
  const fb = window.ACIA_FB.classement_mails;
  const res = { ok: fb && fb.statut === "ok", erreur: fb ? fb.erreur : "", parCode: {}, semMax: 0 };
  if (!res.ok) return res;
  typesPilotage().forEach(function (t) { res.parCode[t.code] = { total: 0, parSem: {}, reels: [], semMax: 0 }; });
  fb.docs.forEach(function (d) {
    if (d.type === "ECARTE") return;
    const m = /^J(\d+)$/.exec(String(d.jour_fictif || "").trim());
    const s = m ? Math.ceil(Number(m[1]) / 7) : null;
    if (s && s > res.semMax) res.semMax = s;
    const recu = d.recu && d.recu.toDate ? d.recu.toDate() : null;
    [d.type, d.type_secondaire].forEach(function (c, i) {
      c = String(c || "").trim();
      const p = res.parCode[c];
      if (!p || (i === 1 && c === d.type)) return;
      p.total += 1;
      if (s) p.parSem[s] = (p.parSem[s] || 0) + 1; else if (recu) p.reels.push(recu);
    });
  });
  typesMail().forEach(function (t) { res.parCode[t.code].semMax = res.semMax; });
  signauxComptesRendus(res.parCode[CODE_CR]);
  return res;
}
// Comptes rendus : un signal = une action reportée, ou ouverte sans responsable, dans un compte rendu.
// Semaine = semaine fictive de la réunion. Chaque source garde sa propre « dernière semaine observée ».
function signauxComptesRendus(p) {
  const fb = window.ACIA_FB.comptes_rendus;
  p.disponible = !!(fb && fb.statut === "ok");
  if (!p.disponible || typeof lireAnalyseCR !== "function") return;
  const vus = {};
  fb.docs.filter(function (d) { return d.statut === "ANALYSE" || d.statut === "ECARTE"; })
    .sort(function (a, b) { return (Number(a.jour_reunion) || 0) - (Number(b.jour_reunion) || 0); })
    .forEach(function (cr) {
      const s = Math.ceil((Number(cr.jour_reunion) || 0) / 7);
      if (s > p.semMax) p.semMax = s;
      if (cr.statut !== "ANALYSE") return;
      lireAnalyseCR(cr.analyse).actions.forEach(function (x) {
        let st = x.statut;
        if (st === "NOUVELLE" && vus[x.libelle]) st = "REPORTEE";
        vus[x.libelle] = true;
        if (st === "REPORTEE" || (st !== "FERMEE" && !x.resp)) { p.total += 1; p.parSem[s] = (p.parSem[s] || 0) + 1; }
      });
    });
}
function decisionDe(code) {
  const fb = window.ACIA_FB.decisions_hrbp;
  if (!fb || fb.statut !== "ok") return null;
  return fb.docs.find(function (d) { return d.id === code; }) || null;
}
// « À examiner » : au moins 3 signaux sur les 2 dernières semaines observées.
function aExaminer(p) { const m = p.semMax; return ((p.parSem[m] || 0) + (p.parSem[m - 1] || 0)) >= 3; }

function messageSansBase(titre, sig) {
  const msg = window.ACIA_FB.classement_mails.statut === "chargement" ? "Lecture de la base en cours…" : "Données indisponibles : " + sig.erreur;
  return "<h2>" + titre + '</h2><div class="card"><p class="note" style="margin:0">' + esc(msg) + '</p><p class="note">Aucun chiffre n\'est affiché sans la base.</p></div>';
}
function bandeauVersionC() {
  const fb = window.ACIA_FB.decisions_hrbp;
  const etat = !fb || fb.statut === "chargement" ? badge("b-sky", "Décisions : lecture…")
    : fb.statut === "ok" ? badge("b-emerald", "● Décisions : en direct")
    : badge("b-rose", "Décisions indisponibles : " + fb.erreur);
  return '<p class="note" style="margin:0 0 12px">' + etat + " Enregistrement réservé au profil HRBP connecté, vérifié par les règles de la base.</p>";
}

// ------------------------------ VALIDER ET ORIENTER ------------------------

state.selPilot = state.selPilot || "ANNONCE_INCOMPLETE";
state.msgPilot = "";
function selPilot(code) { state.selPilot = code; state.msgPilot = ""; render(); }

// v13 : filtre de la liste par statut de décision.
const FILTRES_PILOT = [
  { id: "TOUS",         label: "Tous les statuts", test: function () { return true; } },
  { id: "SANS",         label: "Sans décision", test: function (d) { return !d; } },
  { id: "VALIDE",       label: "Validé",        test: function (d) { return !!d && d.statut === "VALIDE"; } },
  { id: "A_SURVEILLER", label: "À surveiller",  test: function (d) { return !!d && d.statut === "A_SURVEILLER"; } },
  { id: "ECARTE",       label: "Écarté",        test: function (d) { return !!d && d.statut === "ECARTE"; } },
  { id: "EXAMINER",     label: "À examiner",    test: function (d, p) { return aExaminer(p); } },
];
state.filtrePilot = state.filtrePilot || "TOUS";
// v47 : filtre « Proposition de l'assistant » (Décisions : Liste et Tableau de suivi), à côté du filtre Processus.
// Les types créés dans « Types d’irritants » n'ont pas de proposition (confDe renvoie SIMPLIFIER par défaut) : ils sont
// rangés à part, dans « À définir », pour ne pas gonfler « Simplifier ».
const PROPOS_PILOT = [
  { id: "SIMPLIFIER",  label: "Simplifier, sans IA" },
  { id: "AUTOMATISER", label: "Automatiser" },
  { id: "ASSISTER",    label: "Assister (agent IA)" },
  { id: "A_DEFINIR",   label: "À définir (pas de proposition)" },
];
state.filtrePropo = state.filtrePropo || [];
function propoDe(code) { return PILOTAGE[code] ? PILOTAGE[code].reco : "A_DEFINIR"; }
function passePropo(code) { return !state.filtrePropo.length || state.filtrePropo.indexOf(propoDe(code)) >= 0; }
function basculerPropo(id) { const i = state.filtrePropo.indexOf(id); if (i >= 0) state.filtrePropo.splice(i, 1); else state.filtrePropo.push(id); state.propoOuvert = true; render(); }
function viderPropo() { state.filtrePropo = []; state.propoOuvert = false; render(); }
function filtrePropoHtml(codes) {
  const actifs = state.filtrePropo;
  const resume = !actifs.length ? "Toutes" : PROPOS_PILOT.filter(function (r) { return actifs.indexOf(r.id) >= 0; }).map(function (r) { return r.label.split(" (")[0].split(",")[0]; }).join(", ");
  const cases = PROPOS_PILOT.map(function (r) {
    const n = codes.filter(function (c) { return propoDe(c) === r.id; }).length;
    const ic = typeof specIcone === "function" && r.id !== "A_DEFINIR" ? specIcone(r.id, 22) : '<span class="tend-ic" aria-hidden="true" style="background:#f1f5f9;color:#64748b;width:22px;height:22px;font-size:12px;font-weight:700">?</span>';
    return '<label style="display:flex;gap:8px;align-items:center;padding:5px 4px;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap">' +
      '<input type="checkbox" style="width:auto;margin:0"' + (actifs.indexOf(r.id) >= 0 ? " checked" : "") + ' onchange="basculerPropo(\'' + r.id + '\')"> ' + ic + esc(r.label) +
      '<span class="note" style="margin:0 0 0 auto;padding-left:10px">' + n + "</span></label>";
  }).join("");
  return '<details class="propo-filtre" style="position:relative;display:inline-block;margin:0 0 10px"' + (state.propoOuvert ? " open" : "") + ' ontoggle="state.propoOuvert=this.open">' +
    '<summary class="chip' + (actifs.length ? " active" : "") + '" style="list-style:none;display:inline-block">Proposition de l\'assistant : ' + esc(resume) + " ▾</summary>" +
    '<div style="position:absolute;z-index:30;top:calc(100% + 4px);left:0;min-width:280px;background:#fff;border:1px solid #cbd5e1;border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,.12);padding:6px 8px">' +
    cases + '<p class="note" style="margin:4px 4px 0;white-space:normal;max-width:300px">Proposition = grille du livrable 01, avant la décision du HRBP. La réponse retenue peut être différente.</p>' +
    '<div style="border-top:1px solid #e2e8f0;margin-top:6px;padding-top:6px;display:flex;justify-content:space-between;gap:8px">' +
    '<button class="chip" onclick="viderPropo()">Tout afficher</button><button class="chip" onclick="state.propoOuvert=false;render()">Fermer</button></div></div></details>';
}
document.addEventListener("click", function (e) {
  if (!state.propoOuvert) return;
  if (e.target && e.target.closest && e.target.closest(".propo-filtre")) return;
  state.propoOuvert = false;
  const d = document.querySelector(".propo-filtre"); if (d) d.open = false;
});

function filtrePilot(id) { state.filtrePilot = id; state.msgPilot = ""; render(); }

// v13 : indicateur en anneau du nombre de signaux d'un type.
// Remplissage = total / total du type le plus signalé. Couleur = activité récente
// (2 dernières semaines observées) : rouge >= 3 (seuil « à examiner »), orange 1-2,
// vert 0 récent, gris aucun signal du tout.
function anneauSignaux(p, maxTot) {
  const recents = (p.parSem[p.semMax] || 0) + (p.parSem[p.semMax - 1] || 0);
  const coul = !p.total ? "#94a3b8" : recents >= 3 ? "#e11d48" : recents >= 1 ? "#d97706" : "#059669";
  const r = 19, L = 2 * Math.PI * r, part = p.total ? Math.max(0.06, p.total / maxTot) : 0;
  const titre = p.total + " signal(s) au total, dont " + recents + " sur les 2 dernières semaines observées";
  return '<span title="' + esc(titre) + '" style="flex:0 0 auto;display:inline-block;width:46px;height:46px;background:#fff;border-radius:50%">' +
    '<svg viewBox="0 0 46 46" width="46" height="46" role="img" aria-label="' + esc(titre) + '">' +
    '<circle cx="23" cy="23" r="' + r + '" fill="none" stroke="#f1f5f9" stroke-width="4"/>' +
    '<circle cx="23" cy="23" r="' + r + '" fill="none" stroke="' + coul + '" stroke-width="4" stroke-linecap="round" transform="rotate(-90 23 23)" stroke-dasharray="' + (L * part).toFixed(1) + " " + L.toFixed(1) + '"/>' +
    '<text x="23" y="23" text-anchor="middle" dominant-baseline="central" font-size="15" font-weight="800" fill="' + coul + '">' + p.total + "</text></svg></span>";
}

function enregistrerDecision(code) {
  const v = function (id) { const el = document.getElementById(id); return el ? el.value : ""; };
  const data = { statut: v("dp-statut"), reponse: v("dp-reponse"), commentaire: v("dp-comm").slice(0, 280), semaine_effet: parseInt(v("dp-sem"), 10) };
  if (!(data.semaine_effet >= 1 && data.semaine_effet <= 53)) { state.msgPilot = "Semaine d'effet invalide (1 à 53)."; render(); return; }
  // Pas d'effet rétroactif : une décision prise aujourd'hui ne s'applique qu'aux semaines à venir
  // (sinon le suivi « avant / après » mesurerait une baisse qui précède la décision).
  const sig = aciaSignaux(), avant = decisionDe(code), semMax = sig.parCode[code] ? sig.parCode[code].semMax : sig.semMax;
  if (data.semaine_effet <= semMax && !(avant && avant.semaine_effet === data.semaine_effet)) {
    state.msgPilot = "La semaine d'effet doit être postérieure à la dernière semaine observée (S" + semMax + ") : pas de décision rétroactive."; render(); return;
  }
  if (typeof window.aciaEcrireDecision !== "function") { state.msgPilot = "Écriture impossible : connexion à la base absente."; render(); return; }
  state.msgPilot = "Enregistrement…"; render();
  window.aciaEcrireDecision(code, data).then(function () { state.prefillPilot = null; state.msgPilot = "Décision enregistrée dans la base."; render(); })
    .catch(function (e) { state.msgPilot = "Refusé par la base : " + ((e && e.message) || e); render(); });
}

function viewPilotOrienter() {
  const sig = aciaSignaux();
  if (!sig.ok) return messageSansBase("Décisions", sig);
  // v14 : filtre « Processus » appliqué avant le filtre de statut (les compteurs des puces en tiennent compte).
  const avantPropo = typesPilotage().filter(function (t) { return (t.actif || sig.parCode[t.code].total || decisionDe(t.code)) && passeProcessus(t.code); }).map(function (t) { return t.code; });
  const tous = avantPropo.filter(passePropo).sort(function (a, b) { return sig.parCode[b].total - sig.parCode[a].total; });
  // v13 : filtre par statut de décision (ou « à examiner »).
  const filtre = FILTRES_PILOT.find(function (f) { return f.id === state.filtrePilot; }) || FILTRES_PILOT[0];
  const passe = function (f, c) { return f.test(decisionDe(c), sig.parCode[c]); };
  const codes = tous.filter(function (c) { return passe(filtre, c); });
  if (codes.length && codes.indexOf(state.selPilot) < 0) state.selPilot = codes[0];
  // v23 : liste des processus à gauche des boutons de statut, sur une seule ligne.
  const chips = '<div class="filtres-ligne">' + filtreProcessusHtml() + filtrePropoHtml(avantPropo) + '<div class="chips">' + FILTRES_PILOT.map(function (f) {
    const n = tous.filter(function (c) { return passe(f, c); }).length;
    return '<button class="chip' + (f.id === filtre.id ? " active" : "") + '" onclick="filtrePilot(\'' + f.id + '\')">' + esc(f.label) + " (" + n + ")</button>";
  }).join("") + "</div></div>";
  const maxTot = Math.max(1, Math.max.apply(null, tous.map(function (c) { return sig.parCode[c].total; })));

  const picks = codes.map(function (c) {
    const p = sig.parCode[c], d = decisionDe(c), st = libStatut(d && d.statut);
    return '<button class="pick' + (state.selPilot === c ? " selected" : "") + '" onclick="selPilot(\'' + c + '\')" style="display:flex;gap:12px;align-items:center">' +
      anneauSignaux(p, maxTot) + '<div style="min-width:0">' +
      '<div style="font-weight:700;font-size:14px">' + esc(libelleType(c)) + (actifType(c) ? "" : " (désactivé)") + "</div>" +
      '<div class="psub">' + esc(st.label) + (d ? " · " + esc(libReponse(d.reponse)) : "") + (processusDe(c) ? " · " + esc(processusDe(c)) : "") +
      (aExaminer(p) ? " · à examiner" : "") + "</div></div>" +
      '<span style="margin-left:auto" title="Proposition de l\'assistant : ' + esc(PROPOS_PILOT.find(function (r) { return r.id === propoDe(c); }).label) + '">' + (propoDe(c) === "A_DEFINIR" ? "" : specIcone(propoDe(c), 24)) + "</span></button>";
  }).join("") || '<div class="card"><p class="note" style="margin:0">Aucune catégorie avec ce statut' + (filtreProcActif().length ? " et ce processus" : "") + (state.filtrePropo.length ? " et cette proposition" : "") + ".</p></div>";
  const legende = '<p class="note" style="margin-top:10px">Anneau : nombre total de signaux, rempli en proportion du type le plus signalé. Couleur selon les 2 dernières semaines observées : ' +
    '<b style="color:#e11d48">rouge</b> 3 signaux ou plus (à examiner) · <b style="color:#d97706">orange</b> 1 ou 2 · <b style="color:#059669">vert</b> aucun récent · <b style="color:#94a3b8">gris</b> aucun signal.</p>';

  const c = state.selPilot, p = sig.parCode[c], d = decisionDe(c), conf = confDe(c);
  const semaines = Object.keys(p.parSem).map(Number).sort(function (a, b) { return a - b; });
  const detailSem = semaines.length ? semaines.map(function (s) { return "S" + s + " : " + p.parSem[s]; }).join(" · ") : "aucun signal daté";
  const reco = conf.reco;
  // v19 : décision pré-remplie depuis une suggestion de l'IA acceptée (à relire puis enregistrer).
  const pre = state.prefillPilot && state.prefillPilot.code === c ? state.prefillPilot : null;
  const opt = function (list, val) { return list.map(function (x) { return '<option value="' + x.id + '"' + (x.id === val ? " selected" : "") + ">" + esc(x.label) + "</option>"; }).join(""); };
  const semDefaut = d && d.semaine_effet ? d.semaine_effet : p.semMax + 1;

  const right = '<div class="card">' +
    "<div class='spechead'>Ce que dit la base</div><div class='spech3'>" + esc(libelleType(c)) + "</div>" +
    '<a href="#" class="pick-fiche" onclick="ouvrirFiche(\'' + c + '\', false);return false">Ouvrir la fiche de l\'irritant →</a>' +
    '<p style="margin-top:8px;font-size:14px"><b>' + p.total + " signal(s)</b> " + esc(sourceDe(c)) + " (" + esc(detailSem) + (p.reels.length ? " · " + p.reels.length + " mail(s) réel(s)" : "") + ").</p>" +
    (c === CODE_CR && !p.disponible ? '<p class="note">Comptes rendus indisponibles dans la base : compteur à zéro par défaut.</p>' : "") +
    (aExaminer(p) ? '<p style="margin-top:4px">' + badge("b-rose", "À examiner : 3 signaux ou plus sur les 2 dernières semaines") + "</p>" : "") +
    '<p style="margin-top:10px;font-size:14px"><b>Proposition de l\'assistant :</b> ' + esc(libReponse(reco)) + (conf.action ? " : " + esc(conf.action) : "") + "</p>" +
    '<p class="note">Grille du livrable 01 : la réponse la plus simple qui suffit. Un agent seulement si la tâche demande du jugement ou de la rédaction.</p></div>' +
    (typeof avdCarte === "function" ? avdCarte(c) : "") +
    '<div class="card" id="decision-hrbp" style="margin-top:16px;border-color:#fde68a;background:#fffbeb;scroll-margin-top:130px"><div class="spechead" style="color:#b45309">Décision du HRBP</div>' +
      (d ? '<p style="font-size:13px;margin-top:6px">Décision actuelle : ' + badge(libStatut(d.statut).cls, libStatut(d.statut).label) + " " + esc(libReponse(d.reponse)) +
        " · effet en semaine " + esc(d.semaine_effet) + (d.maj && d.maj.toDate ? " · enregistrée le " + esc(d.maj.toDate().toLocaleString("fr-FR")) : "") + "</p>" +
        (d.statut === "VALIDE" ? '<a href="#" class="pick-fiche" style="display:inline-flex;gap:8px;align-items:center" onclick="allerSpec(\'' + c + '\');return false">' + specIcone(d.reponse, 24) + "Voir la spécification →</a>" : "")
        : '<p class="note">Aucune décision enregistrée pour cet irritant.</p>') +
      '<label class="fl">Statut<select id="dp-statut">' + opt(STATUTS_HRBP, pre ? "VALIDE" : d ? d.statut : "VALIDE") + "</select></label>" +
      '<label class="fl">Réponse retenue<select id="dp-reponse">' + opt(REPONSES_HRBP, pre ? pre.reponse : d ? d.reponse : reco) + "</select></label>" +
      '<label class="fl">Semaine à partir de laquelle la réponse s\'applique<input id="dp-sem" type="number" min="' + (p.semMax + 1) + '" max="53" value="' + esc(semDefaut) + '"></label>' +
      '<label class="fl">Commentaire (280 caractères maximum, sans nom de personne)<input id="dp-comm" maxlength="280" value="' + esc(pre ? pre.commentaire : d && d.commentaire ? d.commentaire : "") + '"></label>' +
      (pre ? '<p class="note">' + badge("b-violet", "IA") + " " + esc(pre.note || "Pré-rempli d'après la suggestion acceptée dans la Revue mensuelle : relisez, puis enregistrez vous-même.") + "</p>" : "") +
      '<div class="btns" style="margin-top:12px"><button class="btn ok" onclick="enregistrerDecision(\'' + c + '\')">Enregistrer la décision</button></div>' +
      (state.msgPilot ? '<p class="note">' + esc(state.msgPilot) + "</p>" : "") +
      '<p class="note">La décision porte sur un processus, jamais sur une personne. Sans décision « validé », aucune fiche n\'est produite.</p></div>';

  if (!codes.length) {
    return "<h2>Décisions</h2>" + bandeauVersionC() + chips + '<div class="row c-1-2"><div>' + picks + legende + "</div><div></div></div>";
  }
  return "<h2>Décisions</h2>" + bandeauVersionC() + chips +
    '<div class="row c-1-2"><div>' + picks + legende + "</div><div>" + right + "</div></div>";
}

// ------------------------------ SPÉCIFICATIONS -----------------------------

function filtreSpec(id) { state.filtreSpec = id; render(); }
// v40 : picto par réponse retenue (même style que les icônes des indicateurs de Tendances), couleur par réponse.
const SPEC_REP = {
  SIMPLIFIER:  { fond: "#dcfce7", encre: "#047857", svg: '<path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4M9.5 12h6M9.5 15.5h6"/>' },
  AUTOMATISER: { fond: "#e0f2fe", encre: "#0369a1", svg: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.5M12 18v2.5M3.5 12H6M18 12h2.5M6 6l1.8 1.8M16.2 16.2L18 18M6 18l1.8-1.8M16.2 7.8L18 6"/>' },
  ASSISTER:    { fond: "#eee8f5", encre: "#4b2882", svg: '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 8V4.5M10 4.5h4"/><circle cx="9.5" cy="13" r="1.2"/><circle cx="14.5" cy="13" r="1.2"/><path d="M3 12.5v2M21 12.5v2"/>' },
};
function specIcone(rep, taille) {
  const r = SPEC_REP[rep]; if (!r) return "";
  const t = taille || 30;
  return '<span class="tend-ic" aria-hidden="true" style="background:' + r.fond + ";color:" + r.encre + ";width:" + t + "px;height:" + t + 'px"><svg viewBox="0 0 24 24" width="' + Math.round(t * 0.6) + '" height="' + Math.round(t * 0.6) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + r.svg + "</svg></span>";
}
// v40 : liens croisés Spécification ↔ Décision du HRBP (le filtre « Processus » est conservé : l'irritant y passe déjà).
function allerVers(id) { setTimeout(function () { const el = document.getElementById(id); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 0); }
function allerDecision(code) { state.selPilot = code; state.filtrePilot = "TOUS"; state.msgPilot = ""; setTab("b_orienter"); allerVers("decision-hrbp"); }
function allerSpec(code) { state.filtreSpec = "TOUS"; setTab("b_spec"); allerVers("spec-" + code); }
// v13 : rappel en tête de page de ce qui est affiché.
function aideSpec() {
  return '<p class="note" style="margin:0 0 12px"><b>Ce qui apparaît ici :</b> les irritants au statut « Validé » dans « Décisions ». ' +
    "La fiche dépend de la réponse retenue : <b>Assister</b> ou <b>Automatiser</b> donnent une spécification complète (l'agent prépare, ou agit sur les cas standard) ; " +
    "<b>Simplifier</b> donne une fiche courte, sans outil à construire.</p>";
}

function viewPilotSpec() {
  const sig = aciaSignaux();
  if (!sig.ok) return messageSansBase("Spécifications", sig);
  let valides = typesPilotage().map(function (t) { return t.code; }).filter(function (c) { const d = decisionDe(c); return d && d.statut === "VALIDE"; });
  if (!valides.length) {
    return "<h2>Spécifications</h2>" + bandeauVersionC() + aideSpec() + '<div class="card"><p style="font-size:14px;margin:0">Aucun irritant validé pour l\'instant.</p><p class="note">Une fiche n\'est produite qu\'après une décision « validé » du HRBP, dans l\'onglet « Décisions ».</p></div>';
  }
  // v13 : filtre par réponse retenue. v39 : filtre « Processus » (le même que dans Décisions) appliqué d'abord ;
  // les compteurs des puces en tiennent compte.
  const tousValides = valides;
  valides = tousValides.filter(function (c) { return passeProcessus(c); });
  const fRep = state.filtreSpec || "TOUS";
  const visibles = valides.filter(function (c) { return fRep === "TOUS" || decisionDe(c).reponse === fRep; });
  const chips = '<div class="filtres-ligne" style="align-items:flex-start">' + filtreProcessusHtml() + '<span class="note" style="margin:0 0 10px;line-height:30px"><b>Réponse retenue :</b></span><div class="chips" style="margin:0 0 10px">' + [{ id: "TOUS", label: "Toutes" }].concat(REPONSES_HRBP).map(function (r) {
    const n = r.id === "TOUS" ? valides.length : valides.filter(function (c) { return decisionDe(c).reponse === r.id; }).length;
    return '<button class="chip' + (r.id === fRep ? " active" : "") + '" onclick="filtreSpec(\'' + r.id + '\')">' + (r.id === "TOUS" ? "" : specIcone(r.id, 18) + " ") + esc(r.label) + " (" + n + ")</button>";
  }).join("") + "</div></div>";
  const fiches = (visibles.length ? "" : '<div class="card" style="margin-top:12px"><p class="note" style="margin:0">Aucune spécification validée avec cette réponse' + (filtreProcActif().length ? " et ce processus" : "") + '.</p></div>') + visibles.map(function (c) {
    const d = decisionDe(c), p = sig.parCode[c], conf = confDe(c);
    const semaines = Object.keys(p.parSem).map(Number).sort(function (a, b) { return a - b; });
    const lienDec = '<a href="#" class="pick-fiche" onclick="allerDecision(\'' + c + '\');return false">Voir la décision du HRBP →</a>';
    if (d.reponse === "SIMPLIFIER") {
      return '<div class="card" id="spec-' + c + '" style="margin-top:12px;scroll-margin-top:130px"><div class="kpi-h">' + specIcone(d.reponse) + '<div class="spechead">Réponse sans IA : pas de spécification d\'outil</div></div><div class="spech3">' + esc(libelleType(c)) + "</div>" + lienDec +
        '<p style="font-size:14px;margin-top:6px"><b>Action :</b> ' + esc(conf.action || "À définir par le HRBP.") + "</p>" +
        '<p class="note">Signal observé : ' + p.total + " signal(s). Indicateur de suivi : " + esc(conf.indicateur) + ".</p></div>";
    }
    const besoin = conf.besoin || conf.action || "";
    const autonomie = d.reponse === "ASSISTER" ? "Préparer : l'agent prépare, un humain relit et envoie." : "Agir sur les cas standard, sans jugement ; tout cas hors règle revient à un humain.";
    const ligne = function (k, v) { return "<tr><td style='padding:6px 10px 6px 0;color:#64748b;vertical-align:top;white-space:nowrap'>" + esc(k) + "</td><td style='padding:6px 0'>" + v + "</td></tr>"; };
    const workflow = (conf.workflow || ["À définir"]).map(function (s, k) { return (k + 1) + ". " + esc(s); }).join("<br>");
    return '<div class="card" id="spec-' + c + '" style="margin-top:12px;scroll-margin-top:130px"><div class="kpi-h">' + specIcone(d.reponse) + '<div class="spechead">Fiche générée à partir de la base · ' + esc(libReponse(d.reponse)) + '</div></div><div class="spech3">' + esc(libelleType(c)) + "</div>" + lienDec +
      '<table style="margin-top:8px;font-size:13px"><tbody>' +
      ligne("Besoin métier", esc(besoin)) +
      ligne("Signal observé", p.total + " signal(s) " + sourceDe(c) + (semaines.length ? " (semaines " + semaines.join(", ") + ")" : "") + ".") +
      ligne("Entrées", esc(conf.entrees || "À définir")) +
      ligne("Sorties", esc(conf.sorties || "À définir")) +
      ligne("Workflow", workflow) +
      ligne("Niveau d'autonomie", esc(autonomie)) +
      ligne("Garde-fous", "Aucun mail ni compte rendu confidentiel traité ; aucune donnée sur une personne ; " + (d.reponse === "AUTOMATISER" ? "seule la réponse standard part automatiquement ; tout autre envoi passe par une validation humaine." : "rien n'est envoyé sans validation humaine.")) +
      ligne("Indicateur de suivi", esc(conf.indicateur) + ", mesuré dans l'onglet « Revue mensuelle ».") +
      ligne("Décision", "Effet à partir de la semaine " + esc(d.semaine_effet) + (d.commentaire ? " · « " + esc(d.commentaire) + " »" : "")) +
      "</tbody></table>" + (d.reponse === "ASSISTER" && typeof skillBloc === "function" ? skillBloc(c) : "") + "</div>";
  }).join("");
  return "<h2>Spécifications</h2>" + bandeauVersionC() + aideSpec() + chips + fiches +
    '<p class="note">Fiches remplies automatiquement avec les données de la base et la grille du livrable 01. Elles ne se mettent pas à jour seules en texte libre : une rédaction plus riche se fait avec Claude, à partir de cette fiche.</p>';
}

// ------------------------------ SUIVI DES RÉPONSES -------------------------

function viewPilotSuivre() {
  const sig = aciaSignaux();
  if (!sig.ok) return messageSansBase("Suivi des réponses", sig);
  const suivis = typesPilotage().map(function (t) { return t.code; }).filter(function (c) { const d = decisionDe(c); return d && d.statut !== "ECARTE"; });
  if (!suivis.length) {
    return "<h2>Suivi des réponses</h2>" + bandeauVersionC() + '<div class="card"><p style="font-size:14px;margin:0">Aucune décision à suivre pour l\'instant.</p><p class="note">Le suivi compare les signaux avant et après la semaine d\'effet de chaque décision.</p></div>';
  }
  const cartes = suivis.map(function (c) {
    const d = decisionDe(c), p = sig.parCode[c], se = Number(d.semaine_effet) || 0;
    const semMax = p.semMax;
    const semaines = []; for (let s = 1; s <= Math.max(semMax, se); s++) semaines.push(s);
    const av = semaines.filter(function (s) { return s < se; }), ap = semaines.filter(function (s) { return s >= se && s <= semMax; });
    const somme = function (l) { return l.reduce(function (t, s) { return t + (p.parSem[s] || 0); }, 0); };
    const mAv = av.length ? somme(av) / av.length : null, mAp = ap.length ? somme(ap) / ap.length : null;
    let verdict;
    const nb = somme(av) + somme(ap);
    if (mAp !== null && mAv !== null && nb < 3) verdict = badge("b-slate", "Trop peu de signaux pour conclure");
    else if (mAp === null) verdict = badge("b-sky", "Pas encore de semaine après la décision");
    else if (mAv === null) verdict = badge("b-sky", "Pas de semaine avant la décision");
    else if (mAp < mAv * 0.8) verdict = badge("b-emerald", "En baisse");
    else if (mAp > mAv * 1.2) verdict = badge("b-rose", "En hausse");
    else verdict = badge("b-amber", "Stable");
    const fmt = function (m) { return m === null ? "—" : (Math.round(m * 10) / 10).toString().replace(".", ","); };
    const cases = semaines.map(function (s) {
      const v = p.parSem[s] || 0, apres = s >= se;
      return '<td style="text-align:center;padding:4px 6px;font-weight:700;' + (apres ? "background:#ecfdf5" : "") + '">' + (s > semMax ? "·" : v) + '<br><small style="font-weight:400;color:#64748b">S' + s + "</small></td>";
    }).join("");
    return '<div class="card" style="margin:0"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap">' +
      '<div class="irrtitle">' + esc(libelleType(c)) + "</div>" + verdict + "</div>" +
      '<div class="irrdetail">' + esc(libReponse(d.reponse)) + " · " + esc(libStatut(d.statut).label) + " · effet en semaine " + esc(se) + "</div>" +
      '<div class="tw" style="margin-top:8px"><table style="font-size:12px"><tbody><tr>' + cases + "</tr></tbody></table></div>" +
      '<p style="font-size:13px;margin-top:6px">Moyenne par semaine : <b>' + fmt(mAv) + "</b> avant · <b>" + fmt(mAp) + "</b> après</p>" +
      (p.reels.length ? '<p class="note">' + p.reels.length + " mail(s) réel(s) sans semaine fictive, non comptés dans la comparaison.</p>" : "") + "</div>";
  }).join("");
  return "<h2>Suivi des réponses</h2>" + bandeauVersionC() +
    '<div class="row" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px">' + cartes + "</div>" +
    '<p class="note">Mesure réelle, tirée des mails classés et des comptes rendus analysés : signaux par semaine avant et après la semaine d\'effet (fond vert). « En baisse » = au moins 20 % de moins en moyenne. Peu de semaines = conclusion fragile : à lire comme une tendance, pas comme une preuve.</p>';
}
