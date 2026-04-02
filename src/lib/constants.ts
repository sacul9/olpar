export const MOTIVOS_DEVOLUCION = [
  { value: "vencido", label: "Vencido" },
  { value: "averiado", label: "Averiado / Dañado" },
  { value: "cadena_frio", label: "Cadena de frío rota" },
  { value: "fecha_corta", label: "Fecha corta" },
  { value: "sobrante", label: "Sobrante / Exceso inventario" },
  { value: "producto_equivocado", label: "Producto equivocado" },
  { value: "otro", label: "Otro" },
] as const;

export const ESTADOS_SESION = {
  abierta: { label: "En proceso", color: "blue" },
  cerrada: { label: "Cerrada", color: "green" },
  cancelada: { label: "Cancelada", color: "gray" },
} as const;

export const ESTADOS_TURNO = {
  esperando: { label: "Esperando", color: "yellow" },
  en_atencion: { label: "En atención", color: "blue" },
  completado: { label: "Completado", color: "green" },
  cancelado: { label: "Cancelado", color: "gray" },
} as const;

// Anti-fraud system constants
export const MIN_DURACION_SESION_SEGUNDOS = 20;
export const DEBOUNCE_SEGUNDOS = 3;
export const CAMARA_OFFLINE_ALERTA_SEGUNDOS = 5;
export const VIDEO_RETENCION_NORMAL_DIAS = 30;
export const VIDEO_RETENCION_ALERTA_DIAS = 90;
export const CONDUCTOR_FLAG_UMBRAL_PORCENTAJE = 20;
export const SCORE_VENTANA_SEMANAS = 4;
