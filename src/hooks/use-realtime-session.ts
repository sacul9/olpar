"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Producto = {
  id: string;
  nombre: string;
  codigoBarras: string;
  marca: string;
};

type Linea = {
  id: string;
  productoId: string;
  producto: Producto;
  motivo: string;
  cantidadDeclarada: number;
  cantidadDetectada: number;
  estadoProducto: string;
};

type ItemDetectado = {
  id: string;
  codigoBarras: string;
  reconocido: boolean;
  producto: Producto | null;
  detectadoEn: string;
};

type Conductor = {
  id: string;
  nombre: string;
  cedula: string;
  placa: string | null;
  ruta: string | null;
};

type Sesion = {
  id: string;
  tienda: string;
  estado: string;
  videoUrl: string | null;
  camaraOffline: boolean;
  creadoEn: string;
  conductor: Conductor;
  lineas: Linea[];
  itemsDetectados: ItemDetectado[];
};

export function useRealtimeSession() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSesion = useCallback(async () => {
    try {
      const res = await fetch("/api/sesiones/activa");
      if (res.ok) {
        const data = await res.json();
        setSesion(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSesion();

    const supabase = createClient();

    // Listen for new scanned items
    const itemsChannel = supabase
      .channel("items-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "items_detectados" },
        () => {
          fetchSesion();
        }
      )
      .subscribe();

    // Listen for session state changes (video uploaded, closed, etc.)
    const sessionChannel = supabase
      .channel("session-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sesiones_devolucion" },
        () => {
          fetchSesion();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(sessionChannel);
    };
  }, [fetchSesion]);

  // Computed totals
  const totalDeclarado =
    sesion?.lineas.reduce((sum, l) => sum + l.cantidadDeclarada, 0) ?? 0;
  const totalDetectado =
    sesion?.lineas.reduce((sum, l) => sum + l.cantidadDetectada, 0) ?? 0;
  const hayExceso = totalDetectado > totalDeclarado;

  return {
    sesion,
    loading,
    totalDeclarado,
    totalDetectado,
    hayExceso,
    refetch: fetchSesion,
  };
}
