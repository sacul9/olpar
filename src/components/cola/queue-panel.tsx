"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { NuevaSesionForm } from "@/components/sesiones/nueva-sesion-form";

type QueueHook = {
  cola: Array<{
    id: string;
    numeroTurno: number;
    estado: string;
    conductor: { id: string; nombre: string; cedula: string; ruta: string | null };
  }>;
  esperando: Array<{
    id: string;
    numeroTurno: number;
    estado: string;
    conductor: { id: string; nombre: string; cedula: string; ruta: string | null };
  }>;
  enAtencion: {
    id: string;
    numeroTurno: number;
    conductor: { id: string; nombre: string; cedula: string; ruta: string | null };
  } | null;
  loading: boolean;
  refetch: () => void;
};

export function QueuePanel({
  queue,
  hasSesionActiva,
  onSesionCreada,
}: {
  queue: QueueHook;
  hasSesionActiva: boolean;
  onSesionCreada: () => void;
}) {
  const [llamando, setLlamando] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  async function llamarSiguiente() {
    setLlamando(true);
    try {
      const res = await fetch("/api/cola/siguiente", { method: "POST" });
      if (res.ok) {
        queue.refetch();
        setMostrarFormulario(true);
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } finally {
      setLlamando(false);
    }
  }

  // If there's a turn being attended and no active session, show the form
  if (queue.enAtencion && !hasSesionActiva && mostrarFormulario) {
    return (
      <Card>
        <CardTitle>Nueva Sesion de Devolucion</CardTitle>
        <p className="mb-4 text-sm text-gray-500">
          Turno #{queue.enAtencion.numeroTurno} —{" "}
          <span className="font-medium">{queue.enAtencion.conductor.nombre}</span>
        </p>
        <NuevaSesionForm
          turnoId={queue.enAtencion.id}
          conductorNombre={queue.enAtencion.conductor.nombre}
          onCreada={() => {
            setMostrarFormulario(false);
            onSesionCreada();
          }}
          onCancelar={() => setMostrarFormulario(false)}
        />
      </Card>
    );
  }

  // If there's a turn being attended and an active session, show info
  if (queue.enAtencion && hasSesionActiva) {
    return (
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>En Atencion</CardTitle>
            <p className="text-sm text-gray-500">
              Turno #{queue.enAtencion.numeroTurno}
            </p>
          </div>
          <Badge color="blue">En proceso</Badge>
        </div>
        <div className="mt-4">
          <p className="text-lg font-semibold">{queue.enAtencion.conductor.nombre}</p>
          <p className="text-sm text-gray-500">
            CC {queue.enAtencion.conductor.cedula}
            {queue.enAtencion.conductor.ruta && ` — ${queue.enAtencion.conductor.ruta}`}
          </p>
        </div>
      </Card>
    );
  }

  // Default: show queue list
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Cola de Turnos</CardTitle>
          <Badge color="blue">{queue.esperando.length} esperando</Badge>
        </div>

        {queue.esperando.length === 0 ? (
          <p className="text-sm text-gray-400">No hay conductores en cola</p>
        ) : (
          <ul className="space-y-2">
            {queue.esperando.map((turno) => (
              <li
                key={turno.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                    {turno.numeroTurno}
                  </span>
                  <span className="text-sm font-medium">{turno.conductor.nombre}</span>
                  {turno.conductor.ruta && (
                    <span className="ml-2 text-xs text-gray-400">{turno.conductor.ruta}</span>
                  )}
                </div>
                <Badge color="yellow">Esperando</Badge>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <Button
            onClick={llamarSiguiente}
            loading={llamando}
            disabled={queue.esperando.length === 0 || hasSesionActiva}
            size="lg"
            className="w-full"
          >
            Llamar Siguiente
          </Button>
        </div>
      </Card>

      <RegistrarTurnoCard onRegistrado={queue.refetch} />
    </div>
  );
}

function RegistrarTurnoCard({ onRegistrado }: { onRegistrado: () => void }) {
  const [conductorId, setConductorId] = useState("");
  const [conductores, setConductores] = useState<
    Array<{ id: string; nombre: string; cedula: string }>
  >([]);
  const [busqueda, setBusqueda] = useState("");
  const [registrando, setRegistrando] = useState(false);

  async function buscarConductores(q: string) {
    setBusqueda(q);
    if (q.length < 2) {
      setConductores([]);
      return;
    }
    const res = await fetch(`/api/conductores/buscar?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      setConductores(await res.json());
    }
  }

  async function registrar() {
    if (!conductorId) return;
    setRegistrando(true);
    try {
      const res = await fetch("/api/cola", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conductorId }),
      });
      if (res.ok) {
        setConductorId("");
        setBusqueda("");
        setConductores([]);
        onRegistrado();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } finally {
      setRegistrando(false);
    }
  }

  return (
    <Card>
      <CardTitle>Registrar Turno</CardTitle>
      <div className="mt-3 space-y-3">
        <div>
          <input
            type="text"
            placeholder="Buscar conductor por nombre o cedula..."
            value={busqueda}
            onChange={(e) => buscarConductores(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {conductores.length > 0 && (
            <ul className="mt-1 max-h-40 overflow-auto rounded-md border bg-white shadow-sm">
              {conductores.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => {
                      setConductorId(c.id);
                      setBusqueda(c.nombre);
                      setConductores([]);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                  >
                    {c.nombre} — CC {c.cedula}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button onClick={registrar} loading={registrando} disabled={!conductorId} className="w-full">
          Registrar en Cola
        </Button>
      </div>
    </Card>
  );
}
