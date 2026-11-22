// ---------------------------------------------------------------------------
// Données : jeu de données v5 « intégration des nouveaux collaborateurs » (fictif)
// ---------------------------------------------------------------------------

const SOURCES = {
  mail: { label: "Boîte RH", cls: "b-violet" },
  cr:   { label: "Compte rendu", cls: "b-sky" },
};

// Types de réponse, du plus simple au plus lourd
const REPONSES = [
  { id: "reglage",        label: "Réglage d'un outil existant", color: "#64748b" },
  { id: "document",       label: "Document ou modèle unique",   color: "#059669" },
  { id: "automatisation", label: "Automatisation simple",       color: "#0284c7" },
  { id: "workflow",       label: "Workflow sans IA",            color: "#0d9488" },
  { id: "agent",          label: "Nouvel agent IA",             color: "#7c3aed" },
];

const IRRITANTS = [
  { id: "arrivee", titre: "Arrivées mal préparées : annonces incomplètes, demandes au support trop tardives", court: "Arrivées mal préparées", signal: "Arrivée mal préparée", color: "#e11d48",
    note: 11, traitement: "Assister", reponse: "agent", demo: true,
    proposition: "Agent d'intégration : à chaque annonce d'arrivée, il compare l'annonce à la checklist, liste ce qui manque, calcule le rétro-planning (poste 10 jours ouvrés, habilitation 15, badge 3) et prépare les messages au manager, à l'informatique et aux services généraux.",
    pourquoi: "Lire une annonce écrite librement, repérer ce qui manque selon le profil (une habilitation pour un consultant cybersécurité) et rédiger trois messages adaptés demande compréhension et rédaction. Un formulaire aide, mais les managers continueront d'écrire par mail (mails 1, 4, 14, 21). L'agent prépare, la RH envoie." },
  { id: "doc", titre: "Documentation dispersée : plusieurs versions, liens inaccessibles, règles contradictoires", court: "Documentation dispersée", signal: "Version incertaine", color: "#7c3aed",
    note: 10, traitement: "Simplifier (sans agent)", reponse: "document",
    proposition: "Pas d'agent. Une page de référence unique, une seule version par document, lisible avant l'arrivée. La RH archive les anciennes versions.",
    pourquoi: "Le problème n'est pas de trouver le document : il en existe trois. Un agent de recherche documentaire masquerait le désordre au lieu de le supprimer." },
  { id: "questions", titre: "Mêmes questions à chaque arrivée (télétravail, mutuelle, premier jour)", court: "Questions récurrentes", signal: "Question récurrente", color: "#0ea5e9",
    note: 7, traitement: "Simplifier", reponse: "document",
    proposition: "Une FAQ d'accueil jointe au mail de bienvenue. L'assistant en propose le contenu à partir des questions reçues, la RH valide.",
    pourquoi: "Les questions sont prévisibles et les réponses stables : un document suffit. L'IA sert une seule fois, pour rédiger la FAQ." },
  { id: "actions", titre: "Actions de réunion jamais fermées, comptes rendus diffusés tard et peu lus", court: "Actions jamais fermées", signal: "Action reportée", color: "#10b981",
    note: 7, traitement: "Simplifier", reponse: "document",
    proposition: "Un modèle de compte rendu avec un tableau d'actions (responsable, échéance, statut) repris en tête du compte rendu suivant. En option, l'assistant prépare le brouillon à partir de notes tapées, jamais d'un enregistrement.",
    pourquoi: "Ce qui manque, c'est un suivi des actions, pas une rédaction plus rapide. Visios et enregistrements sont exclus par Scalian." },
  { id: "boucle", titre: "Services généraux hors de la boucle des arrivées", court: "Acteur oublié", signal: "Acteur oublié", color: "#f59e0b",
    note: 6, traitement: "Simplifier", reponse: "reglage",
    proposition: "Ajouter les services généraux à la liste de diffusion des annonces d'arrivée.",
    pourquoi: "Un réglage de messagerie suffit : aucune IA n'est nécessaire pour mettre quelqu'un en copie." },
  { id: "pieces", titre: "Pièces renvoyées faute d'accusé de réception", court: "Pièces renvoyées", signal: "Renvoi", color: "#64748b",
    note: 6, traitement: "Automatiser", reponse: "automatisation",
    proposition: "Une réponse automatique à la réception d'un dossier, avec la liste des pièces attendues. L'assistant ne lit jamais le contenu des pièces.",
    pourquoi: "Accuser réception est une règle fixe. Les pièces contiennent des données personnelles : l'IA n'a rien à y faire." },
];

// Fil d'événements, dans l'ordre des jours. Le mail 21 est gardé pour « l'envoi en direct ».
const EVENTS = [
  { jour: "J1", src: "mail", ref: "Mail 1", de: "Olivier Lambert, manager", titre: "Arrivée Hugo Lefèvre", texte: "Hugo arrive le lundi 15 comme consultant test logiciel. « Vous pouvez lancer le nécessaire ? »", irr: ["arrivee"], aparte: "" },
  { jour: "J2", src: "cr", ref: "CR-1", titre: "Point hebdo intégration", texte: "« Arrivées à venir : aucune signalée. » Délai poste rappelé : 10 jours ouvrés. Mise à jour du livret d'accueil : reportée, prévue depuis septembre. Accès aux documents avant l'arrivée : sans responsable.", irr: ["arrivee", "doc", "actions"] },
  { jour: "J2", src: "mail", ref: "Mail 2", de: "Camille Rousseau, RH", titre: "Bienvenue chez nous !", texte: "Liste des pièces à retourner, et lien vers le livret d'accueil : Livret_accueil_2024.pdf.", irr: ["doc"] },
  { jour: "J3", src: "mail", ref: "Mail 3", de: "Hugo Lefèvre, futur employé", titre: "RE: Bienvenue chez nous !", texte: "« Le livret indique un jour de télétravail, en entretien on m'a parlé de deux. » Ne trouve pas le formulaire de mutuelle.", irr: ["doc", "questions"] },
  { jour: "J4", src: "mail", ref: "Mail 4", de: "Olivier Lambert, manager", titre: "Encore une arrivée le 15", texte: "Sarah arrive aussi le 15. « Il lui faudra un PC, je ne sais pas trop à qui faire la demande. »", irr: ["arrivee"] },
  { jour: "J5", src: "mail", ref: "Mail 5", de: "Sarah Benmoussa, future employée", titre: "Lien mutuelle", texte: "Le lien vers le formulaire de mutuelle affiche « accès refusé ».", irr: ["doc", "questions"] },
  { jour: "J8", src: "mail", ref: "Mail 6", de: "Camille Rousseau, RH", titre: "2 postes pour lundi 15", texte: "Demande à l'informatique deux PC et les comptes, 5 jours ouvrés avant l'arrivée.", irr: ["arrivee"] },
  { jour: "J9", src: "cr", ref: "CR-2", titre: "Point hebdo intégration", texte: "Postes commandés, livraison deux jours après l'arrivée. Formulaires de compte en attente. Livret : reporté. Checklist commune : « à lancer ». Services généraux excusés pour la 2e fois.", irr: ["actions", "boucle", "arrivee"] },
  { jour: "J9", src: "mail", ref: "Mail 7", de: "Marc Dubois, informatique", titre: "RE: 2 postes pour lundi 15", texte: "« Le délai, c'est 10 jours ouvrés. » Livraison le 17 au plus tôt ; formulaire de création de compte manquant pour les deux.", irr: ["arrivee"] },
  { jour: "J9", src: "mail", ref: "Mail 8", de: "Hugo Lefèvre, futur employé", titre: "Mes documents (2e envoi)", texte: "Renvoie ses documents : pas de confirmation du premier envoi.", irr: ["pieces"] },
  { jour: "J10", src: "mail", ref: "Mail 9", de: "Camille Rousseau, RH", titre: "Formulaire création de compte", texte: "« Je crois que c'est la bonne version, il y en a deux sur le SharePoint. »", irr: ["doc"] },
  { jour: "J11", src: "mail", ref: "Mail 10", de: "Sarah Benmoussa, future employée", titre: "Lundi : où et à quelle heure ?", texte: "Pas de programme reçu : agence ou client ? À quelle heure ?", irr: ["questions"] },
  { jour: "J12", src: "mail", ref: "Mail 11", de: "Sandrine Petit, services généraux", titre: "Arrivées de lundi ?", texte: "« J'apprends à la machine à café que deux personnes arrivent lundi. » Badges non commandés.", irr: ["boucle", "arrivee"] },
  { jour: "J15", src: "mail", ref: "Mail 12", de: "Olivier Lambert, manager", titre: "Premier jour sans PC", texte: "Les deux arrivants passent la journée sans PC. « Est-ce qu'on peut éviter ça la prochaine fois ? »", irr: ["arrivee"] },
  { jour: "J16", src: "mail", ref: "Mail 13", de: "Hugo Lefèvre, nouvel arrivant", titre: "Quel livret d'accueil ?", texte: "Trois livrets dans le dossier Accueil (2024, 2025_v2, 2025 FINAL) : « Lequel fait foi ? » Note de frais introuvable.", irr: ["doc"] },
  { jour: "J16", src: "mail", ref: "Mail 14", de: "Julien Mercier, HRBP", titre: "Arrivée Antoine Roche lundi 22", texte: "Consultant sécurité, arrive dans 6 jours. « Tu as une checklist d'arrivée à jour ? Je n'ai que celle de 2023. »", irr: ["arrivee", "doc"] },
  { jour: "J17", src: "mail", ref: "Mail 15", de: "Antoine Roche, futur employé", titre: "Quelques questions avant lundi", texte: "Télétravail ? Mutuelle ? Heure d'arrivée lundi ? Les mêmes questions que les deux arrivants précédents.", irr: ["questions"] },
  { jour: "J18", src: "mail", ref: "Mail 16", de: "Marc Dubois, informatique", titre: "Habilitation Antoine", texte: "Une habilitation cybersécurité se demande 15 jours ouvrés avant. « Personne ne me l'a demandée. »", irr: ["arrivee"] },
  { jour: "J18", src: "mail", ref: "Mail 17", de: "Expéditeur masqué", titre: "Demande de rendez-vous confidentiel", texte: "Contenu non affiché.", irr: [], conf: true, aparte: "Classé confidentiel sur son objet : contenu non analysé, non résumé, non inscrit au registre. Transmis tel quel au HRBP." },
  { jour: "J19", src: "mail", ref: "Mail 18", de: "Mutuelle", titre: "Votre lettre d'information de novembre", texte: "Newsletter.", irr: [], aparte: "Bruit : ignoré." },
  { jour: "J19", src: "mail", ref: "Mail 19", de: "Comité d'agence", titre: "Afterwork de fin d'année", texte: "Invitation.", irr: [], aparte: "Bruit : ignoré." },
  { jour: "J19", src: "cr", ref: "CR-3", titre: "Point hebdo intégration (réunion J16, diffusé J19)", texte: "Deux arrivants sans PC le premier jour. Chacun tient sa liste : tableur RH, outil informatique, cahier des services généraux. Livret : 3e report. Checklist commune : pas commencée.", irr: ["actions", "boucle", "doc"] },
  { jour: "J19", src: "cr", ref: "CR-4", titre: "Comité RH mensuel", texte: "Premiers jours difficiles remontés par deux managers. Télétravail : l'accord 2025 dit deux jours, le livret un seul. Checklist commune déjà décidée au comité précédent. Les managers ne lisent pas les comptes rendus des points hebdo. Sujet reporté.", irr: ["actions", "doc", "arrivee"] },
  { jour: "J22", src: "mail", ref: "Mail 20", de: "Karine Dumas, manager", titre: "Arrivée d'Antoine", texte: "PC de secours prêté, mais pas d'accès à l'outil des temps ni d'habilitation avant deux semaines : impossible de le positionner sur sa mission.", irr: ["arrivee"] },
];

const LIVE_EVENT = { jour: "Live", src: "mail", ref: "Mail 21", de: "Isabelle Moreau, manager", titre: "Arrivée Lucas Fabre lundi prochain", texte: "« Lucas Fabre nous rejoint lundi prochain comme consultant data. Merci de faire le nécessaire ! »", irr: ["arrivee"], live: true };



// Livrable 03 : spec complète de l'agent d'intégration (modèle en 11 rubriques)
const SPEC_INTEGRATION = [
  ["Irritant détecté", "Les arrivées sont mal préparées : 3 annonces incomplètes sur 3, demandes au support parties après les délais connus, 3 arrivants sur 3 sans poste ou sans accès complet le premier jour. Sources : mails 1, 4, 6, 7, 11, 12, 14, 16, 20 ; CR-1 à CR-4. Confiance moyenne après contre-analyse. Interprétation des signaux, pas une cause prouvée. Données fictives."],
  ["Besoin métier", "« Quand un manager m'annonce une arrivée, je veux savoir tout de suite ce qui manque et ce qui est déjà en retard, et avoir les messages prêts. » (administration du personnel)"],
  ["Utilisateurs", "L'administration du personnel (valide et envoie), le manager (reçoit la demande d'informations), l'informatique et les services généraux (reçoivent les demandes), le HRBP (propriétaire du processus)."],
  ["Entrées", "Mails de la boîte RH qui annoncent une arrivée ; checklist d'intégration de référence et délais par étape (Notion)."],
  ["Sorties", "Une fiche d'arrivée dans Notion (étapes, échéances, statut) ; 3 brouillons : au manager (informations manquantes), à l'informatique (poste, comptes, habilitation), aux services généraux (badge, place) ; une alerte si un délai est déjà dépassé, avec une solution de repli."],
  ["Workflow", "1. Un mail annonce une arrivée. 2. L'agent extrait date, poste, manager, lieu, matériel, accès. 3. Il compare à la checklist et liste ce qui manque. 4. Il calcule le rétro-planning et repère les délais dépassés. 5. Il crée la fiche d'arrivée et prépare les 3 brouillons. 6. La RH relit, modifie, envoie. 7. Cinq jours avant l'arrivée, l'agent signale les étapes non faites."],
  ["Niveau d'autonomie", "Préparer. L'agent n'envoie rien : une mauvaise date ou un message mal formulé peut coûter un premier jour. Le passage à « agir » (envoi automatique des demandes standard à l'informatique) n'est envisageable qu'après une période de mesure, sur décision du HRBP."],
  ["Permissions et risques", "Lecture de la boîte RH ; écriture de la fiche d'arrivée et des brouillons. Jamais : lire les pièces administratives, lire un mail classé confidentiel, envoyer un mail, évaluer une personne. Risque : données personnelles du futur employé. Parade : l'agent ne traite que l'annonce (nom, date, poste), jamais le dossier. Risque : faux positif. Parade : la RH valide chaque fiche."],
  ["Agent proposé", "Nouvel agent, branché sur la boîte RH (MCP Thunderbird) et sur Notion (checklist, fiches d'arrivée). En complément, sans IA : un formulaire d'annonce pour les managers qui préfèrent l'utiliser."],
  ["Critères d'acceptation", "Sur le jeu de données : les 4 annonces reconnues (mails 1, 4, 14, 21) ; les informations manquantes listées sans erreur ; le délai dépassé signalé pour le mail 21 ; l'habilitation de l'arrivant cybersécurité repérée dès le mail 14 ; le mail 17 jamais analysé ; aucun mail envoyé."],
  ["Gain attendu et indicateur", "Indicateur principal : part des arrivants avec poste et accès prêts le premier jour. Secondaire : nombre de mails échangés par arrivée avant le premier jour. Valeurs : à mesurer, avant et après."],
];

const GEN_STEPS = ["Lecture de l'irritant validé et de ses sources", "Application du modèle en 11 rubriques", "Choix du niveau d'autonomie le plus bas qui suffit", "Vérification : validation humaine, aucun envoi, aucun chiffre inventé, aucune donnée individuelle"];

const PROMPT_GEN = "Tu es analyste métier RH. À partir de l'irritant ci-dessous et de ses sources, rédige une spécification selon ce modèle : Irritant détecté, Besoin métier, Utilisateurs, Entrées, Sorties, Workflow, Niveau d'autonomie, Permissions et risques, Agent proposé, Critères d'acceptation, Gain attendu et indicateur.\n\nRègles :\n- Propose d'abord la réponse la plus simple : un réglage, un document ou un workflow sans IA avant un agent.\n- Le workflow contient toujours une étape de validation humaine.\n- Rien n'est envoyé sans validation.\n- Aucune donnée individuelle : l'irritant décrit une étape du processus, jamais une personne.\n- Les mails confidentiels et les pièces administratives ne sont jamais lus.\n- N'invente aucun chiffre : si un gain n'est pas chiffrable, écris-le.\n- Cite les sources (numéros de mails, comptes rendus).";

// Livrable 04 : simulation de l'agent d'intégration sur le mail 21
const AGENT_STEPS = [
  { label: "Lecture du mail 21", detail: "« Lucas Fabre nous rejoint lundi prochain comme consultant data. Merci de faire le nécessaire ! »", outil: "MCP Thunderbird" },
  { label: "Reconnaissance d'une annonce d'arrivée", detail: "Nom, poste (consultant data), date (lundi prochain), manager (expéditrice).", outil: "Claude" },
  { label: "Comparaison avec la checklist", detail: "Manquent 3 informations sur 6 : lieu du premier jour, matériel, accès particuliers.", outil: "MCP Notion" },
  { label: "Calcul du rétro-planning", detail: "Poste : 10 jours ouvrés, délai déjà dépassé. Badge : 3 jours, possible si demandé aujourd'hui. Repli proposé : PC de secours.", outil: "Claude" },
  { label: "Rapprochement avec l'historique", detail: "Même schéma pour les 3 arrivées précédentes, quel que soit le manager : c'est le processus qui est en cause, pas une personne.", outil: "Claude" },
  { label: "Contre-analyse", detail: "Les informations ont-elles été données par téléphone ? Aucune trace écrite : l'agent pose la question au lieu de supposer.", outil: "Claude" },
  { label: "Fiche d'arrivée et 3 brouillons", detail: "Fiche créée dans Notion. Brouillons : à la manager, à l'informatique, aux services généraux.", outil: "MCP Notion" },
  { label: "La RH relit et envoie", detail: "Camille valide, modifie ou ignore. L'agent n'envoie rien lui-même.", outil: "Humain", human: true },
];



// ---------------------------------------------------------------------------
// État et rendu
// ---------------------------------------------------------------------------


const state = {
  tab: "observer",
  idx: 0, playing: false, liveSent: false, fresh: null,
  feed: [],
  status: {},
  selOrient: "doc",
  selSpec: null, generating: false, genStep: 0, specReady: false,
  agentRunning: false, agentStep: -1,
  serviceFilter: "Tous",
  persona: "futur",
};
IRRITANTS.forEach(function (i) { state.status[i.id] = "À valider"; });
state.avisMgr = {};

let playTimer = null;
const timers = [];

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function badge(cls, text) { return '<span class="badge ' + cls + '">' + esc(text) + "</span>"; }
function irrById(id) { return IRRITANTS.find(function (i) { return i.id === id; }); }
function repById(id) { return REPONSES.find(function (r) { return r.id === id; }); }
function setTab(t) { state.tab = t; render(); window.scrollTo(0, 0); }


function occurrences(list) {
  const occ = {};
  (list || state.feed).slice().reverse().forEach(function (ev) {
    ev.irr.forEach(function (id) { (occ[id] = occ[id] || []).push(ev.ref); });
  });
  return occ;
}

function ring(note) {
  const color = note >= 10 ? "#e11d48" : note >= 8 ? "#f59e0b" : "#64748b";
  const dash = (note / 12) * 97.4;
  return '<div class="ring" title="Note de priorisation /12 (livrable 01, proposition à valider)"><svg viewBox="0 0 36 36">' +
    '<circle cx="18" cy="18" r="15.5" fill="none" stroke="#e2e8f0" stroke-width="4"/>' +
    '<circle cx="18" cy="18" r="15.5" fill="none" stroke="' + color + '" stroke-width="4" stroke-linecap="round" stroke-dasharray="' + dash + ' 97.4"/>' +
    '</svg><span style="color:' + color + '">' + note + "</span></div>";
}

// ------------------------------- OBSERVER ----------------------------------

function step() {
  if (state.idx >= EVENTS.length) { pause(); return; }
  const ev = EVENTS[state.idx];
  state.idx += 1;
  state.feed.unshift(ev);
  state.fresh = ev.irr; state.justAdded = true;
  if (state.idx >= EVENTS.length) pause();
  if (state.tab === "registre") render();
}
function play() { if (state.idx >= EVENTS.length) return; state.playing = true; clearInterval(playTimer); playTimer = setInterval(step, 2200); step(); }
function pause() { state.playing = false; clearInterval(playTimer); if (state.tab === "registre") render(); }
function toutAfficher() { pause(); while (state.idx < EVENTS.length) { state.feed.unshift(EVENTS[state.idx]); state.idx += 1; } state.fresh = null; render(); }
function rejouer() { pause(); state.idx = 0; state.feed = []; state.liveSent = false; state.fresh = null; render(); }
function envoyerLive() {
  if (state.liveSent) return;
  toutAfficher();
  state.liveSent = true;
  state.feed.unshift(LIVE_EVENT);
  state.fresh = LIVE_EVENT.irr; state.justAdded = true;
  render();
}

function viewObserver() {
  const done = state.idx >= EVENTS.length;
  const pct = Math.round((state.idx / EVENTS.length) * 100);
  const controls = '<div class="controls">' +
    (state.playing
      ? '<button class="ctl" onclick="pause()">Pause</button>'
      : '<button class="ctl" onclick="play()"' + (done ? " disabled" : "") + ">" + (state.idx ? "Reprendre" : "Lancer l'observation") + "</button>") +
    '<button class="ctl" onclick="pause();step()"' + (done ? " disabled" : "") + ">Événement suivant</button>" +
    '<button class="ctl" onclick="toutAfficher()"' + (done ? " disabled" : "") + ">Tout afficher</button>" +
    '<button class="ctl" onclick="rejouer()">Rejouer</button>' +
    '<div class="progress" title="' + state.idx + " / " + EVENTS.length + ' événements"><i style="width:' + pct + '%"></i></div>' +
    '<button class="ctl hot" onclick="envoyerLive()"' + (state.liveSent ? " disabled" : "") + ">Simuler l'arrivée du mail 21</button>" +
    "</div>";

  const feed = state.feed.length ? state.feed.map(function (ev, n) {
    const first = ev.irr.length ? irrById(ev.irr[0]) : null;
    const color = first ? first.color : ev.conf ? "#1a1030" : "#cbd5e1";
    const tags = ev.irr.map(function (id) {
      const i = irrById(id);
      return '<span class="badge" style="background:' + i.color + ';color:#fff;border-color:transparent">' + esc(i.signal) + "</span>";
    }).join("");
    const sub = ev.irr.length
      ? "Rattaché à : " + ev.irr.map(function (id) { return esc(irrById(id).court); }).join(" · ")
      : esc(ev.aparte || "Aucun signal retenu.");
    return '<div class="event card' + (ev.live ? " live" : "") + (ev.conf ? " conf" : "") + (n === 0 && state.justAdded ? " new" : "") + '">' +
      '<span class="evdot" style="background:' + color + '"></span>' +
      '<div class="evbody">' +
        '<div class="evmeta"><span class="evtime">' + ev.jour + "</span>" + badge(SOURCES[ev.src].cls, SOURCES[ev.src].label) +
          badge("b-slate", ev.ref) + tags + (ev.conf ? badge("b-dark", "Écarté · confidentiel") : "") + (ev.live ? badge("b-rose", "Reçu en direct") : "") + "</div>" +
        '<div class="evtitle">' + esc(ev.titre) + (ev.de ? ' <span style="font-weight:400;color:#64748b">· ' + esc(ev.de) + "</span>" : "") + "</div>" +
        '<div class="evtext"' + (ev.conf ? ' style="font-style:italic;color:#8f87a3"' : "") + ">" + esc(ev.texte) + "</div>" +
        '<div class="evsub">' + sub + "</div>" +
      "</div></div>";
  }).join("") : '<div class="empty"><div class="big">📨</div><p>Le fil rejoue, dans l\'ordre des jours, les 20 mails déjà reçus par la boîte RH et les 4 comptes rendus. Trois arrivées en quatre semaines. Le mail 21 est gardé pour l\'envoi en direct.</p></div>';

  const occ = occurrences();
  const seen = IRRITANTS.filter(function (i) { return occ[i.id]; });
  const ecartes = state.feed.filter(function (e) { return e.conf; }).length;
  const bruit = state.feed.filter(function (e) { return !e.irr.length && !e.conf; }).length;
  const registre = seen.length ? seen.map(function (i) {
    const srcs = occ[i.id];
    const confirmed = srcs.length >= 2;
    const fresh = state.fresh && state.fresh.indexOf(i.id) >= 0;
    return '<div class="card irr-card' + (fresh ? " fresh" : "") + '"><div class="irr">' + ring(i.note) +
      '<div style="flex:1;min-width:0"><div class="irrtitle">' + esc(i.titre) + "</div>" +
      '<div class="irrtags">' +
        (confirmed ? badge("b-amber", "Irritant · " + srcs.length + " sources") : badge("b-slate", "Signal isolé · 1 source")) +
        badge("b-slate", repById(i.reponse).label) + badge("b-slate", state.status[i.id]) + avisBadge(i.id) +
      "</div></div></div>" +
      '<div class="irrdetail">Sources : ' + esc(srcs.join(", ")) + "</div>" +
      (state.role === "collab" && state.status[i.id] !== "Contesté" ? '<div class="btns"><button class="btn ghost" onclick="setStatus(\'' + i.id + '\',\'Contesté\')">Contester</button></div>' : "") + "</div>";
  }).join("") : '<div class="card"><div class="irrdetail" style="margin:0">Aucun signal pour l\'instant.</div></div>';
  const filtre = (ecartes || bruit) ? '<p class="note">' + (ecartes ? ecartes + " mail écarté (confidentiel, non analysé). " : "") + (bruit ? bruit + " mails de bruit ignorés." : "") + "</p>" : "";

  const trust = '<div class="card trust" style="margin-top:16px"><h3>Règles de confiance</h3><ul class="arrows">' +
    "<li><span>✓</span><span>Sources lues : la boîte partagée « RH – Administration du personnel » et les comptes rendus, autorisées par Scalian. Le dossier partagé : source à confirmer.</span></li>" +
    "<li><span>✕</span><span>Jamais de visios, d'enregistrements ni de tickets. Jamais les pièces administratives jointes.</span></li>" +
    "<li><span>✕</span><span>Un mail confidentiel (santé, conflit, situation personnelle) est écarté sans être analysé.</span></li>" +
    "<li><span>✕</span><span>Aucun irritant n'est attribué à une personne : le registre décrit des étapes du processus.</span></li>" +
    "<li><span>✓</span><span>Le collaborateur et le manager concernés voient d'abord l'irritant et peuvent le contester ; le HRBP valide.</span></li>" +
    "<li><span>✓</span><span>Chaque irritant est une interprétation des signaux, avec ses sources, pas une cause prouvée.</span></li>" +
    "</ul></div>";

  return "<h2>" + (state.role === "collab" ? "Ce que l'assistant repère dans votre activité" : "Fil d'observation : boîte RH et comptes rendus") + "</h2>" + controls +
    '<div class="row c-3-2"><div><div class="feed">' + feed + "</div></div>" +
    "<div><h2>Registre des irritants (" + seen.length + " / " + IRRITANTS.length + ")</h2>" + registre + filtre +
    '<p class="note">Note /12 : grille de priorisation du livrable 01 (fréquence, temps, charge cognitive, risque), proposée par l\'équipe et à valider. Un irritant devient « confirmé » à partir de 2 sources.</p>' +
    trust + "</div></div>";
}

// ------------------------------ ORIENTER -----------------------------------

function selOrient(id) { state.selOrient = id; render(); }
function setStatus(id, s) { state.status[id] = s; render(); }

function viewOrienter() {
  const picks = IRRITANTS.map(function (i) {
    const r = repById(i.reponse);
    return '<button class="pick' + (state.selOrient === i.id ? " selected" : "") + '" onclick="selOrient(\'' + i.id + '\')">' +
      '<div style="font-weight:700;font-size:14px">' + esc(i.court) + "</div>" +
      '<div class="psub"><span style="color:' + r.color + ';font-weight:700">●</span> ' + esc(r.label) + " · " + esc(state.status[i.id]) + (state.avisMgr[i.id] ? " · manager : " + state.avisMgr[i.id].toLowerCase() : "") + "</div></button>";
  }).join("");

  const i = irrById(state.selOrient);
  const r = repById(i.reponse);
  const rIdx = REPONSES.indexOf(r);
  const ladder = '<div class="ladder">' + REPONSES.map(function (x, k) {
    const on = k === rIdx;
    return '<div class="rung' + (on ? " on" : k > rIdx ? " skip" : "") + '"' + (on ? ' style="background:' + x.color + '"' : "") + ">" + esc(x.label) + "</div>";
  }).join("") + "</div>";

  // v22 : l'ancien contradicteur scénarisé est remplacé par le vrai (IA), dans le profil HRBP.
  const contre = '<p style="font-size:13px;margin-top:6px">Le contradicteur avant décision fonctionne en vrai (Claude, via Make) dans le profil <b>HRBP</b>, onglet « Décisions » : ' +
    "bouton « Contredire la proposition » sur chaque irritant. Il ne reçoit que les agrégats de l'irritant, jamais de mail ni de nom.</p>";

  const st = state.status[i.id];
  const stCls = st === "Validé" ? "b-emerald" : st === "Ignoré" ? "b-slate" : "b-amber";

  const right = '<div class="card">' +
    '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">' +
      "<div><div class='spechead'>Réponse la plus simple qui suffit</div><div class='spech3'>" + esc(i.titre) + "</div></div>" +
      "<div>" + badge(stCls, st) + " " + avisBadge(i.id) + "</div></div>" + ladder +
    '<p style="margin-top:12px;font-size:14px"><b>Proposition :</b> ' + esc(i.proposition) + "</p>" +
    '<p style="margin-top:6px;font-size:13px;color:#4a4360"><b>Pourquoi ce niveau :</b> ' + esc(i.pourquoi) + "</p>" +
    '<p class="note" style="margin-top:6px">Traitement selon la grille du livrable 01 : ' + esc(i.traitement) + ".</p></div>" +
    '<div class="card" style="margin-top:16px"><div class="spechead">Contre-analyse</div>' + contre + "</div>" +
    '<div class="card" style="margin-top:16px;border-color:#fde68a;background:#fffbeb"><div class="spechead" style="color:#b45309">Validation humaine</div>' +
      '<p style="font-size:13px;color:#2f2745;margin-top:6px">Le collaborateur et le manager concernés voient l\'irritant en premier et peuvent le contester. Le HRBP, propriétaire du processus, valide et choisit la réponse. Sans validation, aucune spec n\'est générée et aucun agent n\'est lancé.</p>' +
      '<div class="btns"><button class="btn ok" onclick="setStatus(\'' + i.id + '\',\'Validé\')">Valider</button>' +
      '<button class="btn ghost" onclick="setStatus(\'' + i.id + '\',\'Ignoré\')">Ignorer</button>' +
      '<button class="btn ghost" onclick="setStatus(\'' + i.id + '\',\'À valider\')">Remettre à valider</button></div></div>';

  const counts = {}; IRRITANTS.forEach(function (x) { counts[x.reponse] = (counts[x.reponse] || 0) + 1; });
  const resume = REPONSES.map(function (x) { return badge("b-slate", x.label + " : " + (counts[x.id] || 0)); }).join(" ");

  return "<h2>Orienter : pas un agent pour chaque irritant</h2>" +
    '<div class="chips" style="margin-bottom:14px">' + resume + "</div>" +
    '<div class="row c-1-2"><div>' + picks + "</div><div>" + right + "</div></div>" +
    '<p class="note">Règle du prompt de détection : proposer un réglage, un document ou un workflow sans IA avant un agent ; un agent seulement si la tâche demande du jugement ou de la rédaction. Sur 6 irritants RH, un seul agent. Aucun agent n\'existe aujourd\'hui chez Scalian.</p>';
}

// --------------------------- SPÉCIFICATION ---------------------------------

function pickSpec(id) { state.selSpec = id; state.specReady = false; state.genStep = 0; state.generating = false; render(); }

function genererSpec() {
  if (!state.selSpec || state.status[state.selSpec] !== "Validé") return;
  state.generating = true; state.specReady = false; state.genStep = 0; render();
  GEN_STEPS.forEach(function (_, k) { timers.push(setTimeout(function () { state.genStep = k + 1; render(); }, 650 * (k + 1))); });
  timers.push(setTimeout(function () { state.generating = false; state.specReady = true; render(); }, 650 * GEN_STEPS.length + 300));
}

function viewSpec() {
  const picks = IRRITANTS.map(function (i) {
    return '<button class="pick' + (state.selSpec === i.id ? " selected" : "") + '" onclick="pickSpec(\'' + i.id + '\')">' +
      '<div style="font-weight:700;font-size:14px">' + esc(i.court) + "</div>" +
      '<div class="psub">' + esc(repById(i.reponse).label) + " · " + esc(state.status[i.id]) + "</div></button>";
  }).join("");

  const sel = state.selSpec ? irrById(state.selSpec) : null;
  const validated = sel && state.status[sel.id] === "Validé";
  let warn = "";
  if (sel && !validated) {
    warn = '<div class="obj" style="margin-top:12px">Irritant au statut « ' + esc(state.status[sel.id]) + ' ». La spec n\'est générée qu\'après validation par le HRBP. <a href="#" onclick="selOrient(\'' + sel.id + '\');setTab(\'orienter\');return false">Aller à Orienter</a></div>';
  }

  let right;
  if (state.specReady && sel) {
    if (sel.id === "arrivee") {
      right = '<div class="card"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">' +
        "<div><div class='spechead'>Spécification générée par l'IA · relue par l'équipe</div><div class='spech3'>Agent d'intégration</div></div>" +
        badge("b-violet", "Autonomie : préparer") + "</div></div>" +
        '<div class="tw" style="margin-top:12px"><table class="spectable"><tbody>' +
        SPEC_INTEGRATION.map(function (r) { return "<tr><td>" + esc(r[0]) + "</td><td>" + esc(r[1]) + "</td></tr>"; }).join("") +
        "</tbody></table></div>" +
        '<p class="note">La spec ne se met pas à jour seule. Si les signaux évoluent, l\'assistant propose une nouvelle version, qui repasse par la validation du HRBP.</p>';
    } else if (sel.id === "doc") {
      right = '<div class="card"><div class="spechead">Pas de spec d\'agent</div><div class="spech3">Page de référence unique</div>' +
        '<p style="margin-top:8px;font-size:14px;color:#2f2745">L\'assistant ne propose pas d\'agent : le problème n\'est pas de chercher, c\'est qu\'il existe plusieurs versions.</p>' +
        '<ol class="wf"><li><span class="wnum">1</span><span>Une seule page « Accueil » liste les documents en vigueur : livret, accord télétravail 2025, mutuelle, notes de frais, programme du premier jour.</span></li>' +
        '<li><span class="wnum">2</span><span>Une seule version par document ; les anciennes passent dans un dossier Archives.</span></li>' +
        '<li><span class="wnum">3</span><span>La page est lisible avant l\'arrivée, sans compte interne (le lien « accès refusé » du mail 5 disparaît).</span></li>' +
        '<li><span class="wnum">4</span><span>Un responsable unique, nommé par le HRBP, tient la page à jour.</span></li></ol></div>' +
        '<p class="note">Sources : mails 2, 3, 5, 9, 13, 14 ; CR-1, CR-4. L\'IA peut aider une fois, à repérer les doublons dans le dossier partagé si Scalian autorise cette source.</p>';
    } else {
      right = '<div class="card"><div class="spechead">Spec à générer en répétition</div><div class="spech3">' + esc(sel.court) + "</div>" +
        '<p style="margin-top:8px;font-size:14px;color:#2f2745">Cette spec n\'est pas encore rédigée. Elle sera produite avec le prompt ci-dessous, puis relue par l\'équipe. La maquette n\'affiche pas de contenu inventé.</p>' +
        "<pre>" + esc(PROMPT_GEN) + "</pre></div>";
    }
  } else {
    right = '<div class="empty"><div class="big">📋</div><p>Choisissez un irritant validé, puis lancez la génération. La spec suit le modèle en 11 rubriques du livrable 03 : de l\'irritant détecté jusqu\'au gain attendu et à son indicateur.</p></div>';
  }

  const gen = (state.generating || state.specReady) ? '<div class="gensteps">' + GEN_STEPS.map(function (s, k) {
    return '<div class="gstep' + (state.genStep > k ? " on" : "") + '"><span class="gdot"></span><span>' + esc(s) + "</span></div>";
  }).join("") + "</div>" : "";

  return '<div class="row c-1-2"><div><h2>Choisir un irritant</h2>' + picks +
    '<button class="btn" onclick="genererSpec()"' + ((!validated || state.generating) ? " disabled" : "") + ">" +
      (state.generating ? "Génération en cours…" : "Générer la spécification") + "</button>" + warn + gen +
    "</div><div>" + right + "</div></div>";
}

// ----------------------------- AGENT & OUTILS ------------------------------

function lancerAgent() {
  timers.forEach(clearTimeout);
  state.agentRunning = true; state.agentStep = 0; render();
  AGENT_STEPS.forEach(function (_, k) {
    timers.push(setTimeout(function () { state.agentStep = k + 1; render(); }, 1300 * (k + 1)));
  });
  timers.push(setTimeout(function () { state.agentRunning = false; render(); }, 1300 * AGENT_STEPS.length + 300));
}

// ------------------------------- PERSONAS -----------------------------------


function kpiTiles() {
  const all = EVENTS.concat([LIVE_EVENT]);
  const occ = occurrences(all);
  const nIrr = IRRITANTS.filter(function (i) { return occ[i.id]; }).length;
  const nVal = IRRITANTS.filter(function (i) { return state.status[i.id] === "Validé"; }).length;
  const nAgent = IRRITANTS.filter(function (i) { return i.reponse === "agent"; }).length;
  const tiles = [
    ["Arrivants prêts le premier jour", "0 / 3", "Jeu fictif : poste ou accès manquant pour les 3 arrivées"],
    ["Irritants détectés", String(nIrr), "Jeu fictif, au niveau du processus"],
    ["Irritants validés par le HRBP", nVal + " / " + IRRITANTS.length, "Selon les validations du HRBP dans l'outil"],
    ["Réponses proposées", nAgent + " agent · " + (IRRITANTS.length - nAgent) + " sans IA", "La réponse la plus simple qui suffit"],
    ["Mails échangés par arrivée", "à mesurer", "Avant / après, sur de vraies arrivées"],
    ["Temps gagné", "à mesurer", "Aucune estimation affichée"],
  ];
  return '<div class="kpis">' + tiles.map(function (t) {
    return '<div class="kpi"><div class="spechead">' + esc(t[0]) + '</div><div class="kv' + (t[1] === "à mesurer" ? " tbd" : "") + '">' + esc(t[1]) + '</div><div class="irrdetail" style="margin-top:4px">' + esc(t[2]) + "</div></div>";
  }).join("") + "</div>";
}

// -------------------------------- SUIVRE -----------------------------------

function viewSuivre() {
  const all = EVENTS.concat([LIVE_EVENT]);
  const occ = occurrences(all);
  const max = Math.max.apply(null, IRRITANTS.map(function (i) { return (occ[i.id] || []).length; }));
  const bars = IRRITANTS.map(function (i) {
    const v = (occ[i.id] || []).length;
    return '<div class="bar"><span class="lbl">' + esc(i.court) + '</span><span class="track"><span class="fill" style="display:block;width:' + Math.round(v / max * 100) + '%"></span></span><span class="val">' + v + "</span></div>";
  }).join("");

  const c = { "À valider": 0, "Contesté": 0, "Validé": 0, "Ignoré": 0 };
  IRRITANTS.forEach(function (i) { c[state.status[i.id]] += 1; });
  const statuts = Object.keys(c).map(function (k) { return badge(k === "Validé" ? "b-emerald" : k === "Ignoré" ? "b-slate" : "b-amber", k + " : " + c[k]); }).join(" ");

  const INDIC = {
    arrivee: "Part des arrivants avec poste et accès prêts le premier jour",
    doc: "Questions « lequel / où est » reçues par mois",
    questions: "Questions reçues déjà couvertes par la FAQ",
    actions: "Actions reportées plus de 2 fois",
    boucle: "Arrivées signalées à temps aux services généraux",
    pieces: "Renvois de pièces par arrivée",
  };
  const cards = IRRITANTS.map(function (i) {
    const r = repById(i.reponse);
    return '<div class="card" style="margin:0"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">' +
      '<div class="irrtitle">' + esc(i.proposition.split(/[:.]/)[0]) + "</div>" +
      '<span class="badge" style="background:' + r.color + ';color:#fff;border-color:transparent">' + esc(r.label) + "</span></div>" +
      '<div class="irrdetail">Irritant d\'origine : ' + esc(i.court) + "</div>" +
      '<table style="margin-top:8px;font-size:12px"><tbody>' +
      "<tr><td style='padding:3px 8px 3px 0;color:#64748b'>Indicateur</td><td style='padding:3px 0'>" + esc(INDIC[i.id]) + "</td></tr>" +
      "<tr><td style='padding:3px 8px 3px 0;color:#64748b'>L'irritant a-t-il disparu ?</td><td style='padding:3px 0' class='tbd'>à mesurer</td></tr>" +
      "<tr><td style='padding:3px 8px 3px 0;color:#64748b'>Données</td><td style='padding:3px 0'>Pas encore en service</td></tr>" +
      "</tbody></table></div>";
  }).join("");

  return "<h2>Suivre : l'amélioration dans la durée</h2>" +
    '<div class="duo"><div class="card" style="margin:0"><div class="spechead">Vue 1 · Sources par irritant</div>' + bars +
      '<p class="note">Calculé sur le jeu de données (21 mails, 4 comptes rendus). Agrégé par irritant, jamais par personne.</p></div>' +
    '<div class="card" style="margin:0"><div class="spechead">Vue 2 · Taux de validation</div><div class="chips" style="margin-top:10px">' + statuts + "</div>" +
      '<p class="note">Reflète les validations faites dans l\'onglet Orienter. En démo, il mesure la précision de l\'assistant, corrigée par l\'humain.</p>' +
      '<div class="spechead" style="margin-top:14px">Vue 3 · Délai de traitement</div><p style="font-size:13px;margin-top:6px">Entre « Détecté le » et « Traité le » : <span class="tbd">à mesurer</span>.</p></div></div>' +
    '<h3 style="margin-top:22px">Vue 4 · Suivi des réponses mises en place</h3>' +
    '<div class="duo">' + cards + "</div>" +
    '<div class="card" style="margin-top:16px;border-color:#fde68a;background:#fffbeb"><div class="spechead" style="color:#b45309">Alertes (principe)</div><ul class="arrows">' +
      "<li><span>↺</span><span>Un irritant traité qui réapparaît dans les sources repasse au statut « À valider ».</span></li>" +
      "<li><span>↺</span><span>Une page ou une FAQ qui ne fait pas baisser les questions est signalée « à revoir », sur décision du HRBP.</span></li>" +
      "<li><span>↺</span><span>Si les brouillons de l\'agent sont souvent réécrits à la main, l\'agent est proposé « à adapter » plutôt que remplacé.</span></li></ul>" +
      '<p class="note">Avant le 28/11, aucune semaine d\'usage réel n\'existe : toutes les valeurs d\'usage restent « à mesurer ».</p></div>';
}

// ---------------------------------------------------------------------------
// v6 : l'outil vu par chaque persona (les livrables sont dans un document à part)
// ---------------------------------------------------------------------------

const ROLES = [
  { id: "collab",  nom: "Camille", role: "Administration du personnel", persona: "Collaborateur",
    tabs: [["arrivees", "Arrivées à préparer"], ["registre", "Ce que l'assistant repère dans mon activité"], ["firebase", "Données de la base"]] },
  { id: "manager", nom: "Isabelle", role: "Manager BU Data", persona: "Manager",
    tabs: [["mesarrivees", "Mes arrivées"], ["equipe", "Irritants qui touchent mon équipe"]] },
  // v11 : deux HRBP pour ne pas mélanger les données.
  // Julien = uniquement ce qui vient des sources réelles (boîte RH partagée, comptes rendus Notion) via Firebase.
  { id: "hrbp",    nom: "Julien", role: "HRBP", persona: "HRBP",
    tabs: [["tendances", "Tendances"], ["b_orienter", "Décisions"], ["b_spec", "Spécifications"], ["b_pilotage", "Tableau de bord"], ["b_revue", "Revue mensuelle"], ["types", "Types d’irritants"]] },
  // HRBP de démo = uniquement les écrans scénarisés de la maquette (données fictives écrites dans le code).
  { id: "hrbp_demo", nom: "HRBP de démo", role: "HRBP", persona: "HRBP",
    tabs: [["registre", "Registre RH"], ["orienter", "Décisions"], ["spec", "Spécifications"], ["suivre", "Suivi des réponses"], ["firebase", "Données de la base"]] },
  { id: "dir",     nom: "Direction", role: "Direction d'agence", persona: "Dirigeants",
    tabs: [["ensemble", "Vue d’ensemble"]] },
  { id: "futur",   nom: "Lucas", role: "Futur employé", persona: "Futur employé",
    tabs: [["futur", "Ce qu'il reçoit"]] },
];

const ARRIVEES_PASSEES = [
  { nom: "Hugo Lefèvre", poste: "Consultant test logiciel", date: "J15", etat: "Premier jour sans poste (mail 12)" },
  { nom: "Sarah Benmoussa", poste: "Consultante PMO", date: "J15", etat: "Premier jour sans poste (mail 12)" },
  { nom: "Antoine Roche", poste: "Consultant cybersécurité", date: "J22", etat: "PC de secours ; habilitation et outil des temps manquants (mail 20)" },
];

const BROUILLONS = [
  { id: "manager", a: "Isabelle Moreau, manager", objet: "Arrivée de Lucas Fabre : 3 informations manquantes",
    corps: "Bonjour Isabelle, pour préparer l'arrivée de Lucas lundi, il nous manque le lieu du premier jour (agence ou client), le matériel nécessaire et les accès particuliers éventuels. Le délai habituel d'un poste (10 jours ouvrés) est dépassé : nous demandons un PC de secours. Vous pouvez aussi compléter l'annonce dans ACIA. Camille" },
  { id: "it", a: "Marc Dubois, informatique", objet: "Arrivée lundi : PC de secours et comptes",
    corps: "Bonjour Marc, Lucas Fabre, consultant data, arrive lundi dans la BU Data. Le délai poste est dépassé : un PC de secours est-il possible ? Le formulaire de création de compte, signé par Isabelle Moreau, suit. Camille" },
  { id: "sg", a: "Sandrine Petit, services généraux", objet: "Arrivée lundi : badge et place",
    corps: "Bonjour Sandrine, Lucas Fabre arrive lundi : badge et place à prévoir. Le lieu du premier jour est en cours de confirmation avec sa manager. Camille" },
];

state.role = "collab";
state.tab = "arrivees";
state.lucas = { recu: false, envoyes: {}, infos: { lieu: "", materiel: "", acces: "" }, complete: false };

function role() { return ROLES.find(function (r) { return r.id === state.role; }); }
const IDENT = {
  collab:  ["Camille Rousseau", "Chargée d'administration du personnel"],
  manager: ["Isabelle Moreau", "Manager BU Data"],
  hrbp:    ["Julien Mercier", "HRBP · données en direct"],
  hrbp_demo: ["HRBP de démo", "Maquette · données fictives"],
  dir:     ["Direction", "Direction d'agence"],
  futur:   ["Lucas Fabre", "Futur employé, consultant data"],
};
function renderWho() {
  // v15 : nom et profil de l'utilisateur connecté (table « utilisateurs »), sinon libellés de la maquette.
  const id = window.ACIA_AUTH && ACIA_AUTH.identite ? ACIA_AUTH.identite() : null;
  const w = id && id.utilisateur ? [id.utilisateur, id.profil] : (IDENT[state.role] || ["", ""]);
  document.getElementById("who-nom").textContent = w[0];
  document.getElementById("who-fn").textContent = w[1];
  document.getElementById("um-nom").textContent = w[0];
  document.getElementById("um-fn").textContent = w[1];
  // v26 : mention « En direct » et réinitialisation des agents, réservées au HRBP en direct.
  // v36 : la mention « En direct » s'affiche aussi pour la Direction (lecture seule, même base).
  const direct = state.role === "hrbp";
  const et = document.getElementById("um-etat"); if (et) et.hidden = !(direct || state.role === "dir");
  const ra = document.getElementById("um-agents"); if (ra) ra.hidden = !direct;
}
function toggleBento(e) {
  e.stopPropagation(); closeUser();
  const m = document.getElementById("bento"), b = document.getElementById("bento-btn");
  const open = m.hidden; m.hidden = !open; b.setAttribute("aria-expanded", open ? "true" : "false");
}
function toggleUser(e) {
  e.stopPropagation(); closeBento();
  const m = document.getElementById("usermenu"), b = document.getElementById("user-btn");
  const open = m.hidden; m.hidden = !open; b.setAttribute("aria-expanded", open ? "true" : "false");
}
function closeUser() { const m = document.getElementById("usermenu"); if (m && !m.hidden) { m.hidden = true; document.getElementById("user-btn").setAttribute("aria-expanded", "false"); } }
document.addEventListener("click", function (e) { if (!e.target.closest(".usermenu")) closeUser(); });
document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeUser(); });
function closeBento() { const m = document.getElementById("bento"); if (m && !m.hidden) { m.hidden = true; document.getElementById("bento-btn").setAttribute("aria-expanded", "false"); } }
document.addEventListener("click", function (e) { if (!e.target.closest(".bento")) closeBento(); });
document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeBento(); });
function setRole(id) { state.role = id; state.tab = role().tabs[0][0]; render(); window.scrollTo(0, 0); }

function renderTabs() {
  const tabs = role().tabs.map(function (t) {
    return '<button class="tab' + (state.tab === t[0] ? " active" : "") + '" onclick="setTab(\'' + t[0] + '\')">' + esc(t[1]) + "</button>";
  }).join("");
  const bandeaux = {
    // v26 : plus de bandeau pour le HRBP en direct : mention « En direct » dans le menu du compte.
    hrbp_demo: ["#fef3c7", "#b45309", "Maquette : écrans scénarisés avec les données fictives du jeu de démo. Rien ne vient des sources réelles."],
  };
  // v15 : ModeDemo = Oui dans la table « utilisateurs » -> bandeau « maquette » sur les écrans sans bandeau propre.
  const idt = window.ACIA_AUTH && ACIA_AUTH.identite ? ACIA_AUTH.identite() : null;
  if (idt && idt.modeDemo && !bandeaux[state.role]) bandeaux[state.role] = ["#fef3c7", "#b45309", "Mode démo : écrans scénarisés avec les données fictives du jeu de démo."];
  const bd = bandeaux[state.role];
  document.getElementById("tabs").innerHTML = '<div class="tabrow">' + tabs + "</div>" +
    (bd ? '<div style="background:' + bd[0] + ';color:' + bd[1] + ';font-size:12px;font-weight:600;padding:6px 12px;border-radius:6px;margin:8px 0 4px">' + esc(bd[2]) + "</div>" : "");
}

// ----------------------------- ARRIVÉES (Camille) ---------------------------

function recevoirMail21() {
  if (state.lucas.recu) return;
  envoyerLive();            // le mail rejoint aussi le fil d'observation
  state.lucas.recu = true;
  state.tab = "arrivees";
  lancerAgent();
}
function envoyerBrouillon(id) { state.lucas.envoyes[id] = "Envoyé par Camille"; render(); }
function ignorerBrouillon(id) { state.lucas.envoyes[id] = "Ignoré"; render(); }

function ficheRows() {
  const L = state.lucas, I = L.infos;
  return [
    ["Annonce de l'arrivée", "Manager", "Dès la signature", L.complete ? ["ok", "Complète"] : ["warn", "3 informations manquantes : lieu, matériel, accès"]],
    ["Poste de travail et comptes", "Informatique", "10 jours ouvrés", ["bad", "Délai dépassé · PC de secours à demander"]],
    ["Habilitation spécifique", "Informatique", "15 jours ouvrés", L.complete ? (I.acces && I.acces !== "Aucun" ? ["bad", "Requise : " + I.acces + " · délai dépassé"] : ["ok", "Non requise"]) : ["warn", "À confirmer avec la manager"]],
    ["Badge et place", "Services généraux", "3 jours ouvrés", L.envoyes.sg === "Envoyé par Camille" ? ["ok", "Demandé"] : ["warn", "À demander aujourd'hui"]],
    ["Programme du premier jour", "Manager et RH", "5 jours", L.complete ? ["ok", "Lieu : " + I.lieu] : ["warn", "Lieu inconnu"]],
    ["Dossier administratif", "RH", "15 jours", ["warn", "Liste à envoyer · accusé de réception automatique"]],
    ["Documents d'accueil", "RH", "Avec le mail de bienvenue", ["warn", "Lien vers la page de référence (à créer)"]],
  ];
}
function ficheTable() {
  const cls = { ok: "b-emerald", warn: "b-amber", bad: "b-rose" };
  return '<div class="tw"><table><thead><tr><th>Étape</th><th>Qui</th><th>Délai de référence</th><th>Statut</th></tr></thead><tbody>' +
    ficheRows().map(function (r) { return "<tr><td><b>" + esc(r[0]) + "</b></td><td>" + esc(r[1]) + "</td><td>" + esc(r[2]) + "</td><td>" + badge(cls[r[3][0]], r[3][1]) + "</td></tr>"; }).join("") +
    "</tbody></table></div>";
}

function viewArrivees() {
  const L = state.lucas;
  const done = state.agentStep >= AGENT_STEPS.length;
  let lucasCard = L.recu
    ? '<div class="card" style="border-color:#4b2882"><div class="irrtitle">Lucas Fabre</div><div class="irrdetail" style="margin-top:2px">Consultant data · BU Data · lundi prochain</div><div class="irrtags">' +
      (done ? badge(L.complete ? "b-emerald" : "b-amber", L.complete ? "Annonce complète" : "3 informations manquantes") + badge("b-rose", "Délai poste dépassé") : badge("b-slate", "Préparation en cours…")) + "</div></div>"
    : '<div class="card"><div class="irrdetail" style="margin:0">Aucune nouvelle annonce.</div><button class="btn" onclick="recevoirMail21()">Mail 21 reçu : préparer l\'arrivée</button><p class="note">En démo, le mail part en direct d\'un téléphone ; ce bouton le simule.</p></div>';
  // Fiche écrite par le vrai agent (Firebase) : on masque la carte scriptée pour éviter le doublon.
  if (typeof aciaFicheAgent === "function" && aciaFicheAgent("lucas-fabre")) {
    lucasCard = '<div class="card"><div class="irrdetail" style="margin:0">Annonce de Lucas Fabre traitée par l\'agent : voir la fiche ci-dessus.</div></div>';
  }
  const passees = ARRIVEES_PASSEES.map(function (a) {
    return '<div class="card"><div class="irrtitle">' + esc(a.nom) + '</div><div class="irrdetail" style="margin-top:2px">' + esc(a.poste) + " · arrivé(e) " + a.date + "</div>" +
      '<div class="irrdetail">' + esc(a.etat) + "</div></div>";
  }).join("");
  const left = "<h2>Arrivées</h2>" + lucasCard + '<h3 style="margin-top:18px">Arrivées passées</h3>' + passees;

  let right;
  if (!L.recu) {
    right = '<div class="empty"><div class="big">🗂️</div><p>Quand une annonce d\'arrivée arrive dans la boîte RH, ACIA la compare à la checklist, calcule les échéances et prépare les messages. Vous relisez et vous envoyez.</p></div>';
  } else {
    const steps = AGENT_STEPS.map(function (s, k) {
      let c = state.agentStep > k ? " done" : state.agentStep === k ? " active" : "";
      if (s.human && state.agentStep >= AGENT_STEPS.length && !Object.keys(L.envoyes).length) c = " active";
      return '<div class="step' + c + (s.human ? " human" : "") + '"><span class="snum">' + (c === " done" ? "✓" : k + 1) + '</span><div style="flex:1;min-width:0"><div class="steptitle">' + esc(s.label) + '</div><div class="stepsub">' + esc(s.detail) + "</div></div></div>";
    }).join("");
    right = "<h2>Journal de l'assistant</h2>" + steps;
    if (done) {
      const drafts = BROUILLONS.map(function (b) {
        const st = L.envoyes[b.id];
        return '<div class="card"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><div><div class="spechead">Brouillon · à ' + esc(b.a) + '</div><div class="irrtitle">' + esc(b.objet) + "</div></div>" +
          (st ? badge(st === "Ignoré" ? "b-slate" : "b-emerald", st) : badge("b-amber", "À relire")) + "</div>" +
          '<p style="font-size:13px;color:#2f2745;margin-top:8px">' + esc(b.corps) + "</p>" +
          (st ? "" : '<div class="btns"><button class="btn ok" onclick="envoyerBrouillon(\'' + b.id + '\')">Envoyer</button><button class="btn ghost" onclick="ignorerBrouillon(\'' + b.id + '\')">Ignorer</button></div>') + "</div>";
      }).join("");
      right += '<h2 style="margin-top:20px">Fiche d\'arrivée · Lucas Fabre</h2>' + ficheTable() +
        '<h2 style="margin-top:20px">Brouillons préparés (rien n\'est parti)</h2>' + drafts +
        '<p class="note">Maquette : le bouton « Envoyer » ne fait que changer le statut. En démo, l\'envoi se fait depuis Thunderbird.</p>';
    }
  }
  return '<div class="row c-1-2"><div>' + left + "</div><div>" + right + "</div></div>";
}

// ----------------------------- MES ARRIVÉES (Isabelle) ----------------------

function completerAnnonce() {
  const g = function (id) { return document.getElementById(id).value.trim(); };
  state.lucas.infos = { lieu: g("f-lieu"), materiel: g("f-mat") || "PC portable standard", acces: g("f-acces") || "Aucun" };
  state.lucas.complete = true; render();
}

// ----------------------- IRRITANTS DE L'ÉQUIPE (manager) -------------------
// Le manager ne voit que les irritants dont une étape dépend de lui, décrits au niveau du processus.
// Jamais de nom de collègue, jamais de comparaison entre managers ou entre équipes.
const IRR_MANAGER = [
  ["arrivee", "L'annonce de l'arrivée est l'étape du manager : c'est elle qui déclenche le poste, les comptes, l'habilitation et le badge."],
  ["boucle", "Les annonces d'arrivée partent sans les services généraux : le badge et la place sont demandés trop tard."],
  ["actions", "Au comité où les managers sont présents, des actions sur l'intégration sont décidées sans responsable ni échéance."],
];
function avisBadge(id) {
  const a = state.avisMgr && state.avisMgr[id];
  return a ? badge(a === "Confirmé" ? "b-emerald" : "b-rose", "Manager : " + a.toLowerCase()) : "";
}
function setAvis(id, a) { state.avisMgr[id] = a; render(); }
function viewEquipe() {
  const occ = occurrences(EVENTS);
  const cards = IRR_MANAGER.map(function (m) {
    const i = irrById(m[0]); const a = state.avisMgr[i.id];
    return '<div class="card irr-card"><div class="irr">' + ring(i.note) +
      '<div style="flex:1;min-width:0"><div class="irrtitle">' + esc(i.titre) + "</div>" +
      '<div class="irrtags">' + badge("b-slate", repById(i.reponse).label) + badge("b-slate", "HRBP : " + state.status[i.id].toLowerCase()) + avisBadge(i.id) + "</div></div></div>" +
      '<p style="font-size:14px;margin-top:8px"><b>En quoi votre équipe est concernée :</b> ' + esc(m[1]) + "</p>" +
      '<p style="font-size:13px;color:#4a4360;margin-top:4px"><b>Réponse proposée :</b> ' + esc(i.proposition) + "</p>" +
      '<div class="irrdetail">Sources : ' + esc((occ[i.id] || []).join(", ")) + "</div>" +
      '<div class="btns">' +
        (a !== "Confirmé" ? '<button class="btn ok" onclick="setAvis(\'' + i.id + '\',\'Confirmé\')">Confirmer</button>' : "") +
        (a !== "Contesté" ? '<button class="btn ghost" onclick="setAvis(\'' + i.id + '\',\'Contesté\')">Contester</button>' : "") +
      "</div></div>";
  }).join("");
  return "<h2>Irritants qui touchent mon équipe</h2>" +
    '<div class="row c-3-2"><div>' + cards + "</div>" +
    '<div><div class="card trust"><h3>Ce que vous voyez, et ce que vous ne voyez pas</h3><ul class="arrows">' +
      "<li><span>✓</span><span>Les irritants du processus d'intégration dont une étape dépend du manager.</span></li>" +
      "<li><span>✓</span><span>Votre avis (confirmer ou contester) est transmis au HRBP, qui décide.</span></li>" +
      "<li><span>✕</span><span>Aucun nom de collègue, aucun mail individuel, aucune comparaison entre managers ou entre équipes.</span></li>" +
      "<li><span>✕</span><span>Les irritants propres à l'administration du personnel restent visibles par la RH et le HRBP.</span></li>" +
    "</ul></div></div></div>";
}

function viewMesArrivees() {
  const L = state.lucas;
  if (!L.recu || state.agentStep < AGENT_STEPS.length) {
    return "<h2>Mes arrivées</h2>" + '<div class="empty"><div class="big">👋</div><p>Aucune arrivée en préparation. Annoncez une arrivée par mail à la boîte RH, comme d\'habitude, ou complétez ici une annonce déjà reçue. (En démo : passer d\'abord par l\'écran de Camille, mail 21.)</p></div>';
  }
  const form = L.complete
    ? '<div class="result"><b>Annonce complète</b><p>Lieu : ' + esc(L.infos.lieu) + " · matériel : " + esc(L.infos.materiel) + " · accès particuliers : " + esc(L.infos.acces) + ". La RH et l\'informatique voient la mise à jour.</p></div>"
    : '<div class="card"><div class="spechead">Compléter l\'annonce · 3 informations manquantes</div>' +
      '<label class="fl">Lieu du premier jour<select id="f-lieu"><option>Agence</option><option>Chez le client</option></select></label>' +
      '<label class="fl">Matériel<input id="f-mat" placeholder="ex. PC portable standard" /></label>' +
      '<label class="fl">Accès particuliers<input id="f-acces" placeholder="ex. Aucun, ou habilitation client" /></label>' +
      '<button class="btn" onclick="completerAnnonce()">Envoyer à la RH</button>' +
      '<p class="note">Ce formulaire évite l\'aller-retour par mail. L\'annonce par mail reste possible : ACIA la lit de la même façon.</p></div>';
  return '<div class="row c-1-2"><div><h2>Mes arrivées</h2><div class="card" style="border-color:#4b2882"><div class="irrtitle">Lucas Fabre</div><div class="irrdetail" style="margin-top:2px">Consultant data · lundi prochain</div>' +
    '<div class="irrtags">' + badge("b-rose", "Délai poste dépassé : PC de secours demandé") + "</div></div>" + form + "</div>" +
    "<div><h2>État de préparation</h2>" + ficheTable() + '<p class="note">Vous voyez les arrivées de votre équipe. Aucun indicateur sur vous ni sur vos collaborateurs.</p></div></div>';
}

// ----------------------------- TABLEAU DE BORD (direction) ------------------

function viewTableau() {
  const all = EVENTS.concat([LIVE_EVENT]);
  const occ = occurrences(all);
  const max = Math.max.apply(null, IRRITANTS.map(function (i) { return (occ[i.id] || []).length; }));
  const bars = IRRITANTS.map(function (i) {
    const v = (occ[i.id] || []).length;
    return '<div class="bar"><span class="lbl">' + esc(i.court) + '</span><span class="track"><span class="fill" style="display:block;width:' + Math.round(v / max * 100) + '%"></span></span><span class="val">' + v + "</span></div>";
  }).join("");
  return "<h2>Tableau de bord · intégration des nouveaux collaborateurs</h2>" + kpiTiles() +
    '<div class="card" style="margin-top:16px"><div class="spechead">Sources par irritant</div>' + bars + "</div>" +
    '<p class="note">Indicateurs de processus agrégés : aucun nom, aucun classement d\'équipe ou de manager, aucun indicateur sur un groupe de moins de 5 personnes (seuil proposé). Les valeurs viennent du jeu de données fictif ; le reste est « à mesurer ».</p>';
}

// ----------------------------- FUTUR EMPLOYÉ --------------------------------

function viewFutur() {
  return "<h2>Le futur employé n'utilise pas ACIA</h2>" +
    '<div class="row c-1-2"><div><div class="card"><p style="font-size:14px">Lucas n\'a pas de compte et n\'est pas observé. Ses pièces administratives ne sont jamais lues par l\'IA.</p><p style="font-size:14px;margin-top:8px">Il reçoit seulement les mails préparés par la RH et envoyés par Camille.</p></div></div>' +
    '<div><div class="card preview"><div class="spechead">Le mail de bienvenue qu\'il reçoit</div>' +
    "<p>Bienvenue Lucas ! Vous arrivez lundi : Isabelle Moreau vous accueille.</p>" +
    "<p>Votre poste et votre badge seront prêts à votre arrivée.</p>" +
    "<p>Réponses aux questions fréquentes : télétravail, mutuelle, notes de frais (lien).</p>" +
    "<p>Tous les documents d'accueil, dans leur version en vigueur, lisibles dès maintenant (lien).</p>" +
    "<p>Chaque envoi de pièces reçoit une confirmation automatique.</p></div></div></div>";
}

// ------------------------------- RENDU --------------------------------------

function render() {
  // v31 : onglet absent du profil (ex. onglet mémorisé d'une version précédente) -> premier onglet.
  if (!role().tabs.some(function (t) { return t[0] === state.tab; })) state.tab = role().tabs[0][0];
  renderTabs();
  renderWho();
  const views = { arrivees: viewArrivees, registre: viewObserver, orienter: viewOrienter, spec: viewSpec, suivre: viewSuivre, mesarrivees: viewMesArrivees, equipe: viewEquipe, tableau: viewTableau, futur: viewFutur, firebase: viewFirebase, tendances: viewTendances, b_orienter: viewPilotOrienter, b_spec: viewPilotSpec, b_suivre: viewPilotSuivre, b_pilotage: viewTableauBordHrbp, b_revue: function () { return viewRevueMensuelle(); }, types: viewTypesIrritants, ensemble: function () { return viewVueEnsemble(); } };
  document.getElementById("main").innerHTML = views[state.tab]();
  state.justAdded = false; state.fresh = null;
}


