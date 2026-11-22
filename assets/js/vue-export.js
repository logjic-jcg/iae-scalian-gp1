// ---------------------------------------------------------------------------
// v24 : « Exporter en PDF » et « Partager par mail » (profil HRBP)
// ---------------------------------------------------------------------------
// Pages concernées : fiche irritant, Revue mensuelle, Spécifications, Tableau de bord.
// - PDF : impression du navigateur (« Enregistrer au format PDF »), mise en page dédiée
//   (sans menus ni boutons), en-tête et pied de page ajoutés le temps de l'impression.
// - Mail : ouvre la messagerie avec un objet et un résumé (chiffres de la base) + le lien.
//   Un lien « mailto: » ne peut pas joindre de fichier : le PDF se joint à la main.
//   Sur mobile, le partage natif (navigator.share) remplace le lien mailto.
// Rien n'est envoyé par le site : c'est l'utilisateur qui envoie, depuis sa messagerie.
// Contenu : uniquement des agrégats déjà affichés, aucun nom, aucun extrait de mail.
// ---------------------------------------------------------------------------

const EXP_PAGES = { b_revue: "Revue mensuelle", b_spec: "Spécifications", b_pilotage: "Tableau de bord" };

// Page courante exportable : { cle, titre } ou null.
function expContexte() {
  if (state.ficheCode) return { cle: "fiche", titre: "Fiche irritant · " + (typeof libelleType === "function" ? libelleType(state.ficheCode) : state.ficheCode) };
  return EXP_PAGES[state.tab] ? { cle: state.tab, titre: EXP_PAGES[state.tab] } : null;
}
function expDate() { return new Date().toLocaleDateString("fr-FR"); }
function expLien() { return location.origin + location.pathname.replace(/app\.html$/, ""); }

// ------------------------------ PDF ----------------------------------------

function expPdf() {
  const c = expContexte(); if (!c) return;
  const titreAvant = document.title;
  document.title = "ACIA - " + c.titre.replace(/[·:]/g, "-") + " - " + new Date().toISOString().slice(0, 10);
  const tete = document.createElement("div"); tete.id = "exp-tete"; tete.className = "exp-print";
  tete.innerHTML = "<b>ACIA</b> · assistant d'amélioration continue · " + esc(c.titre) + "<span>Exporté le " + esc(new Date().toLocaleString("fr-FR")) + "</span>";
  const pied = document.createElement("div"); pied.id = "exp-pied"; pied.className = "exp-print";
  pied.textContent = "Source : boîte RH partagée et comptes rendus de réunion (Make + Claude → base), décisions du HRBP. " +
    "Agrégats uniquement : aucun nom, aucun extrait de mail. Données du jeu de démonstration du hackathon.";
  document.body.insertBefore(tete, document.body.firstChild); document.body.appendChild(pied);
  document.body.classList.add("exp-impression");
  const fin = function () {
    document.title = titreAvant; document.body.classList.remove("exp-impression");
    [tete, pied].forEach(function (e) { if (e.parentNode) e.parentNode.removeChild(e); });
    window.removeEventListener("afterprint", fin);
  };
  window.addEventListener("afterprint", fin);
  window.print();
  setTimeout(function () { if (document.body.classList.contains("exp-impression") && !window.matchMedia("print").matches) fin(); }, 1500);
}

// ------------------------------ MAIL ---------------------------------------

// Résumé texte de la page : chiffres de la base, jamais le texte libre de l'IA.
function expResume(c) {
  const L = [];
  if (c.cle === "fiche") {
    const code = state.ficheCode, sig = aciaSignaux();
    const p = sig.ok ? sig.parCode[code] : null, d = decisionDe(code), conf = confDe(code);
    L.push("Irritant : " + libelleType(code) + (typeof processusDe === "function" && processusDe(code) ? " (processus : " + processusDe(code) + ")" : ""));
    if (p) {
      const sem = Object.keys(p.parSem).map(Number).sort(function (a, b) { return a - b; }).map(function (s) { return "S" + s + " : " + p.parSem[s]; }).join(", ");
      L.push("Signaux : " + p.total + " au total" + (sem ? " (" + sem + ")" : "") + (aExaminer(p) ? ", à examiner" : ""));
      if (d && d.semaine_effet && typeof tdbEffet === "function") {
        const e = tdbEffet(p, Number(d.semaine_effet));
        L.push("Effet : " + TDB_VERDICT[e.verdict][1].toLowerCase() + (e.mAv !== null && e.mAp !== null ? " (moyenne avant " + tdbFr(e.mAv, 1) + ", après " + tdbFr(e.mAp, 1) + " par semaine)" : ""));
      }
    }
    L.push(d ? "Décision : " + libStatut(d.statut).label + ", " + libReponse(d.reponse) + ", effet à partir de la semaine " + d.semaine_effet
             : "Décision : aucune. Proposition de l'assistant : " + libReponse(conf.reco));
  } else if (c.cle === "b_spec") {
    const valides = typesPilotage().map(function (t) { return t.code; }).filter(function (x) { const d = decisionDe(x); return d && d.statut === "VALIDE"; });
    L.push(valides.length + " irritant(s) validé(s), avec la réponse retenue :");
    valides.forEach(function (x) { const d = decisionDe(x); L.push("- " + libelleType(x) + " : " + libReponse(d.reponse) + " (effet dès S" + d.semaine_effet + ")"); });
  } else {
    const S = tdbSections(c.titre);
    if (typeof S === "string") { L.push("Données de la base indisponibles au moment du partage."); return L; }
    const sig = S.lignes.filter(function (l) { return l.p.total > 0; });
    const dec = S.lignes.filter(function (l) { return l.d; });
    if (S.D.mode === "statique") L.push("Attention : instantané de démonstration (décisions d'exemple), pas la base en direct.");
    L.push(sig.length + " irritant(s) signalé(s), " + dec.length + " décision(s) du HRBP" + (S.partAgent === null ? "" : ", " + S.partAgent + " % des réponses font appel à un agent IA (cible : " + TDB_CIBLE_AGENT + " % au plus)") + ".");
    if (c.cle === "b_revue") {
      const ef = S.lignes.filter(function (l) { return l.effet; });
      if (ef.length) { L.push(""); L.push("Effet des réponses :"); ef.forEach(function (l) { L.push("- " + l.label + " : " + TDB_VERDICT[l.effet.verdict][1].toLowerCase() + " → " + tdbRecommandation(l.d, l.effet)[1].toLowerCase()); }); }
      L.push(""); L.push("Décisions attendues :"); S.A.forEach(function (a) { L.push("- " + a); });
    } else {
      const top = sig.slice().sort(function (a, b) { return b.p.total - a.p.total; }).slice(0, 5);
      L.push(""); L.push("Irritants les plus signalés :"); top.forEach(function (l) { L.push("- " + l.label + " : " + l.p.total + " signal(s)" + (l.examiner ? ", à examiner" : "")); });
      L.push(""); L.push(S.A.length + " décision(s) attendue(s) à la prochaine revue mensuelle.");
    }
  }
  return L;
}

function expMail() {
  const c = expContexte(); if (!c) return;
  const objet = "ACIA · " + c.titre + " · " + expDate();
  const corps = ["Bonjour,", "", "Voici « " + c.titre + " » (ACIA, " + expDate() + ").", ""]
    .concat(expResume(c))
    .concat(["", "Le détail est dans le PDF joint (bouton « Exporter en PDF ») et sur le site : " + expLien(),
      "", "Agrégats uniquement : aucun nom, aucun extrait de mail.", ""]).join("\n");
  // Mobile : partage natif (mail, messagerie, Teams…) ; ordinateur : messagerie par défaut.
  const mobile = window.matchMedia && window.matchMedia("(max-width: 760px)").matches;
  if (mobile && navigator.share) {
    navigator.share({ title: objet, text: corps }).catch(function () {});
    return;
  }
  // Limite pratique des liens mailto (~2 000 caractères) : on coupe proprement si besoin.
  let b = corps; if (b.length > 1800) b = b.slice(0, 1750) + "\n[…] Suite dans le PDF joint.";
  window.location.href = "mailto:?subject=" + encodeURIComponent(objet) + "&body=" + encodeURIComponent(b);
}

// ------------------------------ ICÔNES -------------------------------------
// v24.1 : deux petites icônes discrètes à droite du titre de la page.
const EXP_SVG_PDF = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19.5h14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const EXP_SVG_MAIL = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="3.5" y="6" width="17" height="12.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M4.5 7.5l7.5 6 7.5-6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function expIcones() {
  return '<span class="exp-ic">' +
    '<button type="button" onclick="expPdf()" title="Exporter en PDF (choisir « Enregistrer au format PDF »)" aria-label="Exporter en PDF">' + EXP_SVG_PDF + "</button>" +
    '<button type="button" onclick="expMail()" title="Partager par mail : résumé et lien ; joignez le PDF vous-même" aria-label="Partager par mail">' + EXP_SVG_MAIL + "</button></span>";
}
function expAjouter(h) {
  const i = h.indexOf("<h2>"), j = h.indexOf("</h2>");
  if (i < 0 || j < i) return h;
  return h.slice(0, i) + '<h2 class="exp-h2"><span>' + h.slice(i + 4, j) + "</span>" + expIcones() + h.slice(j);
}
// Ajoute les icônes sur les pages exportables (après l'enveloppe de la fiche irritant).
["viewPilotSpec", "viewTableauBordHrbp", "viewRevueMensuelle", "viewTendances", "viewPilotOrienter", "viewTypesIrritants"].forEach(function (nom) {
  const orig = window[nom];
  if (typeof orig !== "function") return;
  window[nom] = function () { const h = orig(); return expContexte() ? expAjouter(h) : h; };
});
