"use client";

import { QueuePanel } from "@/components/cola/queue-panel";
import { SessionPanel } from "@/components/sesiones/session-panel";
import { useRealtimeQueue } from "@/hooks/use-realtime-queue";
import { useRealtimeSession } from "@/hooks/use-realtime-session";

export default function DevolucionesPage() {
  const queue = useRealtimeQueue();
  const session = useRealtimeSession();

  return (
    <div className="flex h-full flex-col lg:flex-row gap-4 lg:gap-6">
      {/* Left panel: Queue + Session form */}
      <div className="w-full lg:w-[380px] lg:min-w-[340px] lg:max-w-[420px] shrink-0 overflow-auto">
        <QueuePanel
          queue={queue}
          hasSesionActiva={!!session.sesion}
          onSesionCreada={session.refetch}
        />
      </div>

      {/* Right panel: Realtime counter + detection feed */}
      <div className="flex-1 min-w-0 overflow-auto">
        <SessionPanel session={session} onCerrada={() => {
          session.refetch();
          queue.refetch();
        }} />
      </div>
    </div>
  );
}
