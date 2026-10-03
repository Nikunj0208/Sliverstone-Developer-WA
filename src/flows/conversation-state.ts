export type ConversationHandoff = {
  mode: "chat" | "site-visit";
  projectId?: string;
  markedAt: string;
};

export type ConversationStateType =
  | "MAIN_MENU"
  | "PROJECT_LIST"
  | "PROJECT_SELECTED"
  | "PROJECT_INFO"
  | "PROJECT_ACTIONS"
  | "SELECT_SQFT"
  | "SELECT_BHK"
  | "BROCHURE_SENT"
  | "PLAN_SENT"
  | "CHAT"
  | "CALL";

export type ConversationState = {
  state: ConversationStateType;
  projectId?: string;
  squareFeetId?: string;
  bhk?: string;
  updatedAt: string;
};

const states = new Map<string, ConversationState>();
const handoffs = new Map<string, ConversationHandoff>();

export function setConversationState(
  conversationId: string,
  state: ConversationStateType,
  data?: { projectId?: string; squareFeetId?: string; bhk?: string }
): ConversationState {
  const current = states.get(conversationId);
  const updated: ConversationState = {
    state,
    projectId: data?.projectId ?? current?.projectId,
    squareFeetId: data?.squareFeetId ?? current?.squareFeetId,
    bhk: data?.bhk ?? current?.bhk,
    updatedAt: new Date().toISOString()
  };
  states.set(conversationId, updated);
  return updated;
}

export function getConversationState(conversationId: string): ConversationState | undefined {
  return states.get(conversationId);
}

export function clearConversationState(conversationId: string): void {
  states.delete(conversationId);
}

export function markChatHandoff(conversationId: string): void {
  handoffs.set(conversationId, { mode: "chat", markedAt: new Date().toISOString() });
  setConversationState(conversationId, "CHAT");
}

export function markSiteVisitHandoff(conversationId: string, projectId?: string): void {
  handoffs.set(conversationId, {
    mode: "site-visit",
    ...(projectId ? { projectId } : {}),
    markedAt: new Date().toISOString()
  });
}

export function getConversationHandoff(conversationId: string): ConversationHandoff | undefined {
  return handoffs.get(conversationId);
}
