// ---------------------------------------------------------------------------
// v19 : « Contradicteur de revue » (IA) ; v21 : déplacé dans l'onglet « Revue mensuelle » du HRBP
// ---------------------------------------------------------------------------
// 1. Le HRBP clique sur « Préparer la revue ».
// 2. Le site envoie au webhook Make UNIQUEMENT les agrégats déjà affichés par le
//    tableau de bord (signaux par semaine, décisions, mesures) : aucun mail, aucun
//    texte de compte rendu, aucun nom.
// 3. Make (scénario « ACIA : contradicteur de revue ») : garde-fou 1 demande / 10 min
//    → Claude Haiku → Firestore suggestions_ia/{id} (3 suggestions au plus).
// 4. Le site lit suggestions_ia en direct ; le HRBP accepte (décision pré-remplie
//    dans « Décisions », qu'il enregistre lui-même) ou rejette (motif).
// L'IA propose, le HRBP décide : elle n'écrit jamais de décision.
// Format d'une suggestion (une ligne) : SUGG|CODE|GENRE|REPONSE|ACTION|JUSTIFICATION|CONFIANCE
// ---------------------------------------------------------------------------

const REVUE_WEBHOOK = "https://hook.eu1.make.com/opeqlylosrxqe1fryxq9m7ka2fob7wh7";
const REVUE_DELAI_MIN = 10;
const REVUE_MOTIFS = ["Déjà fait", "Pas pertinent", "Données insuffisantes"];

// Agrégats envoyés à l'IA : uniquement ce que le tableau de bord affiche.
function revueAgregats(lignes, C, partAgent) {
  const L = [];
  L.push("CIBLE_AGENT_IA_MAX|" + TDB_CIBLE_AGENT + " %|part actuelle : " + (partAgent === null ? "aucune réponse retenue" : partAgent + " %"));
  L.push("QUALITE|mails traités : " + C.mails + "|écartés sans IA : " + (C.mailsEcartes + C.crEcartes) + "|classés Autre : " + C.mailsAutre +
    "|comptes rendus analysés : " + C.crAnalyses + "|confiance basse : " + (C.confianceBasse === null ? "non mesuré" : C.confianceBasse));
  // Alertes calculées par des RÈGLES (pas par l'IA), par ordre de priorité : l'IA les traite d'abord.
  const al = [[], [], [], []];
  lignes.forEach(function (l) {
    const v = l.effet ? l.effet.verdict : "";
    if (l.d && l.d.reponse === "ASSISTER" && (v === "STABLE" || v === "HAUSSE")) al[0].push("ALERTE|" + l.code + "|agent IA (ASSISTER) sans effet visible (mesure " + v + ") : une réponse plus simple suffirait-elle ?");
    if (l.examiner && !l.d) al[1].push("ALERTE|" + l.code + "|à examiner sans décision du HRBP");
    if (v === "HAUSSE" && !(l.d && l.d.reponse === "ASSISTER")) al[2].push("ALERTE|" + l.code + "|mesure en HAUSSE malgré la réponse " + l.d.reponse);
    if (v === "BAISSE" && l.effet.nbAp === 1) al[3].push("ALERTE|" + l.code + "|baisse mesurée sur une seule semaine après l'effet : conclusion fragile");
    if (v === "TROP_PEU") al[3].push("ALERTE|" + l.code + "|trop peu de signaux pour juger la réponse " + l.d.reponse);
  });
  al.forEach(function (x) { x.forEach(function (t) { L.push(t); }); });
  lignes.forEach(function (l) {
    const sem = []; for (let s = 1; s <= l.p.semMax; s++) sem.push("S" + s + "=" + (l.p.parSem[s] || 0));
    let txt = "IRRITANT|" + l.code + "|" + l.label + "|source : " + (l.code === CODE_CR ? "comptes rendus" : "boîte RH") +
      "|total : " + l.p.total + "|par semaine : " + (sem.join(" ") || "aucune") + "|à examiner : " + (l.examiner ? "OUI" : "NON");
    if (!l.d) txt += "|décision : AUCUNE";
    else {
      txt += "|décision : " + l.d.statut + "|réponse : " + l.d.reponse + "|effet dès : S" + l.d.semaine_effet;
      if (l.effet) txt += "|moyenne avant : " + tdbFr(l.effet.mAv, 1) + "|moyenne après : " + tdbFr(l.effet.mAp, 1) + "|mesure : " + l.effet.verdict;
    }
    L.push(txt);
  });
  return L.join("\n");
}

// Lecture d'une ligne de suggestion ; une ligne mal formée ou un code inconnu est ignoré.
function revueLire(texte, codes) {
  const res = [];
  String(texte || "").split(/\r?\n/).forEach(function (l) {
    const p = l.split("|").map(function (s) { return s.trim(); });
    if (p[0] !== "SUGG" || p.length < 7 || codes.indexOf(p[1]) < 0) return;
    if (res.length >= 3) return;
    res.push({ code: p[1], genre: p[2] === "CONTRADICTION" ? "CONTRADICTION" : "ACTION",
      reponse: ["SIMPLIFIER", "AUTOMATISER", "ASSISTER"].indexOf(p[3]) >= 0 ? p[3] : "AUCUNE",
      action: p[4].slice(0, 200), justification: p[5].slice(0, 300), confiance: ["HAUTE", "MOYENNE", "BASSE"].indexOf(p[6]) >= 0 ? p[6] : "BASSE" });
  });
  return res;
}
// Une « réponse proposée » identique à la réponse déjà retenue n'est pas une proposition.
function revueNettoyer(sugg, lignes) {
  sugg.forEach(function (s) { const l = lignes.find(function (x) { return x.code === s.code; }); if (l && l.d && l.d.reponse === s.reponse) s.reponse = "AUCUNE"; });
  return sugg;
}

function revueDerniere() {
  const fb = window.ACIA_FB.suggestions_ia;
  if (!fb || fb.statut !== "ok") return null;
  // Les documents « test… » viennent du scénario de test Make : jamais affichés.
  const docs = fb.docs.filter(function (d) { return String(d.id).indexOf("test") !== 0 && d.type !== "AVANT_DECISION"; });
  if (!docs.length) return null;
  const t = function (d) { return d.demande && d.demande.toDate ? d.demande.toDate().getTime() : 0; };
  return docs.slice().sort(function (a, b) { return t(b) - t(a); })[0];
}

state.revue = state.revue || { envoi: "", msg: "" };

function revuePreparer() {
  const m = state.tdbModele;
  if (!m) return;
  const der = revueDerniere();
  if (der && der.demande && der.demande.toDate && (Date.now() - der.demande.toDate().getTime()) < REVUE_DELAI_MIN * 60000) {
    state.revue.msg = "Une revue a été préparée il y a moins de " + REVUE_DELAI_MIN + " minutes : attendez avant d'en relancer une."; render(); return;
  }
  state.revue.envoi = "envoi"; state.revue.msg = "Demande envoyée. Les suggestions s'afficheront ici dans une trentaine de secondes."; render();
  // Formulaire encodé + mode no-cors (comme le bouton « Actualiser ») : pas de requête
  // préalable CORS ; Make lit les champs « agregats » et « origine ».
  const corps = new URLSearchParams({ agregats: revueAgregats(m.lignes, m.C, m.partAgent), origine: "site ACIA" });
  fetch(REVUE_WEBHOOK, { method: "POST", mode: "no-cors", body: corps })
    .then(function () { state.revue.envoi = "attente"; })
    .catch(function (e) { state.revue.envoi = ""; state.revue.msg = "Envoi impossible : " + ((e && e.message) || e); render(); });
  setTimeout(function () { if (state.revue.envoi === "attente") { state.revue.envoi = ""; state.revue.msg = "Pas de nouvelle suggestion après 90 secondes : réessayez dans 10 minutes ou vérifiez le scénario Make."; render(); } }, 90000);
}

function revueStatut(id, n, statut, motif) {
  if (typeof window.aciaEcrireSuggestion !== "function") { state.revue.msg = "Écriture impossible : connexion à la base absente."; render(); return; }
  window.aciaEcrireSuggestion(id, n, statut, motif || "").then(function () { state.revue.msg = ""; })
    .catch(function (e) { state.revue.msg = "Refusé par la base : " + ((e && e.message) || e); render(); });
}
function revueAccepter(id, n, code, reponse) {
  revueStatut(id, n, "ACCEPTEE", "");
  if (reponse !== "AUCUNE") {
    state.prefillPilot = { code: code, reponse: reponse, commentaire: "Suggestion de l'IA acceptée en revue" };
    state.selPilot = code; state.filtrePilot = "TOUS"; state.filtreProc = [];
    setTab("b_orienter");
  }
}
function revueRejeter(id, n) {
  const el = document.getElementById("rv-motif-" + n);
  revueStatut(id, n, "REJETEE", el ? el.value : "");
}

// Carte affichée en tête du tableau de bord.
function carteRevueIa(modele) {
  state.tdbModele = modele;
  const statique = modele.mode === "statique";
  const fb = window.ACIA_FB.suggestions_ia;
  const der = statique ? null : revueDerniere();
  if (der && state.revue.envoi === "attente" && der.demande && der.demande.toDate && Date.now() - der.demande.toDate().getTime() < 120000) { state.revue.envoi = ""; state.revue.msg = ""; }
  const codes = modele.lignes.map(function (l) { return l.code; });
  const sugg = der ? revueNettoyer(revueLire(der.texte, codes), modele.lignes) : [];
  const lib = function (c) { const l = modele.lignes.find(function (x) { return x.code === c; }); return l ? l.label : c; };
  const bouton = statique ? '<span class="note" style="margin:0">Indisponible sur l\'instantané de démonstration : l\'IA travaille sur les données de la base.</span>'
    : '<button class="btn slim" ' + (state.revue.envoi ? "disabled" : "") + ' onclick="revuePreparer()">' + (state.revue.envoi ? "Préparation en cours…" : "Préparer la revue") + "</button>";
  let corps;
  if (statique) corps = "";
  else if (!fb || fb.statut === "chargement") corps = '<p class="note">Lecture des suggestions…</p>';
  else if (fb.statut !== "ok") corps = '<p class="note">Suggestions indisponibles : ' + esc(fb.erreur || "") + "</p>";
  else if (!der) corps = '<p class="note">Aucune revue préparée pour l\'instant.</p>';
  else if (!sugg.length) corps = '<p class="note">La dernière réponse de l\'IA ne contient aucune suggestion exploitable (format non respecté ou code inconnu). Relancez dans 10 minutes.</p>';
  else {
    corps = '<p class="note" style="margin-top:6px">Revue préparée le ' + esc(der.demande && der.demande.toDate ? der.demande.toDate().toLocaleString("fr-FR") : "?") + ". Les chiffres de chaque ligne viennent de la base, pas du texte de l'IA.</p>" +
      '<div class="rv-list">' + sugg.map(function (s, i) {
        const n = i + 1, st = der["s" + n] || "PROPOSEE", l = modele.lignes.find(function (x) { return x.code === s.code; });
        const chiffres = l ? l.p.total + " signal(s) au total" + (l.d ? " · décision : " + libStatut(l.d.statut).label + ", " + libReponse(l.d.reponse) : " · aucune décision") + (l.effet ? " · mesure : " + TDB_VERDICT[l.effet.verdict][1].toLowerCase() : "") : "";
        const pied = st === "ACCEPTEE" ? badge("b-emerald", "Acceptée") + (s.reponse !== "AUCUNE" ? ' <button class="chip" onclick="revueAccepter(\'' + esc(der.id) + "'," + n + ",'" + s.code + "','" + s.reponse + '\')">Rouvrir dans Décisions</button>' : "")
          : st === "REJETEE" ? badge("b-slate", "Rejetée" + (der["m" + n] ? " : " + der["m" + n] : ""))
          : '<button class="btn ok slim" onclick="revueAccepter(\'' + esc(der.id) + "'," + n + ",'" + s.code + "','" + s.reponse + '\')">Accepter' + (s.reponse !== "AUCUNE" ? " et pré-remplir la décision" : "") + "</button>" +
            '<select id="rv-motif-' + n + '" class="rv-sel">' + REVUE_MOTIFS.map(function (m) { return "<option>" + esc(m) + "</option>"; }).join("") + "</select>" +
            '<button class="btn ghost slim" onclick="revueRejeter(\'' + esc(der.id) + "'," + n + ')">Rejeter</button>';
        return '<div class="rv-item' + (s.genre === "CONTRADICTION" ? " contra" : "") + '"><div class="rv-h">' +
          badge(s.genre === "CONTRADICTION" ? "b-rose" : "b-violet", s.genre === "CONTRADICTION" ? "Contradiction" : "Action") + " " +
          badge(s.confiance === "HAUTE" ? "b-emerald" : s.confiance === "MOYENNE" ? "b-amber" : "b-slate", "Confiance " + s.confiance.toLowerCase()) +
          ' <span class="tdb-sub">' + lienFiche(s.code, esc(lib(s.code))) + (s.reponse !== "AUCUNE" ? " · réponse proposée : " + esc(libReponse(s.reponse)) : "") + "</span></div>" +
          '<div class="rv-a">' + esc(s.action) + "</div><div class=\"rv-j\">" + esc(s.justification) + "</div>" +
          '<div class="tdb-sub" style="margin-top:4px">Dans la base : ' + esc(chiffres) + "</div>" +
          '<div class="rv-actions">' + pied + "</div></div>";
      }).join("") + "</div>";
  }
  return '<div class="card rv-card"><div class="rv-top"><div><h3 style="margin:0">Contradicteur de revue ' + badge("b-violet", "IA") + "</h3>" +
    '<p class="tdb-sub" style="margin-top:4px">Avant la revue mensuelle : 3 suggestions au plus, dont une remise en cause si les données la justifient. L\'IA ne reçoit que les agrégats de cette page ; le HRBP décide.</p></div>' +
    '<div class="rv-btn">' + bouton + "</div></div>" + (state.revue.msg ? '<p class="note">' + esc(state.revue.msg) + "</p>" : "") + corps + "</div>";
}
