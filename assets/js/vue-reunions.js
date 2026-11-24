// ---------------------------------------------------------------------------
// Onglet HRBP « Tendances de la boîte » : bloc « Actions de réunion qui traînent » (v10)
// ---------------------------------------------------------------------------
// Lit la collection Firestore « comptes_rendus », écrite par le scénario Make
// « ACIA : lecture des comptes rendus Notion (actions) » :
//   base Notion des comptes rendus → filtre confidentiel (sans IA) → Claude Haiku → Firestore.
// Chaque document = un compte rendu : ref, instance, jour_reunion, jour_diffusion,
// services (présents), statut (ANALYSE / ECARTE), analyse (lignes produites par l'IA), maj.
// Lignes de « analyse » :
//   ACTION|libellé|NOUVELLE/REPORTEE/EN_COURS/FERMEE|OUI/NON (responsable désigné)
//   ABSENTS|services excusés ou absents | AUCUN
//   CONFIANCE|HAUTE/MOYENNE/BASSE
// Aucun nom de personne n'est stocké ni affiché : actions et services seulement.
// ---------------------------------------------------------------------------
const STATUTS_ACTION = {
  NOUVELLE: { court: "Nouvelle", cls: "b-sky" },
  REPORTEE: { court: "Reportée", cls: "b-rose" },
  EN_COURS: { court: "En cours", cls: "b-amber" },
  FERMEE:   { court: "Fermée",   cls: "b-emerald" },
};
const RETARD_DIFFUSION_J = 2;   // compte rendu diffusé 2 jours ou plus après la réunion

function lireAnalyseCR(texte) {
  const res = { actions: [], absents: [], confiance: "" };
  String(texte || "").split(/\r?\n/).forEach(function (l) {
    const p = l.split("|").map(function (s) { return s.trim(); });
    if (p[0] === "ACTION" && p[1]) {
      const st = String(p[2] || "").toUpperCase();
      res.actions.push({ libelle: p[1].toLowerCase(), statut: STATUTS_ACTION[st] ? st : "NOUVELLE", resp: String(p[3] || "").toUpperCase() === "OUI" });
    } else if (p[0] === "ABSENTS" && p[1] && p[1].toUpperCase() !== "AUCUN") {
      p[1].split(",").forEach(function (s) { s = s.trim().toLowerCase(); if (s) res.absents.push(s); });
    } else if (p[0] === "CONFIANCE") res.confiance = String(p[1] || "").toUpperCase();
  });
  return res;
}

function carteReunions() {
  const fb = window.ACIA_FB.comptes_rendus;
  const titre = '<div class="sec-titre"><h3 id="sec-reunions" style="margin:26px 0 0">Comptes rendus de réunion : actions qui traînent</h3>' +
    '<a href="#" class="lien-haut" onclick="hautDePage();return false">↑ Haut de l\'onglet</a></div>';
  if (!fb || fb.statut !== "ok") {
    const msg = !fb || fb.statut === "chargement" ? "Lecture de la base en cours…" : "Données indisponibles : " + fb.erreur;
    return titre + '<div class="card"><p class="note" style="margin:0">' + esc(msg) + "</p>" +
      '<p class="note">Aucun chiffre n\'est affiché sans la base : rien n\'est simulé.</p></div>';
  }
  // v14 : section masquée si le filtre « Processus » exclut l'irritant des comptes rendus.
  if (typeof passeProcessus === "function" && !passeProcessus("ACTIONS_NON_FERMEES")) {
    const pr = processusDe("ACTIONS_NON_FERMEES");
    return titre + '<div class="card"><p class="note" style="margin:0">Masqué par le filtre « Processus » (processus de cet irritant : ' + esc(pr || "non renseigné") + ").</p></div>";
  }
  const tous = fb.docs.filter(function (d) { return d.statut === "ANALYSE" || d.statut === "ECARTE"; })
    .sort(function (a, b) { return (Number(a.jour_reunion) || 0) - (Number(b.jour_reunion) || 0) || String(a.ref).localeCompare(String(b.ref)); });
  // v55 : période d'analyse. Les comptes rendus de la période sont affichés ; ceux d'avant
  // servent seulement à l'historique des actions (une action qui traîne depuis avant reste « qui traîne »).
  const perB = perBornes(perDocs());
  const dansPer = function (cr) { const j = perJourCR(cr); return !!j && j >= perB.du && j <= perB.au; };
  const avantPer = function (cr) { const j = perJourCR(cr); return !!j && j < perB.du; };
  const nonDates = tous.filter(function (d) { return !perJourCR(d); }).length;
  const crs = tous.filter(dansPer);
  const ecartes = crs.filter(function (d) { return d.statut === "ECARTE"; });
  const analyses = crs.filter(function (d) { return d.statut === "ANALYSE"; });
  const historique = tous.filter(function (d) { return d.statut === "ANALYSE" && avantPer(d); });
  const perTxt = perCourt(perB.du) + " – " + perCourt(perB.au);
  if (!tous.length) return titre + '<div class="card"><p class="note" style="margin:0">Aucun compte rendu analysé pour l\'instant.</p></div>';
  if (!crs.length) return titre + '<div class="card"><p class="note" style="margin:0">Aucun compte rendu sur la période choisie (' + esc(perTxt) + "). " + tous.length + " compte(s) rendu(s) en base, hors de cette période.</p></div>";

  // Suivi de chaque action d'un compte rendu à l'autre (même libellé = même action).
  const actions = {}, absents = {};
  let enRetard = 0, basse = 0;
  historique.concat(analyses).forEach(function (cr) {
    const a = lireAnalyseCR(cr.analyse);
    const dedans = dansPer(cr);
    if (dedans) {
      if (a.confiance === "BASSE") basse++;
      const delai = (Number(cr.jour_diffusion) || 0) - (Number(cr.jour_reunion) || 0);
      if (delai >= RETARD_DIFFUSION_J) enRetard++;
      a.absents.forEach(function (s) { absents[s] = (absents[s] || 0) + 1; });
    }
    a.actions.forEach(function (x) {
      const k = x.libelle;
      if (!actions[k]) actions[k] = { libelle: k, passages: {}, ouvertes: 0, avant: 0, fermee: null, resp: false, vue: false };
      if (dedans) actions[k].vue = true; else if (x.statut !== "FERMEE") actions[k].avant++;
      const act = actions[k];
      // Une action déjà vue n'est plus « nouvelle », quoi qu'en dise l'IA.
      let st = x.statut;
      if (st === "NOUVELLE" && Object.keys(act.passages).length) st = "REPORTEE";
      act.passages[cr.ref] = { statut: st, resp: x.resp };
      if (st === "FERMEE") act.fermee = cr.ref; else act.ouvertes++;
      act.resp = x.resp;   // état au dernier passage
      act.dernier = st;
    });
  });
  // Seules les actions évoquées dans un compte rendu de la période sont affichées.
  const liste = Object.keys(actions).map(function (k) { return actions[k]; }).filter(function (a) { return a.vue; });
  const trainent = liste.filter(function (a) { return a.dernier !== "FERMEE" && a.ouvertes >= 2; });
  const sansResp = liste.filter(function (a) { return a.dernier !== "FERMEE" && !a.resp; });
  const fermees = liste.filter(function (a) { return a.dernier === "FERMEE"; });

  const tiles = [
    ["Comptes rendus analysés", String(analyses.length), ecartes.length + " écarté(s) sans lecture IA (confidentiel)", "document"],
    ["Actions qui traînent", String(trainent.length), "Évoquées au moins 2 fois sans être fermées (passages antérieurs compris)", "horloge"],
    ["Actions sans responsable", String(sansResp.length), "Au dernier compte rendu où elles apparaissent", "personne"],
    ["Comptes rendus diffusés en retard", String(enRetard) + " / " + analyses.length, RETARD_DIFFUSION_J + " jours ou plus après la réunion", "calendrier"],
  ];
  const kpis = '<div class="kpis">' + tiles.map(tendTuile).join("") + "</div>";

  // Tableau : une ligne par action, une colonne par compte rendu (ordre chronologique).
  const lignes = liste.slice().sort(function (a, b) {
    const ra = a.dernier === "FERMEE" ? 1 : 0, rb = b.dernier === "FERMEE" ? 1 : 0;
    return ra - rb || b.ouvertes - a.ouvertes || a.libelle.localeCompare(b.libelle);
  });
  const tete = "<tr><th>Action</th>" + analyses.map(function (cr) {
    return '<th style="text-align:center">' + esc(cr.ref) + "<br><small>" + esc(perCourt(perJourCR(cr))) + " · J" + esc(cr.jour_reunion) + "</small></th>";
  }).join("") + "<th>Bilan</th></tr>";
  const corps = lignes.map(function (a) {
    const cells = analyses.map(function (cr) {
      const p = a.passages[cr.ref];
      if (!p) return "<td></td>";
      const s = STATUTS_ACTION[p.statut];
      return '<td style="text-align:center">' + badge(s.cls, s.court) + (p.resp || p.statut === "FERMEE" ? "" : '<br><small class="note">sans resp.</small>') + "</td>";
    }).join("");
    const bilan = a.dernier === "FERMEE"
      ? badge("b-emerald", "Fermée en " + a.fermee) + ' <small class="note">après ' + a.ouvertes + " passage(s) ouvert(s)</small>"
      : (a.ouvertes >= 2 ? badge("b-rose", "Traîne : " + a.ouvertes + " passages") : badge("b-slate", a.ouvertes + " passage")) +
        (a.avant ? ' <small class="note">dont ' + a.avant + " avant la période</small>" : "") +
        (a.resp ? "" : " " + badge("b-amber", "Sans responsable"));
    return "<tr><td><b>" + esc(a.libelle) + "</b></td>" + cells + "<td>" + bilan + "</td></tr>";
  }).join("");

  const abs = Object.keys(absents).sort(function (a, b) { return absents[b] - absents[a]; });
  const blocAbs = abs.length
    ? '<p style="margin:10px 0 0">' + abs.map(function (s) { return '<span class="badge b-violet" style="white-space:normal;display:inline-block;max-width:100%">' + esc(s + " : absent ou excusé dans " + absents[s] + " compte(s) rendu(s) sur " + analyses.length) + "</span>"; }).join(" ") + "</p>"
    : '<p class="note">Aucun service signalé absent.</p>';

  return titre +
    '<div class="card"><div>' + badge("b-emerald", "● En direct") + ' <span class="note">Source : base Notion des comptes rendus, lue par Make + Claude Haiku · réunions du ' + esc(perTxt) + "</span></div>" + kpis +
    (nonDates ? '<p class="note">' + nonDates + " compte(s) rendu(s) sans jour de réunion : hors période, non comptés.</p>" : "") + "</div>" +
    '<div class="card" style="margin-top:16px"><div class="kpi-h">' + tendIcone("liste") + '<div class="spechead">Suivi des actions d\'un compte rendu à l\'autre</div></div>' +
    '<div class="tw" style="margin-top:8px"><table><thead>' + tete + "</thead><tbody>" + corps + "</tbody></table></div>" +
    '<p class="note">Une même action est reconnue à son libellé : l\'IA réutilise le libellé déjà connu. Une action déjà vue n\'est jamais recomptée comme « nouvelle ». ' +
    fermees.length + " action(s) fermée(s) sur la période." + (historique.length ? " Les " + historique.length + " compte(s) rendu(s) antérieur(s) à la période comptent dans l\'historique des actions, sans colonne." : "") + "</p></div>" +
    '<div class="card" style="margin-top:16px"><div class="kpi-h">' + tendIcone("groupe") + '<div class="spechead">Services absents des réunions</div></div>' + blocAbs +
    '<p class="note">Compté par service, jamais par personne.</p></div>' +
    '<p class="note">Ce bloc ne montre aucun nom : ni participant, ni responsable d\'action. Un compte rendu confidentiel est écarté avant toute lecture par l\'IA : seul son nombre est gardé.' +
    (basse ? " " + basse + " analyse(s) en confiance « basse » à vérifier." : "") + "</p>" +
    '<p class="note"><b>Réponse la plus simple qui suffit :</b> un modèle de compte rendu avec un tableau d\'actions (responsable, échéance, statut) repris en tête du compte rendu suivant. Pas d\'agent nécessaire.</p>';
}

// Le bloc s'ajoute sous les tendances des mails.
const viewTendancesMails = viewTendances;
viewTendances = function () { return viewTendancesMails() + carteReunions(); };
