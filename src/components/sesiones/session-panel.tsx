"use client";

import { useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
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
      <Card className="flex min-h-[300px] lg:h-full items-center justify-center">
        <div className="text-center">
          <p className="text-5xl sm:text-6xl text-gray-200 font-bold">0 / 0</p>
          <p className="mt-4 text-sm text-gray-400">
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

        <div className="mt-4 sm:mt-6 text-center">
          <div
            className={`inline-block w-full max-w-md rounded-2xl px-6 sm:px-12 py-6 sm:py-8 ${
              session.hayExceso
                ? "animate-pulse bg-red-50 ring-2 ring-red-500"
                : "bg-gray-50"
            }`}
          >
            <p className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wide">
              Declarado vs Detectado
            </p>
            <p
              className={`text-5xl sm:text-7xl font-bold tabular-nums ${
                session.hayExceso
                  ? "text-red-600"
                  : session.totalDetectado === session.totalDeclarado && session.totalDetectado > 0
                  ? "text-green-600"
                  : "text-gray-900"
              }`}
            >
              {session.totalDeclarado}{" "}
              <span className="text-3xl sm:text-4xl text-gray-400">vs</span>{" "}
              {session.totalDetectado}
            </p>
            {session.hayExceso && (
              <p className="mt-2 text-xs sm:text-sm font-semibold text-red-600 uppercase">
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
    producto: { nombre: string; refrigerado?: boolean };
    cantidadDeclarada: number;
    cantidadDetectada: number;
  }>;
  onCerrada: () => void;
}) {
  const [estados, setEstados] = useState<Record<string, string>>({});
  const [temperaturas, setTemperaturas] = useState<Record<string, string>>({});
  const [rechazadas, setRechazadas] = useState<Record<string, boolean>>({});
  const [firmaConductor, setFirmaConductor] = useState(false);
  const [firmaBodeguero, setFirmaBodeguero] = useState(false);
  const [rechazarTodo, setRechazarTodo] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estadoOptions = [
    { value: "bueno", label: "Bueno" },
    { value: "vencido", label: "Vencido" },
    { value: "daniado", label: "Dañado" },
    { value: "rechazado", label: "Rechazado" },
    { value: "sin_verificar", label: "Sin verificar" },
  ];

  async function cerrar() {
    setCerrando(true);
    setError(null);

    // Validate firma
    if (!rechazarTodo && !firmaConductor) {
      setError("La firma del conductor es obligatoria");
      setCerrando(false);
      return;
    }

    try {
      const body: Record<string, unknown> = rechazarTodo
        ? {
            rechazarSesion: true,
            motivoRechazoSesion: motivoRechazo || "Devolucion rechazada en dock",
            firmaConductor: firmaConductor ? `firma-conductor-${Date.now()}` : undefined,
            firmaBodeguero: firmaBodeguero ? `firma-bodeguero-${Date.now()}` : undefined,
          }
        : {
            lineas: lineas.map((l) => ({
              lineaId: l.id,
              estadoProducto: rechazadas[l.id] ? "rechazado" : (estados[l.id] ?? "sin_verificar"),
              temperaturaRegistrada: temperaturas[l.id] ? parseFloat(temperaturas[l.id]) : undefined,
              cadenaFrioOk: temperaturas[l.id] ? parseFloat(temperaturas[l.id]) <= 8 : undefined,
              rechazada: rechazadas[l.id] ?? false,
            })),
            firmaConductor: firmaConductor ? `firma-conductor-${Date.now()}` : undefined,
            firmaBodeguero: firmaBodeguero ? `firma-bodeguero-${Date.now()}` : undefined,
          };

      const res = await fetch(`/api/sesiones/${sesionId}/cerrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      <div className="space-y-4 max-h-[70vh] overflow-auto">
        {/* Reject entire session */}
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3">
          <input
            type="checkbox"
            checked={rechazarTodo}
            onChange={(e) => setRechazarTodo(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <label className="text-sm font-medium text-red-700">
            Rechazar toda la devolucion
          </label>
        </div>

        {rechazarTodo ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo del rechazo
            </label>
            <input
              type="text"
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              placeholder="Ej: Producto no corresponde a esta distribuidora"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500">
              Marque el estado de cada producto:
            </p>
            {lineas.map((l) => (
              <div key={l.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{l.producto.nombre}</p>
                    <p className="text-xs text-gray-400">
                      {l.cantidadDetectada}/{l.cantidadDeclarada}
                    </p>
                  </div>
                  <div className="w-32">
                    <Select
                      options={estadoOptions}
                      value={rechazadas[l.id] ? "rechazado" : (estados[l.id] ?? "sin_verificar")}
                      onChange={(e) => {
                        if (e.target.value === "rechazado") {
                          setRechazadas({ ...rechazadas, [l.id]: true });
                        } else {
                          setRechazadas({ ...rechazadas, [l.id]: false });
                          setEstados({ ...estados, [l.id]: e.target.value });
                        }
                      }}
                    />
                  </div>
                </div>
                {/* Temperature input for refrigerated products */}
                {l.producto.refrigerado && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-600">Temp:</span>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="°C"
                      value={temperaturas[l.id] ?? ""}
                      onChange={(e) =>
                        setTemperaturas({ ...temperaturas, [l.id]: e.target.value })
                      }
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-xs"
                    />
                    <span className="text-xs text-gray-400">°C</span>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* Firma digital */}
        <div className="border-t pt-3 space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase">Firmas</p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={firmaConductor}
              onChange={(e) => setFirmaConductor(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Conductor acepta y firma
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={firmaBodeguero}
              onChange={(e) => setFirmaBodeguero(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Bodeguero confirma y firma
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={cerrar}
            loading={cerrando}
            variant={rechazarTodo ? "danger" : "primary"}
            className="flex-1"
          >
            {rechazarTodo ? "Rechazar Devolucion" : "Cerrar Sesion"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
