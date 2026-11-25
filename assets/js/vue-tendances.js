// ---------------------------------------------------------------------------
// Onglet HRBP « Tendances de la boîte » (v8)
// ---------------------------------------------------------------------------
// Lit la collection Firestore « classement_mails », écrite toutes les heures
// par le scénario Make « ACIA : classement de la boîte HRBP (irritants) » :
//   boîte partagée → filtre confidentiel (sans IA) → Claude Haiku → Firestore.
// Chaque document = un mail, SANS expéditeur ni objet : type, type_secondaire,
// confiance, jour_fictif, recu, source, maj.
// L'écran n'affiche que des agrégats (aucune liste de mails, aucun nom).
// Si la base est indisponible, aucun chiffre n'est inventé : message seulement.
// ---------------------------------------------------------------------------
// v13 : la liste des types vient de la table Firestore « types_irritants »,
// administrée par le HRBP (onglet « Types d’irritants ») et lue par Make à
// chaque passage. Le code est figé, seul le titre peut changer : les tendances
// restent comparables. Si la table est indisponible, repli sur la liste d'origine.
const TYPES_MAIL_DEFAUT = [
  { code: "ANNONCE_INCOMPLETE",   label: "Annonce d'arrivée incomplète" },
  { code: "DEMANDE_TARDIVE",      label: "Demande au support trop tardive" },
  { code: "HORS_BOUCLE",          label: "Service tenu hors de la boucle" },
  { code: "PREMIER_JOUR_DEGRADE", label: "Premier jour dégradé" },
  { code: "QUESTION_RECURRENTE",  label: "Question récurrente d'arrivant" },
  { code: "PIECES_RENVOYEES",     label: "Pièces renvoyées" },
  { code: "DOC_DISPERSEE",        label: "Documentation dispersée" },
  { code: "AUTRE",                label: "Autre" },
];
// Réponse la plus simple qui suffit (grille du livrable 01) ; un type créé par le HRBP n'en a pas encore.
const REPONSE_TYPE = {
  ANNONCE_INCOMPLETE: "Assister : agent d'intégration (démo)",
  DEMANDE_TARDIVE: "Assister : agent d'intégration (délais calculés)",
  HORS_BOUCLE: "Simplifier : liste de diffusion, sans IA",
  PREMIER_JOUR_DEGRADE: "Conséquence : se traite en amont (annonce, délais)",
  QUESTION_RECURRENTE: "Simplifier : FAQ jointe au mail de bienvenue",
  PIECES_RENVOYEES: "Automatiser : accusé de réception, sans IA",
  DOC_DISPERSEE: "Simplifier : page de référence unique",
  ACTIONS_NON_FERMEES: "Simplifier : modèle de compte rendu avec tableau d'actions",
  AUTRE: "Relire : si un motif revient, créer un nouveau type",
};
function tableTypesOk() { const fb = window.ACIA_FB.types_irritants; return !!(fb && fb.statut === "ok" && fb.docs.length); }
// Tous les types de la table (actifs et désactivés), triés par ordre.
function typesTable() {
  if (!tableTypesOk()) return null;
  return window.ACIA_FB.types_irritants.docs.slice().sort(function (a, b) { return (Number(a.ordre) || 0) - (Number(b.ordre) || 0); });
}
// Types de la source « mails » : { code, label, reponse, actif }.
function typesMail() {
  const t = typesTable();
  const liste = t ? t.filter(function (d) { return d.source !== "COMPTES_RENDUS"; }).map(function (d) { return { code: d.id, label: d.titre || d.id, actif: d.actif !== false }; })
                  : TYPES_MAIL_DEFAUT.map(function (d) { return { code: d.code, label: d.label, actif: true }; });
  liste.forEach(function (d) { d.reponse = REPONSE_TYPE[d.code] || "À définir par le HRBP"; d.processus = processusDe(d.code); });
  return liste;
}

// ---------------------------------------------------------------------------
// v14 : filtre « Processus » (liste déroulante à choix multiples), partagé par
// « Tendances » et « Décisions ». Le processus est un
// champ texte de la table « types_irritants ». Aucune case cochée = tout afficher.
// La comparaison ignore la casse et les espaces en trop.
// ---------------------------------------------------------------------------
const PROC_NR = "_NR";   // « Non renseigné »
state.filtreProc = state.filtreProc || [];
state.procOuvert = !!state.procOuvert;
function procTexte(v) { return String(v || "").trim().replace(/\s+/g, " "); }
function procCle(v) { const t = procTexte(v); return t ? t.toLowerCase() : PROC_NR; }
function processusDe(code) {
  const t = typesTable(), d = t && t.find(function (x) { return x.id === code; });
  return d ? procTexte(d.processus) : "";
}
// Valeurs proposées : celles présentes dans la table (+ « Non renseigné » si un type n'en a pas).
function choixProcessus() {
  const vus = {}, out = []; let nr = false;
  (typesTable() || []).forEach(function (d) {
    const t = procTexte(d.processus); if (!t) { nr = true; return; }
    const k = t.toLowerCase(); if (!vus[k]) { vus[k] = 1; out.push({ cle: k, label: t }); }
  });
  out.sort(function (a, b) { return a.label.localeCompare(b.label, "fr"); });
  if (nr) out.push({ cle: PROC_NR, label: "Non renseigné" });
  return out;
}
function filtreProcActif() {
  const dispo = choixProcessus().map(function (c) { return c.cle; });
  return state.filtreProc.filter(function (k) { return dispo.indexOf(k) >= 0; });
}
function passeProcessus(code) {
  const f = filtreProcActif();
  return !f.length || f.indexOf(procCle(processusDe(code))) >= 0;
}
function basculerProc(cle) {
  const i = state.filtreProc.indexOf(cle);
  if (i >= 0) state.filtreProc.splice(i, 1); else state.filtreProc.push(cle);
  state.procOuvert = true; render();
}
function viderProc() { state.filtreProc = []; state.procOuvert = false; render(); }
function filtreProcessusHtml() {
  const choix = choixProcessus();
  if (!choix.length) return "";
  const actifs = filtreProcActif();
  const resume = !actifs.length ? "Tous" : choix.filter(function (c) { return actifs.indexOf(c.cle) >= 0; }).map(function (c) { return c.label; }).join(", ");
  const cases = choix.map(function (c) {
    return '<label style="display:flex;gap:8px;align-items:center;padding:5px 4px;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap">' +
      '<input type="checkbox" style="width:auto;margin:0"' + (actifs.indexOf(c.cle) >= 0 ? " checked" : "") + ' data-cle="' + esc(c.cle) + '" onchange="basculerProc(this.dataset.cle)"> ' + esc(c.label) + "</label>";
  }).join("");
  return '<details class="proc-filtre" style="position:relative;display:inline-block;margin:0 0 10px"' + (state.procOuvert ? " open" : "") + ' ontoggle="state.procOuvert=this.open">' +
    '<summary class="chip' + (actifs.length ? " active" : "") + '" style="list-style:none;display:inline-block">Processus : ' + esc(resume) + " ▾</summary>" +
    '<div style="position:absolute;z-index:30;top:calc(100% + 4px);left:0;min-width:220px;background:#fff;border:1px solid #cbd5e1;border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,.12);padding:6px 8px">' +
    cases + '<div style="border-top:1px solid #e2e8f0;margin-top:4px;padding-top:6px;display:flex;justify-content:space-between;gap:8px">' +
    '<button class="chip" onclick="viderProc()">Tout afficher</button><button class="chip" onclick="state.procOuvert=false;render()">Fermer</button></div></div></details>';
}
// v41 : option « Masquer les irritants sans signal » (Tendances et Tableau de bord), partagée entre les deux onglets.
function basculerVides() { state.masquerVides = !state.masquerVides; render(); }
function boutonSansSignal() {
  return '<button class="chip' + (state.masquerVides ? " active" : "") + '" style="margin:0" aria-pressed="' + (state.masquerVides ? "true" : "false") + '" onclick="basculerVides()">' +
    (state.masquerVides ? "✓ " : "") + "Masquer les irritants sans signal</button>";
}
// Ferme la liste quand on clique ailleurs.
document.addEventListener("click", function (e) {
  if (!state.procOuvert) return;
  if (e.target && e.target.closest && e.target.closest(".proc-filtre")) return;
  state.procOuvert = false;
  const d = document.querySelector(".proc-filtre"); if (d) d.open = false;
});
const CODES_HORS_IRRITANT = ["AUCUN", "ECARTE"];

function semaineDe(doc) {
  const m = /^J(\d+)$/.exec(String(doc.jour_fictif || "").trim());
  if (m) { const s = Math.ceil(Number(m[1]) / 7); return { cle: "f" + s, label: "Semaine " + s + " (fictive)", ordre: s }; }
  const d = doc.recu && doc.recu.toDate ? doc.recu.toDate() : null;
  if (!d) return { cle: "x", label: "Sans date", ordre: 999 };
  const lundi = new Date(d); lundi.setHours(0, 0, 0, 0); lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7));
  return { cle: "r" + lundi.getTime(), label: "Sem. du " + lundi.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), ordre: 100 + lundi.getTime() / 864e5 };
}

function viewTendances() {
  const fb = window.ACIA_FB.classement_mails;
  // v27 : en-tête allégé : sources = liens vers leur partie ; filtre à gauche, relance à droite.
  const entete = "<h2>Fil d'observation : boîte RH et comptes rendus</h2>" +
    '<p class="note tend-sources" style="margin:-4px 0 8px">Sources : <a href="#" onclick="allerSection(\'sec-mails\');return false">Boîte RH partagée (mails)</a> · ' +
    '<a href="#" onclick="allerSection(\'sec-reunions\');return false">Comptes rendus de réunion (Notion) ↓</a></p>' +
    '<div class="tend-outils"><span style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' + filtreProcessusHtml() + boutonSansSignal() + "</span>" + blocRelance() + "</div>" +
    '<h3 id="sec-mails" style="margin-top:4px">Boîte RH partagée</h3>';
  if (!fb || fb.statut !== "ok") {
    const msg = !fb || fb.statut === "chargement" ? "Lecture de la base en cours…" : "Données indisponibles : " + fb.erreur;
    return entete + '<div class="card"><p class="note" style="margin:0">' + esc(msg) + "</p>" +
      '<p class="note">Aucun chiffre n\'est affiché sans la base : rien n\'est simulé sur cet écran.</p></div>';
  }
  const docsTous = fb.docs;
  // v55 : période d'analyse (vue-periode.js) : toute la page suit la période choisie.
  const perB = perBornes(docsTous), grain = perEtat().grain;
  const docs = docsTous.filter(function (d) { return perDans(d, perB); });
  const ecartes = docs.filter(function (d) { return d.type === "ECARTE"; }).length;
  const analyses = docs.filter(function (d) { return d.type !== "ECARTE"; });
  const avecIrr = analyses.filter(function (d) { return CODES_HORS_IRRITANT.indexOf(d.type) < 0; }).length;
  // v62 : répartition par niveau de confiance (auto-évaluation de l'IA), sur tous les mails analysés.
  const tendNivConf = function (d) { return String(d.confiance || "").trim().toUpperCase(); };
  const confHaute = analyses.filter(function (d) { return tendNivConf(d) === "HAUTE"; }).length;
  const confMoyenne = analyses.filter(function (d) { return tendNivConf(d) === "MOYENNE"; }).length;
  const aVerifier = analyses.filter(function (d) { return tendNivConf(d) === "BASSE"; }).length;
  const confAutre = analyses.length - confHaute - confMoyenne - aVerifier;
  // v63 : motif générique donné par l'IA (champ motif_confiance, absent avant le 25/11 22h45).
  const TEND_MOTIFS = { EXPLICITE: "écrit explicitement", DEDUIT: "déduit du contexte", PLUSIEURS_TYPES: "plusieurs types possibles", PEU_D_INFO: "mail trop court ou vague", HORS_LISTE: "hors des types de la liste", NON_PRECISE: "motif non reconnu" };
  const motifsDe = function (niveau) {
    const n = {}; let sans = 0;
    analyses.forEach(function (d) {
      if (tendNivConf(d) !== niveau) return;
      const m = String(d.motif_confiance || "").trim().toUpperCase();
      if (!m) { sans++; return; }
      n[m] = (n[m] || 0) + 1;
    });
    const parts = Object.keys(n).sort(function (a, b) { return n[b] - n[a]; }).map(function (m) { return (TEND_MOTIFS[m] || m.toLowerCase()) + " " + n[m]; });
    if (sans) parts.push("sans motif (classé avant le 25/11) " + sans);
    return parts.length ? " · Motifs : " + parts.join(", ") : "";
  };
  const surTotal = function (v) { return String(v) + " / " + analyses.length + (analyses.length ? " · " + Math.round(v * 100 / analyses.length) + " %" : ""); };
  let derniere = null;
  docs.forEach(function (d) { const t = d.maj && d.maj.toDate ? d.maj.toDate() : null; if (t && (!derniere || t > derniere)) derniere = t; });

  const types = typesMail();
  // Comptage des signaux (irritant principal + secondaire) par type et par semaine.
  const total = {}, parSem = {}, inconnus = {};
  analyses.forEach(function (d) {
    const s = { cle: perCle(d, grain) };
    [d.type, d.type_secondaire].forEach(function (c, i) {
      c = String(c || "").trim();
      if (!c || CODES_HORS_IRRITANT.indexOf(c) >= 0) return;
      if (i === 1 && c === d.type) return;            // même code deux fois : compté une fois
      if (!types.some(function (t) { return t.code === c; })) { inconnus[c] = (inconnus[c] || 0) + 1; return; }
      total[c] = (total[c] || 0) + 1;
      parSem[c + "|" + s.cle] = (parSem[c + "|" + s.cle] || 0) + 1;
    });
  });
  const cols = perColonnes(perB, grain);
  // Frise et comparaison : signaux par jour sur toute la boîte, période précédente de même durée.
  const sigJour = {};
  docsTous.forEach(function (d) {
    if (d.type === "ECARTE") return; const j = perJour(d); if (!j) return;
    [d.type, d.type_secondaire].forEach(function (c, i) { c = String(c || "").trim(); if (!c || CODES_HORS_IRRITANT.indexOf(c) >= 0 || (i === 1 && c === d.type)) return; sigJour[perIso(j)] = (sigJour[perIso(j)] || 0) + 1; });
  });
  const nbJ = perNbJours(perB), avant = { du: perAjoute(perB.du, -nbJ), au: perAjoute(perB.du, -1) };
  const docsAvant = docsTous.filter(function (d) { return d.type !== "ECARTE" && perDans(d, avant); });
  const comparable = perEtat().preset !== "tout" && docsTous.some(function (d) { const j = perJour(d); return j && j <= avant.au; });
  const ecart = function (v, w) { if (!comparable) return ""; const e = v - w; return " · " + (e > 0 ? "+" : "") + e + " vs période précédente"; };
  const avecIrrAvant = docsAvant.filter(function (d) { return CODES_HORS_IRRITANT.indexOf(d.type) < 0; }).length;
  const max = Math.max(1, Math.max.apply(null, Object.keys(parSem).map(function (k) { return parSem[k]; }).concat([0])));
  const maxTot = Math.max(1, Math.max.apply(null, Object.keys(total).map(function (k) { return total[k]; }).concat([0])));
  // Un type désactivé reste affiché tant qu'il a des signaux (historique conservé).
  // v14 : filtre « Processus » appliqué aux irritants affichés (les compteurs du haut restent globaux).
  const lignes = types.filter(function (t) { return (t.actif || total[t.code]) && passeProcessus(t.code) && (!state.masquerVides || total[t.code]); }).sort(function (a, b) { return (total[b.code] || 0) - (total[a.code] || 0); });

  const tiles = [
    ["Mails analysés", String(analyses.length), "Sur la période" + ecart(analyses.length, docsAvant.length), "mail"],
    ["Mails signalant un irritant", String(avecIrr) + " / " + analyses.length, "Sur la période" + ecart(avecIrr, avecIrrAvant), "drapeau"],
    ["Mails écartés sans lecture IA", String(ecartes), "Confidentiel, santé, conflit : seul le nombre est gardé", "bouclier"],
    ["Confiance haute", surTotal(confHaute), "Signal écrit explicitement. Seul niveau qui peut déclencher une réponse automatique, si le HRBP l'a décidée" + motifsDe("HAUTE"), "cible"],
    ["Confiance moyenne", surTotal(confMoyenne), "Signal déduit par l'IA : classé et compté, jamais de réponse automatique" + motifsDe("MOYENNE"), "jauge"],
    ["Classements à vérifier", surTotal(aVerifier), "Confiance « basse » donnée par l'IA : classé, jamais de réponse automatique" + (confAutre > 0 ? " · " + confAutre + " sans niveau de confiance renseigné" : "") + motifsDe("BASSE"), "loupe"],
  ];
  const kpis = '<div class="kpis">' + tiles.map(tendTuile).join("") + "</div>";

  const bars = lignes.map(function (t) {
    const v = total[t.code] || 0;
    return '<div class="bar"><span class="lbl">' + lienFiche(t.code, esc(t.label)) + (t.actif ? "" : " (désactivé)") + '</span><span class="track"><span class="fill" style="display:block;width:' + Math.round(v / maxTot * 100) + '%"></span></span><span class="val">' + v + "</span></div>";
  }).join("") || '<p class="note">Aucun irritant ' + (state.masquerVides ? "avec signal " : "") + "pour ce processus.</p>";

  const tete = '<tr><th class="per-fixe" style="min-width:210px">Irritant</th><th style="text-align:center" title="Total sur la période choisie, toutes colonnes comprises">Total</th>' + cols.map(function (c) { return '<th style="text-align:center;white-space:nowrap;min-width:44px">' + esc(c.label) + '<br><small style="font-weight:500">' + esc(c.sous) + "</small></th>"; }).join("") + '<th style="min-width:260px">Réponse la plus simple qui suffit</th></tr>';
  const corps = lignes.map(function (t) {
    return '<tr><td class="per-fixe"><b>' + lienFiche(t.code, esc(t.label)) + "</b>" + (t.actif ? "" : " <small>(désactivé)</small>") + "</td>" +
      '<td style="text-align:center;font-weight:700">' + (total[t.code] || 0) + "</td>" + cols.map(function (c) {
      const v = parSem[t.code + "|" + c.cle] || 0;
      const a = v ? (0.12 + 0.6 * v / max).toFixed(2) : 0;
      return '<td style="text-align:center;font-weight:700;background:rgba(228,0,91,' + a + ')">' + (v || "") + "</td>";
    }).join("") + "<td><small>" + esc(t.reponse) + "</small></td></tr>";
  }).join("");

  const nbInconnus = Object.keys(inconnus).reduce(function (s, k) { return s + inconnus[k]; }, 0);
  const source = badge("b-emerald", "● En direct") +
    ' <span class="note">' + (derniere ? "Dernier mail classé : " + esc(derniere.toLocaleString("fr-FR")) + " · boîte vérifiée toutes les heures (lun-sam, 8h-20h) ; sans nouveau mail, rien n'est réécrit." : "") + "</span>";

  return entete.replace('<h3 id="sec-mails"', perBarre(docsTous, sigJour) + '<h3 id="sec-mails"') + '<div class="card"><div>' + source + "</div>" + kpis + "</div>" +
    '<div class="card" style="margin-top:16px"><div class="kpi-h">' + tendIcone("etiquette") + '<div class="spechead">Signaux par irritant (irritant principal + secondaire) · ' + esc(perCourt(perB.du)) + " – " + esc(perCourt(perB.au)) + '</div></div>' +
    (filtreProcActif().length || state.masquerVides ? '<p class="note" style="margin:2px 0 6px">' + (filtreProcActif().length ? "Filtré par processus. " : "") + (state.masquerVides ? "Irritants sans signal masqués. " : "") + "Les compteurs du haut portent sur toute la boîte (pour la période choisie).</p>" : "") + bars +
    (nbInconnus ? '<p class="note">' + nbInconnus + " code(s) renvoyé(s) par l'IA non reconnu(s), non comptés.</p>" : "") + "</div>" +
    '<div class="card" style="margin-top:16px"><div class="kpi-h">' + tendIcone("courbe") + '<div class="spechead">Évolution par ' + grain + "</div></div>" +
    '<div class="tw" style="margin-top:8px"><table><thead>' + tete + "</thead><tbody>" + corps + "</tbody></table></div>" +
    '<p class="note">Dates de démonstration : le jour fictif J1 du scénario correspond au lundi ' + esc(PER_J1.toLocaleDateString("fr-FR")) + ' (S1 = semaine 1 du scénario). Un mail sans jour fictif est daté de sa réception. La colonne « Total » couvre toute la période : si le tableau est plus large que l\'écran, faites-le défiler vers la droite.</p></div>' +
    '<p class="note">Ce que cet écran ne montre pas, volontairement : aucun mail, aucun expéditeur, aucun objet, aucun nom. La base ne les stocke pas. Classement automatique toutes les heures (lun-sam, 8h-20h) par Claude Haiku via Make ; la confiance est une auto-évaluation de l\'IA, pas une probabilité mesurée.</p>';
}

// v13 : raccourci vers une section de l'onglet, sous l'en-tête fixe.
function allerSection(id) {
  const el = document.getElementById(id); if (!el) return;
  const h = document.querySelector("header.app"), haut = h && getComputedStyle(h).position !== "static" ? h.offsetHeight : 0;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - haut - 12, behavior: "smooth" });
}

// ---------------------------------------------------------------------------
// v13 : bouton « Actualiser » (v27 : à droite du filtre Processus). Affiché seulement si le paramètre
// parametres/ihm.refresh_ihm vaut 1 (modifiable uniquement via Claude + Make).
// Le bouton appelle un webhook Make qui revérifie lui-même le paramètre,
// refuse s'il y a eu une relance dans les 10 dernières minutes, puis lance la
// lecture de la boîte RH et celle des comptes rendus. Les résultats arrivent
// d'eux-mêmes (écoute en direct de la base).
// ---------------------------------------------------------------------------
const ACIA_URL_RELANCE = "https://hook.eu1.make.com/qbsiods6ns41u0seto2yyafrx5sijo18";
const RELANCE_DELAI_MIN = 10;
state.msgRelance = state.msgRelance || "";
function parametresIhm() {
  const fb = window.ACIA_FB.parametres;
  if (!fb || fb.statut !== "ok") return null;
  return fb.docs.find(function (d) { return d.id === "ihm"; }) || null;
}
function blocRelance() {
  const p = parametresIhm();
  if (!p || Number(p.refresh_ihm) !== 1) return "";
  const der = p.derniere_relance && p.derniere_relance.toDate ? p.derniere_relance.toDate() : null;
  const prochaine = der ? new Date(der.getTime() + RELANCE_DELAI_MIN * 60000) : null;
  const attente = prochaine && prochaine > new Date();
  const heure = function (d) { return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); };
  if (attente && !window.__aciaRelanceTimer) {
    window.__aciaRelanceTimer = setTimeout(function () { window.__aciaRelanceTimer = null; if (state.tab === "tendances") render(); }, prochaine - new Date() + 1000);
  }
  const fmt = function (d) { return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + " à " + heure(d); };
  const info = state.msgRelance || (attente ? "Prochaine relance possible à " + heure(prochaine) : der ? "Dernière relance manuelle : " + fmt(der) : "");
  return '<div class="tend-relance">' + (info ? '<span class="tdb-sub">' + esc(info) + "</span>" : "") +
    '<button class="chip" ' + (attente ? "disabled " : "") + 'title="Relance la lecture de la boîte RH et des comptes rendus (une fois toutes les ' + RELANCE_DELAI_MIN + ' minutes au plus)" onclick="relancerTraitement()">⟳ Actualiser</button></div>';
}
function relancerTraitement() {
  state.msgRelance = "Relance envoyée : les résultats apparaîtront ici d'eux-mêmes d'ici une à deux minutes.";
  render();
  fetch(ACIA_URL_RELANCE, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: "source=site" })
    .catch(function () { state.msgRelance = "Relance impossible : Make n'a pas répondu."; render(); });
  setTimeout(function () { state.msgRelance = ""; if (state.tab === "tendances") render(); }, 60000);
}

// v23 : bouton flottant « haut de l'onglet », visible dès qu'on a défilé (tous les onglets).
function hautDePage() { window.scrollTo({ top: 0, behavior: "smooth" }); }
window.addEventListener("scroll", function () {
  const b = document.getElementById("btn-haut");
  if (b) b.classList.toggle("visible", window.scrollY > 500);
}, { passive: true });

// v28 : petites icônes des indicateurs (Tendances : boîte RH et comptes rendus).
const TEND_ICONES = {
  mail:     '<rect x="3.5" y="6" width="17" height="12.5" rx="2"/><path d="M4.5 7.5l7.5 6 7.5-6"/>',
  drapeau:  '<path d="M6 21V4"/><path d="M6 4.5h10.5l-2 3.5 2 3.5H6"/>',
  bouclier: '<path d="M12 3.5l7 2.8v5.2c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6.3z"/><path d="M9.5 12h5"/>',
  loupe:    '<circle cx="10.5" cy="10.5" r="5.5"/><path d="M15 15l5 5"/>',
  cible:    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.2"/>',
  jauge:    '<path d="M4 16a8 8 0 0 1 16 0"/><path d="M12 16l-3-4.5"/><path d="M4 19.5h16"/>',
  document: '<path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4M9.5 12h6M9.5 15.5h6"/>',
  horloge:  '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  personne: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5.5 20c.8-3.6 3.4-5.5 6.5-5.5"/><path d="M16 15l4 4M20 15l-4 4"/>',
  calendrier:'<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  etiquette:'<path d="M3.5 12.5V4.5h8l9 9-8 8z"/><circle cx="8" cy="9" r="1.4"/>',
  courbe:   '<path d="M4 19.5h16"/><path d="M5 16l4.5-5 3.5 3 6-7"/>',
  liste:    '<path d="M4.5 7l1.5 1.5 2.5-3M4.5 13l1.5 1.5 2.5-3M4.5 19l1.5 1.5 2.5-3"/><path d="M11.5 7h8M11.5 13h8M11.5 19h8"/>',
  groupe:   '<circle cx="9" cy="9" r="3"/><circle cx="16.5" cy="10" r="2.5"/><path d="M3.5 19c.6-3 2.7-4.8 5.5-4.8s4.9 1.8 5.5 4.8M15 14.6c2.5-.2 4.6 1.3 5.3 4.4"/>',
};
function tendIcone(nom) {
  return '<span class="tend-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (TEND_ICONES[nom] || "") + "</svg></span>";
}
// Tuile d'indicateur : [titre, valeur, détail, icône].
function tendTuile(t) {
  return '<div class="kpi"><div class="kpi-h">' + tendIcone(t[3]) + '<div class="spechead">' + esc(t[0]) + '</div></div><div class="kv">' + esc(t[1]) + '</div><div class="irrdetail" style="margin-top:4px">' + esc(t[2]) + "</div></div>";
}
