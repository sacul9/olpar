"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MOTIVOS_DEVOLUCION } from "@/lib/constants";

type LineaInput = {
  productoId: string;
  productoNombre: string;
  motivo: string;
  cantidadDeclarada: number;
};

type Producto = {
  id: string;
  nombre: string;
  codigoBarras: string;
  marca: string;
};

export function NuevaSesionForm({
  turnoId,
  onCreada,
  onCancelar,
}: {
  turnoId: string;
  onCreada: () => void;
  onCancelar: () => void;
}) {
  const [tienda, setTienda] = useState("");
  const [lineas, setLineas] = useState<LineaInput[]>([]);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Product search state
  const [busqueda, setBusqueda] = useState("");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [motivo, setMotivo] = useState("vencido");
  const [cantidad, setCantidad] = useState(1);

  useEffect(() => {
    if (busqueda.length < 2) {
      setProductos([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/catalogo?q=${encodeURIComponent(busqueda)}`);
      if (res.ok) setProductos(await res.json());
    }, 300);
    return () => clearTimeout(timer);
  }, [busqueda]);

  function agregarLinea() {
    if (!productoSeleccionado || cantidad < 1) return;

    // Prevent duplicate product+motivo
    const existe = lineas.find(
      (l) => l.productoId === productoSeleccionado.id && l.motivo === motivo
    );
    if (existe) {
      setError("Ya existe una linea con ese producto y motivo");
      return;
    }

    setLineas([
      ...lineas,
      {
        productoId: productoSeleccionado.id,
        productoNombre: productoSeleccionado.nombre,
        motivo,
        cantidadDeclarada: cantidad,
      },
    ]);

    // Reset
    setProductoSeleccionado(null);
    setBusqueda("");
    setCantidad(1);
    setError(null);
  }

  function quitarLinea(index: number) {
    setLineas(lineas.filter((_, i) => i !== index));
  }

  async function crearSesion() {
    if (!tienda || lineas.length === 0) return;
    setCreando(true);
    setError(null);

    try {
      const res = await fetch("/api/sesiones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turnoId,
          tienda,
          lineas: lineas.map((l) => ({
            productoId: l.productoId,
            motivo: l.motivo,
            cantidadDeclarada: l.cantidadDeclarada,
          })),
        }),
      });

      if (res.ok) {
        onCreada();
      } else {
        const data = await res.json();
        setError(data.error);
      }
    } finally {
      setCreando(false);
    }
  }

  const motivoOptions = MOTIVOS_DEVOLUCION.map((m) => ({
    value: m.value,
    label: m.label,
  }));

  return (
    <div className="space-y-4">
      <Input
        id="tienda"
        label="Tienda"
        placeholder="Nombre de la tienda"
        value={tienda}
        onChange={(e) => setTienda(e.target.value)}
      />

      {/* Product search + add line */}
      <div className="rounded-md border bg-gray-50 p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">Agregar producto</p>

        <div className="relative">
          <input
            type="text"
            placeholder="Buscar producto por nombre o barcode..."
            value={productoSeleccionado ? productoSeleccionado.nombre : busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setProductoSeleccionado(null);
            }}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {productos.length > 0 && !productoSeleccionado && (
            <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-md border bg-white shadow-lg">
              {productos.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => {
                      setProductoSeleccionado(p);
                      setProductos([]);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                  >
                    <span className="font-medium">{p.nombre}</span>
                    <span className="ml-2 text-gray-400">{p.codigoBarras}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <Select
              options={motivoOptions}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          <div className="w-24">
            <Input
              type="number"
              min={1}
              value={cantidad}
              onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
              placeholder="Cant"
            />
          </div>
          <Button
            variant="secondary"
            onClick={agregarLinea}
            disabled={!productoSeleccionado}
          >
            Agregar
          </Button>
        </div>
      </div>

      {/* Lines list */}
      {lineas.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            Productos declarados ({lineas.length})
          </p>
          {lineas.map((linea, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-md border bg-white p-3"
            >
              <div>
                <p className="text-sm font-medium">{linea.productoNombre}</p>
                <p className="text-xs text-gray-400">
                  {MOTIVOS_DEVOLUCION.find((m) => m.value === linea.motivo)?.label} —{" "}
                  <span className="font-bold">{linea.cantidadDeclarada} und</span>
                </p>
              </div>
              <button
                onClick={() => quitarLinea(i)}
                className="text-red-400 hover:text-red-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <div className="flex gap-2">
        <Button
          variant="ghost"
          onClick={onCancelar}
          className="flex-1"
        >
          Cancelar
        </Button>
        <Button
          onClick={crearSesion}
          loading={creando}
          disabled={!tienda || lineas.length === 0}
          size="lg"
          className="flex-1"
        >
          Iniciar Registro
        </Button>
      </div>
    </div>
  );
}
