// ---------------------------------------------------------------------------
// v22 : « Contradicteur avant décision » (IA), onglet « Valider et orienter »
// ---------------------------------------------------------------------------
// Complète le « Contradicteur de revue » (Revue mensuelle, APRÈS les décisions) :
// ici l'IA intervient AVANT que le HRBP valide un irritant et choisisse la réponse.
// 1. Le HRBP clique sur « Contredire la proposition » pour UN irritant.
// 2. Le site envoie au webhook Make un dossier d'AGRÉGATS de cet irritant (signaux
//    par semaine, définition et exemple fictif tenus par le HRBP, proposition de la
//    grille, décision actuelle) : aucun mail, aucun texte de compte rendu, aucun nom.
// 3. Make (« ACIA : contradicteur avant décision ») : 1 demande par minute au plus
//    → Claude Haiku → Firestore suggestions_ia/d{date}_{CODE}, type AVANT_DECISION.
// 4. Le site affiche l'objection ; le HRBP peut reprendre la réponse recommandée dans
//    le formulaire, qu'il relit et enregistre lui-même. L'IA n'écrit jamais de décision.
// Format de la réponse (6 lignes) : OBJECTION|… VERIFICATION|… CONCLUSION|…
//   REPONSE|… JUSTIFICATION|… CONFIANCE|…
// ---------------------------------------------------------------------------

const AVD_WEBHOOK = "https://hook.eu1.make.com/to4ej946f8l0wnlma64f3ih84pg5oe9o";
const AVD_DELAI_S = 60;
const AVD_CONCLUSIONS = {
  MAINTENIR:   ["b-emerald", "La proposition tient"],
  PLUS_SIMPLE: ["b-amber",   "Une réponse plus simple suffirait"],
  ATTENDRE:    ["b-sky",     "Attendre d'autres signaux"],
  ECARTER:     ["b-slate",   "Écarter cet irritant"],
};

// Dossier d'agrégats d'un irritant : uniquement ce que l'écran affiche déjà.
function avdDossier(code) {
  const sig = aciaSignaux();
  if (!sig.ok || !sig.parCode[code]) return "";
  const p = sig.parCode[code], conf = confDe(code), d = decisionDe(code);
  const t = typesTable(), tb = t ? t.find(function (x) { return x.id === code; }) : null;
  const cr = code === CODE_CR;
  const L = [];
  L.push("IRRITANT|" + code + "|" + libelleType(code) + "|source : " + (cr ? "comptes rendus de réunion" : "boîte RH partagée") +
    "|définition : " + (tb && tb.definition ? tb.definition : "non renseignée") + "|exemple fictif : " + (tb && tb.exemple ? tb.exemple : "non renseigné"));
  const sem = []; for (let s = 1; s <= p.semMax; s++) sem.push("S" + s + "=" + (p.parSem[s] || 0));
  let principal = 0, secondaire = 0, basse = 0;
  if (!cr) {
    window.ACIA_FB.classement_mails.docs.forEach(function (m) {
      if (m.type === "ECARTE") return;
      const t1 = String(m.type || "").trim(), t2 = String(m.type_secondaire || "").trim();
      if (t1 === code) principal++; else if (t2 === code) secondaire++; else return;
      if (String(m.confiance || "").toUpperCase() === "BASSE") basse++;
    });
  } else {
    const fb = window.ACIA_FB.comptes_rendus;
    if (fb && fb.statut === "ok" && typeof lireAnalyseCR === "function") {
      fb.docs.filter(function (x) { return x.statut === "ANALYSE"; }).forEach(function (x) { if (lireAnalyseCR(x.analyse).confiance === "BASSE") basse++; });
    }
  }
  L.push("SIGNAUX|total : " + p.total + "|par semaine : " + (sem.join(" ") || "aucune") + "|à examiner : " + (aExaminer(p) ? "OUI" : "NON") +
    (cr ? "|un signal = une action reportée ou sans responsable dans un compte rendu|comptes rendus analysés en confiance basse : " + basse
        : "|en irritant principal : " + principal + "|en irritant secondaire : " + secondaire + "|classements en confiance basse : " + basse) +
    (p.reels.length ? "|mails réels sans semaine fictive : " + p.reels.length : ""));
  L.push("PROPOSITION|réponse proposée : " + conf.reco + "|" + (conf.action ? "action : " + conf.action : "besoin : " + (conf.besoin || "à définir")) +
    (conf.sorties ? "|sorties : " + conf.sorties : ""));
  L.push("DECISION|actuelle : " + (d ? d.statut + " " + d.reponse + " effet dès S" + d.semaine_effet : "AUCUNE"));
  L.push("GRILLE|SIMPLIFIER = page, FAQ, liste de diffusion, modèle ; AUTOMATISER = règle sans jugement ; ASSISTER = agent IA qui prépare, un humain valide");
  const fbD = window.ACIA_FB.decisions_hrbp;
  const rep = fbD && fbD.statut === "ok" ? fbD.docs.filter(function (x) { return x.statut !== "ECARTE" && x.reponse; }) : [];
  const part = rep.length ? Math.round(100 * rep.filter(function (x) { return x.reponse === "ASSISTER"; }).length / rep.length) : null;
  L.push("CIBLE_AGENT_IA_MAX|" + (typeof TDB_CIBLE_AGENT !== "undefined" ? TDB_CIBLE_AGENT : 30) + " %|part actuelle : " + (part === null ? "aucune réponse retenue" : part + " %"));
  return L.join("\n").replace(/\r/g, "");
}

// Dernière réponse de l'IA pour cet irritant (documents de test exclus).
function avdDerniere(code) {
  const fb = window.ACIA_FB.suggestions_ia;
  if (!fb || fb.statut !== "ok") return null;
  const t = function (d) { return d.demande && d.demande.toDate ? d.demande.toDate().getTime() : 0; };
  const docs = fb.docs.filter(function (d) { return d.type === "AVANT_DECISION" && d.code === code && String(d.id).indexOf("test") !== 0; });
  return docs.length ? docs.sort(function (a, b) { return t(b) - t(a); })[0] : null;
}
function avdToutes(code) {
  const fb = window.ACIA_FB.suggestions_ia;
  if (!fb || fb.statut !== "ok") return [];
  const t = function (d) { return d.demande && d.demande.toDate ? d.demande.toDate().getTime() : 0; };
  return fb.docs.filter(function (d) { return d.type === "AVANT_DECISION" && d.code === code && String(d.id).indexOf("test") !== 0; })
    .sort(function (a, b) { return t(b) - t(a); });
}

// Lecture des 6 lignes ; null si l'objection ou la conclusion manque.
function avdLire(texte) {
  const r = {};
  String(texte || "").split(/\r?\n/).forEach(function (l) {
    const i = l.indexOf("|");
    if (i < 0) return;
    const k = l.slice(0, i).trim().toUpperCase(), v = l.slice(i + 1).replace(/\|/g, " ").trim();
    if (["OBJECTION", "VERIFICATION", "CONCLUSION", "REPONSE", "JUSTIFICATION", "CONFIANCE"].indexOf(k) >= 0 && !r[k]) r[k] = v;
  });
  if (!r.OBJECTION || !r.CONCLUSION) return null;
  const mot = function (v, liste, def) { const m = String(v || "").toUpperCase().replace(/[^A-Z_]/g, " ").split(/\s+/).find(function (x) { return liste.indexOf(x) >= 0; }); return m || def; };
  return {
    objection: r.OBJECTION.slice(0, 420), verification: (r.VERIFICATION || "").slice(0, 420), justification: (r.JUSTIFICATION || "").slice(0, 420),
    conclusion: mot(r.CONCLUSION, Object.keys(AVD_CONCLUSIONS), ""),
    reponse: mot(r.REPONSE, ["SIMPLIFIER", "AUTOMATISER", "ASSISTER"], ""),
    confiance: mot(r.CONFIANCE, ["HAUTE", "MOYENNE", "BASSE"], "BASSE"),
  };
}

state.avd = state.avd || { code: "", envoi: "", msg: "", depuis: 0 };

function avdLancer(code) {
  const der = avdDerniere(code);
  const ilya = der && der.demande && der.demande.toDate ? Date.now() - der.demande.toDate().getTime() : Infinity;
  if (ilya < AVD_DELAI_S * 1000 || Date.now() - (state.avd.depuis || 0) < AVD_DELAI_S * 1000) {
    state.avd = { code: code, envoi: "", msg: "Une objection a été demandée il y a moins d'une minute : attendez avant d'en relancer une.", depuis: state.avd.depuis }; render(); return;
  }
  const dossier = avdDossier(code);
  if (!dossier) { state.avd = { code: code, envoi: "", msg: "Dossier impossible à constituer : données de la base indisponibles.", depuis: 0 }; render(); return; }
  state.avd = { code: code, envoi: "attente", msg: "Demande envoyée. L'objection s'affichera ici dans une trentaine de secondes.", depuis: Date.now() }; render();
  // Formulaire encodé + no-cors, comme « Préparer la revue » : pas de requête préalable CORS.
  fetch(AVD_WEBHOOK, { method: "POST", mode: "no-cors", body: new URLSearchParams({ dossier: dossier, code: code, origine: "site ACIA" }) })
    .catch(function (e) { state.avd.envoi = ""; state.avd.msg = "Envoi impossible : " + ((e && e.message) || e); render(); });
  const debut = state.avd.depuis;
  setTimeout(function () {
    if (state.avd.envoi === "attente" && state.avd.depuis === debut) { state.avd.envoi = ""; state.avd.msg = "Pas d'objection reçue après 90 secondes : réessayez ou vérifiez le scénario Make."; render(); }
  }, 90000);
}

function avdReprendre(code, reponse) {
  state.prefillPilot = { code: code, reponse: reponse, commentaire: "Réponse revue après l'objection de l'IA (avant décision)",
    note: "Réponse reprise de l'objection de l'IA (avant décision) : relisez, puis enregistrez vous-même." };
  state.msgPilot = ""; render();
  const el = document.getElementById("dp-reponse"); if (el && el.scrollIntoView) el.scrollIntoView({ block: "center" });
}

// Carte affichée dans « Valider et orienter », au-dessus du formulaire de décision.
function avdCarte(code) {
  const fb = window.ACIA_FB.suggestions_ia;
  const der = avdDerniere(code);
  const enCours = state.avd.code === code && state.avd.envoi === "attente";
  // Réponse arrivée après l'envoi : fin de l'attente.
  if (enCours && der && der.demande && der.demande.toDate && der.demande.toDate().getTime() >= state.avd.depuis - 5000) { state.avd.envoi = ""; state.avd.msg = ""; }
  const attente = state.avd.code === code && state.avd.envoi === "attente";
  const bouton = '<button class="btn slim" ' + (attente ? "disabled" : "") + ' onclick="avdLancer(\'' + code + '\')">' + (attente ? "Objection en cours…" : der ? "Relancer l'objection" : "Contredire la proposition") + "</button>";
  const r = der ? avdLire(der.texte) : null;
  let corps;
  if (!fb || fb.statut === "chargement") corps = '<p class="note">Lecture des objections…</p>';
  else if (fb.statut !== "ok") corps = '<p class="note">Objections indisponibles : ' + esc(fb.erreur || "") + "</p>";
  else if (!der) corps = '<p class="note">Aucune objection demandée pour cet irritant. Avant de valider, demandez à l\'IA l\'argument le plus fort contre la proposition.</p>';
  else if (!r) corps = '<p class="note">La dernière réponse de l\'IA ne respecte pas le format attendu : relancez l\'objection.</p>';
  else {
    const cc = AVD_CONCLUSIONS[r.conclusion] || ["b-slate", "Conclusion non lisible"];
    const conf = confDe(code), d = decisionDe(code);
    const actuelle = d ? d.reponse : conf.reco;
    // Contrôle sans IA : chaque nombre cité par l'IA doit figurer dans le dossier envoyé.
    const dansDossier = (String(der.entree || "").match(/\d+/g) || []);
    const hors = der.entree ? ((r.objection + " " + r.justification + " " + r.verification).match(/\d+/g) || [])
      .filter(function (n, i, t) { return t.indexOf(n) === i && dansDossier.indexOf(n) < 0; }) : [];
    const reprendre = r.reponse && r.reponse !== actuelle
      ? '<button class="btn ok slim" onclick="avdReprendre(\'' + code + "','" + r.reponse + '\')">Reprendre « ' + esc(libReponse(r.reponse)) + " » dans le formulaire</button>" : "";
    corps = '<div class="avd-r">' +
      '<div class="avd-l"><span class="avd-k">Objection</span><span>' + esc(r.objection) + "</span></div>" +
      (r.verification ? '<div class="avd-l"><span class="avd-k">À vérifier avant de décider</span><span>' + esc(r.verification) + "</span></div>" : "") +
      '<div class="avd-l"><span class="avd-k">Conclusion</span><span>' + badge(cc[0], cc[1]) +
        (r.reponse ? " " + badge("b-violet", "Réponse recommandée : " + libReponse(r.reponse)) : "") + " " +
        badge(r.confiance === "HAUTE" ? "b-emerald" : r.confiance === "MOYENNE" ? "b-amber" : "b-slate", "Confiance " + r.confiance.toLowerCase()) + "</span></div>" +
      (r.justification ? '<div class="avd-l"><span class="avd-k">Sur quoi elle s\'appuie</span><span>' + esc(r.justification) + "</span></div>" : "") +
      "</div>" +
      (reprendre ? '<div class="rv-actions">' + reprendre + "</div>" : "") +
      '<p class="note" style="margin-top:6px">Objection du ' + esc(der.demande && der.demande.toDate ? der.demande.toDate().toLocaleString("fr-FR") : "?") +
      ". L'IA ne doit citer que des nombres du dossier envoyé ; elle peut se tromper : vérifiez avant de décider.</p>" +
      (hors.length ? '<p class="note">' + badge("b-rose", "Attention") + " Nombre(s) absent(s) du dossier envoyé : " + esc(hors.join(", ")) + ". Ne pas s'y fier.</p>" : "");
  }
  return '<div class="card avd-card" style="margin-top:16px"><div class="rv-top"><div><div class="spechead" style="color:#4b2882">Contradicteur avant décision ' + badge("b-violet", "IA") + "</div>" +
    '<p class="tdb-sub" style="margin-top:4px">L\'IA cherche l\'objection la plus forte : le signal est-il solide, une réponse plus simple suffirait-elle ? Elle ne reçoit que les agrégats de cet irritant ; vous décidez.</p></div>' +
    '<div class="rv-btn">' + bouton + "</div></div>" +
    (state.avd.code === code && state.avd.msg ? '<p class="note">' + esc(state.avd.msg) + "</p>" : "") + corps + "</div>";
}
