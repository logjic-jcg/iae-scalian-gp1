// ---------------------------------------------------------------------------
// v67 : interrupteur « Version simple / Version complète » (Julien et Direction)
// ---------------------------------------------------------------------------
// Ne modifie AUCUN écran ni la base : la version simple
//   1. n'affiche que quelques onglets (les autres restent ouverts par les liens
//      internes : un onglet masqué mais ouvert s'affiche quand même) ;
//   2. replie certains blocs après le rendu (balise <details>, un clic les ouvre) ;
//   3. masque les paragraphes d'explication secondaires.
// Version complète = le site exactement comme avant. Choix gardé dans le
// navigateur (localStorage). Pour retirer la fonction : enlever la ligne
// <script src="assets/js/version-simple.js"> de app.html.
// ---------------------------------------------------------------------------
(function () {
  const CLE = "acia.version";
  // Onglets visibles en version simple (identifiants inchangés).
  const ONGLETS_SIMPLES = {
    hrbp: ["tendances", "b_orienter", "b_revue"],
    dir: ["ensemble", "dir_equipe"],
  };
  // Blocs repliés en version simple : début du titre du bloc -> libellé du repli.
  const REPLIS = [
    { onglet: "tendances", titre: "mails analys", libelle: "Qualité du classement (confiance, mails écartés)" },
    { onglet: "tendances", titre: "evolution par", libelle: "Évolution semaine par semaine (tableau)" },
    { onglet: "ensemble", titre: "repartition par source", libelle: "Répartition par source" },
  ];
  // Section « Comptes rendus » de Tendances : du titre de section jusqu'à la fin de l'écran.
  const SECTION_CR = { onglet: "tendances", titre: "comptes rendus de reunion", libelle: "Comptes rendus de réunion : actions qui traînent" };

  function lire() { try { return localStorage.getItem(CLE) === "simple"; } catch (e) { return false; } }
  function ecrire(v) { try { localStorage.setItem(CLE, v ? "simple" : "complete"); } catch (e) { /* stockage bloqué : le choix vaut pour la page */ } }
  let simple = lire();
  const ouverts = {};   // replis ouverts par l'utilisateur, gardés d'un rendu à l'autre (mise à jour en direct)

  function concerne() { return !!ONGLETS_SIMPLES[state.role]; }
  function actif() { return simple && concerne(); }
  function norme(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase(); }

  // Styles propres à la version simple (aucune règle ne s'applique en version complète).
  const css = document.createElement("style");
  css.textContent =
    ".vs-switch{margin-left:auto;align-self:center;display:inline-flex;border:1px solid rgba(255,255,255,.35);border-radius:999px;overflow:hidden}" +
    ".vs-switch button{border:0;background:transparent;color:rgba(255,255,255,.78);font:inherit;font-size:12px;font-weight:600;padding:4px 12px;cursor:pointer}" +
    ".vs-switch button[aria-pressed=true]{background:#fff;color:var(--dark)}" +
    ".vs-switch button:focus-visible{outline:2px solid #fff;outline-offset:-2px}" +
    "body.acia-simple #main > p.note ~ p.note{display:none}" +
    "details.vs-repli{background:var(--card);border:1px solid var(--line);border-radius:14px;margin:12px 0}" +
    "details.vs-repli > summary{cursor:pointer;padding:11px 16px;font-weight:600;color:var(--accent)}" +
    "details.vs-repli > summary span{font-weight:400;color:var(--muted);font-size:13px;margin-left:6px}" +
    "details.vs-repli[open] > summary{border-bottom:1px solid var(--line)}" +
    "details.vs-repli > .vs-in{padding:12px 12px 4px}";
  document.head.appendChild(css);

  function interrupteur() {
    return '<div class="vs-switch" role="group" aria-label="Version du site">' +
      '<button type="button" aria-pressed="' + simple + '" onclick="aciaVersionSimple(true)" title="Moins d\'onglets, détails repliés">Version simple</button>' +
      '<button type="button" aria-pressed="' + !simple + '" onclick="aciaVersionSimple(false)" title="Tous les onglets et tous les blocs">Version complète</button></div>';
  }

  // Barre d'onglets : on masque les onglets hors liste (sauf celui ouvert) et on ajoute l'interrupteur.
  const renderTabsOrigine = renderTabs;
  renderTabs = function () {
    renderTabsOrigine();
    document.body.classList.toggle("acia-simple", actif());
    if (!concerne()) return;
    const row = document.querySelector("#tabs .tabrow");
    if (!row) return;
    if (actif()) {
      const garde = ONGLETS_SIMPLES[state.role];
      const ids = role().tabs.map(function (t) { return t[0]; });
      row.querySelectorAll(".tab").forEach(function (b, i) {
        if (garde.indexOf(ids[i]) === -1 && ids[i] !== state.tab) b.hidden = true;
      });
    }
    row.insertAdjacentHTML("beforeend", interrupteur());
  };

  function replier(noeuds, libelle) {
    if (!noeuds.length) return;
    const d = document.createElement("details");
    d.className = "vs-repli";
    d.open = !!ouverts[libelle];
    d.innerHTML = "<summary>" + esc(libelle) + "<span>(version simple : cliquer pour afficher)</span></summary>";
    const inner = document.createElement("div"); inner.className = "vs-in";
    noeuds[0].parentNode.insertBefore(d, noeuds[0]);
    noeuds.forEach(function (n) { inner.appendChild(n); });
    d.appendChild(inner);
    d.addEventListener("toggle", function () { ouverts[libelle] = d.open; });
  }
  function titreDe(el) {
    const h = el.matches("h2,h3,.sec-titre") ? el : el.querySelector("h2,h3,.spechead,.sec-titre,.ve-h,.lbl");
    return norme(h ? h.textContent : el.textContent.slice(0, 80));
  }

  function appliquerReplis() {
    if (!actif()) return;
    const main = document.getElementById("main");
    if (!main) return;
    const enfants = Array.prototype.slice.call(main.children);
    if (SECTION_CR.onglet === state.tab) {
      const i = enfants.findIndex(function (el) { return el.classList.contains("sec-titre") && titreDe(el).indexOf(SECTION_CR.titre) === 0; });
      if (i >= 0) replier(enfants.slice(i), SECTION_CR.libelle);
    }
    REPLIS.forEach(function (r) {
      if (r.onglet !== state.tab) return;
      const el = Array.prototype.slice.call(main.children).find(function (c) { return c.tagName === "DIV" && titreDe(c).indexOf(r.titre) === 0; });
      if (el) replier([el], r.libelle);
    });
  }

  const renderOrigine = render;
  render = function () { renderOrigine(); try { appliquerReplis(); } catch (e) { /* en cas d'imprévu, l'écran reste complet */ } };

  // Lien « Comptes rendus de réunion ↓ » de Tendances : ouvre le repli avant de descendre.
  if (typeof allerSection === "function") {
    const allerOrigine = allerSection;
    allerSection = function (id) {
      const el = document.getElementById(id), d = el && el.closest("details.vs-repli");
      if (d && !d.open) d.open = true;
      return allerOrigine.apply(this, arguments);
    };
  }

  window.aciaVersionSimple = function (v) {
    simple = !!v; ecrire(simple);
    render(); window.scrollTo(0, 0);
  };
})();
