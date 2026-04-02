"use client";

import { useState } from "react";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { MOTIVOS_DEVOLUCION } from "@/lib/constants";

type SessionHook = {
  sesion: {
    id: string;
    tienda: string;
    estado: string;
    videoUrl: string | null;
    camaraOffline: boolean;
    creadoEn: string;
    conductor: { nombre: string; cedula: string; ruta: string | null };
    lineas: Array<{
      id: string;
      producto: { nombre: string; codigoBarras: string };
      motivo: string;
      cantidadDeclarada: number;
      cantidadDetectada: number;
      estadoProducto: string;
    }>;
    itemsDetectados: Array<{
      id: string;
      codigoBarras: string;
      reconocido: boolean;
      producto: { nombre: string } | null;
      detectadoEn: string;
    }>;
  } | null;
  loading: boolean;
  totalDeclarado: number;
  totalDetectado: number;
  hayExceso: boolean;
  refetch: () => void;
};

export function SessionPanel({
  session,
  onCerrada,
}: {
  session: SessionHook;
  onCerrada: () => void;
}) {
  const [showCerrar, setShowCerrar] = useState(false);

  if (!session.sesion) {
    return (
      <Card className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-6xl text-gray-200 font-bold">0 / 0</p>
          <p className="mt-4 text-gray-400">
            No hay sesion activa. Llame al siguiente conductor.
          </p>
        </div>
      </Card>
    );
  }

  const s = session.sesion;
  const videoListo = !!s.videoUrl;
  const puedesCerrar = videoListo || s.camaraOffline;

  return (
    <div className="space-y-4">
      {/* Big counter */}
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500">
              {s.conductor.nombre} — {s.tienda}
            </p>
            <p className="text-xs text-gray-400">{s.conductor.ruta}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Camera status indicator */}
            <span
              className={`inline-block h-3 w-3 rounded-full ${
                s.camaraOffline ? "bg-red-500" : "bg-green-500"
              }`}
              title={s.camaraOffline ? "Camara offline" : "Camara activa"}
            />
            {videoListo && <Badge color="green">Video listo</Badge>}
          </div>
        </div>

        <div className="mt-6 text-center">
          <div
            className={`inline-block rounded-2xl px-12 py-8 ${
              session.hayExceso
                ? "animate-pulse bg-red-50 ring-2 ring-red-500"
                : "bg-gray-50"
            }`}
          >
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Declarado vs Detectado
            </p>
            <p
              className={`text-7xl font-bold tabular-nums ${
                session.hayExceso
                  ? "text-red-600"
                  : session.totalDetectado === session.totalDeclarado && session.totalDetectado > 0
                  ? "text-green-600"
                  : "text-gray-900"
              }`}
            >
              {session.totalDeclarado}{" "}
              <span className="text-4xl text-gray-400">vs</span>{" "}
              {session.totalDetectado}
            </p>
            {session.hayExceso && (
              <p className="mt-2 text-sm font-semibold text-red-600 uppercase">
                EXCESO DETECTADO
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <Button
            size="lg"
            variant={puedesCerrar ? "primary" : "secondary"}
            disabled={!puedesCerrar}
            onClick={() => setShowCerrar(true)}
          >
            {puedesCerrar ? "Cerrar Sesion" : "Esperando video..."}
          </Button>
        </div>
      </Card>

      {/* Per-product lines */}
      <Card>
        <CardTitle>Detalle por Producto</CardTitle>
        <div className="mt-4 space-y-3">
          {s.lineas.map((linea) => {
            const match = linea.cantidadDetectada === linea.cantidadDeclarada;
            const exceso = linea.cantidadDetectada > linea.cantidadDeclarada;

            return (
              <div
                key={linea.id}
                className={`flex items-center justify-between rounded-md border p-3 ${
                  exceso ? "border-red-300 bg-red-50" : match ? "border-green-200 bg-green-50" : ""
                }`}
              >
                <div>
                  <p className="text-sm font-medium">{linea.producto.nombre}</p>
                  <p className="text-xs text-gray-400">
                    {MOTIVOS_DEVOLUCION.find((m) => m.value === linea.motivo)?.label}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-lg font-bold tabular-nums ${
                      exceso ? "text-red-600" : match && linea.cantidadDetectada > 0 ? "text-green-600" : "text-gray-900"
                    }`}
                  >
                    {linea.cantidadDetectada} / {linea.cantidadDeclarada}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Recent detections feed */}
      <Card>
        <CardTitle>Ultimas Detecciones</CardTitle>
        <div className="mt-3 max-h-60 overflow-auto">
          {s.itemsDetectados.length === 0 ? (
            <p className="text-sm text-gray-400">Esperando escaneos...</p>
          ) : (
            <ul className="space-y-1">
              {s.itemsDetectados.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        item.reconocido ? "bg-green-500" : "bg-yellow-500"
                      }`}
                    />
                    <span className={item.reconocido ? "" : "text-yellow-600"}>
                      {item.producto?.nombre ?? item.codigoBarras}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(item.detectadoEn).toLocaleTimeString("es-CO")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* Close dialog */}
      <CerrarSesionDialog
        open={showCerrar}
        onClose={() => setShowCerrar(false)}
        sesionId={s.id}
        lineas={s.lineas}
        onCerrada={onCerrada}
      />
    </div>
  );
}

function CerrarSesionDialog({
  open,
  onClose,
  sesionId,
  lineas,
  onCerrada,
}: {
  open: boolean;
  onClose: () => void;
  sesionId: string;
  lineas: Array<{
    id: string;
    producto: { nombre: string };
    cantidadDeclarada: number;
    cantidadDetectada: number;
  }>;
  onCerrada: () => void;
}) {
  const [estados, setEstados] = useState<Record<string, string>>({});
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estadoOptions = [
    { value: "bueno", label: "Bueno" },
    { value: "vencido", label: "Vencido" },
    { value: "daniado", label: "Dañado" },
    { value: "sin_verificar", label: "Sin verificar" },
  ];

  async function cerrar() {
    setCerrando(true);
    setError(null);

    try {
      const res = await fetch(`/api/sesiones/${sesionId}/cerrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineas: lineas.map((l) => ({
            lineaId: l.id,
            estadoProducto: estados[l.id] ?? "sin_verificar",
          })),
        }),
      });

      if (res.ok) {
        onClose();
        onCerrada();
      } else {
        const data = await res.json();
        setError(data.error);
      }
    } finally {
      setCerrando(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Cerrar Sesion">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Marque el estado de cada producto antes de cerrar:
        </p>
        {lineas.map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium">{l.producto.nombre}</p>
              <p className="text-xs text-gray-400">
                {l.cantidadDetectada}/{l.cantidadDeclarada}
              </p>
            </div>
            <div className="w-36">
              <Select
                options={estadoOptions}
                value={estados[l.id] ?? "sin_verificar"}
                onChange={(e) =>
                  setEstados({ ...estados, [l.id]: e.target.value })
                }
              />
            </div>
          </div>
        ))}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={cerrar} loading={cerrando} className="flex-1">
            Cerrar Sesion
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
