type AmovilRow = {
  codigoBarras: string;
  nombre: string;
  marca: string;
  unidad: string;
  skuAmovil: string;
};

type ParseResult = {
  rows: AmovilRow[];
  errors: string[];
};

export function parseAmovilCSV(csvContent: string): ParseResult {
  const lines = csvContent.trim().split("\n");
  const rows: AmovilRow[] = [];
  const errors: string[] = [];

  if (lines.length < 2) {
    return { rows: [], errors: ["CSV vacío o sin datos"] };
  }

  // Parse header to find column indices
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const colMap: Record<string, number> = {};

  const expectedCols = ["sku", "nombre", "marca", "barcode_ean13", "unidad"];
  for (const col of expectedCols) {
    const idx = header.findIndex(
      (h) => h === col || h.includes(col.replace("_", ""))
    );
    if (idx === -1) {
      // Try alternative names
      const altIdx = header.findIndex((h) => {
        if (col === "barcode_ean13") return h.includes("barcode") || h.includes("ean");
        if (col === "sku") return h.includes("sku") || h.includes("codigo");
        return false;
      });
      if (altIdx !== -1) {
        colMap[col] = altIdx;
      }
    } else {
      colMap[col] = idx;
    }
  }

  if (!colMap["barcode_ean13"] && !colMap["nombre"]) {
    return {
      rows: [],
      errors: ["No se encontraron las columnas requeridas (barcode_ean13, nombre)"],
    };
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));

    const barcode = cols[colMap["barcode_ean13"] ?? -1] ?? "";
    const nombre = cols[colMap["nombre"] ?? -1] ?? "";
    const marca = cols[colMap["marca"] ?? -1] ?? "otro";
    const unidad = cols[colMap["unidad"] ?? -1] ?? "und";
    const sku = cols[colMap["sku"] ?? -1] ?? "";

    if (!barcode || barcode.length < 8) {
      errors.push(`Fila ${i + 1}: Barcode invalido "${barcode}"`);
      continue;
    }

    if (!nombre) {
      errors.push(`Fila ${i + 1}: Nombre vacío`);
      continue;
    }

    rows.push({
      codigoBarras: barcode,
      nombre,
      marca: marca.toLowerCase(),
      unidad: unidad.toLowerCase(),
      skuAmovil: sku,
    });
  }

  return { rows, errors };
}
