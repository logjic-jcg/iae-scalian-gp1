// ---------------------------------------------------------------------------
// v53 : « Nouveaux types proposés » à partir des mails classés « Autre »
// (onglet HRBP « Types d’irritants »)
// ---------------------------------------------------------------------------
// 1. Le HRBP clique sur « Proposer de nouveaux types ».
// 2. Le site appelle le webhook Make (aucune donnée envoyée : Make relit tout lui-même).
// 3. Make (« ACIA : nouveaux types proposés à partir de « Autre » ») : 1 demande par minute
//    au plus ; liste les mails classés AUTRE dans classement_mails, relit leur texte dans la
//    boîte RH (lecture seule, mails confidentiels exclus par mots-clés), puis Claude Haiku
//    propose au plus 3 types. Rien du mail n'est conservé : seule la réponse de l'IA est
//    écrite dans suggestions_ia/n{date}, type NOUVEAUX_TYPES (+ lus, autres = identifiants).
//    Le scénario de classement horaire n'est pas modifié.
// 4. Le HRBP reprend une proposition dans le formulaire « Nouveau type », la fusionne dans
//    un type existant, ou l'écarte (s1..s3 = ACCEPTEE / REJETEE, règles v19 inchangées).
//    L'IA ne crée jamais de type.
// Format de la réponse :
//   PROPOSITION|TITRE|DEFINITION|EXEMPLE|PROCESSUS|MAILS|CONFIANCE|PROCHE|RESUME
//   EXISTANT|CODE|MAILS        (mails « Autre » qui relèvent d'un type existant)
//   AUCUNE|raison
// Les nombres de mails affichés sont recomptés par le site à partir des numéros
// rendus par l'IA, recoupés avec les mails réellement classés « Autre ».
// ---------------------------------------------------------------------------

const NTY_WEBHOOK = "https://hook.eu1.make.com/elfrn7p9cwamvqjfok59dp1q4zymgcb2";
const NTY_DELAI_S = 60;
const NTY_SEL = "_proposes";   // valeur de state.selType pour le panneau des propositions

state.nty = state.nty || { envoi: "", msg: "", depuis: 0, fusion: -1 };
state.ntySource = state.ntySource || null;   // { id, n, mode: "NOUVEAU" | "FUSION", code? } pendant une reprise

function ntyDocs() {
  const fb = window.ACIA_FB.suggestions_ia;
  if (!fb || fb.statut !== "ok") return [];
  const t = function (x) { return x.demande && x.demande.toDate ? x.demande.toDate().getTime() : 0; };
  return fb.docs.filter(function (x) { return x.type === "NOUVEAUX_TYPES" && String(x.id).indexOf("test") !== 0; })
    .sort(function (a, b) { return t(b) - t(a); });
}
function ntyDerniere() { return ntyDocs()[0] || null; }

// Mails classés « Autre » aujourd'hui dans la base : identifiant (g + UID Gmail, m + UID de l'ancienne boîte GMX) → semaine fictive.
function ntyAutres() {
  const fb = window.ACIA_FB.classement_mails, res = {};
  if (!fb || fb.statut !== "ok") return res;
  fb.docs.forEach(function (d) {
    if (String(d.type || "").trim() !== "AUTRE") return;
    const m = /^J(\d+)$/.exec(String(d.jour_fictif || "").trim());
    res[String(d.id)] = m ? Math.ceil(Number(m[1]) / 7) : 0;
  });
  return res;
}
function ntyNbAutres() { return Object.keys(ntyAutres()).length; }

// Numéros « 90, #103 » → identifiants g90 (boîte Gmail, depuis le 25/11) ou m90 (ancienne boîte GMX)
// encore classés « Autre » (les autres sont ignorés).
function ntyMails(champ, autres) {
  const vus = {};
  String(champ || "").split(/[^0-9]+/).forEach(function (x) {
    if (!x) return;
    if (autres.hasOwnProperty("g" + x)) vus["g" + x] = 1; else if (autres.hasOwnProperty("m" + x)) vus["m" + x] = 1;
  });
  return Object.keys(vus);
}

function ntyLire(doc) {
  const res = { props: [], existants: [], aucune: "", lus: Number(doc && doc.lus) || 0 };
  if (!doc) return res;
  const autres = ntyAutres();
  const typesConnus = {}; (typesTable() || []).forEach(function (d) { typesConnus[d.id] = d; });
  String(doc.texte || "").split(/\r?\n/).forEach(function (l) {
    const c = l.split("|").map(function (x) { return x.trim(); });
    const k = (c[0] || "").replace(/[^A-Za-z]/g, "").toUpperCase();
    if (k === "PROPOSITION" && c.length >= 7 && res.props.length < 3) {
      const titre = c[1].slice(0, TYPE_LIMITES.titre);
      if (titre.length < 3) return;
      const mails = ntyMails(c[5], autres);
      const sem = {}; mails.forEach(function (m) { if (autres[m]) sem[autres[m]] = 1; });
      const proche = (c[7] || "").toUpperCase();
      res.props.push({
        titre: titre, definition: (c[2] || "").slice(0, TYPE_LIMITES.definition), exemple: (c[3] || "").replace(/^[«"\s]+|[»"\s]+$/g, "").slice(0, TYPE_LIMITES.exemple),
        processus: (c[4] || "").slice(0, TYPE_LIMITES.processus), mails: mails,
        semaines: Object.keys(sem).map(Number).sort(function (a, b) { return a - b; }),
        confiance: ["HAUTE", "MOYENNE", "BASSE"].indexOf((c[6] || "").toUpperCase()) >= 0 ? c[6].toUpperCase() : "BASSE",
        proche: typesConnus[proche] ? proche : "",
        resume: (c[8] || "").split(/\s*;\s*/).filter(Boolean).slice(0, 3).map(function (s) { return s.slice(0, 200); }),
      });
    } else if (k === "EXISTANT" && c.length >= 3 && typesConnus[(c[1] || "").toUpperCase()]) {
      const mails = ntyMails(c[2], autres);
      if (mails.length) res.existants.push({ code: c[1].toUpperCase(), mails: mails });
    } else if (k === "AUCUNE" && !res.aucune) {
      res.aucune = (c[1] || "").slice(0, 300);
    }
  });
  return res;
}

function ntyStatut(doc, n) { return (doc && doc["s" + n]) || "PROPOSEE"; }
// Propositions encore à examiner (pour la pastille de la liste).
function ntyAExaminer() {
  const doc = ntyDerniere();
  if (!doc) return 0;
  return ntyLire(doc).props.filter(function (p, i) { return ntyStatut(doc, i + 1) === "PROPOSEE" && p.mails.length >= 2; }).length;
}

function ntyLancer() {
  const der = ntyDerniere();
  const ilya = der && der.demande && der.demande.toDate ? Date.now() - der.demande.toDate().getTime() : Infinity;
  if (ilya < NTY_DELAI_S * 1000 || Date.now() - (state.nty.depuis || 0) < NTY_DELAI_S * 1000) {
    state.nty = Object.assign({}, state.nty, { envoi: "", msg: "Une proposition a été demandée il y a moins d'une minute : attendez avant d'en relancer une." }); render(); return;
  }
  state.nty = { envoi: "attente", msg: "Demande envoyée. L'IA relit les mails « Autre » dans la boîte RH ; les propositions s'afficheront ici dans une trentaine de secondes.", depuis: Date.now(), fusion: -1 }; render();
  fetch(NTY_WEBHOOK, { method: "POST", mode: "no-cors", body: new URLSearchParams({ origine: "site ACIA" }) })
    .catch(function (e) { state.nty.envoi = ""; state.nty.msg = "Envoi impossible : " + ((e && e.message) || e); render(); });
  const debut = state.nty.depuis;
  setTimeout(function () {
    if (state.nty.envoi === "attente" && state.nty.depuis === debut) { state.nty.envoi = ""; state.nty.msg = "Pas de réponse après 90 secondes : réessayez ou vérifiez le scénario Make."; render(); }
  }, 90000);
}
// Appelée à chaque mise à jour de suggestions_ia : fin de l'attente dès qu'une réponse plus récente arrive.
function ntyVerifierArrivee() {
  if (state.nty.envoi !== "attente") return;
  const der = ntyDerniere();
  const t = der && der.demande && der.demande.toDate ? der.demande.toDate().getTime() : 0;
  if (t >= state.nty.depuis - 5000) { state.nty.envoi = ""; state.nty.msg = ""; }
}

function ntyProp(n) { const doc = ntyDerniere(); return doc ? { doc: doc, p: ntyLire(doc).props[n - 1] } : null; }

function ntyReprendre(n) {
  const x = ntyProp(n); if (!x || !x.p) return;
  selType("_nouveau");
  Object.assign(state.brType, { titre: x.p.titre, definition: x.p.definition, exemple: x.p.exemple, processus: x.p.processus });
  state.ntySource = { id: x.doc.id, n: n, mode: "NOUVEAU", nb: x.p.mails.length }; state.nty.fusion = -1;
  state.msgType = ""; render(); hautDePage();
}
function ntyFusionChoix(n) { state.nty.fusion = state.nty.fusion === n ? -1 : n; render(); }
function ntyFusionner(n, el) {
  const code = el && el.value, x = ntyProp(n);
  if (!code || !x || !x.p) return;
  selType(code);
  const b = state.brType, ajout = " Inclut aussi : " + x.p.definition;
  b.definition = (b.definition + ajout).slice(0, TYPE_LIMITES.definition);
  state.ntySource = { id: x.doc.id, n: n, mode: "FUSION", code: code, nb: x.p.mails.length };
  state.nty.fusion = -1; state.msgType = ""; render(); hautDePage();
}
function ntyEcarter(n) {
  const doc = ntyDerniere(); if (!doc) return;
  if (typeof window.aciaEcrireSuggestion !== "function") { state.nty.msg = "Écriture impossible : connexion à la base absente."; render(); return; }
  window.aciaEcrireSuggestion(doc.id, n, "REJETEE", "Écartée par le HRBP (onglet Types d'irritants)")
    .then(function () { state.nty.msg = "Proposition " + n + " écartée."; render(); })
    .catch(function (e) { state.nty.msg = "Refusé par la base : " + ((e && e.message) || e); render(); });
}
function ntyRetablir(n) {
  const doc = ntyDerniere(); if (!doc || typeof window.aciaEcrireSuggestion !== "function") return;
  window.aciaEcrireSuggestion(doc.id, n, "PROPOSEE", "").then(function () { render(); }).catch(function (e) { state.nty.msg = "Refusé par la base : " + ((e && e.message) || e); render(); });
}
function ntyAnnulerReprise() { const s = state.ntySource; state.ntySource = null; if (s) { state.selType = NTY_SEL; state.brType = null; } render(); }

// Appelée par enregistrerType() après une écriture réussie.
function ntyApresEnregistrement(code, nouveau) {
  const s = state.ntySource; state.ntySource = null;
  if (!s || typeof window.aciaEcrireSuggestion !== "function") return;
  if ((s.mode === "NOUVEAU") !== !!nouveau) return;
  const motif = s.mode === "NOUVEAU" ? "Type créé : " + code : "Fusionnée dans " + code;
  window.aciaEcrireSuggestion(s.id, s.n, "ACCEPTEE", motif).catch(function () {});
}

// Bandeau au-dessus du formulaire pendant une reprise.
function ntyBandeauReprise() {
  const s = state.ntySource;
  if (!s) return "";
  if (s.mode === "NOUVEAU" && state.selType !== "_nouveau") return "";
  if (s.mode === "FUSION" && state.selType !== s.code) return "";
  const nb = s.nb + " mail" + (s.nb > 1 ? "s" : "") + " « Autre »";
  const txt = s.mode === "NOUVEAU"
    ? "Pré-rempli depuis la <b>proposition " + s.n + "</b> de l'IA (" + nb + "). Relisez et corrigez : le type n'est créé qu'au clic sur « Créer le type »."
    : "La définition de la <b>proposition " + s.n + "</b> (" + nb + ") a été ajoutée à la fin de celle de ce type. Relisez, raccourcissez si besoin, puis « Enregistrer ».";
  return '<div class="card nty-reprise"><p style="margin:0;font-size:14px">' + badge("b-violet", "IA") + " " + txt +
    " Les mails déjà classés « Autre » ne sont pas reclassés ; les prochains mails le seront.</p>" +
    '<div class="btns" style="margin-top:8px"><button class="btn slim" onclick="ntyAnnulerReprise()">← Revenir aux propositions</button></div></div>';
}

// Entrée de la liste de gauche.
function ntyPick() {
  const n = ntyAExaminer();
  return '<button class="pick nty-pick' + (state.selType === NTY_SEL ? " selected" : "") + '" onclick="selType(\'' + NTY_SEL + '\')">' +
    '<div class="nty-pick-l"><div><div style="font-weight:700;font-size:14px">✦ Nouveaux types proposés</div><div class="psub">À partir des mails classés « Autre »</div></div>' +
    (n ? badge("b-violet", n + " à examiner") : "") + "</div></button>";
}

function ntyCarte(doc, p, i) {
  const n = i + 1, st = ntyStatut(doc, n), confB = { HAUTE: "b-emerald", MOYENNE: "b-amber", BASSE: "b-slate" };
  const codeAuto = codeDepuisTitre(p.titre), existe = (typesTable() || []).some(function (d) { return d.id === codeAuto; });
  const trop = p.mails.length < 2;
  const typesFusion = (typesTable() || []).filter(function (d) { return d.actif !== false && d.source !== "COMPTES_RENDUS" && !d.protege; })
    .sort(function (a, b) { return String(a.titre).localeCompare(String(b.titre), "fr"); });
  let actions;
  if (st === "REJETEE") actions = '<p class="note" style="margin:10px 0 0">' + badge("b-slate", "Écartée") + ' <button class="lnk" onclick="ntyRetablir(' + n + ')">Rétablir</button></p>';
  else if (st === "ACCEPTEE") actions = '<p class="note" style="margin:10px 0 0">' + badge("b-emerald", "Reprise") + " " + esc(doc["m" + n] || "") + "</p>";
  else actions = '<div class="rv-actions">' +
    '<button class="btn ok slim" onclick="ntyReprendre(' + n + ')"' + (existe ? " disabled" : "") + ">Reprendre dans « Nouveau type »</button>" +
    '<button class="btn slim" onclick="ntyEcarter(' + n + ')">Écarter</button>' +
    '<button class="btn slim" onclick="ntyFusionChoix(' + n + ')">Fusionner avec un type existant…</button></div>' +
    (state.nty.fusion === n ? '<label class="fl" style="margin-top:8px">Type dans lequel ajouter cette définition<select onchange="ntyFusionner(' + n + ', this)"><option value="">Choisir un type…</option>' +
      typesFusion.map(function (d) { return '<option value="' + esc(d.id) + '"' + (d.id === p.proche ? " selected" : "") + ">" + esc(d.titre || d.id) + "</option>"; }).join("") + "</select></label>" : "");
  return '<div class="card nty-card' + (st !== "PROPOSEE" ? " nty-close" : "") + '">' +
    '<div class="nty-top"><div><div class="nty-k">Proposition ' + n + "</div>" +
    '<div class="spech3" style="margin-top:2px">' + esc(p.titre) + "</div></div>" +
    '<div class="nty-n"><b>' + p.mails.length + "</b><span>mail" + (p.mails.length > 1 ? "s" : "") + " « Autre »</span></div></div>" +
    '<p class="nty-meta">' + (p.processus ? badge("b-sky", p.processus) + " " : "") + badge(confB[p.confiance], "Confiance " + p.confiance.toLowerCase()) +
    (p.semaines.length ? ' <span class="note" style="margin:0">semaine' + (p.semaines.length > 1 ? "s " : " ") + p.semaines.map(function (s) { return "S" + s; }).join(" · ") + "</span>" : "") + "</p>" +
    (p.proche ? '<p class="nty-alerte">' + badge("b-amber", "À vérifier") + " Proche d'un type existant : « " + esc(libelleType(p.proche)) + " ». Peut-être faut-il plutôt compléter sa définition (Fusionner).</p>" : "") +
    (existe && st === "PROPOSEE" ? '<p class="nty-alerte">' + badge("b-amber", "Déjà créé") + " Un type porte déjà le code " + esc(codeAuto) + ".</p>" : "") +
    (trop ? '<p class="nty-alerte">' + badge("b-slate", "Trop peu de mails") + " Moins de 2 mails « Autre » retrouvés pour cette proposition : un cas isolé ne fait pas un type.</p>" : "") +
    '<div class="avd-r">' +
    '<div class="avd-l"><span class="avd-k">Définition proposée</span><span>' + esc(p.definition) + "</span></div>" +
    (p.exemple ? '<div class="avd-l"><span class="avd-k">Exemple (écrit par l\'IA)</span><span>« ' + esc(p.exemple) + " »</span></div>" : "") +
    (p.resume.length ? '<div class="avd-l"><span class="avd-k">Ce que l\'IA a vu</span><span class="nty-phr">' + p.resume.map(function (s) { return "· " + esc(s); }).join("<br>") + "</span></div>" : "") +
    "</div>" + actions + "</div>";
}

function ntyPanneau() {
  const fbs = window.ACIA_FB.suggestions_ia, fbm = window.ACIA_FB.classement_mails;
  if (!fbs || fbs.statut !== "ok" || !fbm || fbm.statut !== "ok") {
    return '<div class="card"><p class="note" style="margin:0">Lecture de la base en cours…</p></div>';
  }
  const doc = ntyDerniere(), nbAutres = ntyNbAutres(), r = ntyLire(doc);
  const attente = state.nty.envoi === "attente";
  const quand = doc && doc.demande && doc.demande.toDate ? doc.demande.toDate().toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  let resume = "";
  if (doc) {
    const groupes = {}; r.props.forEach(function (p) { p.mails.forEach(function (m) { groupes[m] = 1; }); });
    const nbG = Object.keys(groupes).length, nbE = r.existants.reduce(function (s, e) { return s + e.mails.length; }, 0);
    resume = '<p class="note" style="margin:8px 0 0">Proposition du ' + esc(quand) + " · " + r.lus + " mail(s) « Autre » relu(s) · " +
      r.props.length + " proposition(s)" + (nbG ? " regroupant " + nbG + " mail(s)" : "") +
      (nbE ? " · " + nbE + " mail(s) relèvent en fait d'un type existant" : "") + ".</p>";
  }
  const tete = '<div class="card avd-card"><div class="rv-top"><div><div class="spechead" style="color:#4b2882">Nouveaux types proposés par l\'IA ' + badge("b-violet", "IA") + "</div>" +
    '<p class="tdb-sub" style="margin-top:4px"><b>' + nbAutres + " mail" + (nbAutres > 1 ? "s" : "") + "</b> classé" + (nbAutres > 1 ? "s" : "") + " « Autre » dans la base. " +
    "À la demande, l'IA relit ces mails dans la boîte RH (lecture seule, mails confidentiels exclus) et propose 3 types au plus. Seule sa réponse est gardée, sans nom. Vous décidez : l'IA ne crée jamais de type.</p></div>" +
    '<div class="rv-btn"><button class="btn slim" onclick="ntyLancer()"' + (attente ? " disabled" : "") + ">" + (attente ? "Proposition en cours…" : doc ? "Relancer la proposition" : "Proposer de nouveaux types") + "</button></div></div>" +
    resume + (state.nty.msg ? '<p class="note" style="margin:8px 0 0">' + esc(state.nty.msg) + "</p>" : "") + "</div>";
  if (!doc) return tete + '<div class="card"><p class="note" style="margin:0">Aucune proposition pour l\'instant. Cliquez sur « Proposer de nouveaux types ».</p></div>';
  let corps = r.props.map(function (p, i) { return ntyCarte(doc, p, i); }).join("");
  if (!r.props.length) corps += '<div class="card"><p style="margin:0;font-size:14px">' + badge("b-slate", "Aucun nouveau type") + " " +
    esc(r.aucune || "L'IA n'a pas trouvé de motif qui revient dans au moins 2 mails.") + "</p></div>";
  if (r.existants.length) corps += '<div class="card nty-card"><div class="spechead">Mails « Autre » qui relèvent d\'un type existant</div>' +
    '<p class="note" style="margin:4px 0 8px">Selon l\'IA, ces mails auraient pu être rangés dans un type déjà défini. Si cela revient souvent, précisez la définition ou l\'exemple de ce type.</p>' +
    r.existants.map(function (e) { return '<p style="margin:4px 0;font-size:14px"><button class="lnk" onclick="selType(\'' + esc(e.code) + '\')">' + esc(libelleType(e.code)) + "</button> · " + e.mails.length + " mail" + (e.mails.length > 1 ? "s" : "") + "</p>"; }).join("") + "</div>";
  return tete + corps;
}
