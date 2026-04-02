import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Use DIRECT_URL for seed (PgBouncer on port 6543 doesn't support transactions)
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding productos...");

  await prisma.producto.createMany({
    skipDuplicates: true,
    data: [
      // ─── Alpina ───
      {
        codigoBarras: "7702001148301",
        nombre: "Avena Alpina",
        marca: "alpina",
        categoria: "bebidas",
        unidad: "caja",
        presentacion: "x6 200ml",
        unidadesPorCaja: 6,
        refrigerado: true,
      },
      {
        codigoBarras: "7702001158201",
        nombre: "Yogurt Griego Alpina",
        marca: "alpina",
        categoria: "lacteos",
        unidad: "caja",
        presentacion: "x12 150g",
        unidadesPorCaja: 12,
        refrigerado: true,
      },
      {
        codigoBarras: "7702001168101",
        nombre: "Bon Yurt Alpina",
        marca: "alpina",
        categoria: "lacteos",
        unidad: "caja",
        presentacion: "x24 und",
        unidadesPorCaja: 24,
        refrigerado: true,
      },
      {
        codigoBarras: "7702001178001",
        nombre: "Leche Entera Alpina",
        marca: "alpina",
        categoria: "lacteos",
        unidad: "caja",
        presentacion: "x6 1L",
        unidadesPorCaja: 6,
        refrigerado: true,
      },
      {
        codigoBarras: "7702001187901",
        nombre: "Arequipe Alpina",
        marca: "alpina",
        categoria: "dulces",
        unidad: "caja",
        presentacion: "x12 250g",
        unidadesPorCaja: 12,
        refrigerado: false,
      },
      // ─── Zenu ───
      {
        codigoBarras: "7702085100103",
        nombre: "Salchicha Premium Zenu",
        marca: "zenu",
        categoria: "carnes",
        unidad: "caja",
        presentacion: "x12 paq",
        unidadesPorCaja: 12,
        refrigerado: true,
      },
      {
        codigoBarras: "7702085200203",
        nombre: "Jamon Pietran Zenu",
        marca: "zenu",
        categoria: "carnes",
        unidad: "caja",
        presentacion: "x6 paq",
        unidadesPorCaja: 6,
        refrigerado: true,
      },
      {
        codigoBarras: "7702085300303",
        nombre: "Chorizo Santarrosano Zenu",
        marca: "zenu",
        categoria: "carnes",
        unidad: "caja",
        presentacion: "x8 paq",
        unidadesPorCaja: 8,
        refrigerado: true,
      },
      {
        codigoBarras: "7702085400403",
        nombre: "Mortadela Zenu",
        marca: "zenu",
        categoria: "carnes",
        unidad: "caja",
        presentacion: "x6 paq",
        unidadesPorCaja: 6,
        refrigerado: true,
      },
      {
        codigoBarras: "7702085500503",
        nombre: "Hamburguesa Zenu",
        marca: "zenu",
        categoria: "carnes",
        unidad: "caja",
        presentacion: "x10 und",
        unidadesPorCaja: 10,
        refrigerado: true,
      },
      // ─── Bimbo ───
      {
        codigoBarras: "7501000119608",
        nombre: "Pan Blanco Bimbo",
        marca: "bimbo",
        categoria: "panaderia",
        unidad: "und",
        presentacion: "paq 600g",
        unidadesPorCaja: 1,
        refrigerado: false,
      },
      {
        codigoBarras: "7501000219708",
        nombre: "Ponque Gala Bimbo",
        marca: "bimbo",
        categoria: "pasteleria",
        unidad: "caja",
        presentacion: "x12 und",
        unidadesPorCaja: 12,
        refrigerado: false,
      },
      {
        codigoBarras: "7501000319808",
        nombre: "Tostadas Bimbo",
        marca: "bimbo",
        categoria: "panaderia",
        unidad: "caja",
        presentacion: "x8 paq",
        unidadesPorCaja: 8,
        refrigerado: false,
      },
      {
        codigoBarras: "7501000419908",
        nombre: "Pan Integral Bimbo",
        marca: "bimbo",
        categoria: "panaderia",
        unidad: "und",
        presentacion: "paq 480g",
        unidadesPorCaja: 1,
        refrigerado: false,
      },
      {
        codigoBarras: "7501000520008",
        nombre: "Tortillas Bimbo",
        marca: "bimbo",
        categoria: "panaderia",
        unidad: "caja",
        presentacion: "x6 paq",
        unidadesPorCaja: 6,
        refrigerado: false,
      },
    ],
  });

  console.log("Seeding conductores...");

  await prisma.conductor.createMany({
    skipDuplicates: true,
    data: [
      {
        cedula: "1020304050",
        nombre: "Carlos Martinez",
        placa: "ABC-123",
        telefono: "+573001112233",
        ruta: "Ruta Norte - Usaquen/Suba",
      },
      {
        cedula: "1020304051",
        nombre: "Jose Rodriguez",
        placa: "DEF-456",
        telefono: "+573002223344",
        ruta: "Ruta Sur - Bosa/Kennedy",
      },
      {
        cedula: "1020304052",
        nombre: "Miguel Hernandez",
        placa: "GHI-789",
        telefono: "+573003334455",
        ruta: "Ruta Centro - Chapinero/Teusaquillo",
      },
      {
        cedula: "1020304053",
        nombre: "Andres Lopez",
        placa: "JKL-012",
        telefono: "+573004445566",
        ruta: "Ruta Occidente - Fontibon/Engativa",
      },
      {
        cedula: "1020304054",
        nombre: "David Garcia",
        placa: "MNO-345",
        telefono: "+573005556677",
        ruta: "Ruta Soacha - Soacha/Bosa Sur",
      },
    ],
  });

  console.log("Seed completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
