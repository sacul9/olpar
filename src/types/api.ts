import { z } from "zod/v4";

// ─── Cola ──────────────────────────────────────────────

export const RegistrarTurnoSchema = z.object({
  conductorId: z.string().min(1),
});

// ─── Sesiones ──────────────────────────────────────────

export const LineaDevolucionInput = z.object({
  productoId: z.string().min(1),
  motivo: z.enum([
    "vencido",
    "averiado",
    "cadena_frio",
    "fecha_corta",
    "sobrante",
    "producto_equivocado",
    "otro",
  ]),
  cantidadDeclarada: z.number().int().positive(),
  notas: z.string().optional(),
});

export const CrearSesionSchema = z.object({
  turnoId: z.string().min(1),
  tienda: z.string().min(1),
  lineas: z.array(LineaDevolucionInput).min(1),
});

export const CerrarSesionSchema = z.object({
  lineas: z
    .array(
      z.object({
        lineaId: z.string().min(1),
        estadoProducto: z.enum(["bueno", "vencido", "daniado", "sin_verificar"]),
      })
    )
    .optional(),
  notas: z.string().optional(),
});

// ─── Scanner ───────────────────────────────────────────

export const ScannerItemSchema = z.object({
  codigoBarras: z.string().min(1),
  idempotencyKey: z.string().uuid(),
  sesionId: z.string().min(1),
  screenshotBase64: z.string().optional(),
});

export const ScannerVideoListoSchema = z.object({
  sesionId: z.string().min(1),
  storagePath: z.string().min(1),
});

// ─── Catalogo ──────────────────────────────────────────

export const CrearProductoSchema = z.object({
  codigoBarras: z.string().min(8),
  nombre: z.string().min(1),
  marca: z.string().min(1),
  categoria: z.string().optional(),
  unidad: z.string().min(1),
  presentacion: z.string().optional(),
  unidadesPorCaja: z.number().int().positive().default(1),
  refrigerado: z.boolean().default(false),
  skuAmovil: z.string().optional(),
});

// ─── Type Exports ──────────────────────────────────────

export type RegistrarTurnoInput = z.infer<typeof RegistrarTurnoSchema>;
export type CrearSesionInput = z.infer<typeof CrearSesionSchema>;
export type CerrarSesionInput = z.infer<typeof CerrarSesionSchema>;
export type ScannerItemInput = z.infer<typeof ScannerItemSchema>;
export type CrearProductoInput = z.infer<typeof CrearProductoSchema>;
