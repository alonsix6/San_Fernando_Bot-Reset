import { SupabaseClient } from '@supabase/supabase-js';
import { ConversationStep, NewRequestData, CompleteRequestData, AREAS } from './types';

const TEAM_ID = process.env.TEAM_ID;

/**
 * Helper para gestionar el estado de conversaciones
 */
export interface ConversationState {
  chatId: string;
  userId: string;
  step: ConversationStep;
  data: NewRequestData | CompleteRequestData;
}

/**
 * Obtiene el estado de conversación de un usuario
 */
export async function getConversationState(
  chatId: string,
  userId: string,
  supabase: SupabaseClient
): Promise<ConversationState | null> {
  let query = supabase
    .from('conversation_state')
    .select('*')
    .eq('chat_id', chatId.toString())
    .eq('user_id', userId.toString());

  if (TEAM_ID) {
    query = query.eq('team_id', TEAM_ID);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return null;
  }

  return {
    chatId: data.chat_id,
    userId: data.user_id,
    step: data.step as ConversationStep,
    data: data.data as NewRequestData,
  };
}

/**
 * Guarda el estado de conversación
 */
export async function saveConversationState(
  state: ConversationState,
  supabase: SupabaseClient
): Promise<void> {
  const { error } = await supabase
    .from('conversation_state')
    .upsert({
      chat_id: state.chatId,
      user_id: state.userId,
      step: state.step,
      data: state.data,
      updated_at: new Date().toISOString(),
      ...(TEAM_ID && { team_id: TEAM_ID }),
    });

  if (error) {
    throw error;
  }
}

/**
 * Limpia el estado de conversación
 */
export async function clearConversationState(
  chatId: string,
  userId: string,
  supabase: SupabaseClient
): Promise<void> {
  let deleteQuery = supabase
    .from('conversation_state')
    .delete()
    .eq('chat_id', chatId.toString())
    .eq('user_id', userId.toString());

  if (TEAM_ID) {
    deleteQuery = deleteQuery.eq('team_id', TEAM_ID);
  }

  await deleteQuery;
}

/**
 * Mensajes del flujo conversacional
 */
export const conversationMessages = {
  start: '📝 *¡Vamos a crear un pendiente!*\n\n¿Para qué *proyecto o campaña* es?',

  client: (client: string) =>
    `✅ Proyecto: *${client}*\n\n¿Qué se necesita? Cuéntame los detalles`,

  description: (desc: string) =>
    `✅ Pendiente: ${desc}\n\n¿Quién lo solicita?`,

  requester: (requester: string) =>
    `✅ Solicitante: ${requester}\n\n¿Para cuándo lo necesitan?\n• Fecha: "25/03" o "25/03/2026"\n• Relativo: "hoy", "mañana", "en 3 días"`,

  deadline: (deadline: string, formatted: string) => {
    const emojis = ['1️⃣', '2️⃣', '3️⃣'];
    let assignOptions = '';
    AREAS.forEach((area, i) => {
      assignOptions += `${emojis[i]} ${area}\n`;
    });
    assignOptions += `${AREAS.length + 1}️⃣ Sin asignar`;
    return `✅ Fecha: ${formatted}\n\n¿A qué área le toca?\n${assignOptions}\n\nResponde con el número`;
  },

  summary: (data: NewRequestData, assigned: string, priority: string, emoji: string) => {
    return `✅ *¡Pendiente creado!*\n\n📋 *Resumen:*\n🎯 Proyecto: ${data.client}\n📝 Pendiente: ${data.description}\n👤 Solicitante: ${data.requester_name}\n📅 Fecha: ${data.deadline}\n🏢 Área: ${assigned}\n${emoji} Prioridad: ${priority}\n\n✨ Listo, todos pueden verlo con /ver`;
  },

  cancel: '❌ Cancelado. Usa /nuevopendiente cuando quieras crear uno nuevo.',

  error: '⚠️ No entendí esa respuesta, intenta de nuevo.',

  invalidDate: '⚠️ No pude entender esa fecha. Prueba con:\n• "25/03" o "25/03/2026"\n• "hoy", "mañana"\n• "en 3 días"',

  invalidAssignment: `⚠️ Responde con un número del 1 al ${AREAS.length + 1}.`,
};
