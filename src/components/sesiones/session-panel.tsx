"use client";

import { useState, useCallback } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";

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
      producto: { nombre: string; codigoBarras: string; imagenUrl?: string | null; refrigerado?: boolean };
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

type ScanResult = {
  productoNombre: string | null;
  productoImagen: string | null;
  productoRefrigerado: boolean;
  cantidadDetectada: number;
  cantidadDeclarada: number | null;
  exceso: boolean;
  reconocido: boolean;
  noDeclarado: boolean;
};

export function SessionPanel({
  session,
  onCerrada,
}: {
  session: SessionHook;
  onCerrada: () => void;
}) {
  const [showCerrar, setShowCerrar] = useState(false);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      if (!session.sesion || scanning) return;

      setScanning(true);
      setScanError(null);

      try {
        const res = await fetch("/api/scanner/scan-from-ui", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            codigoBarras: barcode,
            sesionId: session.sesion.id,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setScanError(data.error);
          // Play error sound
          playSound("error");
          return;
        }

        setLastScan(data);
        session.refetch();

        // Play sound
        if (data.exceso) {
          playSound("alert");
        } else if (data.reconocido) {
          playSound("beep");
        } else {
          playSound("unknown");
        }
      } catch {
        setScanError("Error de conexion");
        playSound("error");
      } finally {
        setScanning(false);
      }
    },
    [session, scanning]
  );

  // Listen for USB barcode scanner keystrokes
  useBarcodeScanner(handleBarcodeScan, !!session.sesion && !showCerrar);

  if (!session.sesion) {
    return (
      <Card className="flex min-h-[300px] lg:h-full items-center justify-center">
        <div className="text-center">
          <p className="text-5xl sm:text-6xl text-gray-200 font-bold">0 / 0</p>
          <p className="mt-4 text-sm text-gray-400">
            No hay sesion activa. Llame al siguiente conductor.
          </p>
          <p className="mt-2 text-xs text-gray-300">
            La pistola de barcode esta lista para escanear
          </p>
        </div>
      </Card>
    );
  }

  const s = session.sesion;
  const videoListo = !!s.videoUrl;
  const puedesCerrar = videoListo || s.camaraOffline;
  const totalProgress =
    session.totalDeclarado > 0
      ? Math.min((session.totalDetectado / session.totalDeclarado) * 100, 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* Header + scan status */}
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-gray-900">{s.conductor.nombre}</p>
            <p className="text-sm text-gray-500">{s.tienda}</p>
            <p className="text-xs text-gray-400">{s.conductor.ruta}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-3 w-3 rounded-full ${
                s.camaraOffline ? "bg-red-500" : "bg-green-500"
              }`}
            />
            {videoListo && <Badge color="green">Video</Badge>}
            <Badge color="blue">Pistola activa</Badge>
          </div>
        </div>

        {/* LAST SCAN: big product display */}
        {lastScan && lastScan.reconocido ? (
          <div
            className={`mt-4 flex items-center gap-4 rounded-xl p-4 ${
              lastScan.exceso
                ? "bg-red-50 ring-2 ring-red-500 animate-pulse"
                : lastScan.noDeclarado
                ? "bg-yellow-50 ring-2 ring-yellow-400"
                : "bg-green-50"
            }`}
          >
            {lastScan.productoImagen && (
              <img
                src={lastScan.productoImagen}
                alt={lastScan.productoNombre ?? ""}
                className="h-20 w-20 rounded-lg object-contain bg-white"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold truncate">
                {lastScan.productoNombre}
              </p>
              {lastScan.cantidadDeclarada != null ? (
                <p
                  className={`text-3xl font-bold tabular-nums ${
                    lastScan.exceso ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {lastScan.cantidadDetectada} / {lastScan.cantidadDeclarada}
                </p>
              ) : (
                <p className="text-sm text-yellow-600 font-medium">
                  Producto NO declarado en esta sesion
                </p>
              )}
              {lastScan.exceso && (
                <p className="text-sm font-bold text-red-600 uppercase mt-1">
                  EXCESO DETECTADO — ALERTA ENVIADA
                </p>
              )}
            </div>
          </div>
        ) : lastScan && !lastScan.reconocido ? (
          <div className="mt-4 rounded-xl bg-yellow-50 p-4 ring-2 ring-yellow-400">
            <p className="text-lg font-bold text-yellow-700">
              Producto NO reconocido
            </p>
            <p className="text-sm text-yellow-600">
              Este codigo de barras no existe en el catalogo
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl bg-gray-50 p-6 text-center">
            <p className="text-4xl text-gray-300">📦</p>
            <p className="mt-2 text-sm text-gray-400">
              {scanning ? "Procesando..." : "Esperando escaneo con pistola..."}
            </p>
            <p className="text-xs text-gray-300 mt-1">
              Dispare la pistola al codigo de barras del producto
            </p>
          </div>
        )}

        {scanError && (
          <p className="mt-2 text-sm text-red-600 bg-red-50 rounded p-2">
            {scanError}
          </p>
        )}

        {/* Total progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-500">Progreso total</span>
            <span
              className={`font-bold tabular-nums ${
                session.hayExceso ? "text-red-600" : "text-gray-900"
              }`}
            >
              {session.totalDetectado} / {session.totalDeclarado}
            </span>
          </div>
          <div className="h-3 rounded-full bg-gray-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                session.hayExceso
                  ? "bg-red-500"
                  : totalProgress >= 100
                  ? "bg-green-500"
                  : "bg-blue-500"
              }`}
              style={{ width: `${Math.min(totalProgress, 100)}%` }}
            />
          </div>
          {session.hayExceso && (
            <p className="text-xs text-red-600 font-semibold mt-1">
              EXCESO: {session.totalDetectado - session.totalDeclarado} unidades de mas
            </p>
          )}
        </div>

        <div className="mt-4 flex justify-end">
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

      {/* Per-product detail with progress bars */}
      <Card>
        <CardTitle>Detalle por Producto</CardTitle>
        <div className="mt-4 space-y-3">
          {s.lineas.map((linea) => {
            const pct =
              linea.cantidadDeclarada > 0
                ? (linea.cantidadDetectada / linea.cantidadDeclarada) * 100
                : 0;
            const match = linea.cantidadDetectada === linea.cantidadDeclarada;
            const exceso = linea.cantidadDetectada > linea.cantidadDeclarada;

            return (
              <div
                key={linea.id}
                className={`rounded-lg border p-3 ${
                  exceso ? "border-red-300 bg-red-50" : match && linea.cantidadDetectada > 0 ? "border-green-200 bg-green-50" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  {linea.producto.imagenUrl && (
                    <img
                      src={linea.producto.imagenUrl}
                      alt={linea.producto.nombre}
                      className="h-10 w-10 rounded object-contain bg-white"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{linea.producto.nombre}</p>
                    <p className="text-xs text-gray-400">{linea.motivo}</p>
                  </div>
                  <p
                    className={`text-lg font-bold tabular-nums ${
                      exceso ? "text-red-600" : match && linea.cantidadDetectada > 0 ? "text-green-600" : "text-gray-900"
                    }`}
                  >
                    {linea.cantidadDetectada} / {linea.cantidadDeclarada}
                  </p>
                </div>
                {/* Progress bar per product */}
                <div className="mt-2 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      exceso ? "bg-red-500" : match ? "bg-green-500" : "bg-blue-400"
                    }`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Recent scans feed */}
      <Card>
        <CardTitle>Ultimos Escaneos</CardTitle>
        <div className="mt-3 max-h-48 overflow-auto">
          {s.itemsDetectados.length === 0 ? (
            <p className="text-sm text-gray-400">Dispare la pistola al primer producto...</p>
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

function playSound(type: "beep" | "error" | "alert" | "unknown") {
  // Use Web Audio API for instant feedback
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.1;

    if (type === "beep") {
      osc.frequency.value = 800;
      osc.type = "sine";
    } else if (type === "error") {
      osc.frequency.value = 200;
      osc.type = "square";
    } else if (type === "alert") {
      osc.frequency.value = 400;
      osc.type = "sawtooth";
    } else {
      osc.frequency.value = 500;
      osc.type = "triangle";
    }

    osc.start();
    osc.stop(ctx.currentTime + (type === "alert" ? 0.4 : 0.15));
  } catch {
    // Audio not available
  }
}

// ─── Close Dialog (same as before) ─────────────────────

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

    if (!rechazarTodo && !firmaConductor) {
      setError("La firma del conductor es obligatoria");
      setCerrando(false);
      return;
    }

    try {
      const body: Record<string, unknown> = rechazarTodo
        ? {
            rechazarSesion: true,
            motivoRechazoSesion: motivoRechazo || "Devolucion rechazada",
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
            <p className="text-sm text-gray-500">Estado de cada producto:</p>
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
