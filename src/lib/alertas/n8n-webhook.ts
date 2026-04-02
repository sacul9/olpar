type AlertPayload = {
  tipo: string;
  sesionId: string;
  conductorNombre: string;
  conductorCedula: string;
  tienda: string;
  mensaje: string;
  detalleLineas?: Array<{
    producto: string;
    declarada: number;
    detectada: number;
  }>;
};

export async function enviarAlerta(payload: AlertPayload): Promise<boolean> {
  const webhookUrl = payload.tipo === "camara_offline"
    ? process.env.N8N_WEBHOOK_CAMARA_OFFLINE
    : process.env.N8N_WEBHOOK_ALERTA;

  if (!webhookUrl) {
    console.error(`[Alerta] Webhook URL no configurada para tipo: ${payload.tipo}`);
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        ownerPhone: process.env.OWNER_PHONE,
        ownerEmail: process.env.OWNER_EMAIL,
        timestamp: new Date().toISOString(),
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("[Alerta] Error enviando webhook:", error);
    return false;
  }
}
