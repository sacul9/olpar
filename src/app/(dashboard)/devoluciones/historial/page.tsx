"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MOTIVOS_DEVOLUCION } from "@/lib/constants";

type Sesion = {
  id: string;
  tienda: string;
  estado: string;
  videoUrl: string | null;
  camaraOffline: boolean;
  creadoEn: string;
  cerradoEn: string | null;
  conductor: { nombre: string; cedula: string };
  lineas: Array<{
    producto: { nombre: string };
    motivo: string;
    cantidadDeclarada: number;
    cantidadDetectada: number;
  }>;
  alertas: Array<{ tipo: string; mensaje: string }>;
};

export default function HistorialPage() {
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchHistorial = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reportes/diario?fecha=${fecha}`);
      if (res.ok) {
        const data = await res.json();
        setSesiones(data.sesiones);
      }
    } finally {
      setLoading(false);
    }
  }, [fecha]);

  useEffect(() => {
    fetchHistorial();
  }, [fetchHistorial]);

  function getEstadoBadge(sesion: Sesion) {
    const hayDiscrepancia = sesion.lineas.some(
      (l) => l.cantidadDetectada !== l.cantidadDeclarada
    );
    if (sesion.estado === "abierta") return <Badge color="blue">En proceso</Badge>;
    if (hayDiscrepancia) return <Badge color="red">Discrepancia</Badge>;
    if (sesion.camaraOffline) return <Badge color="yellow">Sin camara</Badge>;
    return <Badge color="green">OK</Badge>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Historial de Devoluciones
        </h1>
        <div className="flex items-center gap-3">
          <Input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
          <Button
            variant="secondary"
            onClick={() => {
              window.location.href = `/api/reportes/exportar?desde=${fecha}&hasta=${fecha}`;
            }}
          >
            Exportar CSV
          </Button>
        </div>
      </div>

      <Card>
        {loading ? (
          <p className="text-sm text-gray-400">Cargando...</p>
        ) : sesiones.length === 0 ? (
          <p className="text-sm text-gray-400">
            No hay sesiones para esta fecha.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 pr-4 font-medium">Hora</th>
                  <th className="pb-3 pr-4 font-medium">Conductor</th>
                  <th className="pb-3 pr-4 font-medium">Tienda</th>
                  <th className="pb-3 pr-4 font-medium">Productos</th>
                  <th className="pb-3 pr-4 font-medium">Estado</th>
                  <th className="pb-3 font-medium">Video</th>
                </tr>
              </thead>
              <tbody>
                {sesiones.map((s) => (
                  <>
                    <tr
                      key={s.id}
                      className="border-b cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setExpandedId(expandedId === s.id ? null : s.id)
                      }
                    >
                      <td className="py-3 pr-4">
                        {new Date(s.creadoEn).toLocaleTimeString("es-CO", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3 pr-4 font-medium">
                        {s.conductor.nombre}
                      </td>
                      <td className="py-3 pr-4">{s.tienda}</td>
                      <td className="py-3 pr-4">{s.lineas.length} lineas</td>
                      <td className="py-3 pr-4">{getEstadoBadge(s)}</td>
                      <td className="py-3">
                        {s.videoUrl ? (
                          <span className="text-green-600">Si</span>
                        ) : (
                          <span className="text-gray-400">No</span>
                        )}
                      </td>
                    </tr>
                    {expandedId === s.id && (
                      <tr key={`${s.id}-detail`}>
                        <td colSpan={6} className="bg-gray-50 p-4">
                          <div className="space-y-2">
                            {s.lineas.map((l, i) => {
                              const diff =
                                l.cantidadDetectada - l.cantidadDeclarada;
                              return (
                                <div
                                  key={i}
                                  className="flex items-center justify-between text-sm"
                                >
                                  <span>
                                    {l.producto.nombre}{" "}
                                    <span className="text-gray-400">
                                      (
                                      {
                                        MOTIVOS_DEVOLUCION.find(
                                          (m) => m.value === l.motivo
                                        )?.label
                                      }
                                      )
                                    </span>
                                  </span>
                                  <span
                                    className={`font-mono ${
                                      diff !== 0
                                        ? "font-bold text-red-600"
                                        : "text-green-600"
                                    }`}
                                  >
                                    {l.cantidadDetectada}/{l.cantidadDeclarada}
                                    {diff !== 0 && ` (${diff > 0 ? "+" : ""}${diff})`}
                                  </span>
                                </div>
                              );
                            })}
                            {s.alertas.length > 0 && (
                              <div className="mt-2 border-t pt-2">
                                <p className="text-xs font-medium text-red-600">
                                  Alertas:
                                </p>
                                {s.alertas.map((a, i) => (
                                  <p key={i} className="text-xs text-red-500">
                                    {a.mensaje}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
