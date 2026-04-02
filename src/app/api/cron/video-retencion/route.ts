import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { appendAuditLog } from "@/lib/audit";
import { VIDEO_RETENCION_NORMAL_DIAS, VIDEO_RETENCION_ALERTA_DIAS } from "@/lib/constants";

// GET — Cron: delete expired videos
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const now = new Date();
  const cutoffNormal = new Date(
    now.getTime() - VIDEO_RETENCION_NORMAL_DIAS * 24 * 60 * 60 * 1000
  );
  const cutoffAlerta = new Date(
    now.getTime() - VIDEO_RETENCION_ALERTA_DIAS * 24 * 60 * 60 * 1000
  );

  // Normal sessions (no alerts) older than 30 days
  const sesionesNormales = await prisma.sesionDevolucion.findMany({
    where: {
      estado: "cerrada",
      videoUrl: { not: null },
      cerradoEn: { lt: cutoffNormal },
      alertas: { none: {} },
    },
  });

  // Sessions with alerts older than 90 days
  const sesionesAlerta = await prisma.sesionDevolucion.findMany({
    where: {
      estado: "cerrada",
      videoUrl: { not: null },
      cerradoEn: { lt: cutoffAlerta },
      alertas: { some: {} },
    },
  });

  let eliminados = 0;

  // Delete normal videos
  for (const sesion of sesionesNormales) {
    if (sesion.videoUrl) {
      await supabaseAdmin.storage.from("videos").remove([sesion.videoUrl]);
      await prisma.sesionDevolucion.update({
        where: { id: sesion.id },
        data: { videoUrl: null },
      });
      eliminados++;
    }
  }

  // Delete alert videos
  for (const sesion of sesionesAlerta) {
    if (sesion.videoUrl) {
      await supabaseAdmin.storage.from("videos").remove([sesion.videoUrl]);
      await prisma.sesionDevolucion.update({
        where: { id: sesion.id },
        data: { videoUrl: null },
      });
      eliminados++;
    }
  }

  await appendAuditLog({
    accion: "cron.video_retencion",
    entidad: "SesionDevolucion",
    detalle: {
      normalesRevisadas: sesionesNormales.length,
      alertaRevisadas: sesionesAlerta.length,
      eliminados,
    },
  });

  return NextResponse.json({
    ok: true,
    eliminados,
    normales: sesionesNormales.length,
    alertas: sesionesAlerta.length,
  });
}
