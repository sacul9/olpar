import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

// Categorize based on product name
function categorize(name: string): {
  categoria: string;
  refrigerado: boolean;
  unidad: string;
  temperaturaMaxima: number | null;
} {
  const n = name.toLowerCase();

  if (n.includes("yogurt") || n.includes("yox") || n.includes("regeneris") || n.includes("yogo yogo"))
    return { categoria: "yogurt", refrigerado: true, unidad: "und", temperaturaMaxima: 8 };
  if (n.includes("kéfir") || n.includes("kefir"))
    return { categoria: "kefir", refrigerado: true, unidad: "und", temperaturaMaxima: 6 };
  if (n.includes("leche"))
    return { categoria: "leche", refrigerado: true, unidad: "und", temperaturaMaxima: 6 };
  if (n.includes("queso") || n.includes("tilsit") || n.includes("sabana") || n.includes("mozzarella") || n.includes("parmesano") || n.includes("campesino") || n.includes("doble crema"))
    return { categoria: "queso", refrigerado: true, unidad: "und", temperaturaMaxima: 8 };
  if (n.includes("crema") || n.includes("mantequilla"))
    return { categoria: "crema_mantequilla", refrigerado: true, unidad: "und", temperaturaMaxima: 6 };
  if (n.includes("avena"))
    return { categoria: "avena", refrigerado: false, unidad: "und", temperaturaMaxima: null };
  if (n.includes("bon yurt"))
    return { categoria: "bon_yurt", refrigerado: true, unidad: "und", temperaturaMaxima: 8 };
  if (n.includes("arequipe"))
    return { categoria: "arequipe", refrigerado: false, unidad: "und", temperaturaMaxima: null };
  if (n.includes("néctar") || n.includes("frutto"))
    return { categoria: "nectar", refrigerado: false, unidad: "und", temperaturaMaxima: null };
  if (n.includes("finesse"))
    return { categoria: "finesse", refrigerado: true, unidad: "und", temperaturaMaxima: 8 };
  if (n.includes("baby") || n.includes("compota"))
    return { categoria: "baby", refrigerado: false, unidad: "und", temperaturaMaxima: null };
  if (n.includes("alpin"))
    return { categoria: "bebida_lactea", refrigerado: true, unidad: "und", temperaturaMaxima: 8 };
  if (n.includes("griego"))
    return { categoria: "yogurt_griego", refrigerado: true, unidad: "und", temperaturaMaxima: 6 };

  // Default: assume refrigerated (most Alpina products are)
  return { categoria: "otro", refrigerado: true, unidad: "und", temperaturaMaxima: 8 };
}

// Extract presentation from name (e.g., "1000 g", "240 g", "Botella 1750 g")
function extractPresentation(name: string): string | null {
  const match = name.match(/(\d+\s*(?:g|ml|kg|l|litro|cc|und))/i);
  return match ? match[1].trim() : null;
}

// Estimate price based on category and size
function estimatePrice(name: string, categoria: string): { costo: number; venta: number } {
  const n = name.toLowerCase();
  const sizeMatch = n.match(/(\d+)\s*(?:g|ml)/);
  const size = sizeMatch ? parseInt(sizeMatch[1]) : 200;

  const basePrices: Record<string, { costoPerG: number; margin: number }> = {
    yogurt: { costoPerG: 5, margin: 1.45 },
    yogurt_griego: { costoPerG: 8, margin: 1.5 },
    kefir: { costoPerG: 7, margin: 1.5 },
    leche: { costoPerG: 3, margin: 1.35 },
    queso: { costoPerG: 25, margin: 1.55 },
    crema_mantequilla: { costoPerG: 18, margin: 1.45 },
    avena: { costoPerG: 4, margin: 1.4 },
    bon_yurt: { costoPerG: 6, margin: 1.5 },
    arequipe: { costoPerG: 12, margin: 1.5 },
    nectar: { costoPerG: 3.5, margin: 1.4 },
    finesse: { costoPerG: 7, margin: 1.5 },
    baby: { costoPerG: 8, margin: 1.4 },
    bebida_lactea: { costoPerG: 4.5, margin: 1.4 },
    otro: { costoPerG: 5, margin: 1.4 },
  };

  const base = basePrices[categoria] || basePrices.otro;

  // Multi-packs
  const multiMatch = n.match(/x\s*(\d+)/i);
  const multi = multiMatch ? parseInt(multiMatch[1]) : 1;

  const costo = Math.round((size * base.costoPerG * multi) / 100) * 100; // Round to nearest 100
  const venta = Math.round((costo * base.margin) / 100) * 100;

  return { costo: Math.max(costo, 1500), venta: Math.max(venta, 2200) };
}

async function main() {
  const jsonPath = path.join(
    process.env.HOME || "~",
    "Downloads",
    "alpina-products.json"
  );

  if (!fs.existsSync(jsonPath)) {
    console.error("File not found:", jsonPath);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as Array<{
    name: string;
    img: string;
    barcode: string;
  }>;

  console.log(`Loaded ${raw.length} products from JSON`);

  // Filter products with valid barcodes
  const withBarcode = raw.filter((p) => p.barcode && p.barcode.length >= 7);
  console.log(`${withBarcode.length} have valid barcodes`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const p of withBarcode) {
    const meta = categorize(p.name);
    const presentation = extractPresentation(p.name);
    const prices = estimatePrice(p.name, meta.categoria);

    try {
      const existing = await prisma.producto.findUnique({
        where: { codigoBarras: p.barcode },
      });

      if (existing) {
        await prisma.producto.update({
          where: { codigoBarras: p.barcode },
          data: {
            nombre: p.name,
            imagenUrl: p.img,
            categoria: meta.categoria,
            refrigerado: meta.refrigerado,
            temperaturaMaxima: meta.temperaturaMaxima,
          },
        });
        updated++;
      } else {
        await prisma.producto.create({
          data: {
            codigoBarras: p.barcode,
            nombre: p.name,
            marca: "alpina",
            categoria: meta.categoria,
            unidad: meta.unidad,
            presentacion: presentation,
            refrigerado: meta.refrigerado,
            temperaturaMaxima: meta.temperaturaMaxima,
            imagenUrl: p.img,
            precioCosto: prices.costo,
            precioVenta: prices.venta,
          },
        });
        created++;
      }
    } catch (err) {
      skipped++;
    }
  }

  console.log(`\nResults:`);
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total in DB: ${await prisma.producto.count()}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
