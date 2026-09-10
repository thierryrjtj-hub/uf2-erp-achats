// Génère et télécharge un fichier Excel stylé (une ou plusieurs feuilles), avec
// bandeau de titre, sous-titre horodaté, en-tête colorée, lignes zébrées, et une
// ligne de totaux automatique pour les colonnes numériques demandées.
// sheets: [{ name, sousTitre?, columns: [{header,key,width}], rows: [...], currencyKeys: [...], percentKeys: [...], totalsKeys: [...] }]
export async function exportExcel({ filename, titre, sheets }) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "UF2 - ERP Achats";
  wb.created = new Date();

  const VERT_FONCE = "FF1E3A34";
  const VERT = "FF74BC1F";
  const GRIS_ZEBRE = "FFF3F6F4";
  const GRIS_BORDURE = "FFE2E2DC";

  const genereLe = new Date().toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name);
    const nbColonnes = sheet.columns.length;
    const derniereCol = nbColonnes <= 26 ? String.fromCharCode(64 + nbColonnes) : "Z";

    // ---- Bandeau de titre ----
    ws.mergeCells(`A1:${derniereCol}1`);
    const celluleTitre = ws.getCell("A1");
    celluleTitre.value = titre || "UNIFOODS — Achats Locaux";
    celluleTitre.font = { bold: true, size: 15, color: { argb: "FFFFFFFF" } };
    celluleTitre.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERT_FONCE } };
    celluleTitre.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(1).height = 30;

    ws.mergeCells(`A2:${derniereCol}2`);
    const celluleSousTitre = ws.getCell("A2");
    celluleSousTitre.value = `${sheet.sousTitre || sheet.name} — généré le ${genereLe}`;
    celluleSousTitre.font = { italic: true, size: 10, color: { argb: "FF666660" } };
    celluleSousTitre.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(2).height = 18;

    ws.addRow([]); // ligne 3 : espace

    // ---- En-têtes de colonnes (ligne 4) ----
    const ligneEntetes = ws.addRow(sheet.columns.map((c) => c.header));
    ligneEntetes.height = 22;
    ligneEntetes.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERT } };
      cell.alignment = { vertical: "middle", horizontal: "left" };
    });

    sheet.columns.forEach((c, i) => { ws.getColumn(i + 1).width = c.width || 16; });

    const premiereLigneDonnees = 5;
    sheet.rows.forEach((r) => ws.addRow(sheet.columns.map((c) => r[c.key])));

    (sheet.currencyKeys || []).forEach((k) => {
      const idx = sheet.columns.findIndex((c) => c.key === k) + 1;
      if (idx > 0) ws.getColumn(idx).numFmt = '#,##0 "Ar"';
    });
    (sheet.percentKeys || []).forEach((k) => {
      const idx = sheet.columns.findIndex((c) => c.key === k) + 1;
      if (idx > 0) ws.getColumn(idx).numFmt = '0"%"';
    });

    // ---- Bordures + zébrage sur les lignes de données ----
    for (let i = 0; i < sheet.rows.length; i++) {
      const row = ws.getRow(premiereLigneDonnees + i);
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: GRIS_BORDURE } },
          bottom: { style: "thin", color: { argb: GRIS_BORDURE } },
          left: { style: "thin", color: { argb: GRIS_BORDURE } },
          right: { style: "thin", color: { argb: GRIS_BORDURE } },
        };
        cell.alignment = { ...(cell.alignment || {}), vertical: "middle" };
      });
      if (i % 2 === 1) {
        row.eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS_ZEBRE } }; });
      }
    }

    // ---- Ligne de totaux (optionnelle) ----
    if (sheet.totalsKeys && sheet.totalsKeys.length) {
      const ligneTotal = ws.addRow(sheet.columns.map((c) => (sheet.totalsKeys.includes(c.key) ? sheet.rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0) : "")));
      ligneTotal.eachCell((cell, colNumber) => {
        cell.font = { bold: true, color: { argb: "FF1a1a1a" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF3EC" } };
        cell.border = { top: { style: "medium", color: { argb: VERT_FONCE } } };
        const key = sheet.columns[colNumber - 1]?.key;
        if ((sheet.currencyKeys || []).includes(key)) cell.numFmt = '#,##0 "Ar"';
      });
      ws.getCell(`A${ligneTotal.number}`).value = "TOTAL";
      ws.getCell(`A${ligneTotal.number}`).font = { bold: true };
    }

    if (nbColonnes) ws.autoFilter = { from: `A${premiereLigneDonnees - 1}`, to: `${derniereCol}${premiereLigneDonnees - 1}` };
    ws.views = [{ state: "frozen", ySplit: premiereLigneDonnees - 1 }];
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function slugify(s) {
  return s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
