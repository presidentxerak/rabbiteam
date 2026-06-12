/**
 * Broadcast Realtime côté serveur via l'API REST (pas de websocket en
 * serverless). Les clients abonnés au channel `island:{id}` reçoivent
 * l'événement — uniquement pendant les fenêtres de vote/révélation.
 */
import "server-only";

export async function broadcastToIsland(
  islandId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      body: JSON.stringify({
        messages: [{ topic: `island:${islandId}`, event, payload, private: false }],
      }),
    });
  } catch (e) {
    // Le broadcast est un embellissement temps réel, jamais bloquant.
    console.error("[realtime] broadcast failed:", e);
  }
}
