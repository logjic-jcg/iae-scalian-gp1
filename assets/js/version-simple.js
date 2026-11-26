// ---------------------------------------------------------------------------
// v67.12 (Repérer : Actualiser à gauche des icônes d'export) · v67.11 (Bento + boucle de l'assistant ; onglet Réglages seulement depuis le Bento) · v67.10 (Bento : Liens + Affichage ; fiche sans « Voir la spécification » ; « Améliorer dans la durée ») · v67.9.1 (correctif : Décider bloqué par un état mémorisé ancien) · v67.9 (contradicteur replié, Suivre → Revue des agents IA en panneau) · v67.8 (Décider : filtre Essentiel/Tous, allègements, bouton skill aligné) · v67.7 (panneau latéral Tendances / Tableau de bord) · v67.6 (Repérer : colonne Confiance, colonnes resserrées) · v67.5 (Repérer : filtre Essentiel/Tous, PDF et mail ; interrupteur seulement dans le Bento) · v67.4 (Bento allégé, simple par défaut) · v67.3 (relecture Oui/Non) · v67.2 (réponse au mail dans Décider) · v67.1 : interrupteur « Version simple / Version complète » (Julien et Direction)
// ---------------------------------------------------------------------------
// Version complète = le site exactement comme avant (choix par défaut).
// Version simple = un « sous-site » reprenant la maquette « ACIA simplifié » :
//   Julien : Repérer (qu'est-ce qui revient ?) · Décider (que fait-on ?) ·
//            Suivre (= Revue mensuelle) · Réglages (= Types d'irritants)
//   Direction : Vue d'ensemble seule, détails repliés, 3 points pour le comité,
//            accès à « Pilotage et ROI » et « Pour en parler avec l'équipe ».
// Repérer et Décider sont de NOUVEAUX écrans qui lisent les mêmes calculs que
// le Tableau de bord (donneesTdb, tdbAExaminer, tdbEffet) et enregistrent la
// décision avec la fonction existante enregistrerDecision (mêmes règles).
// Aucun écran existant n'est modifié ; rien ne change dans Make ni dans la base.
// Retrait complet : enlever la ligne <script src="assets/js/version-simple.js">.
// ---------------------------------------------------------------------------
(function () {
  const CLE = "acia.version";
  const SIMPLE = {
    hrbp: [["s_reperer", "Repérer", "Qu'est-ce qui revient ?"], ["s_decider", "Décider", "Que fait-on ?"], ["b_revue", "Suivre", "Est-ce que ça marche ?"]],
    dir: [["ensemble", "Vue d’ensemble", "Où en est-on ?"]],
  };
  const NOUVEAUX = ["s_reperer", "s_decider"];

  // v67.4 : version simple par défaut ; la version complète seulement si elle a été choisie dans ce navigateur.
  function lire() { try { return localStorage.getItem(CLE) !== "complete"; } catch (e) { return true; } }
  function ecrire(v) { try { localStorage.setItem(CLE, v ? "simple" : "complete"); } catch (e) { /* stockage bloqué */ } }
  let simple = lire();
  function concerne() { return !!SIMPLE[state.role]; }
  function actif() { return simple && concerne(); }
  function idsSimples() { return (SIMPLE[state.role] || []).map(function (t) { return t[0]; }); }

  state.vs = state.vs || { sel: "", tout: false, rep: {}, stat: {}, sem: {}, comm: {} };
  // v67.9.1 : l'état mémorisé de l'onglet (etat.js) est rechargé APRÈS ce fichier et peut venir
  // d'une version précédente : chaque champ est recréé s'il manque, avant chaque dessin.
  function etatVs() {
    if (!state.vs || typeof state.vs !== "object") state.vs = {};
    ["rep", "stat", "sem", "comm", "avdVu"].forEach(function (k) { if (!state.vs[k] || typeof state.vs[k] !== "object") state.vs[k] = {}; });
    return state.vs;
  }
  etatVs();
  const ouverts = {};

  // ----------------------------------------------------------------- styles
  const css = document.createElement("style");
  css.textContent = [
    ".vs-switch{margin-left:auto;align-self:center;display:inline-flex;border:1px solid rgba(255,255,255,.35);border-radius:999px;overflow:hidden}",
    ".vs-switch button{border:0;background:transparent;color:rgba(255,255,255,.78);font:inherit;font-size:12px;font-weight:600;padding:4px 12px;cursor:pointer}",
    ".vs-switch button[aria-pressed=true]{background:#fff;color:var(--dark)}",
    ".vs-switch button:focus-visible{outline:2px solid #fff;outline-offset:-2px}",
    "body.acia-simple .fi-btns [onclick^='ficheVoirSpec']{display:none}",
    ".vs-bento{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid var(--line);font-size:12px;font-weight:600;color:var(--muted)}",
    ".exp-ic .vs-act-date{align-self:center;font-size:12px;font-weight:500;color:#6b6280;margin-right:2px;white-space:nowrap;letter-spacing:0;text-transform:none}",
    ".exp-ic button:disabled{opacity:.4;cursor:not-allowed;background:transparent;border-color:transparent}",
    ".bento-grid a[hidden],.bento > [hidden]{display:none !important}",
    ".vs-switch.clair{margin-left:0;border-color:var(--line)}",
    ".vs-switch.clair button{color:var(--ink)}",
    ".vs-switch.clair button[aria-pressed=true]{background:var(--dark);color:#fff}",
    ".vs-switch.clair button:focus-visible{outline-color:var(--accent)}",
    ".vs-tbl .vs-c{width:1%;white-space:nowrap}",
    ".vs-tbl .vs-irr{width:34%;min-width:200px;padding-right:40px}",
    ".vs-tbl .vs-act{width:auto;text-align:right;white-space:nowrap}",
    ".vs-tbl th.vs-c,.vs-tbl td.vs-c{padding-left:16px;padding-right:16px}",
    ".vs-tbl th.vs-c.vs-n,.vs-tbl td.vs-c.vs-n{text-align:center !important}",
    "#vs-voile{position:fixed;inset:0;background:rgba(20,8,50,.38);z-index:60;opacity:0;pointer-events:none;transition:opacity .2s}",
    "#vs-voile.ouvert{opacity:1;pointer-events:auto}",
    "#vs-panneau{position:fixed;top:0;right:0;bottom:0;width:min(1080px,94vw);background:var(--bg);z-index:61;box-shadow:-12px 0 32px rgba(20,8,50,.25);transform:translateX(102%);transition:transform .25s ease;display:flex;flex-direction:column}",
    "#vs-panneau.ouvert{transform:none}",
    ".vs-pan-tete{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;background:var(--dark);color:#fff}",
    ".vs-pan-tete b{font-size:16px}.vs-pan-tete small{display:block;font-size:12px;opacity:.75;font-weight:400}",
    ".vs-pan-ferme{border:1px solid rgba(255,255,255,.4);background:transparent;color:#fff;border-radius:8px;padding:6px 12px;font:inherit;font-weight:600;cursor:pointer}",
    ".vs-pan-ferme:focus-visible{outline:2px solid #fff;outline-offset:2px}",
    ".vs-pan-corps{flex:1;overflow:auto;padding:20px}",
    "#vs-panneau .exp-ic{display:none}",
    "body.vs-pan-ouvert{overflow:hidden}",
    "body.vs-pan-ouvert .btn-haut{display:none}",
    "@media (prefers-reduced-motion:reduce){#vs-panneau,#vs-voile{transition:none}}",
    "@media (max-width:760px){#vs-panneau{width:100vw}.vs-pan-corps{padding:14px}}",
    "@media print{#vs-panneau,#vs-voile{display:none !important}}",
    ".vs-conf{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;font-size:13px;font-variant-numeric:tabular-nums}",
    ".vs-conf-b{display:inline-flex;width:34px;height:6px;border-radius:3px;overflow:hidden;background:#f1edf6}",
    ".vs-conf-v{display:inline-grid;place-items:center;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:#fef3c7;color:#b45309;border:1px solid #fde68a;font-size:10.5px;font-weight:700}",
    ".tab .vs-q{display:block;font-size:11px;font-weight:400;opacity:.8;line-height:1.2}",
    ".tab .vs-num{display:inline-block;min-width:18px;padding:0 6px;margin-left:6px;border-radius:999px;background:#e11d48;color:#fff;font-size:11px;font-weight:700;line-height:18px;text-align:center}",
    ".tab.vs-gear{margin-left:8px}",
    "body.acia-simple #main > p.note ~ p.note{display:none}",
    ".vs-lead{color:var(--muted);margin:-4px 0 14px;font-size:14px}",
    ".vs-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:16px}",
    ".vs-tile{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 16px}",
    ".vs-tile b{display:block;font-size:28px;line-height:1.2;font-variant-numeric:tabular-nums}",
    ".vs-tile span{display:block;font-weight:600}.vs-tile small{display:block;color:var(--muted);font-size:13px}",
    ".vs-tbl{width:100%;border-collapse:collapse}",
    ".vs-tbl th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);padding:10px 12px;border-bottom:1px solid var(--line);background:var(--lav)}",
    ".vs-tbl td{padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:middle}",
    ".vs-tbl tr:last-child td{border-bottom:0}",
    ".vs-tbl .vs-n{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}",
    ".vs-src{display:block;font-size:12px;color:var(--faint)}",
    ".vs-nom{font-weight:700;color:var(--ink);text-decoration:none}.vs-nom:hover{text-decoration:underline}",
    ".vs-go{border:1px solid var(--accent);background:#fff;color:var(--accent);border-radius:8px;padding:5px 11px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}",
    ".vs-go.p{background:var(--accent);color:#fff}",
    "details.vs-repli{background:#fff;border:1px solid var(--line);border-radius:14px;margin:12px 0}",
    "details.vs-repli > summary{cursor:pointer;padding:11px 16px;font-weight:600;color:var(--accent)}",
    "details.vs-repli > summary span{font-weight:400;color:var(--muted);font-size:13px;margin-left:6px}",
    "details.vs-repli[open] > summary{border-bottom:1px solid var(--line)}",
    "details.vs-repli > .vs-in{padding:12px 16px}",
    ".vs-dec{display:grid;grid-template-columns:minmax(0,300px) minmax(0,1fr);gap:16px;align-items:start}",
    ".vs-list{display:grid;gap:6px}",
    ".vs-it{display:flex;justify-content:space-between;gap:8px;align-items:center;text-align:left;background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 12px;font:inherit;color:var(--ink);cursor:pointer}",
    ".vs-it[aria-current=true]{border-color:var(--accent);box-shadow:inset 3px 0 0 var(--accent)}",
    ".vs-it .t{font-weight:700;font-size:14px;display:block;margin-bottom:3px}",
    ".vs-choices{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}",
    ".vs-ch{border:1px solid var(--line);background:#fff;border-radius:12px;padding:12px;text-align:left;font:inherit;color:var(--ink);cursor:pointer}",
    ".vs-ch b{display:block}.vs-ch small{display:block;color:var(--muted);font-size:13px;margin-top:2px}",
    ".vs-ch[aria-pressed=true]{border-color:var(--accent);background:var(--lav)}",
    ".vs-reco{display:block;font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.05em}",
    ".vs-seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden}",
    ".vs-seg button{border:0;background:#fff;padding:8px 14px;font:inherit;font-weight:600;color:var(--ink);cursor:pointer}",
    ".vs-seg button[aria-pressed=true]{background:var(--accent);color:#fff}",
    ".vs-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:12px}",
    ".vs-row .btn{width:auto;margin-top:0}",
    ".vs-opts{margin-top:10px}.vs-opts summary{cursor:pointer;font-size:13px;color:var(--accent);font-weight:600}",
    ".vs-opts label{display:block;font-size:13px;font-weight:600;margin-top:8px}",
    ".vs-opts input{display:block;width:100%;margin-top:4px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font:inherit}",
    ".vs-stack > * + *{margin-top:16px}",
    ".vs-liens{display:grid;gap:8px;margin-top:12px}",
    ".vs-lien{display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 16px;font:inherit;font-weight:600;color:var(--accent);cursor:pointer;text-align:left}",
    ".vs-lien small{font-weight:400;color:var(--muted)}",
    "@media (max-width:760px){.vs-tiles,.vs-choices,.vs-dec{grid-template-columns:minmax(0,1fr)}.vs-hide-sm{display:none}.vs-switch{margin-left:0}}",
  ].join("");
  document.head.appendChild(css);

  // ------------------------------------------------------------- utilitaires
  function lignes() {
    const D = donneesTdb();
    if (D.erreur) return { erreur: D.erreur };
    const L = D.types.map(function (t) {
      const p = D.parCode[t.code] || { total: 0, parSem: {}, semMax: 0 };
      const d = D.decision(t.code);
      return { code: t.code, label: t.label, p: p, d: d, ex: tdbAExaminer(p), effet: d && d.statut !== "ECARTE" ? tdbEffet(p, Number(d.semaine_effet) || 0) : null };
    });
    return { L: L, semMax: Math.max.apply(null, [0].concat(L.map(function (l) { return l.p.semMax || 0; }))) };
  }
  function attente(l) { return !l.d && l.ex; }
  function rang(l) { return (attente(l) ? 0 : !l.d ? 1 : 2); }
  function trier(L) { return L.slice().sort(function (a, b) { return (rang(a) - rang(b)) || (b.p.total - a.p.total); }); }
  function etiquette(l) {
    if (attente(l)) return badge("b-rose", "À examiner");
    if (!l.d) return badge("b-sky", "Sans décision");
    const s = libStatut(l.d.statut);
    return badge(s.cls, s.label);
  }
  function source(code) { return code === CODE_CR ? "Comptes rendus" : "Boîte RH"; }
  function spark(p, semMax) {
    const sem = []; for (let s = Math.max(1, semMax - 5); s <= semMax; s++) sem.push(s);
    const max = Math.max(2, Math.max.apply(null, sem.map(function (s) { return p.parSem[s] || 0; })));
    const h = 24, bw = 11, g = 3;
    const barres = sem.map(function (s, k) {
      const v = p.parSem[s] || 0, bh = v ? Math.max(3, Math.round(v / max * (h - 2))) : 2;
      return '<rect x="' + (k * (bw + g)) + '" y="' + (h - bh) + '" width="' + bw + '" height="' + bh + '" rx="2" fill="' + (k >= sem.length - 2 ? "#4b2882" : "#bfb3d2") + '"><title>S' + s + " : " + v + "</title></rect>";
    }).join("");
    return '<svg width="' + (sem.length * (bw + g)) + '" height="' + h + '" role="img" aria-label="Signaux des semaines S' + sem[0] + " à S" + semMax + '">' + barres + "</svg>";
  }
  function tuile(v, l, s) { return '<div class="vs-tile"><b>' + esc(v) + "</b><span>" + esc(l) + "</span><small>" + esc(s) + "</small></div>"; }
  function sansBase(titre, msg) { return "<h2>" + titre + '</h2><div class="card"><p class="note" style="margin:0">' + esc(msg) + '</p><p class="note">Aucun chiffre n\'est affiché sans la base.</p></div>'; }

  // ---------------------------------------------------------------- Repérer
  function vsReperer() {
    if (state.ficheCode) return viewFicheIrritant();
    const R = lignes();
    if (R.erreur) return sansBase("Ce qui revient", R.erreur);
    const signales = R.L.filter(function (l) { return l.p.total > 0 && l.code !== "AUTRE"; });
    const nAtt = signales.filter(attente).length, nSD = signales.filter(function (l) { return !l.d; }).length;
    const enPlace = R.L.filter(function (l) { return l.effet && l.d.statut === "VALIDE"; });
    const baisse = enPlace.filter(function (l) { return l.effet.verdict === "BAISSE"; });
    // v67.5 : « Essentiel » = à examiner, sans décision à 3 signaux ou plus, validés ; « Tous » = tout irritant signalé ou décidé.
    const tous = trier(R.L.filter(function (l) { return l.p.total > 0 || l.d; }));
    const essentiels = tous.filter(essentiel);
    const visibles = state.vs.tousIrr ? tous : essentiels;
    const caches = R.L.length - tous.length;
    const masques = tous.length - essentiels.length;
    const filtre = '<div class="vs-row" style="margin:0 0 10px"><div class="vs-seg vs-filtre" role="group" aria-label="Irritants affichés">' +
      '<button aria-pressed="' + !state.vs.tousIrr + '" onclick="vsTousIrr(false)" title="À examiner, sans décision à 3 signaux ou plus, validés">Essentiel (' + essentiels.length + ")</button>" +
      '<button aria-pressed="' + !!state.vs.tousIrr + '" onclick="vsTousIrr(true)" title="Tous les irritants signalés ou décidés">Tous les irritants (' + tous.length + ")</button></div>" +
      (!state.vs.tousIrr && masques ? '<span class="note" style="margin:0">' + masques + " irritant(s) masqué(s) : sans décision à moins de 3 signaux, à surveiller ou écartés.</span>" : "") + "</div>";
    const C = confiances();
    const rows = visibles.map(function (l) {
      return '<tr><td class="vs-irr">' + lienNom(l) + '<span class="vs-src">' + source(l.code) + '</span></td><td class="vs-hide-sm vs-c">' + spark(l.p, R.semMax) + '</td><td class="vs-c vs-n">' + l.p.total + '</td><td class="vs-c">' + confCellule(C[l.code]) + '</td><td class="vs-c">' + etiquette(l) + "</td>" +
        '<td class="vs-act"><button class="vs-go' + (l.d ? "" : " p") + '" onclick="vsAllerDecider(\'' + l.code + '\')">' + (l.d ? "Voir →" : "Décider →") + "</button></td></tr>";
    }).join("") || '<tr><td colspan="5" class="note">Aucun irritant dans cette sélection.</td></tr>';
    return relanceSimple(expAjouterSimple("<h2>Ce qui revient</h2>")) +
      '<p class="vs-lead">Boîte RH partagée et comptes rendus de réunion</p>' +
      '<div class="vs-tiles">' +
        tuile(nAtt, "irritant(s) à examiner", "3 signaux ou plus sur les 2 dernières semaines, sans décision") +
        tuile(nSD + " / " + signales.length, "sans décision", "Irritants signalés que le HRBP n'a pas encore tranchés") +
        tuile(enPlace.length ? baisse.length + " sur " + enPlace.length : "—", "réponse(s) en place avec un effet visible", "Au moins 20 % de signaux en moins par semaine") +
      "</div>" +
      filtre + '<div class="tw"><table class="vs-tbl"><thead><tr><th class="vs-irr">Irritant</th><th class="vs-hide-sm vs-c" title="Signaux par semaine, 6 dernières semaines (les 2 dernières en foncé)">6 semaines</th><th class="vs-c vs-n">Signaux</th><th class="vs-c" title="Confiance de l\'IA au classement : signaux en confiance haute / total">Confiance</th><th class="vs-c">État</th><th class="vs-act"></th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      '<p class="note" style="margin-top:8px">Un signal = un mail classé dans ce type, ou une action de réunion reportée ou sans responsable. « À examiner » = 3 signaux ou plus sur les 2 dernières semaines observées. Confiance = auto-évaluation de l\'IA au classement, pas une probabilité mesurée : barre <b style="color:#4b2882">haute</b> · <b style="color:#8b6fc2">moyenne</b> · <b style="color:#d97706">basse</b> · non évaluée, chiffre = signaux en confiance haute / total, pastille orange = signaux en confiance basse, à vérifier.' +
      (caches ? " " + caches + " type(s) sans aucun signal ne sont pas affichés." : "") + "</p>" +
      '<div class="vs-liens">' +
        lien("tendances", "Détail semaine par semaine, période, comptes rendus, qualité du classement", "écran Tendances") +
        lien("b_pilotage", "Tableau de bord complet et indicateurs détaillés", "écran Tableau de bord") +
      "</div>";
  }
  // v67.12 : « Actualiser » à gauche des icônes d'export, même apparence qu'elles.
  // Mêmes règles que le bouton de Tendances : visible seulement si parametres/ihm.refresh_ihm vaut 1,
  // une relance toutes les 10 minutes au plus ; Make revérifie lui-même. Même fonction relancerTraitement().
  const SVG_ACT = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>';
  function relanceSimple(h) {
    if (typeof parametresIhm !== "function" || typeof relancerTraitement !== "function") return h;
    const p = parametresIhm();
    if (!p || Number(p.refresh_ihm) !== 1 || h.indexOf('<span class="exp-ic">') < 0) return h;
    const delai = typeof RELANCE_DELAI_MIN === "number" ? RELANCE_DELAI_MIN : 10;
    const der = p.derniere_relance && p.derniere_relance.toDate ? p.derniere_relance.toDate() : null;
    const prochaine = der ? new Date(der.getTime() + delai * 60000) : null;
    const attente = prochaine && prochaine > new Date();
    const heure = function (d) { return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); };
    if (attente && !window.__vsRelanceTimer) {
      window.__vsRelanceTimer = setTimeout(function () { window.__vsRelanceTimer = null; if (state.tab === "s_reperer") render(); }, prochaine - new Date() + 1000);
    }
    const texte = state.msgRelance ? (state.msgRelance.indexOf("impossible") >= 0 ? "Relance impossible" : "Relance envoyée")
      : der ? "Actualisé le " + der.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + " à " + heure(der) : "Jamais actualisé à la main";
    const titre = state.msgRelance || (attente ? "Prochaine relance possible à " + heure(prochaine) : "Relance la lecture de la boîte RH et des comptes rendus (une fois toutes les " + delai + " minutes au plus)");
    const bloc = '<span class="vs-act-date" title="' + esc(titre) + '">' + esc(texte) + "</span>" +
      '<button type="button" ' + (attente ? "disabled " : "") + 'onclick="vsRelancer()" title="' + esc(titre) + '" aria-label="Actualiser">' + SVG_ACT + "</button>";
    return h.replace('<span class="exp-ic">', '<span class="exp-ic">' + bloc);
  }
  window.vsRelancer = function () {
    relancerTraitement();
    setTimeout(function () { if (state.tab === "s_reperer") render(); }, 61000);
  };
  function essentiel(l) { return attente(l) || (!l.d && l.p.total >= 3) || (l.d && l.d.statut === "VALIDE"); }
  function expAjouterSimple(h) { return typeof expAjouter === "function" ? expAjouter(h) : h; }
  window.vsTousIrr = function (v) { state.vs.tousIrr = !!v; render(); };
  // Export PDF / partage par mail de « Repérer » (mêmes fonctions que la Revue mensuelle).
  if (typeof EXP_PAGES === "object") EXP_PAGES.s_reperer = "Repérer · ce qui revient";
  if (typeof expResume === "function") {
    const expResumeOrigine = expResume;
    expResume = function (c) {
      if (!c || c.cle !== "s_reperer") return expResumeOrigine(c);
      const R = lignes();
      if (R.erreur) return ["Données de la base indisponibles au moment du partage."];
      const tous = trier(R.L.filter(function (l) { return l.p.total > 0 || l.d; }));
      const vis = state.vs.tousIrr ? tous : tous.filter(essentiel);
      const signales = R.L.filter(function (l) { return l.p.total > 0 && l.code !== "AUTRE"; });
      const L = [signales.filter(attente).length + " irritant(s) à examiner sans décision, " + signales.filter(function (l) { return !l.d; }).length + " sans décision sur " + signales.length + " signalé(s).", "",
        (state.vs.tousIrr ? "Tous les irritants :" : "Irritants essentiels (à examiner, sans décision à 3 signaux ou plus, validés) :")];
      vis.forEach(function (l) {
        const et = attente(l) ? "à examiner" : !l.d ? "sans décision" : libStatut(l.d.statut).label.toLowerCase() + ", " + libReponse(l.d.reponse);
        L.push("- " + l.label + " : " + l.p.total + " signal(s), " + et);
      });
      return L;
    };
  }
  // Confiance par irritant : comptes haute / moyenne / basse / non évaluée, mêmes règles de comptage que les signaux.
  function confiances() {
    const R = {}, ajoute = function (c, n) { c = String(c || "").trim(); if (!c) return; const r = R[c] = R[c] || { HAUTE: 0, MOYENNE: 0, BASSE: 0, NE: 0, total: 0 }; r[n] += 1; r.total += 1; };
    const niv = function (v) { v = String(v || "").toUpperCase(); return v === "HAUTE" || v === "MOYENNE" || v === "BASSE" ? v : "NE"; };
    const fm = window.ACIA_FB.classement_mails;
    if (fm && fm.statut === "ok") fm.docs.forEach(function (d) {
      if (d.type === "ECARTE") return;
      const n = niv(d.confiance);
      ajoute(d.type, n);
      if (d.type_secondaire && String(d.type_secondaire).trim() !== String(d.type).trim()) ajoute(d.type_secondaire, n);
    });
    const fc = window.ACIA_FB.comptes_rendus;
    if (fc && fc.statut === "ok" && typeof lireAnalyseCR === "function") {
      const vus = {};
      fc.docs.filter(function (d) { return d.statut === "ANALYSE"; }).sort(function (a, b) { return (Number(a.jour_reunion) || 0) - (Number(b.jour_reunion) || 0); })
        .forEach(function (cr) {
          const a = lireAnalyseCR(cr.analyse), n = niv(a.confiance);
          a.actions.forEach(function (x) {
            let st = x.statut; if (st === "NOUVELLE" && vus[x.libelle]) st = "REPORTEE"; vus[x.libelle] = true;
            if (st === "REPORTEE" || (st !== "FERMEE" && !x.resp)) ajoute(CODE_CR, n);
          });
        });
    }
    return R;
  }
  // Cellule compacte : barre empilée (haute · moyenne · basse · non évaluée) + « haute / total », point orange si basse.
  function confCellule(r) {
    if (!r || !r.total) return '<span class="note">—</span>';
    const titre = "Confiance de l'IA : haute " + r.HAUTE + " · moyenne " + r.MOYENNE + " · basse " + r.BASSE + (r.NE ? " · non évaluée " + r.NE : "") + " (sur " + r.total + " signaux)";
    const seg = function (n, coul) { return n ? '<span style="display:block;height:100%;width:' + (100 * n / r.total).toFixed(1) + "%;background:" + coul + '"></span>' : ""; };
    return '<span class="vs-conf" title="' + esc(titre) + '" aria-label="' + esc(titre) + '">' +
      '<span class="vs-conf-b">' + seg(r.HAUTE, "#4b2882") + seg(r.MOYENNE, "#a48bcf") + seg(r.BASSE, "#f59e0b") + seg(r.NE, "#e3dcee") + "</span>" +
      "<span>" + r.HAUTE + "/" + r.total + "</span>" + (r.BASSE ? '<span class="vs-conf-v">' + r.BASSE + "</span>" : "") + "</span>";
  }
  function lienNom(l) { return '<a href="#" class="vs-nom" onclick="ouvrirFiche(\'' + l.code + '\', false);return false">' + esc(l.label) + "</a>"; }
  const PANNEAUX = { tendances: ["Tendances", "Détail semaine par semaine, période, comptes rendus, qualité du classement"], b_pilotage: ["Tableau de bord", "Pilotage des irritants et indicateurs détaillés"], b_agents: ["Revue des agents IA", "Agents en place : signaux mesurés, appréciation du HRBP, règles"] };
  function lien(tab, texte, cible) { return '<button class="vs-lien" onclick="' + (PANNEAUX[tab] ? "vsPanneau(\'" + tab + "\')" : "setTab(\'" + tab + "\')") + '"><span>' + esc(texte) + "</span><small>" + esc(cible) + " →</small></button>"; }

  // ---------------------------------------------------------------- Décider
  function vsDecider() {
    if (state.ficheCode) return viewFicheIrritant();
    const R = lignes();
    if (R.erreur) return sansBase("Que fait-on ?", R.erreur);
    const V = state.vs;
    const tous = trier(R.L.filter(function (l) { return l.p.total > 0 || l.d; }));
    // v67.8 : même filtre Essentiel / Tous que Repérer (choix partagé entre les deux écrans).
    const portee = tous.filter(function (l) { return V.tout || !l.d; });
    const retenus = V.tousIrr ? portee : portee.filter(essentiel);
    if (!V.sel || !tous.some(function (l) { return l.code === V.sel; })) {
      const premier = retenus.find(function (l) { return !l.d; }) || retenus[0] || tous.find(function (l) { return !l.d; }) || tous[0];
      V.sel = premier ? premier.code : "";
    }
    const liste = retenus.concat(tous.filter(function (l) { return l.code === V.sel && retenus.indexOf(l) < 0; }));
    const nDec = tous.filter(function (l) { return l.d; }).length;
    const nEss = portee.filter(essentiel).length, masques = portee.length - nEss;
    const filtre = '<div class="vs-seg vs-filtre" role="group" aria-label="Irritants affichés" style="margin-bottom:8px">' +
      '<button aria-pressed="' + !V.tousIrr + '" onclick="vsTousIrr(false)" title="À examiner, sans décision à 3 signaux ou plus, validés">Essentiel (' + nEss + ")</button>" +
      '<button aria-pressed="' + !!V.tousIrr + '" onclick="vsTousIrr(true)" title="Tous les irritants signalés ou décidés">Tous les irritants (' + portee.length + ")</button></div>" +
      (!V.tousIrr && masques ? '<p class="note" style="margin:0 0 8px">' + masques + " irritant(s) masqué(s) : sans décision à moins de 3 signaux" + (V.tout ? ", à surveiller ou écartés" : "") + ".</p>" : "");
    const gauche = filtre + '<label style="display:flex;gap:8px;align-items:center;font-size:13px;color:var(--muted);margin-bottom:8px"><input type="checkbox" ' + (V.tout ? "checked" : "") + ' onchange="vsTout(this.checked)"> Voir aussi les ' + nDec + " irritant(s) déjà décidé(s)</label>" +
      '<div class="vs-list">' + (liste.map(function (l) {
        return '<button class="vs-it" aria-current="' + (l.code === V.sel) + '" onclick="vsSel(\'' + l.code + '\')"><span><span class="t">' + esc(l.label) + "</span>" + etiquette(l) + "</span><b>" + l.p.total + "</b></button>";
      }).join("") || '<p class="note">' + (V.tousIrr || !portee.length ? "Aucun irritant n\'attend de décision." : "Aucun irritant essentiel : voir « Tous les irritants ».") + "</p>") + "</div>";
    if (!V.sel) return "<h2>Que fait-on ?</h2>" + '<div class="vs-dec"><div>' + gauche + "</div><div></div></div>";

    const l = tous.find(function (x) { return x.code === V.sel; }), c = l.code, d = l.d, conf = confDe(c);
    const pre = state.prefillPilot && state.prefillPilot.code === c ? state.prefillPilot : null;
    const rep = V.rep[c] || (pre && pre.reponse) || (d && d.reponse) || conf.reco || "SIMPLIFIER";
    const stat = V.stat[c] || (pre ? "VALIDE" : d && d.statut) || "VALIDE";
    const sem = V.sem[c] !== undefined ? V.sem[c] : (d && d.semaine_effet ? d.semaine_effet : (l.p.semMax || 0) + 1);
    const comm = V.comm[c] !== undefined ? V.comm[c] : (pre ? pre.commentaire : d && d.commentaire) || "";
    const choix = REPONSES_HRBP.map(function (r) {
      return '<button class="vs-ch" aria-pressed="' + (rep === r.id) + '" onclick="vsRep(\'' + c + "','" + r.id + '\')">' + (conf.reco === r.id ? '<span class="vs-reco">Proposé par l\'assistant</span>' : "") + "<b>" + esc(r.label) + "</b><small>" + esc(r.aide) + "</small></button>";
    }).join("");
    const LIB = { VALIDE: "Valider", A_SURVEILLER: "À surveiller", ECARTE: "Écarter" };
    const seg = '<div class="vs-seg" role="group" aria-label="Statut">' + STATUTS_HRBP.map(function (s) {
      return '<button aria-pressed="' + (stat === s.id) + '" onclick="vsStat(\'' + c + "','" + s.id + '\')">' + (LIB[s.id] || s.label) + "</button>";
    }).join("") + "</div>";
    const droite = '<div class="vs-stack">' +
      '<div class="card"><div class="spech3" style="margin:0">' + esc(l.label) + "</div>" +
        '<p style="margin:6px 0 0;font-size:14px"><b>' + l.p.total + " signal(s)</b> " + esc(sourceDe(c)) + " · " + etiquette(l) + "</p>" +
        '<a href="#" class="pick-fiche" onclick="ouvrirFiche(\'' + c + '\', false);return false">Ouvrir la fiche de l\'irritant →</a>' +
        (conf.action ? '<p class="note">Proposition de l\'assistant : ' + esc(conf.action) + "</p>" : "") + "</div>" +
      '<div class="card" id="decision-hrbp"><div class="spechead">Réponse retenue</div><div class="vs-choices" style="margin-top:8px">' + choix + "</div>" +
        (d ? '<p style="font-size:13px;margin-top:10px">Décision enregistrée : ' + badge(libStatut(d.statut).cls, libStatut(d.statut).label) + " " + esc(libReponse(d.reponse)) + " · effet en semaine " + esc(d.semaine_effet) +
          (d.statut === "VALIDE" ? ' · <a href="#" class="pick-fiche" style="margin:0" onclick="allerSpec(\'' + c + '\');return false">Voir la spécification →</a>' : "") + "</p>" : "") +
        (pre ? '<p class="note">' + badge("b-violet", "IA") + " " + esc(pre.note || "Pré-rempli d'après la suggestion acceptée dans la Revue mensuelle : relisez, puis enregistrez vous-même.") + "</p>" : "") +
        '<div class="vs-row">' + seg + '<button class="btn ok" onclick="vsEnregistrer(\'' + c + '\')">Enregistrer la décision</button></div>' +
        '<input type="hidden" id="dp-statut" value="' + esc(stat) + '"><input type="hidden" id="dp-reponse" value="' + esc(rep) + '">' +
        '<details class="vs-opts"' + (ouverts["opts"] ? " open" : "") + ' ontoggle="vsOpts(this.open)"><summary>Plus d\'options : semaine d\'effet (S' + esc(sem) + "), commentaire</summary>" +
          '<label>Semaine à partir de laquelle la réponse s\'applique<input id="dp-sem" type="number" min="' + ((l.p.semMax || 0) + 1) + '" max="53" value="' + esc(sem) + '" oninput="vsSaisie(\'sem\',\'' + c + '\',this.value)"></label>' +
          '<label>Commentaire (280 caractères maximum, sans nom de personne)<input id="dp-comm" maxlength="280" value="' + esc(comm) + '" oninput="vsSaisie(\'comm\',\'' + c + '\',this.value)"></label></details>' +
        (state.msgPilot ? '<p class="note">' + esc(state.msgPilot) + "</p>" : "") + "</div>" +
      (d && d.statut === "VALIDE" ? reponseMail(c, d, conf) : "") +
      (typeof avdCarte === "function" ? avdSimple(c) : "") +
      "</div>";
    return "<h2>Que fait-on ?</h2>" + '<p class="vs-lead">Une décision par irritant : la réponse la plus simple qui suffit.</p>' +
      '<div class="vs-dec"><div>' + gauche + "</div><div>" + droite + "</div></div>";
  }

  // v67.9 : contradicteur avant décision. Une fois une objection reçue (bouton « Relancer l'objection »),
  // son contenu reste replié tant que le HRBP n'a pas relancé dans cette session.
  function avdSimple(c) {
    const html = avdCarte(c);
    const der = typeof avdDerniere === "function" ? avdDerniere(c) : null;
    const attente = state.avd && state.avd.code === c && state.avd.envoi === "attente";
    if (!der || attente || etatVs().avdVu[c]) return html;
    const i = html.indexOf('<div class="rv-btn">'), j = i < 0 ? -1 : html.indexOf("</div></div>", i);
    if (j < 0) return html;
    const tete = html.slice(0, j + 12), corps = html.slice(j + 12, html.length - 6);
    const date = der.demande && der.demande.toDate ? der.demande.toDate().toLocaleDateString("fr-FR") : "";
    return tete + '<details class="vs-repli" style="margin:10px 0 0"><summary>Dernière objection reçue' + (date ? " <span>(" + esc(date) + ")</span>" : "") + "</summary><div class=\"vs-in\">" + corps + "</div></details></div>";
  }
  if (typeof avdLancer === "function") {
    const avdLancerOrigine = avdLancer;
    avdLancer = function (code) { etatVs().avdVu[code] = true; return avdLancerOrigine(code); };
  }

  // v67.2 : décision validée -> « Réponse au mail » (réponse type) + spécification complète, sans quitter Décider.
  function reponseMail(c, d, conf) {
    if (d.reponse === "SIMPLIFIER") {
      return '<div class="card"><div class="spechead">Réponse au mail</div><p style="font-size:14px;margin:6px 0 0">Aucune réponse automatique : réponse sans outil.</p>' +
        (conf.action ? '<p class="note">Action : ' + esc(conf.action) + "</p>" : "") + "</div>";
    }
    const fiv = typeof fiaValidee === "function" ? fiaValidee(c) : null;
    const der = typeof fiaDerniere === "function" ? fiaDerniere(c) : null;
    const brouillonIA = !!(der && typeof fiaLire === "function" && fiaLire(der.texte));
    let corps, bouton;
    if (d.reponse === "AUTOMATISER") {
      corps = '<p class="note" style="margin:4px 0 8px">Envoyée telle quelle à l\'expéditeur d\'un mail de ce type classé en confiance haute, tant que la décision reste « Validé · Automatiser ».</p>' +
        (fiv ? fiaRepAutoHtml(fiv.REPONSE_AUTO) : '<span class="note">Pas encore de réponse type : elle se saisit à la relecture de la fiche. Vide : aucun mail automatique ne part.</span>');
    } else {
      const rel = fiv ? fiaRelecture(fiv) : "OUI";
      corps = '<p style="font-size:14px;margin:6px 0 0">L\'IA rédige une réponse à chaque mail de ce type (confiance haute).</p>' +
        '<div class="vs-row" style="margin-top:8px"><b style="font-size:14px">Relecture humaine</b>' +
        (fiv ? '<div class="vs-seg" role="group" aria-label="Relecture humaine">' +
            '<button aria-pressed="' + (rel !== "NON") + '" onclick="vsRelecture(\'' + c + '\',\'OUI\')">Oui : brouillon à relire</button>' +
            '<button aria-pressed="' + (rel === "NON") + '" onclick="vsRelecture(\'' + c + '\',\'NON\')">Non : envoi direct</button></div>'
          : '<span style="font-size:14px">Oui (par défaut)</span>') + "</div>" +
        (fiv ? (rel === "NON" ? '<p class="note">' + badge("b-rose", "Sans relecture humaine") + " Écart au garde-fou « aucun message envoyé sans un humain » : à suivre dans la revue des agents.</p>" : "")
          : '<p class="note">Le choix Oui / Non s\'ouvre une fois la fiche rédigée et validée (bouton ci-dessous), comme dans la version complète.</p>') +
        (state.vs.msgRel && state.vs.msgRel.code === c ? '<p class="note">' + esc(state.vs.msgRel.txt) + "</p>" : "");
    }
    if (fiv) bouton = '<button class="btn slim" onclick="vsSpecOuvrir();fiaRelire(\'' + c + '\', true)">' + (d.reponse === "AUTOMATISER" ? "Modifier la réponse type" : "Modifier la fiche") + "</button>";
    else if (brouillonIA) bouton = '<button class="btn slim" onclick="vsSpecOuvrir();fiaRelire(\'' + c + '\', false)">Relire le brouillon de l\'IA</button>';
    else bouton = '<button class="btn slim" onclick="vsSpecOuvrir();vueSpec(\'ia\')">Rédiger la fiche avec l\'IA</button>';
    return '<div class="card"><div class="kpi-h">' + (typeof specIcone === "function" ? specIcone(d.reponse) : "") + '<div class="spechead">Réponse au mail · ' + esc(libReponse(d.reponse)) + "</div></div>" + corps +
      '<div class="vs-row">' + bouton + "</div></div>" + specDetails(c, d, fiv);
  }
  // Même contenu que la fiche de l'écran Spécifications (fiche de la base ou fiche validée, ou rédaction avec l'IA).
  function specDetails(c, d, fiv) {
    const enRelecture = state.fia && state.fia.edit === c;
    const vue = enRelecture ? "ia" : (state.specVue === "ia" && typeof fiaBloc === "function" ? "ia" : "fiche");
    const ouvert = ouverts["spec"] || enRelecture || vue === "ia";
    const seg = typeof fiaBloc === "function" ? '<div class="vs-seg" role="tablist" style="margin-bottom:10px">' +
      '<button aria-pressed="' + (vue === "fiche") + '" onclick="vueSpec(\'fiche\')">Fiche</button>' +
      '<button aria-pressed="' + (vue === "ia") + '" onclick="vueSpec(\'ia\')">' + (enRelecture ? "Relecture" : "Rédaction avec l\'IA") + "</button></div>" : "";
    let corps;
    if (vue === "ia") corps = fiaBloc(c);
    else if (fiv) corps = fiaFicheValidee(c, fiv);
    else {
      const conf = confDe(c);
      corps = '<table style="font-size:13px"><tbody>' + ligneSpec("Besoin métier", esc(conf.besoin || conf.action || "")) + ligneSpec("Entrées", esc(conf.entrees || "À définir")) +
        ligneSpec("Sorties", esc(conf.sorties || "À définir")) + ligneSpec("Workflow", (conf.workflow || ["À définir"]).map(function (x, k) { return (k + 1) + ". " + esc(x); }).join("<br>")) +
        ligneSpec("Indicateur de suivi", esc(conf.indicateur)) + "</tbody></table>";
    }
    let skill = vue === "fiche" && d.reponse === "ASSISTER" && typeof skillBloc === "function" ? skillBloc(c) : "";
    // v67.8 : « Générer le skill (.zip) » sur la même ligne que « Modifier la fiche » et « Revenir à la fiche de la base ».
    const btnSkill = skill.match(/<button[^>]*genererSkill[^>]*>[\s\S]*?<\/button>/), iAct = corps.lastIndexOf('<div class="rv-actions">');
    if (btnSkill && iAct >= 0) {
      const fin = corps.indexOf("</div>", iAct);
      corps = corps.slice(0, fin) + btnSkill[0] + corps.slice(fin);
      skill = skill.replace(btnSkill[0], "");
    }
    return '<details class="vs-repli" style="margin:0"' + (ouvert ? " open" : "") + ' ontoggle="vsSpecToggle(this.open)"><summary>Spécification complète <span>(' + esc(typeof etatSpec === "function" ? etatSpec(c)[1] : "") + ")</span></summary>" +
      '<div class="vs-in">' + seg + corps + skill + "</div></details>";
  }
  // Relecture Oui / Non : réenregistre la fiche validée à l'identique, seule la rubrique RELECTURE change
  // (même écriture que la validation de la relecture, mêmes règles de la base).
  window.vsRelecture = function (c, v) {
    const f = typeof fiaValidee === "function" ? fiaValidee(c) : null, d = decisionDe(c);
    if (!f || !d || d.reponse !== "ASSISTER" || fiaRelecture(f) === v) return;
    if (v === "NON" && !window.confirm("Passer en « Non : envoi direct » ?\n\nLes réponses rédigées par l'IA pour ce type partiront sans relecture humaine.")) return;
    if (typeof window.aciaEcrireFicheSpec !== "function") { state.vs.msgRel = { code: c, txt: "Base non connectée : enregistrement impossible." }; render(); return; }
    const data = { reponse: d.reponse, origine: f.origine || "IA_RELUE", brouillon_ia: String(f.brouillon_ia || "").slice(0, 80), RELECTURE: v };
    FIA_RUBRIQUES.forEach(function (x) { data[x[0]] = String(f[x[0]] || "").trim().slice(0, FIA_MAX); });
    state.vs.msgRel = { code: c, txt: "Enregistrement…" }; render();
    window.aciaEcrireFicheSpec(c, data).then(function () { state.vs.msgRel = { code: c, txt: "Relecture humaine : " + (v === "NON" ? "Non" : "Oui") + ", enregistré dans la base." }; render(); })
      .catch(function (e) { state.vs.msgRel = { code: c, txt: "Refusé par la base : " + ((e && e.message) || e) }; render(); });
  };
  window.vsSpecOuvrir = function () { ouverts["spec"] = true; };
  window.vsSpecToggle = function (o) { ouverts["spec"] = o; };

  // Actions de l'écran Décider (les choix restent en mémoire si la base se met à jour).
  window.vsAllerDecider = function (code) { state.vs.sel = code; state.msgPilot = ""; setTab("s_decider"); };
  window.vsSel = function (code) { state.vs.sel = code; state.msgPilot = ""; render(); };
  window.vsTout = function (v) { state.vs.tout = !!v; render(); };
  window.vsRep = function (c, r) { state.vs.rep[c] = r; render(); };
  window.vsStat = function (c, s) { state.vs.stat[c] = s; render(); };
  window.vsSaisie = function (k, c, v) { state.vs[k][c] = v; };
  window.vsOpts = function (o) { ouverts["opts"] = o; };
  window.vsEnregistrer = function (c) {
    enregistrerDecision(c);   // fonction existante : mêmes contrôles (semaine d'effet, droits, base)
  };

  // ------------------------------------------------- Vue d'ensemble (Direction)
  function replier(noeuds, libelle) {
    if (!noeuds.length) return;
    const d = document.createElement("details");
    d.className = "vs-repli"; d.open = !!ouverts[libelle];
    d.innerHTML = "<summary>" + esc(libelle) + "</summary>";
    const inner = document.createElement("div"); inner.className = "vs-in";
    noeuds[0].parentNode.insertBefore(d, noeuds[0]);
    noeuds.forEach(function (n) { inner.appendChild(n); });
    d.appendChild(inner);
    d.addEventListener("toggle", function () { ouverts[libelle] = d.open; });
  }
  function norme(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase(); }
  function bloc(main, debut) {
    return Array.prototype.slice.call(main.children).find(function (c) {
      const h = c.querySelector("h2,h3,.spechead,.lbl,.ve-h");
      return c.tagName === "DIV" && norme(h ? h.textContent : c.textContent.slice(0, 80)).indexOf(debut) === 0;
    });
  }
  function amenagerEnsemble() {
    const main = document.getElementById("main");
    if (!main || state.ficheCode) return;
    const carte = main.querySelector(".ve-carte");
    if (!carte) return;   // base en cours de lecture : rien à aménager
    const R = lignes();
    if (!R.erreur) {
      const top = trier(R.L.filter(attente)).slice(0, 3);
      const items = top.map(function (l) {
        return "<li><b>" + esc(l.label) + "</b> : " + l.p.total + " signal(s), en attente de décision du HRBP. Réponse proposée : " + esc((function (x) { return x.charAt(0).toLowerCase() + x.slice(1); })(libReponse(confDe(l.code).reco))) + ".</li>";
      }).join("");
      carte.insertAdjacentHTML("afterend", '<div class="card" style="margin-top:16px"><div class="spechead">' + (top.length ? top.length + " point(s) pour le comité" : "Pour le comité") + "</div>" +
        (items ? '<ol style="margin:8px 0 0 18px;display:grid;gap:6px">' + items + "</ol>" : '<p class="note" style="margin:6px 0 0">Aucun irritant à examiner n\'attend de décision.</p>') + "</div>");
    }
    const repart = bloc(main, "repartition par source"), suivre = bloc(main, "irritants a suivre");
    replier([repart, suivre].filter(Boolean), "Répartition par source et tableau complet des irritants");
    main.insertAdjacentHTML("beforeend", '<div class="vs-liens">' + lien("dir_roi", "Pilotage et ROI", "hypothèses, calcul, décisions du comité") + lien("dir_equipe", "Pour en parler avec l’équipe", "conseils de l'IA") + "</div>");
  }

  // ----------------------------------------------------------- branchements
  if (typeof FICHE_ORIGINES === "object") { FICHE_ORIGINES.s_reperer = "Repérer"; FICHE_ORIGINES.s_decider = "Décider"; }

  const roleOrigine = role;
  role = function () {
    const r = roleOrigine();
    if (!actif()) return r;
    const ids = idsSimples();
    return Object.assign({}, r, { tabs: SIMPLE[state.role].map(function (t) { return [t[0], t[1]]; }).concat(r.tabs.filter(function (t) { return ids.indexOf(t[0]) === -1; })) });
  };
  // setRole (connexion) : en version simple, ouvrir le premier écran simple.
  const setRoleOrigine = setRole;
  setRole = function (id) { setRoleOrigine(id); if (actif() && idsSimples().indexOf(state.tab) === -1) setTab(idsSimples()[0]); };

  function interrupteur() {
    return '<div class="vs-switch" role="group" aria-label="Version du site">' +
      '<button type="button" aria-pressed="' + simple + '" onclick="aciaVersionSimple(true)" title="Trois écrans : repérer, décider, suivre">Version simple</button>' +
      '<button type="button" aria-pressed="' + !simple + '" onclick="aciaVersionSimple(false)" title="Tous les onglets et tous les blocs">Version complète</button></div>';
  }
  // v67.4 : menu Bento allégé en version simple (boucle, S2, S6, S7, S8, intranet RH) + interrupteur.
  function bento() {
    const menu = document.getElementById("bento");
    if (!menu) return;
    // v67.10 : en version simple, « Livrables du projet » et sa mention de pied sont masqués ;
    // une section « Liens » (Réglages, Intranet RH) les remplace. Version complète : menu d'origine.
    const S = actif();
    menu.querySelectorAll(":scope > .bento-h, :scope > .bento-grid, :scope > .bento-f").forEach(function (el) { el.hidden = S; });
    menu.querySelectorAll(":scope > .bento-grid a").forEach(function (a) { a.hidden = false; });
    let L = document.getElementById("vs-bento-liens");
    if (!S) { if (L) L.remove(); }
    else {
      if (!L) { L = document.createElement("div"); L.id = "vs-bento-liens"; L.className = "vs-bento-liens"; menu.insertBefore(L, menu.firstChild); }
      const orig = {};
      menu.querySelectorAll(":scope > .bento-grid a").forEach(function (a) { const bt = a.querySelector(".bt"); if (bt) orig[bt.textContent.trim()] = a; });
      const rh = orig.RH, aide = orig.AIDE;
      L.innerHTML = '<div class="bento-h">Liens</div><div class="bento-grid">' +
        (state.role === "hrbp" ? '<a role="menuitem" href="#" onclick="closeBento();setTab(\'types\');return false"><span class="bt" aria-hidden="true" style="font-size:16px">⚙</span>Réglages<small>Types d’irritants</small></a>' : "") +
        (rh ? '<a role="menuitem" href="' + esc(rh.getAttribute("href")) + '" target="_blank" rel="noopener"><span class="bt">RH</span>Intranet RH<small>Notion</small></a>' : "") +
        (aide ? '<a role="menuitem" href="' + esc(aide.getAttribute("href")) + '" target="_blank"><span class="bt">AIDE</span>Boucle de l\'assistant<small>Schéma</small></a>' : "") + "</div>";
    }
    const bb = document.getElementById("bento-btn");
    if (bb) { const t = S ? "Liens et affichage" : "Livrables du projet"; bb.setAttribute("aria-label", t); bb.title = t; }
    let z = document.getElementById("vs-bento");
    if (!concerne()) { if (z) z.remove(); return; }
    if (!z) {
      z = document.createElement("div"); z.id = "vs-bento"; z.className = "vs-bento";
      const pied = menu.querySelector(".bento-f");
      menu.insertBefore(z, pied || null);
    }
    z.innerHTML = '<span>Affichage du site</span>' + interrupteur().replace('class="vs-switch"', 'class="vs-switch clair"');
  }
  const renderTabsOrigine = renderTabs;
  renderTabs = function () {
    renderTabsOrigine();
    document.body.classList.toggle("acia-simple", actif());
    try { bento(); } catch (e) { /* menu complet en cas d'imprévu */ }
    if (!concerne()) return;
    const row = document.querySelector("#tabs .tabrow");
    if (!row) return;
    if (actif()) {
      const S = SIMPLE[state.role], ids = idsSimples();
      let nAtt = 0;
      if (state.role === "hrbp") { const R = lignes(); if (!R.erreur) nAtt = R.L.filter(function (l) { return l.p.total > 0 && l.code !== "AUTRE" && attente(l); }).length; }
      let html = S.map(function (t) {
        return '<button class="tab' + (state.tab === t[0] ? " active" : "") + '" onclick="setTab(\'' + t[0] + '\')">' + esc(t[1]) +
          (t[0] === "s_reperer" && nAtt ? '<span class="vs-num" title="Irritants à examiner sans décision">' + nAtt + "</span>" : "") + '<span class="vs-q">' + esc(t[2]) + "</span></button>";
      }).join("");
      if (ids.indexOf(state.tab) === -1) {
        const t = roleOrigine().tabs.find(function (x) { return x[0] === state.tab; });
        if (t) html += '<button class="tab active">' + esc(state.tab === "types" ? "Réglages" : t[1]) + '<span class="vs-q">' + (state.tab === "types" ? "des types d’irritants" : "écran de la version complète") + "</span></button>";
      }
      // v67.11 : plus d'onglet « Réglages » permanent ; il n'apparaît qu'ouvert depuis le menu Bento.
      row.innerHTML = html;
    }
    // v67.5 : l'interrupteur n'est plus dans la barre d'onglets, seulement dans le menu Bento.
  };

  const renderOrigine = render;
  render = function () {
    etatVs();
    if (actif() && NOUVEAUX.indexOf(state.tab) >= 0) {
      if (!role().tabs.some(function (t) { return t[0] === state.tab; })) state.tab = role().tabs[0][0];
      renderTabs(); renderWho();
      document.getElementById("main").innerHTML = state.tab === "s_reperer" ? vsReperer() : vsDecider();
      state.justAdded = false; state.fresh = null;
      try { dessinerPanneau(); } catch (e) { /* le panneau reste tel quel */ }
      return;
    }
    renderOrigine();
    // v67.9 : Suivre → « Pour aller plus loin » ouvre la Revue des agents IA dans le panneau latéral.
    if (actif() && state.tab === "b_revue" && !state.ficheCode && typeof window.viewRevueAgents === "function") {
      const m = document.getElementById("main");
      if (m && !m.querySelector(".vs-liens")) m.insertAdjacentHTML("beforeend", '<div class="vs-liens">' + lien("b_agents", "Améliorer dans la durée", "écran Revue des agents IA") + "</div>");
    }
    if (actif() && state.tab === "ensemble") { try { amenagerEnsemble(); } catch (e) { /* écran complet en cas d'imprévu */ } }
    try { dessinerPanneau(); } catch (e) { /* le panneau reste tel quel */ }
  };

  // ---------------------------------------------------------------------------
  // v67.7 : en version simple, Tendances et Tableau de bord s'ouvrent dans un panneau
  // latéral (depuis la droite, toute la hauteur). Mêmes écrans, mêmes données en direct.
  // L'onglet courant ne change pas : le panneau se ferme par ×, Échap ou clic sur le voile.
  // ---------------------------------------------------------------------------
  let panneau = null, dernierFocus = null;
  function elementsPanneau() {
    let voile = document.getElementById("vs-voile"), pan = document.getElementById("vs-panneau");
    if (!pan) {
      voile = document.createElement("div"); voile.id = "vs-voile"; voile.addEventListener("click", function () { window.vsFermerPanneau(); });
      pan = document.createElement("aside"); pan.id = "vs-panneau"; pan.setAttribute("role", "dialog"); pan.setAttribute("aria-modal", "true"); pan.setAttribute("aria-labelledby", "vs-pan-titre");
      pan.innerHTML = '<div class="vs-pan-tete"><div><b id="vs-pan-titre"></b><small id="vs-pan-sous"></small></div><button class="vs-pan-ferme" type="button" onclick="vsFermerPanneau()" aria-label="Fermer le panneau">✕ Fermer</button></div><div class="vs-pan-corps" id="vs-pan-corps"></div>';
      document.body.appendChild(voile); document.body.appendChild(pan);
    }
    return { voile: voile, pan: pan, corps: document.getElementById("vs-pan-corps") };
  }
  function dessinerPanneau() {
    const E = document.getElementById("vs-panneau") ? elementsPanneau() : null;
    if (!panneau || !actif() || state.ficheCode) { if (panneau) fermer(); return; }
    const P = E || elementsPanneau();
    const vue = { tendances: window.viewTendances, b_pilotage: window.viewTableauBordHrbp, b_agents: window.viewRevueAgents }[panneau];
    if (typeof vue !== "function") return;
    const ongletReel = state.tab, defil = P.corps.scrollTop;
    state.tab = panneau;            // les écrans lisent l'onglet courant (export, fiche, filtres)
    let html;
    try { html = vue(); } finally { state.tab = ongletReel; }
    P.corps.innerHTML = html;
    P.corps.scrollTop = defil;
    document.getElementById("vs-pan-titre").textContent = PANNEAUX[panneau][0];
    document.getElementById("vs-pan-sous").textContent = PANNEAUX[panneau][1];
  }
  function fermer() {
    const t = panneau;
    panneau = null;
    if (dernierFocus && !document.body.contains(dernierFocus)) dernierFocus = document.querySelector('.vs-lien[onclick*="' + t + '"]');
    const pan = document.getElementById("vs-panneau"), voile = document.getElementById("vs-voile");
    if (pan) pan.classList.remove("ouvert");
    if (voile) voile.classList.remove("ouvert");
    document.body.classList.remove("vs-pan-ouvert");
    if (dernierFocus && dernierFocus.focus) { try { dernierFocus.focus(); } catch (e) { /* rien */ } }
  }
  window.vsPanneau = function (t) {
    if (!PANNEAUX[t]) return;
    dernierFocus = document.activeElement;
    panneau = t;
    const P = elementsPanneau();
    P.corps.scrollTop = 0;
    dessinerPanneau();
    document.body.classList.add("vs-pan-ouvert");
    requestAnimationFrame(function () { P.voile.classList.add("ouvert"); P.pan.classList.add("ouvert"); P.pan.querySelector(".vs-pan-ferme").focus(); });
  };
  window.vsFermerPanneau = function () { fermer(); };
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && panneau) fermer(); });
  // Depuis le panneau : ouvrir une fiche ou changer d'onglet ferme d'abord le panneau.
  if (typeof ouvrirFiche === "function") {
    const ouvrirFicheOrigine = ouvrirFiche;
    ouvrirFiche = function (code, statique) { if (panneau) fermer(); return ouvrirFicheOrigine(code, statique); };
  }
  // Raccourcis internes (« Comptes rendus ↓ ») : défilement dans le panneau quand la cible y est.
  if (typeof allerSection === "function") {
    const allerSectionOrigine = allerSection;
    allerSection = function (id) {
      const el = document.getElementById(id), pan = document.getElementById("vs-pan-corps");
      if (el && pan && pan.contains(el)) { pan.scrollTo({ top: pan.scrollTop + el.getBoundingClientRect().top - pan.getBoundingClientRect().top - 12, behavior: "smooth" }); return; }
      return allerSectionOrigine(id);
    };
  }

  // Mise à jour en direct : les nouveaux écrans se redessinent comme les autres onglets en direct.
  const majOrigine = aciaFbMisAJour;
  aciaFbMisAJour = function (nom) {
    if (actif() && NOUVEAUX.indexOf(state.tab) >= 0) {
      if (["classement_mails", "decisions_hrbp", "comptes_rendus", "types_irritants", "parametres", "suggestions_ia", "fiches_specs"].indexOf(nom) >= 0) render();
      if (nom === "suggestions_ia" && typeof ntyVerifierArrivee === "function") ntyVerifierArrivee();
      return;
    }
    const r = majOrigine(nom);
    if (panneau) { try { dessinerPanneau(); } catch (e) { /* le panneau reste tel quel */ } }
    return r;
  };
  window.aciaFbMisAJour = aciaFbMisAJour;

  // Depuis la fiche irritant, « Décider » reste dans la version simple.
  if (typeof ficheDecider === "function") {
    const ficheDeciderOrigine = ficheDecider;
    ficheDecider = function (code) { if (actif()) { state.ficheCode = null; window.vsAllerDecider(code); } else ficheDeciderOrigine(code); };
  }
  // Revue mensuelle : une suggestion acceptée pré-remplit la décision. En version simple, aller sur Décider.
  const setTabOrigine = setTab;
  setTab = function (t) {
    if (panneau) fermer();
    if (actif() && t === "b_orienter" && state.prefillPilot && state.prefillPilot.code) { state.vs.sel = state.prefillPilot.code; t = "s_decider"; }
    return setTabOrigine(t);
  };

  window.aciaVersionSimple = function (v) {
    simple = !!v; ecrire(simple);
    if (actif()) { if (idsSimples().indexOf(state.tab) === -1) state.tab = idsSimples()[0]; }
    else if (NOUVEAUX.indexOf(state.tab) >= 0) state.tab = roleOrigine().tabs[0][0];
    state.ficheCode = null;
    if (panneau) fermer();
    render(); window.scrollTo(0, 0);
  };
})();
