export interface Contact {
  id: string;
  wa_id: string;
  phone: string;
  name: string | null;
  email: string | null;
  project_id: string | null;
  lead_source: string | null;
  source_detail?: string | null;
  consent_status: string | null;
  opt_in_source: string | null;
  opt_in_at: Date | null;
  opted_out: boolean;
  opt_out_at: Date | null;
  first_seen_at?: Date | null;
  last_seen_at?: Date | null;
  last_activity_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Conversation {
  id: string;
  contact_id: string;
  status: "OPEN" | "CLOSED" | string;
  state: string | null;
  assigned_agent_id: string | null;
  campaign_id: string | null;
  project_id: string | null;
  opened_at: Date;
  last_message_at: Date | null;
  last_inbound_at: Date | null;
  last_outbound_at: Date | null;
  first_response_at: Date | null;
  last_customer_message_id?: string | null;
  last_customer_message_at?: Date | null;
  last_internal_read_at?: Date | null;
  unread_count?: number;
  closed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export type MessageDirection = "inbound" | "outbound";

export interface Message {
  id: string;
  contact_id: string;
  conversation_id: string;
  campaign_id: string | null;
  wa_message_id: string | null;
  direction: MessageDirection;
  message_type: string;
  body_text: string | null;
  template_name: string | null;
  template_language: string | null;
  button_id: string | null;
  list_row_id: string | null;
  media_id: string | null;
  reply_to_message_id: string | null;
  agent_id: string | null;
  created_at: Date;
}

export type MessageStatus = "sent" | "delivered" | "read" | "failed" | "deleted";

export interface MessageStatusEvent {
  id: string;
  message_id: string;
  status: MessageStatus | string;
  recipient_id: string | null;
  event_timestamp: Date;
  error_code: string | null;
  error_message: string | null;
  received_at: Date;
}

export type ConversationEventType =
  | "CUSTOMER_REPLIED"
  | "BUTTON_CLICKED"
  | "MAIN_MENU_VIEWED"
  | "VIEW_PROJECTS_CLICKED"
  | "PROJECT_SELECTED"
  | "BROCHURE_REQUESTED"
  | "BROCHURE_SENT"
  | "PLANS_REQUESTED"
  | "SQFT_SELECTED"
  | "BHK_SELECTED"
  | "PLAN_SENT"
  | "CHAT_REQUESTED"
  | "CALL_REQUESTED"
  | "SITE_VISIT_REQUESTED"
  | "HUMAN_HANDOFF"
  | "OPTED_OUT"
  | "CONVERSATION_CLOSED";

export interface ConversationEvent {
  id: string;
  conversation_id: string;
  contact_id: string;
  campaign_id: string | null;
  agent_id: string | null;
  event_type: ConversationEventType | string;
  event_value: string | null;
  project_id: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: Date;
}

export interface AuditLog {
  id: string;
  action: string; // 'CONTACT_VIEWED' | 'CONVERSATION_VIEWED' | 'CONTACT_EXPORTED'
  entity_type: string;
  entity_id: string;
  user_id: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: Date;
}

export interface ProjectEngagementMatrixItem {
  name: string;
  viewed: boolean;
  selected: boolean;
  brochureRequested: boolean;
  brochureSent: boolean;
  plansRequested: boolean;
  plansSent: boolean;
  selectedSqft: string | null;
  selectedBhk: string | null;
}

export interface Contact360Summary {
  status: string;
  currentState: string;
  lastActivityAt: Date | string | null;
  unreadCount: number;
  firstResponseTimeSeconds: number | null;
  firstResponseTimeFormatted: string | null;
  averageResponseTimeSeconds: number | null;
  averageResponseTimeFormatted: string | null;
  medianResponseTimeSeconds: number | null;
  medianResponseTimeFormatted: string | null;
  fastestResponseTimeSeconds: number | null;
  slowestResponseTimeSeconds: number | null;
  lastCustomerMessage: string | null;
  lastCustomerMessageAt: Date | string | null;
  lastBusinessMessage: string | null;
  lastBusinessMessageAt: Date | string | null;
  nextLogicalAction: string;
}

export interface Contact360Engagement {
  projectsViewed: number;
  projectsSelected: number;
  brochuresRequested: number;
  brochuresSent: number;
  plansRequested: number;
  plansSent: number;
  bhkSelected: number;
  sqftSelected: number;
  chatRequests: number;
  callRequests: number;
  siteVisitRequests: number;
  projectMatrix: Record<string, ProjectEngagementMatrixItem>;
}

export interface Contact360MessageSummary {
  totalMessages: number;
  inboundCount: number;
  outboundCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
}

export interface Contact360CampaignSummary {
  campaignsReceived: string[];
  lastCampaign: string | null;
  lastCampaignStatus: string | null;
  lastTemplate: string | null;
}

export interface Contact360 {
  contact: Contact & { phoneMasked?: string };
  conversation: Conversation | null;
  conversations?: Conversation[];
  messages: Array<Message & { latestStatus?: string }>;
  statuses: MessageStatusEvent[];
  projectEvents: ConversationEvent[];
  events?: ConversationEvent[];
  latestActivity: Date | null;
  responseTime: {
    firstResponseTimeMs: number | null;
    formattedDuration: string | null;
    lastInboundAt: Date | null;
    firstResponseAt: Date | null;
  };
  summary?: Contact360Summary;
  engagement?: Contact360Engagement;
  messagesSummary?: Contact360MessageSummary;
  campaignSummary?: Contact360CampaignSummary;
}

export interface AnalyticsOverview {
  messagesToday: number;
  messagesSent: number;
  messagesDelivered: number;
  messagesRead: number;
  messagesFailed: number;
  repliesToday: number;
  unreadConversations: number;
  brochuresRequested: number;
  plansRequested: number;
  projectSelections: number;
  bhkSelections: number;
}

// Queries & View Models for Milestone 2
export interface ContactListQuery {
  search?: string;
  project?: string;
  leadSource?: string;
  consentStatus?: string;
  optedOut?: boolean;
  conversationStatus?: string;
  currentState?: string;
  lastActivityRange?: string; // 'today' | 'yesterday' | '7d' | '30d' | 'custom'
  date?: string; // Specific single-day filter YYYY-MM-DD
  batch?: string; // Specific batch filter: '1' | '2' | '3' | '4' | '5'
  deliveryStatus?: string; // 'read' | 'delivered' | 'sent' | 'failed'
  startDate?: Date;
  endDate?: Date;
  unread?: boolean;
  replied?: boolean;
  brochureRequested?: boolean;
  planRequested?: boolean;
  siteVisitRequested?: boolean;
  buttonClicks?: boolean;
  sortBy?:
    | "newest"
    | "oldest"
    | "latest_activity"
    | "oldest_activity"
    | "last_inbound"
    | "last_outbound"
    | "most_messages"
    | "most_engagement"
    | "newest_reply";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface ContactListItem {
  id: string;
  wa_id: string;
  phone: string;
  phoneMasked: string;
  name: string | null;
  email: string | null;
  project: string | null;
  leadSource: string | null;
  firstSeenAt: Date | null;
  lastActivityAt: Date | null;
  batchName?: string;
  latestDeliveryStatus?: string;
  seenAt?: Date | null;
  lastMessageDirection: MessageDirection | null;
  lastReplyAt?: Date | null;
  lastReplyText?: string | null;
  lastReplyType?: string | null;
  currentJourneyStep?: string;
  currentJourneyStepNumber?: number;
  currentJourneyStepDetails?: string;
  conversationStatus: string | null;
  currentState: string | null;
  unread: boolean;
  unreadCount: number;
  assignedAgentId: string | null;
  totalMessages: number;
  hasReplied: boolean;
  buttonClicked: boolean;
  lastButtonClicked?: string | null;
  brochureRequested: boolean;
  planRequested: boolean;
  siteVisitRequested: boolean;
  errorCode?: string | null;
  errorMessage?: string | null;
  lastWaMessageId?: string | null;
}

export interface ConversationListQuery {
  search?: string;
  unread?: boolean;
  needsReply?: boolean;
  replied?: boolean;
  status?: string;
  project?: string;
  campaign?: string;
  currentState?: string;
  dateRange?: string;
  limit?: number;
  offset?: number;
}

export interface ConversationListItem {
  id: string;
  contactId: string;
  contactName: string | null;
  phone?: string;
  phoneMasked: string;
  latestMessageText: string | null;
  latestMessageDirection: MessageDirection | null;
  lastActivityAt: Date | null;
  project: string | null;
  currentState: string | null;
  status: string;
  unread: boolean;
  unreadCount: number;
  needsReply: boolean;
}

export interface MessagePaginationQuery {
  limit?: number; // 25, 50, 100
  offset?: number;
  direction?: "asc" | "desc";
}

export interface PaginatedMessagesResult {
  messages: Array<Message & { latestStatus?: string }>;
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface DuplicateContactCandidate {
  contactA: Contact;
  contactB: Contact;
  matchType: "wa_id" | "phone" | "email";
  matchValue: string;
}

export interface MetaTemplateDailyMetric {
  id?: string;
  templateId: string;
  templateName: string;
  dateStr: string; // '2026-10-03', '2026-10-04', etc.
  batchNumber: number | null; // 1, 2, 3, 4, 5
  startTimestamp: number;
  endTimestamp: number;
  sent: number;
  delivered: number;
  deliveryRatePercent: number;
  read: number;
  readRatePercent: number;
  replied: number;
  replyRatePercent: number;
  buttonClicks: number;
  buttonContent: string;
  amountSpent: number;
  costPerDelivered: number;
  currency: string;
  syncedAt: Date;
}

export interface MetaCampaignOverview {
  totalSent: number;
  totalDelivered: number;
  overallDeliveryRatePercent: number;
  totalRead: number;
  overallReadRatePercent: number;
  totalReplied: number;
  overallReplyRatePercent: number;
  totalButtonClicks: number;
  totalSpent: number;
  currency: string;
  lastSyncedAt: Date | string;
  dailyBreakdown: MetaTemplateDailyMetric[];
}

