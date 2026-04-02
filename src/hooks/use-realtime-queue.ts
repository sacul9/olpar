"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type QueueItem = {
  id: string;
  conductorId: string;
  numeroTurno: number;
  estado: string;
  fechaRegistro: string;
  fechaLlamado: string | null;
  conductor: {
    id: string;
    nombre: string;
    cedula: string;
    placa: string | null;
    ruta: string | null;
  };
};

export function useRealtimeQueue() {
  const [cola, setCola] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCola = useCallback(async () => {
    try {
      const res = await fetch("/api/cola");
      if (res.ok) {
        const data = await res.json();
        setCola(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCola();

    const supabase = createClient();
    const channel = supabase
      .channel("cola-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cola_turnos" },
        () => {
          // Refetch on any change to queue
          fetchCola();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCola]);

  const esperando = cola.filter((t) => t.estado === "esperando");
  const enAtencion = cola.find((t) => t.estado === "en_atencion") ?? null;

  return { cola, esperando, enAtencion, loading, refetch: fetchCola };
}
