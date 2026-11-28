// ---------------------------------------------------------------------------
// v55 (maquette) : période d'analyse de l'onglet « Tendances » (profil HRBP)
// ---------------------------------------------------------------------------
// - Calendrier de démo : le jour fictif J1 du scénario = PER_J1 (un lundi).
//   Un mail sans jour fictif est daté de sa réception réelle.
// - Période : préréglages (2 ou 4 dernières semaines, depuis le début) ou dates choisies,
//   flèches pour reculer / avancer d'une période.
// - Zoom : jour, semaine, mois (boutons − / + ou choix direct).
// - Frise : toutes les semaines observées ; un clic sur une semaine zoome sur elle.
// Préfixe « per » : fonctions globales propres à cette vue.
// ---------------------------------------------------------------------------

const PER_J1 = new Date(2026, 9, 19);            // lundi 19 octobre 2026 = J1 du scénario
const PER_GRAINS = ["jour", "semaine", "mois"];
const PER_JOUR_MS = 864e5;
const PER_MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function perEtat() {
  if (!state.per) state.per = { preset: "4", grain: "semaine", decal: 0, du: "", au: "" };
  return state.per;
}
function perMinuit(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function perAjoute(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function perLundi(d) { const x = perMinuit(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function perIso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function perDeIso(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
function perCourt(d) { return d.getDate() + " " + PER_MOIS[d.getMonth()]; }
function perLong(d) { return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" }); }

// Jour d'un document : jour fictif (J12) ou date de réception réelle.
function perJour(doc) {
  const m = /^J(\d+)$/.exec(String(doc.jour_fictif || "").trim());
  if (m) return perAjoute(PER_J1, Number(m[1]) - 1);
  const d = doc.recu && doc.recu.toDate ? doc.recu.toDate() : null;
  return d ? perMinuit(d) : null;
}
// Jour d'un compte rendu : jour de la réunion (même échelle J que les mails).
function perJourCR(cr) {
  const n = Number(cr.jour_reunion);
  return n > 0 ? perAjoute(PER_J1, n - 1) : null;
}
// v73 : libellés des semaines du calendrier. Les semaines du scénario (1, 2, 3… à partir de PER_J1)
// restent les mêmes en base (semaine_effet) et dans les calculs ; seul l'affichage change.
function semIsoNum(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const j = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - j); const a = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - a) / 864e5 + 1) / 7); }
function semOk(s) { return Number(s) >= 1 && Number(s) <= 400; }
function semLundi(s) { return perAjoute(PER_J1, (Number(s) - 1) * 7); }
function semCal(s) { return semOk(s) ? semIsoNum(semLundi(s)) : s; }
function semJJMM(d) { return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0"); }
function semLib(s) { return "S" + semCal(s); }
function semLong(s) { return semOk(s) ? "semaine " + semCal(s) + " (lun. " + semJJMM(semLundi(s)) + ")" : "semaine " + s; }
function semPlage(s) { if (!semOk(s)) return "Semaine " + s; const l = semLundi(s); return "Semaine " + semCal(s) + " · du lun. " + semJJMM(l) + " au dim. " + semJJMM(perAjoute(l, 6)); }
// Liste déroulante des semaines (valeur = numéro du scénario, libellé = semaine du calendrier).
function semSelect(id, min, val, js) {
  const v = Number(val) || min, L = []; for (let s = min; s < min + 12; s++) L.push(s);
  if (semOk(v) && L.indexOf(v) === -1) L.unshift(v);
  return '<select id="' + id + '" onchange="' + js + '">' + L.map(function (s) { return '<option value="' + s + '"' + (s === v ? " selected" : "") + ">" + esc(semPlage(s)) + "</option>"; }).join("") + "</select>";
}
function perNumSemaine(d) { return Math.floor((perLundi(d) - PER_J1) / (7 * PER_JOUR_MS)) + 1; }

// Bornes de la période choisie (du lundi au dimanche pour les préréglages).
function perBornes(docs) {
  const p = perEtat();
  const jours = docs.map(perJour).filter(Boolean);
  const premier = jours.length ? new Date(Math.min.apply(null, jours)) : perMinuit(new Date());
  const finRef = perAjoute(perLundi(new Date()), 6);           // dimanche de la semaine en cours
  if (p.preset === "perso") {
    const du = perDeIso(p.du) || perLundi(premier), au = perDeIso(p.au) || finRef;
    return du <= au ? { du: du, au: au } : { du: au, au: du };
  }
  if (p.preset === "tout") return { du: perLundi(premier), au: finRef };
  const n = Number(p.preset) || 4;
  const au = perAjoute(finRef, -7 * n * (p.decal || 0));
  return { du: perAjoute(au, -7 * n + 1), au: au };
}
function perDans(doc, b) { const j = perJour(doc); return !!j && j >= b.du && j <= b.au; }
function perNbJours(b) { return Math.round((b.au - b.du) / PER_JOUR_MS) + 1; }

// Colonnes du tableau selon le zoom (toutes les colonnes de la période, même vides).
function perColonnes(b, grain) {
  const out = [];
  if (grain === "jour") {
    for (let d = new Date(b.du); d <= b.au; d = perAjoute(d, 1))
      out.push({ cle: perIso(d), label: d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", ""), sous: d.getDate() + "/" + String(d.getMonth() + 1).padStart(2, "0") });
  } else if (grain === "semaine") {
    for (let d = perLundi(b.du); d <= b.au; d = perAjoute(d, 7)) {
      const fin = perAjoute(d, 6);
      out.push({ cle: perIso(d), label: "S" + semIsoNum(d), sous: (d.getMonth() === fin.getMonth() ? d.getDate() : perCourt(d)) + "–" + perCourt(fin) });
    }
  } else {
    for (let d = new Date(b.du.getFullYear(), b.du.getMonth(), 1); d <= b.au; d = new Date(d.getFullYear(), d.getMonth() + 1, 1))
      out.push({ cle: d.getFullYear() + "-" + d.getMonth(), label: PER_MOIS[d.getMonth()], sous: String(d.getFullYear()) });
  }
  return out;
}
function perCle(doc, grain) {
  const j = perJour(doc); if (!j) return "";
  if (grain === "jour") return perIso(j);
  if (grain === "semaine") return perIso(perLundi(j));
  return j.getFullYear() + "-" + j.getMonth();
}

// Actions
function perChoisir(preset) { const p = perEtat(); p.preset = preset; p.decal = 0; if (preset === "perso" && !p.du) { const b = perBornes(perDocs()); p.du = perIso(b.du); p.au = perIso(b.au); } render(); }
function perDecaler(n) { const p = perEtat(); if (p.preset === "perso" || p.preset === "tout") return; p.decal = Math.max(0, (p.decal || 0) + n); render(); }
function perGrain(g) { perEtat().grain = g; render(); }
function perZoom(sens) { const p = perEtat(); const i = PER_GRAINS.indexOf(p.grain) + sens; if (i >= 0 && i < PER_GRAINS.length) { p.grain = PER_GRAINS[i]; render(); } }
function perDate(champ, v) { const p = perEtat(); p.preset = "perso"; p[champ] = v; render(); }
function perSemaine(iso) { const p = perEtat(); const d = perDeIso(iso); p.preset = "perso"; p.du = iso; p.au = perIso(perAjoute(d, 6)); p.grain = "jour"; render(); }
function perDocs() { const fb = window.ACIA_FB.classement_mails; return fb && fb.docs ? fb.docs : []; }

// Barre « Période d'analyse » + frise de toutes les semaines.
function perBarre(docs, signauxParJour) {
  const p = perEtat(), b = perBornes(docs);
  const presets = [["2", "2 dernières semaines"], ["4", "4 dernières semaines"], ["tout", "Depuis le début"], ["perso", "Dates choisies"]];
  const chips = presets.map(function (x) { return '<button class="chip' + (p.preset === x[0] ? " active" : "") + '" onclick="perChoisir(\'' + x[0] + '\')">' + x[1] + "</button>"; }).join("");
  const nav = p.preset === "2" || p.preset === "4";
  const fleches = '<button class="per-fl" title="Période précédente" onclick="perDecaler(1)"' + (nav ? "" : " disabled") + '>‹</button>' +
    '<button class="per-fl" title="Période suivante" onclick="perDecaler(-1)"' + (nav && p.decal > 0 ? "" : " disabled") + ">›</button>";
  const dates = '<span class="per-dates"><label>du <input type="date" value="' + perIso(b.du) + '" onchange="perDate(\'du\',this.value)"></label>' +
    '<label>au <input type="date" value="' + perIso(b.au) + '" onchange="perDate(\'au\',this.value)"></label></span>';
  const i = PER_GRAINS.indexOf(p.grain);
  const zoom = '<span class="per-zoom"><button class="per-fl" title="Dézoomer" onclick="perZoom(1)"' + (i < 2 ? "" : " disabled") + ">−</button>" +
    PER_GRAINS.map(function (g) { return '<button class="per-seg' + (p.grain === g ? " on" : "") + '" onclick="perGrain(\'' + g + '\')">' + g.charAt(0).toUpperCase() + g.slice(1) + "</button>"; }).join("") +
    '<button class="per-fl" title="Zoomer" onclick="perZoom(-1)"' + (i > 0 ? "" : " disabled") + ">+</button></span>";
  const n = perNbJours(b);
  const resume = "Du <b>" + esc(perLong(b.du)) + "</b> au <b>" + esc(perLong(b.au)) + "</b> · " + n + " jours" + (n % 7 === 0 ? " (" + (n / 7) + " semaine" + (n > 7 ? "s" : "") + ")" : "");

  // Frise : une barre par semaine, de la première semaine observée à la semaine en cours.
  const jours = docs.map(perJour).filter(Boolean);
  const debut = jours.length ? perLundi(new Date(Math.min.apply(null, jours))) : perLundi(new Date());
  const fin = perLundi(new Date());
  const sem = []; for (let d = new Date(debut); d <= fin; d = perAjoute(d, 7)) sem.push(d);
  const parSem = {}; Object.keys(signauxParJour).forEach(function (k) { const l = perIso(perLundi(perDeIso(k))); parSem[l] = (parSem[l] || 0) + signauxParJour[k]; });
  const maxS = Math.max(1, Math.max.apply(null, sem.map(function (d) { return parSem[perIso(d)] || 0; })));
  const frise = sem.map(function (d) {
    const v = parSem[perIso(d)] || 0, dedans = perAjoute(d, 6) >= b.du && d <= b.au;
    return '<button class="per-col' + (dedans ? " in" : "") + '" title="S' + semIsoNum(d) + " · " + perCourt(d) + "–" + perCourt(perAjoute(d, 6)) + " : " + v + ' signal(s). Clic : zoomer sur cette semaine" onclick="perSemaine(\'' + perIso(d) + '\')">' +
      '<span class="per-b" style="height:' + Math.max(3, Math.round(v / maxS * 38)) + 'px"></span><span class="per-l">S' + semIsoNum(d) + "</span></button>";
  }).join("");

  return '<div class="card per-carte">' +
    '<div class="per-ligne"><div class="kpi-h" style="margin:0">' + tendIcone("calendrier") + '<div class="spechead">Période d\'analyse</div></div>' +
    '<div class="chips">' + chips + "</div></div>" +
    '<div class="per-ligne">' + fleches + dates + '<span style="flex:1"></span><span class="per-zl">Zoom</span>' + zoom + "</div>" +
    '<div class="per-frise" role="group" aria-label="Signaux par semaine sur toute la période observée">' + frise + "</div>" +
    '<p class="note" style="margin:6px 0 0">' + resume + ". Toute la page suit cette période, sauf la date du dernier classement.</p></div>";
}
