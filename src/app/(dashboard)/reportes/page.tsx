"use client";

import { useState, useEffect } from "react";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CONDUCTOR_FLAG_UMBRAL_PORCENTAJE } from "@/lib/constants";

type Resumen = {
  total: number;
  ok: number;
  conDiscrepancia: number;
  abiertas: number;
  valorEnRiesgo?: number;
};

type Score = {
  id: string;
  semana: string;
  totalSesiones: number;
  sesionesConDiscrepancia: number;
  porcentajeExactitud: number;
  flagGenerado: boolean;
  conductor: { nombre: string; cedula: string; ruta: string | null };
};

export default function ReportesPage() {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/reportes/diario").then((r) => r.json()),
      fetch("/api/reportes/conductor-score").then((r) => r.json()),
    ]).then(([diario, scoresData]) => {
      setResumen(diario.resumen);
      setScores(scoresData);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <p className="text-gray-400">Cargando reportes...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Reportes</h1>
        <Button
          variant="secondary"
          onClick={() => {
            window.location.href = "/api/reportes/exportar";
          }}
        >
          Exportar Todo CSV
        </Button>
      </div>

      {/* Daily summary cards */}
      {resumen && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardTitle>Total Hoy</CardTitle>
            <CardValue className="text-gray-900">{resumen.total}</CardValue>
          </Card>
          <Card>
            <CardTitle>OK</CardTitle>
            <CardValue className="text-green-600">{resumen.ok}</CardValue>
          </Card>
          <Card>
            <CardTitle>Discrepancias</CardTitle>
            <CardValue className="text-red-600">
              {resumen.conDiscrepancia}
            </CardValue>
          </Card>
          <Card>
            <CardTitle>Valor en Riesgo</CardTitle>
            <CardValue className="text-red-600">
              ${((resumen.valorEnRiesgo ?? 0) / 1000).toFixed(0)}K
            </CardValue>
          </Card>
        </div>
      )}

      {/* Driver scores */}
      <Card>
        <CardTitle>Score de Conductores</CardTitle>
        <p className="mb-4 text-xs text-gray-400">
          Conductores con mas del {CONDUCTOR_FLAG_UMBRAL_PORCENTAJE}% de
          discrepancia son marcados automaticamente.
        </p>

        {scores.length === 0 ? (
          <p className="text-sm text-gray-400">
            No hay scores calculados aun. Se calculan cada lunes.
          </p>
        ) : (
          <div className="-mx-6 overflow-x-auto px-6">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 pr-4 font-medium">Conductor</th>
                  <th className="pb-3 pr-4 font-medium">Ruta</th>
                  <th className="pb-3 pr-4 font-medium">Semana</th>
                  <th className="pb-3 pr-4 font-medium">Sesiones</th>
                  <th className="pb-3 pr-4 font-medium">Discrepancias</th>
                  <th className="pb-3 pr-4 font-medium">Exactitud</th>
                  <th className="pb-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s) => (
                  <tr key={s.id} className="border-b">
                    <td className="py-3 pr-4 font-medium">
                      {s.conductor.nombre}
                    </td>
                    <td className="py-3 pr-4 text-gray-500">
                      {s.conductor.ruta ?? "—"}
                    </td>
                    <td className="py-3 pr-4">{s.semana}</td>
                    <td className="py-3 pr-4">{s.totalSesiones}</td>
                    <td className="py-3 pr-4">
                      {s.sesionesConDiscrepancia}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`font-mono font-bold ${
                          s.porcentajeExactitud >= 80
                            ? "text-green-600"
                            : s.porcentajeExactitud >= 60
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}
                      >
                        {s.porcentajeExactitud.toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-3">
                      {s.flagGenerado ? (
                        <Badge color="red">Flaggeado</Badge>
                      ) : (
                        <Badge color="green">Normal</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
