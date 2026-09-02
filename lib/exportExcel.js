// Génère et télécharge un fichier Excel stylé (une ou plusieurs feuilles).
// sheets: [{ name, columns: [{header,key,width}], rows: [...], currencyKeys: [...], percentKeys: [...] }]
export async function exportExcel({ filename, sheets }) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "UF2 - ERP Achats";
  wb.created = new Date();

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name);
    ws.columns = sheet.columns;
    sheet.rows.forEach((r) => ws.addRow(r));

    const headerRow = ws.getRow(1);
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B2430" } };
      cell.alignment = { vertical: "middle", horizontal: "left" };
    });

    (sheet.currencyKeys || []).forEach((k) => { ws.getColumn(k).numFmt = '#,##0 "Ar"'; });
    (sheet.percentKeys || []).forEach((k) => { ws.getColumn(k).numFmt = '0"%"'; });

    ws.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E5E0" } },
          bottom: { style: "thin", color: { argb: "FFE5E5E0" } },
          left: { style: "thin", color: { argb: "FFE5E5E0" } },
          right: { style: "thin", color: { argb: "FFE5E5E0" } },
        };
      });
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F6F3" } };
        });
      }
    });

    if (sheet.columns.length) {
      const lastCol = String.fromCharCode(64 + sheet.columns.length);
      ws.autoFilter = { from: "A1", to: `${lastCol}1` };
    }
    ws.views = [{ state: "frozen", ySplit: 1 }];
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
