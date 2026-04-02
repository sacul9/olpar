"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Producto = {
  id: string;
  codigoBarras: string;
  nombre: string;
  marca: string;
  categoria: string | null;
  unidad: string;
  presentacion: string | null;
  refrigerado: boolean;
  activo: boolean;
};

export default function CatalogoPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    creados: number;
    actualizados: number;
    errores: string[];
  } | null>(null);

  const fetchProductos = useCallback(async () => {
    setLoading(true);
    const params = busqueda ? `?q=${encodeURIComponent(busqueda)}` : "";
    const res = await fetch(`/api/catalogo${params}`);
    if (res.ok) setProductos(await res.json());
    setLoading(false);
  }, [busqueda]);

  useEffect(() => {
    const timer = setTimeout(fetchProductos, 300);
    return () => clearTimeout(timer);
  }, [fetchProductos]);

  async function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setSyncResult(null);

    const formData = new FormData();
    formData.append("archivo", file);

    try {
      const res = await fetch("/api/catalogo/sync-csv", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(data);
        fetchProductos();
      } else {
        alert(data.error);
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const marcaColor: Record<string, "blue" | "red" | "yellow" | "gray"> = {
    alpina: "blue",
    zenu: "red",
    bimbo: "yellow",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Catalogo de Productos
        </h1>
        <div className="flex items-center gap-3">
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="hidden"
            />
            <span className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
              {uploading ? "Sincronizando..." : "Sync CSV Amovil"}
            </span>
          </label>
        </div>
      </div>

      {syncResult && (
        <Card className="border-green-200 bg-green-50">
          <p className="text-sm text-green-700">
            Sync completada: <strong>{syncResult.creados}</strong> nuevos,{" "}
            <strong>{syncResult.actualizados}</strong> actualizados
            {syncResult.errores.length > 0 && (
              <span className="text-yellow-600">
                , {syncResult.errores.length} errores
              </span>
            )}
          </p>
        </Card>
      )}

      <Card>
        <div className="mb-4">
          <Input
            placeholder="Buscar por nombre, barcode o marca..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Cargando...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 pr-4 font-medium">Barcode</th>
                  <th className="pb-3 pr-4 font-medium">Nombre</th>
                  <th className="pb-3 pr-4 font-medium">Marca</th>
                  <th className="pb-3 pr-4 font-medium">Unidad</th>
                  <th className="pb-3 pr-4 font-medium">Presentacion</th>
                  <th className="pb-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 pr-4 font-mono text-xs">
                      {p.codigoBarras}
                    </td>
                    <td className="py-3 pr-4 font-medium">{p.nombre}</td>
                    <td className="py-3 pr-4">
                      <Badge color={marcaColor[p.marca] ?? "gray"}>
                        {p.marca}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4">{p.unidad}</td>
                    <td className="py-3 pr-4 text-gray-500">
                      {p.presentacion ?? "—"}
                    </td>
                    <td className="py-3">
                      {p.activo ? (
                        <Badge color="green">Activo</Badge>
                      ) : (
                        <Badge color="gray">Inactivo</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-gray-400">
              {productos.length} producto{productos.length !== 1 && "s"}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
