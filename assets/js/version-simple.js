// ---------------------------------------------------------------------------
// v67.1 : interrupteur « Version simple / Version complète » (Julien et Direction)
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

  function lire() { try { return localStorage.getItem(CLE) === "simple"; } catch (e) { return false; } }
  function ecrire(v) { try { localStorage.setItem(CLE, v ? "simple" : "complete"); } catch (e) { /* stockage bloqué */ } }
  let simple = lire();
  function concerne() { return !!SIMPLE[state.role]; }
  function actif() { return simple && concerne(); }
  function idsSimples() { return (SIMPLE[state.role] || []).map(function (t) { return t[0]; }); }

  state.vs = state.vs || { sel: "", tout: false, rep: {}, stat: {}, sem: {}, comm: {} };
  const ouverts = {};

  // ----------------------------------------------------------------- styles
  const css = document.createElement("style");
  css.textContent = [
    ".vs-switch{margin-left:auto;align-self:center;display:inline-flex;border:1px solid rgba(255,255,255,.35);border-radius:999px;overflow:hidden}",
    ".vs-switch button{border:0;background:transparent;color:rgba(255,255,255,.78);font:inherit;font-size:12px;font-weight:600;padding:4px 12px;cursor:pointer}",
    ".vs-switch button[aria-pressed=true]{background:#fff;color:var(--dark)}",
    ".vs-switch button:focus-visible{outline:2px solid #fff;outline-offset:-2px}",
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
    const visibles = trier(R.L.filter(function (l) { return l.p.total > 0 || l.d; }));
    const caches = R.L.length - visibles.length;
    const rows = visibles.map(function (l) {
      return "<tr><td>" + lienNom(l) + '<span class="vs-src">' + source(l.code) + '</span></td><td class="vs-hide-sm">' + spark(l.p, R.semMax) + '</td><td class="vs-n">' + l.p.total + "</td><td>" + etiquette(l) + "</td>" +
        '<td style="text-align:right"><button class="vs-go' + (l.d ? "" : " p") + '" onclick="vsAllerDecider(\'' + l.code + '\')">' + (l.d ? "Voir →" : "Décider →") + "</button></td></tr>";
    }).join("");
    return "<h2>Ce qui revient</h2>" +
      '<p class="vs-lead">Boîte RH partagée et comptes rendus de réunion · ' + (R.semMax ? "jusqu'à la semaine S" + R.semMax : "") + "</p>" +
      '<div class="vs-tiles">' +
        tuile(nAtt, "irritant(s) à examiner", "3 signaux ou plus sur les 2 dernières semaines, sans décision") +
        tuile(nSD + " / " + signales.length, "sans décision", "Irritants signalés que le HRBP n'a pas encore tranchés") +
        tuile(enPlace.length ? baisse.length + " sur " + enPlace.length : "—", "réponse(s) en place avec un effet visible", "Au moins 20 % de signaux en moins par semaine") +
      "</div>" +
      '<div class="tw"><table class="vs-tbl"><thead><tr><th>Irritant</th><th class="vs-hide-sm">6 dernières semaines</th><th style="text-align:right">Signaux</th><th>État</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      '<p class="note" style="margin-top:8px">Un signal = un mail classé dans ce type, ou une action de réunion reportée ou sans responsable. « À examiner » = 3 signaux ou plus sur les 2 dernières semaines observées.' +
      (caches ? " " + caches + " type(s) sans aucun signal ne sont pas affichés." : "") + "</p>" +
      '<div class="vs-liens">' +
        lien("tendances", "Détail semaine par semaine, période, comptes rendus, qualité du classement", "écran Tendances") +
        lien("b_pilotage", "Tableau de bord complet et indicateurs détaillés", "écran Tableau de bord") +
      "</div>";
  }
  function lienNom(l) { return '<a href="#" class="vs-nom" onclick="ouvrirFiche(\'' + l.code + '\', false);return false">' + esc(l.label) + "</a>"; }
  function lien(tab, texte, cible) { return '<button class="vs-lien" onclick="setTab(\'' + tab + '\')"><span>' + esc(texte) + "</span><small>" + esc(cible) + " →</small></button>"; }

  // ---------------------------------------------------------------- Décider
  function vsDecider() {
    if (state.ficheCode) return viewFicheIrritant();
    const R = lignes();
    if (R.erreur) return sansBase("Que fait-on ?", R.erreur);
    const V = state.vs;
    const tous = trier(R.L.filter(function (l) { return l.p.total > 0 || l.d; }));
    if (!V.sel || !tous.some(function (l) { return l.code === V.sel; })) {
      const premier = tous.find(function (l) { return !l.d; }) || tous[0];
      V.sel = premier ? premier.code : "";
    }
    const liste = tous.filter(function (l) { return V.tout || !l.d || l.code === V.sel; });
    const nDec = tous.filter(function (l) { return l.d; }).length;
    const gauche = '<label style="display:flex;gap:8px;align-items:center;font-size:13px;color:var(--muted);margin-bottom:8px"><input type="checkbox" ' + (V.tout ? "checked" : "") + ' onchange="vsTout(this.checked)"> Voir aussi les ' + nDec + " irritant(s) déjà décidé(s)</label>" +
      '<div class="vs-list">' + (liste.map(function (l) {
        return '<button class="vs-it" aria-current="' + (l.code === V.sel) + '" onclick="vsSel(\'' + l.code + '\')"><span><span class="t">' + esc(l.label) + "</span>" + etiquette(l) + "</span><b>" + l.p.total + "</b></button>";
      }).join("") || '<p class="note">Aucun irritant n\'attend de décision.</p>') + "</div>";
    if (!V.sel) return "<h2>Que fait-on ?</h2>" + '<div class="vs-dec"><div>' + gauche + "</div><div></div></div>";

    const l = tous.find(function (x) { return x.code === V.sel; }), c = l.code, d = l.d, conf = confDe(c);
    const pre = state.prefillPilot && state.prefillPilot.code === c ? state.prefillPilot : null;
    const rep = V.rep[c] || (pre && pre.reponse) || (d && d.reponse) || conf.reco || "SIMPLIFIER";
    const stat = V.stat[c] || (pre ? "VALIDE" : d && d.statut) || "VALIDE";
    const sem = V.sem[c] !== undefined ? V.sem[c] : (d && d.semaine_effet ? d.semaine_effet : (l.p.semMax || 0) + 1);
    const comm = V.comm[c] !== undefined ? V.comm[c] : (pre ? pre.commentaire : d && d.commentaire) || "";
    const semaines = Object.keys(l.p.parSem).map(Number).sort(function (a, b) { return a - b; });
    const detail = semaines.length ? semaines.map(function (s) { return "S" + s + " : " + l.p.parSem[s]; }).join(" · ") : "aucun signal daté";
    const choix = REPONSES_HRBP.map(function (r) {
      return '<button class="vs-ch" aria-pressed="' + (rep === r.id) + '" onclick="vsRep(\'' + c + "','" + r.id + '\')">' + (conf.reco === r.id ? '<span class="vs-reco">Proposé par l\'assistant</span>' : "") + "<b>" + esc(r.label) + "</b><small>" + esc(r.aide) + "</small></button>";
    }).join("");
    const LIB = { VALIDE: "Valider", A_SURVEILLER: "À surveiller", ECARTE: "Écarter" };
    const seg = '<div class="vs-seg" role="group" aria-label="Statut">' + STATUTS_HRBP.map(function (s) {
      return '<button aria-pressed="' + (stat === s.id) + '" onclick="vsStat(\'' + c + "','" + s.id + '\')">' + (LIB[s.id] || s.label) + "</button>";
    }).join("") + "</div>";
    const droite = '<div class="vs-stack">' +
      '<div class="card"><div class="spech3" style="margin:0">' + esc(l.label) + "</div>" +
        '<p style="margin:6px 0 0;font-size:14px"><b>' + l.p.total + " signal(s)</b> " + esc(sourceDe(c)) + " (" + esc(detail) + ") · " + etiquette(l) + "</p>" +
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
        (state.msgPilot ? '<p class="note">' + esc(state.msgPilot) + "</p>" : "") +
        '<p class="note">La décision porte sur un processus, jamais sur une personne.</p></div>' +
      (typeof avdCarte === "function" ? avdCarte(c) : "") +
      "</div>";
    return "<h2>Que fait-on ?</h2>" + '<p class="vs-lead">Une décision par irritant : la réponse la plus simple qui suffit.</p>' +
      '<div class="vs-dec"><div>' + gauche + "</div><div>" + droite + "</div></div>";
  }

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
  const renderTabsOrigine = renderTabs;
  renderTabs = function () {
    renderTabsOrigine();
    document.body.classList.toggle("acia-simple", actif());
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
        if (t) html += '<button class="tab active">' + esc(state.tab === "types" ? "Réglages" : t[1]) + '<span class="vs-q">écran de la version complète</span></button>';
      }
      if (state.role === "hrbp" && state.tab !== "types") html += '<button class="tab vs-gear" onclick="setTab(\'types\')" title="Types d’irritants">⚙ Réglages</button>';
      row.innerHTML = html;
    }
    row.insertAdjacentHTML("beforeend", interrupteur());
  };

  const renderOrigine = render;
  render = function () {
    if (actif() && NOUVEAUX.indexOf(state.tab) >= 0) {
      if (!role().tabs.some(function (t) { return t[0] === state.tab; })) state.tab = role().tabs[0][0];
      renderTabs(); renderWho();
      document.getElementById("main").innerHTML = state.tab === "s_reperer" ? vsReperer() : vsDecider();
      state.justAdded = false; state.fresh = null;
      return;
    }
    renderOrigine();
    if (actif() && state.tab === "ensemble") { try { amenagerEnsemble(); } catch (e) { /* écran complet en cas d'imprévu */ } }
  };

  // Mise à jour en direct : les nouveaux écrans se redessinent comme les autres onglets en direct.
  const majOrigine = aciaFbMisAJour;
  aciaFbMisAJour = function (nom) {
    if (actif() && NOUVEAUX.indexOf(state.tab) >= 0) {
      if (["classement_mails", "decisions_hrbp", "comptes_rendus", "types_irritants", "parametres", "suggestions_ia"].indexOf(nom) >= 0) render();
      if (nom === "suggestions_ia" && typeof ntyVerifierArrivee === "function") ntyVerifierArrivee();
      return;
    }
    return majOrigine(nom);
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
    if (actif() && t === "b_orienter" && state.prefillPilot && state.prefillPilot.code) { state.vs.sel = state.prefillPilot.code; t = "s_decider"; }
    return setTabOrigine(t);
  };

  window.aciaVersionSimple = function (v) {
    simple = !!v; ecrire(simple);
    if (actif()) { if (idsSimples().indexOf(state.tab) === -1) state.tab = idsSimples()[0]; }
    else if (NOUVEAUX.indexOf(state.tab) >= 0) state.tab = roleOrigine().tabs[0][0];
    state.ficheCode = null;
    render(); window.scrollTo(0, 0);
  };
})();
