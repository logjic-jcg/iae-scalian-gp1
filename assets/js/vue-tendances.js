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
const TYPES_MAIL = [
  { code: "ANNONCE_INCOMPLETE",   label: "Annonce d'arrivée incomplète",   reponse: "Assister : agent d'intégration (démo)" },
  { code: "DEMANDE_TARDIVE",      label: "Demande au support trop tardive", reponse: "Assister : agent d'intégration (délais calculés)" },
  { code: "HORS_BOUCLE",          label: "Service tenu hors de la boucle",  reponse: "Simplifier : liste de diffusion, sans IA" },
  { code: "PREMIER_JOUR_DEGRADE", label: "Premier jour dégradé",            reponse: "Conséquence : se traite en amont (annonce, délais)" },
  { code: "QUESTION_RECURRENTE",  label: "Question récurrente d'arrivant",  reponse: "Simplifier : FAQ jointe au mail de bienvenue" },
  { code: "PIECES_RENVOYEES",     label: "Pièces renvoyées",                reponse: "Automatiser : accusé de réception, sans IA" },
  { code: "DOC_DISPERSEE",        label: "Documentation dispersée",         reponse: "Simplifier : page de référence unique" },
];
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
  const entete = "<h2>Tendances des irritants</h2>" +
    '<p class="note" style="margin:-4px 0 12px">Sources : boîte RH partagée (mails) · comptes rendus de réunion (Notion). Les deux sont lues automatiquement par Make + Claude ; rien n\'est saisi à la main.</p>' +
    '<h3 style="margin-top:4px">Boîte RH partagée</h3>';
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

  // Comptage des signaux (irritant principal + secondaire) par type et par semaine.
  const semaines = {}, total = {}, parSem = {}, inconnus = {};
  analyses.forEach(function (d) {
    const s = semaineDe(d); semaines[s.cle] = s;
    [d.type, d.type_secondaire].forEach(function (c, i) {
      c = String(c || "").trim();
      if (!c || CODES_HORS_IRRITANT.indexOf(c) >= 0) return;
      if (i === 1 && c === d.type) return;            // même code deux fois : compté une fois
      if (!TYPES_MAIL.some(function (t) { return t.code === c; })) { inconnus[c] = (inconnus[c] || 0) + 1; return; }
      total[c] = (total[c] || 0) + 1;
      parSem[c + "|" + s.cle] = (parSem[c + "|" + s.cle] || 0) + 1;
    });
  });
  const cols = Object.keys(semaines).map(function (k) { return semaines[k]; }).sort(function (a, b) { return a.ordre - b.ordre; });
  const max = Math.max(1, Math.max.apply(null, Object.keys(parSem).map(function (k) { return parSem[k]; }).concat([0])));
  const maxTot = Math.max(1, Math.max.apply(null, Object.keys(total).map(function (k) { return total[k]; }).concat([0])));
  const lignes = TYPES_MAIL.slice().sort(function (a, b) { return (total[b.code] || 0) - (total[a.code] || 0); });

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
    return '<div class="bar"><span class="lbl">' + esc(t.label) + '</span><span class="track"><span class="fill" style="display:block;width:' + Math.round(v / maxTot * 100) + '%"></span></span><span class="val">' + v + "</span></div>";
  }).join("");

  const tete = "<tr><th>Irritant</th>" + cols.map(function (c) { return "<th>" + esc(c.label) + "</th>"; }).join("") + "<th>Réponse la plus simple qui suffit</th></tr>";
  const corps = lignes.map(function (t) {
    return "<tr><td><b>" + esc(t.label) + "</b></td>" + cols.map(function (c) {
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
