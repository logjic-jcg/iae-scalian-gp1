// ---------------------------------------------------------------------------
// v51 : « Rédiger la fiche avec l'IA » (onglet « Spécifications », profil HRBP)
// ---------------------------------------------------------------------------
// Pour un irritant « Validé » avec la réponse Automatiser ou Assister :
// 1. Le HRBP clique sur « Rédiger la fiche avec l'IA ».
// 2. Le site envoie au webhook Make un dossier : définition et exemple fictif du type,
//    signaux agrégés, décision du HRBP, ce que la base contient déjà, cadre (sources
//    autorisées, outils, garde-fous). Aucun mail, aucun texte de compte rendu, aucun nom.
// 3. Make (« ACIA : rédaction de fiche par l'IA ») : 1 demande par minute au plus
//    → Claude Haiku → Firestore suggestions_ia/f{date}_{CODE}, type FICHE_IA (brouillon).
// 4. Le HRBP relit et corrige chaque rubrique, puis valide : la fiche est écrite dans
//    fiches_specs/{CODE} (règles Firestore v51). L'IA n'écrit jamais une fiche validée.
// Format de la réponse : 11 lignes CLE|texte (voir FIA_RUBRIQUES).
// ---------------------------------------------------------------------------

const FIA_WEBHOOK = "https://hook.eu1.make.com/h9vt1xp55ouxw729ii6adyppb9sw1vne";
const FIA_DELAI_S = 60;
const FIA_MAX = 600;   // caractères par rubrique (Haiku dépasse parfois les longueurs demandées)
const FIA_RUBRIQUES = [
  ["IRRITANT", "Irritant détecté"], ["BESOIN", "Besoin métier"], ["UTILISATEURS", "Utilisateurs"],
  ["ENTREES", "Entrées"], ["SORTIES", "Sorties"], ["WORKFLOW", "Workflow"], ["AUTONOMIE", "Niveau d'autonomie"],
  ["RISQUES", "Permissions et risques"], ["AGENT", "Agent ou outil proposé"], ["ACCEPTATION", "Critères d'acceptation"],
  ["INDICATEUR", "Gain attendu et indicateur"],
];
const FIA_CADRE = "CADRE|sources autorisées par Scalian : boîte RH partagée, comptes rendus de réunion (Notion), checklist et documents de référence RH (Notion) ; interdites : tickets, appels, visioconférences" +
  "|outils disponibles : Claude (avec compétences), Make (scénarios), Notion, Thunderbird (boîte RH), base du site ACIA" +
  "|garde-fous : aucun message envoyé sans un humain ; aucun nom ni jugement sur une personne ; contenus confidentiels, de santé ou de conflit écartés ; le HRBP revoit chaque agent chaque mois";

// v56 : ce que l'IA rédige selon la réponse retenue (repris de la consigne du scénario Make 8778955).
const FIA_SELON = {
  AUTOMATISER: "Elle rédige la fiche d'une automatisation qui exécute les règles simples du workflow. Tout cas hors règle revient à un humain ou à un agent IA.",
  ASSISTER: "Elle rédige la fiche d'un agent qui prépare les réponses (brouillons, fiche, liste) ; un humain relit et envoie. Vous corrigez et validez la fiche.",
};

// v58 : rubrique « Relecture humaine » (Assister seulement), en dernière position.
// Choisie par le HRBP à la relecture (Oui par défaut) ; l'IA ne la propose pas. Lecture seule ailleurs.
const FIA_RELECTURE_LIB = "Relecture humaine";
function fiaRelecture(f) { return f && f.RELECTURE === "NON" ? "NON" : "OUI"; }
function fiaRelectureHtml(v) {
  return v === "NON" ? "Non " + badge("b-rose", "Sans relecture humaine") + ' <small class="note">Écart au garde-fou « aucun message envoyé sans un humain » : à assumer et à suivre dans la revue des agents.</small>' : "Oui";
}
function fiaLigneRelecture(v) { return '<div class="avd-l"><span class="avd-k">' + FIA_RELECTURE_LIB + ' <small class="note">(lecture seule)</small></span><span>' + fiaRelectureHtml(v) + "</span></div>"; }

// v61 : « Texte de la réponse automatique » (Automatiser seulement), saisi par le HRBP à la relecture.
// Le scénario Make de classement l'envoie tel quel à l'expéditeur d'un mail de ce type classé avec une
// confiance haute, tant que la décision reste « Validé · Automatiser ». Vide : aucun envoi. L'IA ne le rédige pas.
const FIA_REPAUTO_LIB = "Texte de la réponse automatique";
const FIA_REPAUTO_MAX = 1500;
const FIA_REPAUTO_MODELE = "Bonjour,\n\nMerci pour votre message. à compléter : la réponse type que le service RH envoie pour cette demande (où trouver l'information, ce qu'il faut préparer, le délai habituel).\n\nPour toute situation particulière, répondez simplement à ce mail : un membre de l'équipe RH vous répondra.\n\nCordialement,\nService RH";
function fiaRepAutoHtml(t) {
  t = String(t || "").trim();
  return t ? '<div class="fia-apercu">' + esc(t) + "</div>" : '<span class="note">Vide : aucun mail automatique ne part.</span>';
}
function fiaRepAutoModele() { if (state.fia.brouillon) { state.fia.brouillon.REPONSE_AUTO = FIA_REPAUTO_MODELE; render(); } }

// v69 : « Sources Notion de la réponse » (Assister seulement), saisi par le HRBP à la relecture.
// 1 à 3 liens de pages Notion (documents de référence RH). Le scénario Make de classement lit ces pages
// et l'IA rédige la réponse uniquement à partir d'elles, en citant leur titre ; sinon elle dit qu'elle
// n'a pas trouvé et renvoie vers un RH. Vide : l'IA répond comme avant (orientation générale).
const FIA_SOURCES_LIB = "Sources Notion de la réponse";
const FIA_SOURCES_MAX = 600;
function fiaSourcesLiens(t) { return String(t || "").match(/https?:\/\/[^\s<>"']+/g) || []; }
function fiaSourcesOk(t) { return /[0-9a-f]{32}/.test(String(t || "")); }
function fiaSourcesHtml(t) {
  t = String(t || "").trim();
  if (!t) return '<span class="note">Aucune : l\'IA répond sans document de référence (orientation générale).</span>';
  const liens = fiaSourcesLiens(t);
  const html = liens.length ? liens.map(function (u) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 70)) + "</a>"; }).join("<br>") : esc(t);
  return html + (fiaSourcesOk(t) ? "" : '<br><small class="note">' + badge("b-rose", "Attention") + " Aucun lien de page Notion reconnu : l'IA répondra sans document.</small>");
}

state.fia = state.fia || { code: "", envoi: "", msg: "", depuis: 0, edit: "", brouillon: null };

function fiaActif(d) { return !!d && d.statut === "VALIDE" && (d.reponse === "ASSISTER" || d.reponse === "AUTOMATISER"); }

// Dossier envoyé à l'IA : uniquement ce que l'écran affiche déjà.
function fiaDossier(code) {
  const sig = aciaSignaux();
  if (!sig.ok || !sig.parCode[code]) return "";
  const p = sig.parCode[code], conf = confDe(code), d = decisionDe(code);
  if (!fiaActif(d)) return "";
  const tb = (typesTable() || []).find(function (x) { return x.id === code; }) || {};
  const semaines = Object.keys(p.parSem).map(Number).sort(function (a, b) { return a - b; });
  const L = [];
  L.push("IRRITANT|" + code + "|" + libelleType(code) + "|source : " + (code === CODE_CR ? "comptes rendus de réunion" : "boîte RH partagée") +
    "|définition : " + (tb.definition || "non renseignée") + "|exemple fictif : " + (tb.exemple || "non renseigné") + (tb.processus ? "|processus : " + tb.processus : ""));
  L.push("SIGNAUX|total : " + p.total + "|semaines : " + (semaines.length ? semaines.map(function (s) { return "S" + s + "=" + p.parSem[s]; }).join(" ") : "aucune"));
  L.push("DECISION|statut : VALIDE|réponse retenue : " + d.reponse + "|effet dès la semaine " + d.semaine_effet + (d.commentaire ? "|commentaire du HRBP : " + d.commentaire : ""));
  const v = function (x) { return x ? String(x) : "à définir"; };
  L.push("BASE|besoin : " + v(conf.besoin || conf.action) + "|entrées : " + v(conf.entrees) + "|sorties : " + v(conf.sorties) +
    "|workflow : " + (Array.isArray(conf.workflow) ? conf.workflow.join(" ; ") : "à définir") + "|indicateur : " + v(conf.indicateur));
  L.push(FIA_CADRE);
  return L.join("\n").replace(/\r/g, "");
}

function fiaDocsIA(code) {
  const fb = window.ACIA_FB.suggestions_ia;
  if (!fb || fb.statut !== "ok") return [];
  const t = function (x) { return x.demande && x.demande.toDate ? x.demande.toDate().getTime() : 0; };
  return fb.docs.filter(function (x) { return x.type === "FICHE_IA" && x.code === code && String(x.id).indexOf("test") !== 0; })
    .sort(function (a, b) { return t(b) - t(a); });
}
function fiaDerniere(code) { return fiaDocsIA(code)[0] || null; }

// Lecture des 11 lignes ; null si moins de 6 rubriques lisibles.
function fiaLire(texte) {
  const r = {}, cles = FIA_RUBRIQUES.map(function (x) { return x[0]; });
  String(texte || "").split(/\r?\n/).forEach(function (l) {
    const i = l.indexOf("|");
    if (i < 0) return;
    const k = l.slice(0, i).replace(/[^A-Za-z]/g, "").toUpperCase(), val = l.slice(i + 1).replace(/\|/g, " ").trim();
    if (cles.indexOf(k) >= 0 && !r[k] && val) r[k] = val.slice(0, FIA_MAX);
  });
  return Object.keys(r).length >= 6 ? r : null;
}

// Fiche relue et validée par le HRBP, si elle correspond à la décision actuelle.
function fiaValidee(code) {
  const fb = window.ACIA_FB.fiches_specs, d = decisionDe(code);
  if (!fb || fb.statut !== "ok" || !fiaActif(d)) return null;
  const f = fb.docs.find(function (x) { return x.id === code; });
  return f && f.reponse === d.reponse ? f : null;
}

// v51 : la fiche validée prime sur la base pour le skill (besoin, entrées, sorties, workflow, indicateur).
function fiaConf(code) {
  const conf = Object.assign({}, confDe(code)), f = fiaValidee(code);
  if (!f) return conf;
  conf.besoin = f.BESOIN || conf.besoin; conf.entrees = f.ENTREES || conf.entrees; conf.sorties = f.SORTIES || conf.sorties;
  conf.indicateur = f.INDICATEUR || conf.indicateur;
  if (f.WORKFLOW) conf.workflow = String(f.WORKFLOW).split(/\s*;\s*|\n+/).map(function (s) { const x = s.replace(/^\d+[.)]\s*/, "").trim(); return x.charAt(0).toUpperCase() + x.slice(1); }).filter(Boolean);
  return conf;
}

function fiaLancer(code) {
  const der = fiaDerniere(code);
  const ilya = der && der.demande && der.demande.toDate ? Date.now() - der.demande.toDate().getTime() : Infinity;
  if (ilya < FIA_DELAI_S * 1000 || Date.now() - (state.fia.depuis || 0) < FIA_DELAI_S * 1000) {
    state.fia = Object.assign({}, state.fia, { code: code, envoi: "", msg: "Une rédaction a été demandée il y a moins d'une minute : attendez avant d'en relancer une." }); render(); return;
  }
  const dossier = fiaDossier(code), d = decisionDe(code);
  if (!dossier) { state.fia = Object.assign({}, state.fia, { code: code, envoi: "", msg: "Dossier impossible à constituer : décision ou données de la base indisponibles." }); render(); return; }
  state.specVue = "ia";
  state.fia = { code: code, envoi: "attente", msg: "Demande envoyée. Le brouillon s'affichera ici dans une trentaine de secondes.", depuis: Date.now(), edit: "", brouillon: null }; render();
  // Formulaire encodé + no-cors, comme les contradicteurs : pas de requête préalable CORS.
  fetch(FIA_WEBHOOK, { method: "POST", mode: "no-cors", body: new URLSearchParams({ dossier: dossier, code: code, reponse: d.reponse, origine: "site ACIA" }) })
    .catch(function (e) { state.fia.envoi = ""; state.fia.msg = "Envoi impossible : " + ((e && e.message) || e); render(); });
  const debut = state.fia.depuis;
  setTimeout(function () {
    if (state.fia.envoi === "attente" && state.fia.depuis === debut) { state.fia.envoi = ""; state.fia.msg = "Pas de brouillon reçu après 90 secondes : réessayez ou vérifiez le scénario Make."; render(); }
  }, 90000);
}

// Ouvre la relecture, à partir du dernier brouillon de l'IA ou de la fiche déjà validée.
function fiaRelire(code, depuisValidee) {
  const src = depuisValidee ? fiaValidee(code) : fiaLire((fiaDerniere(code) || {}).texte);
  if (!src) return;
  const b = {}; FIA_RUBRIQUES.forEach(function (x) { b[x[0]] = String(src[x[0]] || "").slice(0, FIA_MAX); });
  b._origine = depuisValidee ? (src.origine || "IA_RELUE") : "IA_RELUE";
  b.RELECTURE = depuisValidee ? fiaRelecture(src) : "OUI";
  b.REPONSE_AUTO = String((depuisValidee ? src.REPONSE_AUTO : (fiaValidee(code) || {}).REPONSE_AUTO) || "").slice(0, FIA_REPAUTO_MAX);
  b.SOURCES_NOTION = String((depuisValidee ? src.SOURCES_NOTION : (fiaValidee(code) || {}).SOURCES_NOTION) || "").slice(0, FIA_SOURCES_MAX);
  b._ia = depuisValidee ? (src.brouillon_ia || "") : (fiaDerniere(code) || {}).id || "";
  state.specSel = code; state.specVue = "ia";
  state.fia = Object.assign({}, state.fia, { code: code, edit: code, brouillon: b, msg: "" }); render();
  allerVers("fia-" + code);
}
function fiaSaisie(k, el) { if (state.fia.brouillon) state.fia.brouillon[k] = String(el.value).slice(0, k === "REPONSE_AUTO" ? FIA_REPAUTO_MAX : k === "SOURCES_NOTION" ? FIA_SOURCES_MAX : FIA_MAX); }
function fiaAnnuler() { state.fia = Object.assign({}, state.fia, { edit: "", brouillon: null, msg: "" }); render(); }

function fiaValider(code) {
  const b = state.fia.brouillon, d = decisionDe(code);
  if (!b || !fiaActif(d)) return;
  const vides = FIA_RUBRIQUES.filter(function (x) { return !String(b[x[0]] || "").trim(); }).map(function (x) { return x[1]; });
  if (vides.length) { state.fia.msg = "Rubrique(s) vide(s) : " + vides.join(", ") + ". Écrivez au moins « à compléter »."; render(); return; }
  if (typeof window.aciaEcrireFicheSpec !== "function") { state.fia.msg = "Base non connectée : validation impossible."; render(); return; }
  const data = { reponse: d.reponse, origine: b._origine || "IA_RELUE", brouillon_ia: String(b._ia || "").slice(0, 80) };
  FIA_RUBRIQUES.forEach(function (x) { data[x[0]] = String(b[x[0]]).trim().slice(0, FIA_MAX); });
  if (d.reponse === "ASSISTER") data.RELECTURE = b.RELECTURE === "NON" ? "NON" : "OUI";
  if (d.reponse === "ASSISTER") {
    const sn = String(b.SOURCES_NOTION || "").trim().slice(0, FIA_SOURCES_MAX);
    if (sn && !fiaSourcesOk(sn)) { state.fia.msg = "« " + FIA_SOURCES_LIB + " » : aucun lien de page Notion reconnu. Dans Notion, « Copier le lien » de la page, puis collez-le ici (ou videz la rubrique)."; render(); return; }
    if (sn) data.SOURCES_NOTION = sn;
  }
  if (d.reponse === "AUTOMATISER") {
    const t = String(b.REPONSE_AUTO || "").trim().slice(0, FIA_REPAUTO_MAX);
    if (/à compléter|\[|\]/i.test(t)) { state.fia.msg = "« " + FIA_REPAUTO_LIB + " » contient encore « à compléter » ou des crochets : ce texte partirait tel quel. Complétez-le ou videz-le."; render(); return; }
    data.REPONSE_AUTO = t;
  }
  window.aciaEcrireFicheSpec(code, data).then(function () {
    state.specVue = "fiche";
    state.fia = { code: code, envoi: "", msg: "Fiche validée et enregistrée dans la base.", depuis: state.fia.depuis, edit: "", brouillon: null }; render();
  }).catch(function (e) { state.fia.msg = "Refusé par la base : " + ((e && e.message) || e); render(); });
}
function fiaRetirer(code) {
  if (!confirm("Revenir à la fiche générée à partir de la base ?\n\nLa fiche relue sera effacée. Les brouillons de l'IA restent disponibles.")) return;
  if (typeof window.aciaEffacerFicheSpec !== "function") return;
  window.aciaEffacerFicheSpec(code).then(function () { state.fia.msg = "Fiche relue retirée : la fiche de la base est de nouveau affichée."; state.fia.code = code; render(); })
    .catch(function (e) { state.fia.msg = "Refusé par la base : " + ((e && e.message) || e); render(); });
}

function fiaDate(ts) { return ts && ts.toDate ? ts.toDate().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "?"; }
function fiaTexte(k, v) {
  if (k === "WORKFLOW") return String(v).split(/\s*;\s*|\n+/).filter(Boolean).map(function (s, i) { const x = s.replace(/^\d+[.)]\s*/, "").trim(); return (i + 1) + ". " + esc(x.charAt(0).toUpperCase() + x.slice(1)); }).join("<br>");
  return esc(v).replace(/à compléter( par le HRBP)?/gi, function (m) { return '<span class="fia-ac">' + m + "</span>"; });
}
// Nombres cités par l'IA absents du dossier envoyé (contrôle sans IA, comme le contradicteur).
function fiaHorsDossier(doc, r) {
  if (!doc || !doc.entree || !r) return [];
  const dans = String(doc.entree).match(/\d+/g) || [];
  // Les numéros de liste (« 1) », « 2. ») ne sont pas des données : ignorés.
  return (Object.keys(r).map(function (k) { return r[k]; }).join(" ").replace(/(^|[\s;])\d[.)](?=\s)/g, " ").match(/\d+/g) || [])
    .filter(function (n, i, t) { return t.indexOf(n) === i && dans.indexOf(n) < 0; });
}

// Fiche validée : remplace la fiche de la base dans « Spécifications ».
function fiaFicheValidee(code, f) {
  const ligne = function (k, lib) { return "<tr><td style='padding:6px 10px 6px 0;color:#64748b;vertical-align:top;white-space:nowrap'>" + esc(lib) + "</td><td style='padding:6px 0'>" + fiaTexte(k, f[k] || "") + "</td></tr>"; };
  return '<p style="margin:8px 0 0">' + badge("b-violet", "IA") + " " + badge("b-emerald", "Relue et validée par le HRBP") +
    ' <span class="note">le ' + esc(fiaDate(f.maj)) + "</span></p>" +
    '<table style="margin-top:8px;font-size:13px"><tbody>' + FIA_RUBRIQUES.map(function (x) { return ligne(x[0], x[1]); }).join("") +
    (f.reponse === "ASSISTER" ? "<tr><td style='padding:6px 10px 6px 0;color:#64748b;vertical-align:top;white-space:nowrap'>" + FIA_RELECTURE_LIB + "</td><td style='padding:6px 0'>" + fiaRelectureHtml(fiaRelecture(f)) + "</td></tr>" : "") +
    (f.reponse === "ASSISTER" ? "<tr><td style='padding:6px 10px 6px 0;color:#64748b;vertical-align:top;white-space:nowrap'>" + FIA_SOURCES_LIB + "</td><td style='padding:6px 0'>" + fiaSourcesHtml(f.SOURCES_NOTION) + "</td></tr>" : "") +
    (f.reponse === "AUTOMATISER" ? "<tr><td style='padding:6px 10px 6px 0;color:#64748b;vertical-align:top;white-space:nowrap'>" + FIA_REPAUTO_LIB + "</td><td style='padding:6px 0'>" + fiaRepAutoHtml(f.REPONSE_AUTO) + "</td></tr>" : "") + "</tbody></table>" +
    '<div class="rv-actions"><button class="btn slim" onclick="fiaRelire(\'' + code + '\', true)">Modifier la fiche</button>' +
    '<button class="btn slim" onclick="fiaRetirer(\'' + code + '\')">Revenir à la fiche de la base</button></div>';
}

// Bloc « Rédiger la fiche avec l'IA », sous la fiche (base ou validée).
function fiaBloc(code) {
  const d = decisionDe(code);
  if (!fiaActif(d)) return "";
  const fb = window.ACIA_FB.suggestions_ia, der = fiaDerniere(code), validee = fiaValidee(code);
  if (state.fia.code === code && state.fia.envoi === "attente" && der && der.demande && der.demande.toDate && der.demande.toDate().getTime() >= state.fia.depuis - 5000) { state.fia.envoi = ""; state.fia.msg = ""; }
  const attente = state.fia.code === code && state.fia.envoi === "attente";
  const msg = state.fia.code === code && state.fia.msg ? '<p class="note">' + esc(state.fia.msg) + "</p>" : "";
  // Relecture en cours
  if (state.fia.edit === code && state.fia.brouillon) {
    const b = state.fia.brouillon;
    const champs = FIA_RUBRIQUES.map(function (x) {
      return '<label class="fia-l"><span class="avd-k">' + esc(x[1]) + "</span>" +
        '<textarea rows="' + (x[0] === "WORKFLOW" ? 5 : 3) + '" maxlength="' + FIA_MAX + '" oninput="fiaSaisie(\'' + x[0] + '\', this)">' + esc(b[x[0]] || "") + "</textarea></label>";
    }).join("") + (decisionDe(code).reponse === "ASSISTER" ?
      '<label class="fia-l"><span class="avd-k">' + FIA_RELECTURE_LIB + "</span>" +
      '<select onchange="state.fia.brouillon.RELECTURE=this.value;render()"><option value="OUI"' + (b.RELECTURE !== "NON" ? " selected" : "") + '>Oui : un humain relit avant tout envoi</option>' +
      '<option value="NON"' + (b.RELECTURE === "NON" ? " selected" : "") + ">Non : l'agent envoie sans relecture</option></select>" +
      (b.RELECTURE === "NON" ? '<small class="note">' + badge("b-rose", "Attention") + " Écart au garde-fou « aucun message envoyé sans un humain ». Pensez à ajuster le niveau d'autonomie, les risques et les critères d'acceptation ci-dessus.</small>" : "") + "</label>" +
      '<div class="fia-l"><span class="avd-k">' + FIA_SOURCES_LIB + "</span><div>" +
      '<textarea rows="3" maxlength="' + FIA_SOURCES_MAX + '" placeholder="https://www.notion.so/…" oninput="fiaSaisie(\'SOURCES_NOTION\', this)">' + esc(b.SOURCES_NOTION || "") + "</textarea>" +
      '<small class="note">Collez 1 à 3 liens de pages Notion (dans Notion : « Copier le lien »), un par ligne. L\'IA rédige la réponse uniquement à partir de ces pages et cite leur titre ; si la réponse n\'y est pas, elle le dit et renvoie vers un RH. Vide : réponse générale, sans document.</small></div></div>' : "") +
      (decisionDe(code).reponse === "AUTOMATISER" ?
      '<div class="fia-l"><span class="avd-k">' + FIA_REPAUTO_LIB + "</span><div>" +
      '<textarea rows="8" maxlength="' + FIA_REPAUTO_MAX + '" oninput="fiaSaisie(\'REPONSE_AUTO\', this);var p=document.getElementById(\'fia-ap-' + code + '\');if(p)p.innerHTML=fiaRepAutoHtml(this.value)">' + esc(b.REPONSE_AUTO || "") + "</textarea>" +
      '<small class="note">Envoyé tel quel, en réponse à l\'expéditeur, pour chaque mail de ce type classé avec une confiance haute, tant que votre décision reste « Validé · Automatiser ». Vide : aucun mail ne part. Pas de nom, pas de chiffre que vous n\'avez pas vérifié.</small>' +
      (String(b.REPONSE_AUTO || "").trim() ? "" : ' <button type="button" class="btn slim" onclick="fiaRepAutoModele()">Partir d\'un modèle</button>') +
      '<div class="avd-k" style="margin-top:8px">Aperçu <small class="note">(objet : « Re: » + objet du mail reçu ; expéditeur : Service RH)</small></div><div id="fia-ap-' + code + '">' + fiaRepAutoHtml(b.REPONSE_AUTO) + "</div></div></div>" : "");
    return '<div class="card avd-card fia-card" id="fia-' + code + '" style="margin-top:12px;scroll-margin-top:130px"><div class="spechead" style="color:#4b2882">Relecture de la fiche ' + badge("b-violet", "IA") + "</div>" +
      '<p class="tdb-sub" style="margin-top:4px">Corrigez chaque rubrique. Remplacez « à compléter » par ce que vous savez, ou laissez-le. Dans le workflow, séparez les étapes par « ; ». Rien n\'est enregistré avant « Valider la fiche ».</p>' +
      '<div class="fia-form">' + champs + "</div>" + msg +
      '<div class="rv-actions"><button class="btn ok slim" onclick="fiaValider(\'' + code + '\')">Valider la fiche</button><button class="btn slim" onclick="fiaAnnuler()">Annuler</button></div></div>';
  }
  const r = der ? fiaLire(der.texte) : null;
  const bouton = '<button class="btn slim" ' + (attente ? "disabled" : "") + ' onclick="fiaLancer(\'' + code + '\')">' + (attente ? "Rédaction en cours…" : der ? "Relancer la rédaction" : "Rédiger la fiche avec l'IA") + "</button>";
  let corps = "";
  if (!fb || fb.statut === "chargement") corps = '<p class="note">Lecture des brouillons…</p>';
  else if (fb.statut !== "ok") corps = '<p class="note">Brouillons indisponibles : ' + esc(fb.erreur || "") + "</p>";
  else if (!der) corps = validee ? "" : '<p class="note">Aucun brouillon. L\'IA rédige les 11 rubriques à partir du dossier de cet irritant ; ce qu\'elle ne sait pas, elle l\'écrit « à compléter ».</p>';
  else if (!r) corps = '<p class="note">Le dernier brouillon de l\'IA ne respecte pas le format attendu : relancez la rédaction.</p>';
  else if (!validee || (der.demande && validee.maj && der.demande.toDate && validee.maj.toDate && der.demande.toDate() > validee.maj.toDate())) {
    const hors = fiaHorsDossier(der, r);
    corps = '<div class="avd-r">' + FIA_RUBRIQUES.filter(function (x) { return r[x[0]]; }).map(function (x) {
      return '<div class="avd-l"><span class="avd-k">' + esc(x[1]) + "</span><span>" + fiaTexte(x[0], r[x[0]]) + "</span></div>";
    }).join("") + (decisionDe(code).reponse === "ASSISTER" ? fiaLigneRelecture("OUI") : "") +
      (decisionDe(code).reponse === "AUTOMATISER" ? '<div class="avd-l"><span class="avd-k">' + FIA_REPAUTO_LIB + ' <small class="note">(saisi par vous à la relecture)</small></span><span>' + fiaRepAutoHtml((validee || {}).REPONSE_AUTO) + "</span></div>" : "") + "</div>" +
      (decisionDe(code).reponse === "ASSISTER" ? '<p class="note" style="margin-top:6px">« Relecture humaine » vaut « Oui » par défaut : vous la choisissez à l\'étape « Relire et valider ce brouillon ».</p>' : "") +
      '<p class="note" style="margin-top:6px">Brouillon du ' + esc(fiaDate(der.demande)) + ". L'IA peut se tromper : relisez chaque rubrique avant de valider.</p>" +
      (hors.length ? '<p class="note">' + badge("b-rose", "Attention") + " Nombre(s) absent(s) du dossier envoyé : " + esc(hors.join(", ")) + ". À vérifier ou retirer.</p>" : "") +
      '<div class="rv-actions"><button class="btn ok slim" onclick="fiaRelire(\'' + code + '\', false)">Relire et valider ce brouillon</button></div>';
  }
  return '<div class="card avd-card fia-card" id="fia-' + code + '" style="margin-top:12px;scroll-margin-top:130px"><div class="rv-top"><div><div class="spechead" style="color:#4b2882">Rédiger la fiche avec l\'IA ' + badge("b-violet", "IA") + "</div>" +
    '<p class="tdb-sub" style="margin-top:4px">L\'IA reçoit la définition du type, les signaux agrégés, votre décision et le cadre (sources autorisées, outils, garde-fous). ' + (FIA_SELON[d.reponse] || "Elle propose un brouillon ; vous le corrigez et le validez.") + "</p></div>" +
    '<div class="rv-btn">' + bouton + "</div></div>" + msg + corps + "</div>";
}
