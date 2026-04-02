import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appendAuditLog } from "@/lib/audit";
import { enviarAlerta } from "@/lib/alertas/n8n-webhook";
import {
  CONDUCTOR_FLAG_UMBRAL_PORCENTAJE,
} from "@/lib/constants";
import { format, startOfWeek, subWeeks } from "date-fns";

// GET — Cron: calculate weekly driver scores (runs Monday 4am)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Calculate for the previous week
  const now = new Date();
  const lunesAnterior = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const lunesActual = startOfWeek(now, { weekStartsOn: 1 });

  // ISO week string
  const semana = format(lunesAnterior, "yyyy") + "-W" +
    format(lunesAnterior, "II");

  // Get all conductors
  const conductores = await prisma.conductor.findMany({
    where: { activo: true },
  });

  const resultados = [];

  for (const conductor of conductores) {
    // Get sessions for this conductor in the previous week
    const sesiones = await prisma.sesionDevolucion.findMany({
      where: {
        conductorId: conductor.id,
        estado: "cerrada",
        creadoEn: { gte: lunesAnterior, lt: lunesActual },
      },
      include: { lineas: true },
    });

    if (sesiones.length === 0) continue;

    const totalSesiones = sesiones.length;
    let sesionesConDiscrepancia = 0;

    for (const sesion of sesiones) {
      const hayDiscrepancia = sesion.lineas.some(
        (l) => l.cantidadDetectada !== l.cantidadDeclarada
      );
      if (hayDiscrepancia) sesionesConDiscrepancia++;
    }

    const porcentajeExactitud =
      ((totalSesiones - sesionesConDiscrepancia) / totalSesiones) * 100;

    const flagGenerado =
      (sesionesConDiscrepancia / totalSesiones) * 100 >=
      CONDUCTOR_FLAG_UMBRAL_PORCENTAJE;

    await prisma.conductorScore.upsert({
      where: {
        conductorId_semana: {
          conductorId: conductor.id,
          semana,
        },
      },
      create: {
        conductorId: conductor.id,
        semana,
        totalSesiones,
        sesionesConDiscrepancia,
        porcentajeExactitud,
        flagGenerado,
      },
      update: {
        totalSesiones,
        sesionesConDiscrepancia,
        porcentajeExactitud,
        flagGenerado,
      },
    });

    // Alert owner if conductor is flagged
    if (flagGenerado) {
      await enviarAlerta({
        tipo: "conductor_flag",
        sesionId: sesiones[0].id,
        conductorNombre: conductor.nombre,
        conductorCedula: conductor.cedula,
        tienda: "",
        mensaje: `CONDUCTOR FLAGGEADO: ${conductor.nombre} (${conductor.cedula}) — ${sesionesConDiscrepancia}/${totalSesiones} sesiones con discrepancia (${(100 - porcentajeExactitud).toFixed(1)}%) en semana ${semana}`,
      });
    }

    resultados.push({
      conductor: conductor.nombre,
      totalSesiones,
      sesionesConDiscrepancia,
      porcentajeExactitud: porcentajeExactitud.toFixed(1),
      flagGenerado,
    });
  }

  await appendAuditLog({
    accion: "cron.score_semanal",
    entidad: "ConductorScore",
    detalle: {
      semana,
      conductoresEvaluados: resultados.length,
      flaggeados: resultados.filter((r) => r.flagGenerado).length,
    },
  });

  return NextResponse.json({
    ok: true,
    semana,
    resultados,
  });
}
