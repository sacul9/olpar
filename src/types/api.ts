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
  remisionId: z.string().optional(), // P2: referencia a despacho
  remisionFecha: z.string().optional(),
  estacionId: z.string().optional(), // P3: multi-estacion
  lineas: z.array(LineaDevolucionInput).min(1),
});

export const CerrarSesionSchema = z.object({
  lineas: z
    .array(
      z.object({
        lineaId: z.string().min(1),
        estadoProducto: z.enum(["bueno", "vencido", "daniado", "sin_verificar", "rechazado"]),
        temperaturaRegistrada: z.number().optional(), // P1: temperatura
        cadenaFrioOk: z.boolean().optional(),
        rechazada: z.boolean().optional(), // P1: rechazo
        motivoRechazo: z.string().optional(),
      })
    )
    .optional(),
  notas: z.string().optional(),
  // P2: Firma digital
  firmaConductor: z.string().optional(), // base64
  firmaBodeguero: z.string().optional(),
  // P1: Rechazo de toda la sesion
  rechazarSesion: z.boolean().optional(),
  motivoRechazoSesion: z.string().optional(),
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
  precioCosto: z.number().min(0).optional(),
  precioVenta: z.number().min(0).optional(),
  temperaturaMaxima: z.number().optional(),
  diasMaxDevolucion: z.number().int().positive().optional(),
  pesoUnidad: z.number().positive().optional(),
});

// ─── Type Exports ──────────────────────────────────────

export type RegistrarTurnoInput = z.infer<typeof RegistrarTurnoSchema>;
export type CrearSesionInput = z.infer<typeof CrearSesionSchema>;
export type CerrarSesionInput = z.infer<typeof CerrarSesionSchema>;
export type ScannerItemInput = z.infer<typeof ScannerItemSchema>;
export type CrearProductoInput = z.infer<typeof CrearProductoSchema>;
