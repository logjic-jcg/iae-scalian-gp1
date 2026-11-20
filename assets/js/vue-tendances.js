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
// administrée par le HRBP (onglet « Types des irritants ») et lue par Make à
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
  liste.forEach(function (d) { d.reponse = REPONSE_TYPE[d.code] || "À définir par le HRBP"; });
  return liste;
}
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
  const entete = "<h2>Fil d'observation : boîte RH et comptes rendus</h2>" +
    '<p class="note" style="margin:-4px 0 8px">Sources : boîte RH partagée (mails) · comptes rendus de réunion (Notion). Les deux sont lues automatiquement par Make + Claude ; rien n\'est saisi à la main.</p>' +
    blocRelance() +
    '<p style="margin:0 0 12px;font-size:13px">Aller à : <a href="#" onclick="allerSection(\'sec-mails\');return false">Boîte RH partagée</a> · <a href="#" onclick="allerSection(\'sec-reunions\');return false">Comptes rendus de réunion ↓</a></p>' +
    '<h3 id="sec-mails" style="margin-top:4px">Boîte RH partagée</h3>';
  if (!fb || fb.statut !== "ok") {
    const msg = !fb || fb.statut === "chargement" ? "Lecture de Firebase en cours…" : "Données indisponibles : " + fb.erreur;
    return entete + '<div class="card"><p class="note" style="margin:0">' + esc(msg) + "</p>" +
      '<p class="note">Aucun chiffre n\'est affiché sans la base : rien n\'est simulé sur cet écran.</p></div>';
  }
  const docs = fb.docs;
  const ecartes = docs.filter(function (d) { return d.type === "ECARTE"; }).length;
  const analyses = docs.filter(function (d) { return d.type !== "ECARTE"; });
  const avecIrr = analyses.filter(function (d) { return CODES_HORS_IRRITANT.indexOf(d.type) < 0; }).length;
  const aVerifier = analyses.filter(function (d) { return d.confiance === "BASSE"; }).length;
  let derniere = null;
  docs.forEach(function (d) { const t = d.maj && d.maj.toDate ? d.maj.toDate() : null; if (t && (!derniere || t > derniere)) derniere = t; });

  const types = typesMail();
  // Comptage des signaux (irritant principal + secondaire) par type et par semaine.
  const semaines = {}, total = {}, parSem = {}, inconnus = {};
  analyses.forEach(function (d) {
    const s = semaineDe(d); semaines[s.cle] = s;
    [d.type, d.type_secondaire].forEach(function (c, i) {
      c = String(c || "").trim();
      if (!c || CODES_HORS_IRRITANT.indexOf(c) >= 0) return;
      if (i === 1 && c === d.type) return;            // même code deux fois : compté une fois
      if (!types.some(function (t) { return t.code === c; })) { inconnus[c] = (inconnus[c] || 0) + 1; return; }
      total[c] = (total[c] || 0) + 1;
      parSem[c + "|" + s.cle] = (parSem[c + "|" + s.cle] || 0) + 1;
    });
  });
  const cols = Object.keys(semaines).map(function (k) { return semaines[k]; }).sort(function (a, b) { return a.ordre - b.ordre; });
  const max = Math.max(1, Math.max.apply(null, Object.keys(parSem).map(function (k) { return parSem[k]; }).concat([0])));
  const maxTot = Math.max(1, Math.max.apply(null, Object.keys(total).map(function (k) { return total[k]; }).concat([0])));
  // Un type désactivé reste affiché tant qu'il a des signaux (historique conservé).
  const lignes = types.filter(function (t) { return t.actif || total[t.code]; }).sort(function (a, b) { return (total[b.code] || 0) - (total[a.code] || 0); });

  const tiles = [
    ["Mails analysés", String(analyses.length), "Depuis la mise en service du classement"],
    ["Mails signalant un irritant", String(avecIrr) + " / " + analyses.length, "Les autres : information, invitation, newsletter"],
    ["Mails écartés sans lecture IA", String(ecartes), "Confidentiel, santé, conflit : seul le nombre est gardé"],
    ["Classements à vérifier", String(aVerifier), "Confiance « basse » donnée par l'IA"],
  ];
  const kpis = '<div class="kpis">' + tiles.map(function (t) {
    return '<div class="kpi"><div class="spechead">' + esc(t[0]) + '</div><div class="kv">' + esc(t[1]) + '</div><div class="irrdetail" style="margin-top:4px">' + esc(t[2]) + "</div></div>";
  }).join("") + "</div>";

  const bars = lignes.map(function (t) {
    const v = total[t.code] || 0;
    return '<div class="bar"><span class="lbl">' + esc(t.label) + (t.actif ? "" : " (désactivé)") + '</span><span class="track"><span class="fill" style="display:block;width:' + Math.round(v / maxTot * 100) + '%"></span></span><span class="val">' + v + "</span></div>";
  }).join("");

  const tete = "<tr><th>Irritant</th>" + cols.map(function (c) { return "<th>" + esc(c.label) + "</th>"; }).join("") + "<th>Réponse la plus simple qui suffit</th></tr>";
  const corps = lignes.map(function (t) {
    return "<tr><td><b>" + esc(t.label) + "</b>" + (t.actif ? "" : " <small>(désactivé)</small>") + "</td>" + cols.map(function (c) {
      const v = parSem[t.code + "|" + c.cle] || 0;
      const a = v ? (0.12 + 0.6 * v / max).toFixed(2) : 0;
      return '<td style="text-align:center;font-weight:700;background:rgba(228,0,91,' + a + ')">' + (v || "") + "</td>";
    }).join("") + "<td><small>" + esc(t.reponse) + "</small></td></tr>";
  }).join("");

  const nbInconnus = Object.keys(inconnus).reduce(function (s, k) { return s + inconnus[k]; }, 0);
  const source = badge("b-emerald", "● Firebase, en direct") +
    ' <span class="note">' + (derniere ? "Dernière analyse : " + esc(derniere.toLocaleString("fr-FR")) : "") + "</span>";

  return entete + '<div class="card"><div>' + source + "</div>" + kpis + "</div>" +
    '<div class="card" style="margin-top:16px"><div class="spechead">Signaux par irritant (irritant principal + secondaire)</div>' + bars +
    (nbInconnus ? '<p class="note">' + nbInconnus + " code(s) renvoyé(s) par l'IA non reconnu(s), non comptés.</p>" : "") + "</div>" +
    '<div class="card" style="margin-top:16px"><div class="spechead">Évolution par semaine</div>' +
    '<div class="tw" style="margin-top:8px"><table><thead>' + tete + "</thead><tbody>" + corps + "</tbody></table></div>" +
    '<p class="note">Semaines « fictives » : jour du scénario de démo indiqué dans le mail. Les mails réels sont rangés par semaine de réception.</p></div>' +
    '<p class="note">Ce que cet écran ne montre pas, volontairement : aucun mail, aucun expéditeur, aucun objet, aucun nom. La base ne les stocke pas. Classement automatique toutes les heures (lun-sam, 8h-20h) par Claude Haiku via Make ; la confiance est une auto-évaluation de l\'IA, pas une probabilité mesurée.</p>';
}

// v13 : raccourci vers une section de l'onglet, sous l'en-tête fixe.
function allerSection(id) {
  const el = document.getElementById(id); if (!el) return;
  const h = document.querySelector("header.app"), haut = h && getComputedStyle(h).position !== "static" ? h.offsetHeight : 0;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - haut - 12, behavior: "smooth" });
}

// ---------------------------------------------------------------------------
// v13 : bouton « Actualiser maintenant ». Affiché seulement si le paramètre
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
  return '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 10px">' +
    '<button class="btn slim" style="padding:7px 12px;font-size:13px"' + (attente ? " disabled" : "") + ' onclick="relancerTraitement()">⟳ Actualiser maintenant</button>' +
    '<span class="note" style="margin:0">' + esc(state.msgRelance ||
      (attente ? "Dernière relance à " + heure(der) + " : prochaine possible à " + heure(prochaine) + "." :
       der ? "Dernière relance à la demande : " + der.toLocaleString("fr-FR") + "." : "Relance la lecture de la boîte RH et des comptes rendus.")) + "</span></div>";
}
function relancerTraitement() {
  state.msgRelance = "Relance envoyée : les résultats apparaîtront ici d'eux-mêmes d'ici une à deux minutes.";
  render();
  fetch(ACIA_URL_RELANCE, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: "source=site" })
    .catch(function () { state.msgRelance = "Relance impossible : Make n'a pas répondu."; render(); });
  setTimeout(function () { state.msgRelance = ""; if (state.tab === "tendances") render(); }, 60000);
}
