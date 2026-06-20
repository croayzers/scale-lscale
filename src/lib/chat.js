// MARK: - Chat entre usuarios de la empresa (company_messages)
import { sb, supabaseConfigurado } from "./supabase.js";

// Carga todos los mensajes de la empresa (para el usuario actual, limitado a sus conversaciones)
export async function cargarTodosMensajes(companyId) {
  if (!supabaseConfigurado || !companyId) return [];
  const { data, error } = await sb()
    .from("company_messages")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  if (error) { console.error("[chat] cargarTodosMensajes:", error.message); return []; }
  return data || [];
}

// Envía un mensaje de DM entre dos usuarios
export async function enviarMensaje(companyId, fromUserId, toUserId, message) {
  if (!supabaseConfigurado) throw new Error("Supabase no configurado");
  console.log("[chat] enviar →", { companyId, fromUserId, toUserId, message });
  const { data, error } = await sb()
    .from("company_messages")
    .insert({ company_id: companyId, from_user_id: fromUserId, to_user_id: toUserId, message })
    .select()
    .single();
  if (error) { console.error("[chat] enviarMensaje error:", error); throw error; }
  console.log("[chat] enviado ✓", data);
  return data;
}

// Marca como leídos todos los mensajes de fromId a myId
export async function marcarLeidos(companyId, myId, fromId) {
  if (!supabaseConfigurado) return;
  await sb()
    .from("company_messages")
    .update({ is_read: true })
    .eq("company_id", companyId)
    .eq("to_user_id", myId)
    .eq("from_user_id", fromId)
    .eq("is_read", false);
}

// Suscribe a nuevos mensajes de la empresa via Realtime. Devuelve función de limpieza.
export function suscribirMensajes(companyId, onNewMessage) {
  if (!supabaseConfigurado || !companyId) return () => {};
  const channel = sb()
    .channel(`company-chat-${companyId}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "company_messages",
      filter: `company_id=eq.${companyId}`,
    }, (payload) => {
      if (payload.new) onNewMessage(payload.new);
    })
    .subscribe();
  return () => { sb().removeChannel(channel); };
}
