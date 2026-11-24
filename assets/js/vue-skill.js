// v42 : « Générer le skill » depuis une spécification « Assister » (onglet Spécifications, vue HRBP).
// Produit un .zip contenant <nom>/SKILL.md, importable dans Claude (paramètres de Claude, rubrique Skills).
// Tout se passe dans le navigateur : aucune écriture en base, aucun appel externe.
// Le skill est un BROUILLON : le HRBP (ou l'équipe) le relit avant import.

// Fiche « complète » = besoin, entrées, sorties et workflow renseignés (pas de « À définir »).
function skillFicheComplete(conf) {
  const ok = function (v) { return !!v && String(v).trim() !== "" && !/^À définir/.test(String(v).trim()); };
  return ok(conf.besoin) && ok(conf.entrees) && ok(conf.sorties) &&
    Array.isArray(conf.workflow) && conf.workflow.length > 0 && conf.workflow.every(ok);
}
function skillNom(code) {
  return ("acia-" + String(code).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")).slice(0, 64);
}
// Texte sur une ligne, sans chevrons (contrainte du champ description des skills).
function skillLigne(t) { return String(t || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim(); }

function skillMarkdown(code) {
  const conf = (typeof fiaConf === "function" ? fiaConf(code) : confDe(code)), d = decisionDe(code) || {};
  const t = (typesTable() || []).find(function (x) { return x.id === code; }) || {};
  const titre = libelleType(code), nom = skillNom(code);
  const source = code === CODE_CR ? "un compte rendu de réunion (Notion)" : "un mail de la boîte RH partagée";
  const desc = skillLigne("Prépare, sans rien envoyer, la réponse à l'irritant RH « " + titre + " » : " + conf.besoin +
    " À utiliser quand " + source + " relève de cet irritant et que le HRBP a autorisé l'agent (décision Validé, réponse Assister).").slice(0, 1000);
  const auj = new Date().toLocaleDateString("fr-FR");
  const L = [];
  L.push("---", "name: " + nom, "description: " + desc, "---", "");
  L.push("# " + titre, "");
  L.push("> Brouillon généré le " + auj + " depuis la spécification ACIA (onglet Spécifications). Décision du HRBP : Validé, réponse « Assister (agent IA) », effet à partir de la semaine " + (d.semaine_effet || "?") + ".");
  L.push("> À relire et compléter avant import. Ce skill prépare ; un humain valide et envoie.", "");
  L.push("## Quand l'utiliser", "");
  L.push("Quand " + source + " relève de l'irritant « " + titre + " » (code `" + code + "`)." + (t.processus ? " Processus : " + skillLigne(t.processus) + "." : ""));
  if (t.definition) L.push("", "Définition du type : " + skillLigne(t.definition));
  if (t.exemple) L.push("", "Exemple : " + skillLigne(t.exemple));
  L.push("", "## Préalable obligatoire : autorisation du HRBP", "");
  L.push("Avant toute action, vérifier que la décision du HRBP pour `" + code + "` est toujours « Validé » avec la réponse « Assister » (collection `decisions_hrbp` de la base, ou onglet Décisions du site).");
  L.push("Si la décision a changé, ou si elle ne peut pas être vérifiée, s'arrêter et le dire à l'utilisateur.");
  L.push("", "## Besoin métier", "", skillLigne(conf.besoin));
  L.push("", "## Entrées", "", skillLigne(conf.entrees));
  L.push("", "## Étapes", "");
  conf.workflow.forEach(function (s, i) { L.push((i + 1) + ". " + skillLigne(s)); });
  L.push("", "## Sorties attendues", "", skillLigne(conf.sorties));
  L.push("", "## Garde-fous (non négociables)", "");
  L.push("- Préparer seulement : produire des brouillons, ne jamais envoyer de mail ni publier quoi que ce soit. Un humain relit et envoie.");
  L.push("- Contenu confidentiel, de santé ou de conflit : ne pas l'analyser, s'arrêter et le signaler.");
  L.push("- Aucun jugement sur une personne, aucune donnée nominative recopiée au-delà de ce que la tâche exige.");
  L.push("- Ne jamais inventer une information manquante (date, nom, pièce) : la lister comme manquante.");
  L.push("- En cas de doute sur le classement ou la tâche : demander à l'utilisateur plutôt que deviner.");
  L.push("", "## Pour terminer", "");
  L.push("Donner un résumé court : ce qui a été préparé, ce qui manque, ce que l'humain doit relire avant d'envoyer.");
  L.push("", "## Suivi", "", "Indicateur : " + skillLigne(conf.indicateur) + ", mesuré dans l'onglet « Revue mensuelle » du site ACIA.");
  if (d.commentaire) L.push("", "Commentaire du HRBP : « " + skillLigne(d.commentaire) + " »");
  return L.join("\n") + "\n";
}

// Zip minimal (sans compression, méthode « stored ») : pas de bibliothèque externe.
function skillCrc32(bytes) {
  let c, crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    c = (crc ^ bytes[i]) & 0xFF;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function skillZip(fichiers) {
  const enc = new TextEncoder(), morceaux = [], central = [];
  let offset = 0;
  const now = new Date();
  const dosT = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosD = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  fichiers.forEach(function (f) {
    const nom = enc.encode(f.nom), data = enc.encode(f.texte), crc = skillCrc32(data);
    const loc = new DataView(new ArrayBuffer(30));
    loc.setUint32(0, 0x04034b50, true); loc.setUint16(4, 20, true); loc.setUint16(6, 0x0800, true); loc.setUint16(8, 0, true);
    loc.setUint16(10, dosT, true); loc.setUint16(12, dosD, true); loc.setUint32(14, crc, true);
    loc.setUint32(18, data.length, true); loc.setUint32(22, data.length, true); loc.setUint16(26, nom.length, true); loc.setUint16(28, 0, true);
    morceaux.push(new Uint8Array(loc.buffer), nom, data);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true); cen.setUint16(10, 0, true);
    cen.setUint16(12, dosT, true); cen.setUint16(14, dosD, true); cen.setUint32(16, crc, true);
    cen.setUint32(20, data.length, true); cen.setUint32(24, data.length, true); cen.setUint16(28, nom.length, true);
    cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), nom);
    offset += 30 + nom.length + data.length;
  });
  const tailleCentral = central.reduce(function (s, b) { return s + b.length; }, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, fichiers.length, true); fin.setUint16(10, fichiers.length, true);
  fin.setUint32(12, tailleCentral, true); fin.setUint32(16, offset, true);
  return new Blob(morceaux.concat(central, [new Uint8Array(fin.buffer)]), { type: "application/zip" });
}

function genererSkill(code) {
  const conf = (typeof fiaConf === "function" ? fiaConf(code) : confDe(code)), d = decisionDe(code);
  if (!d || d.statut !== "VALIDE" || d.reponse !== "ASSISTER" || !skillFicheComplete(conf)) return;
  const nom = skillNom(code);
  const blob = skillZip([{ nom: nom + "/SKILL.md", texte: skillMarkdown(code) }]);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nom + ".zip";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
}

// Bloc affiché en bas d'une fiche « Assister ».
function skillBloc(code) {
  const conf = (typeof fiaConf === "function" ? fiaConf(code) : confDe(code));
  if (!skillFicheComplete(conf)) {
    return '<p class="note" style="margin-top:10px">' + badge("b-slate", "Skill indisponible") +
      " Fiche incomplète : besoin, entrées, sorties et workflow doivent être définis avant de générer un skill.</p>";
  }
  return '<div style="margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
    '<button class="btn slim" onclick="genererSkill(\'' + code + '\')">Générer le skill (.zip)</button>' +
    '<span class="note" style="margin:0">' + badge("b-violet", "IA") + " Brouillon à relire avant import dans Claude (paramètres, rubrique Skills). Rien n'est installé ni envoyé automatiquement.</span></div>";
}
