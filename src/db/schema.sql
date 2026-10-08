-- PostgreSQL Schema for Silverstone Developers WhatsApp Analytics Foundation
-- Milestone 1 + Milestone 2 (Contact 360 & Conversation History)

-- 1. CONTACTS
CREATE TABLE IF NOT EXISTS contacts (
  id VARCHAR(64) PRIMARY KEY,
  wa_id VARCHAR(64) UNIQUE NOT NULL,
  phone VARCHAR(32) NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  project_id VARCHAR(64),
  lead_source VARCHAR(128),
  source_detail VARCHAR(255),
  consent_status VARCHAR(64),
  opt_in_source VARCHAR(128),
  opt_in_at TIMESTAMPTZ,
  opted_out BOOLEAN NOT NULL DEFAULT FALSE,
  opt_out_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_wa_id ON contacts (wa_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts (phone);
CREATE INDEX IF NOT EXISTS idx_contacts_last_activity ON contacts (last_activity_at);
CREATE INDEX IF NOT EXISTS idx_contacts_project_id ON contacts (project_id);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts (created_at);

-- 2. CONVERSATIONS
CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR(64) PRIMARY KEY,
  contact_id VARCHAR(64) NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  state VARCHAR(64),
  assigned_agent_id VARCHAR(64),
  campaign_id VARCHAR(64),
  project_id VARCHAR(64),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  last_inbound_at TIMESTAMPTZ,
  last_outbound_at TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,
  last_customer_message_id VARCHAR(255),
  last_customer_message_at TIMESTAMPTZ,
  last_internal_read_at TIMESTAMPTZ,
  unread_count INTEGER NOT NULL DEFAULT 0,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_contact_id ON conversations (contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations (status);
CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON conversations (project_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations (last_message_at);
CREATE INDEX IF NOT EXISTS idx_conversations_unread ON conversations (unread_count);

-- 3. MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(64) PRIMARY KEY,
  contact_id VARCHAR(64) NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  conversation_id VARCHAR(64) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  campaign_id VARCHAR(64),
  wa_message_id VARCHAR(255),
  direction VARCHAR(16) NOT NULL, -- 'inbound' | 'outbound'
  message_type VARCHAR(32) NOT NULL,
  body_text TEXT,
  template_name VARCHAR(128),
  template_language VARCHAR(32),
  button_id VARCHAR(128),
  list_row_id VARCHAR(128),
  media_id VARCHAR(255),
  reply_to_message_id VARCHAR(255),
  agent_id VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_wa_message_id ON messages (wa_message_id) WHERE wa_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_contact_id ON messages (contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages (direction);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at);

-- 4. MESSAGE STATUS EVENTS
CREATE TABLE IF NOT EXISTS message_status_events (
  id VARCHAR(64) PRIMARY KEY,
  message_id VARCHAR(64) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL, -- 'sent', 'delivered', 'read', 'failed', 'deleted'
  recipient_id VARCHAR(64),
  event_timestamp TIMESTAMPTZ NOT NULL,
  error_code VARCHAR(64),
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_events_message_id ON message_status_events (message_id);
CREATE INDEX IF NOT EXISTS idx_status_events_status ON message_status_events (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_status_events_dedupe ON message_status_events (message_id, status, event_timestamp);

-- 5. CONVERSATION EVENTS
CREATE TABLE IF NOT EXISTS conversation_events (
  id VARCHAR(64) PRIMARY KEY,
  conversation_id VARCHAR(64) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id VARCHAR(64) NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  campaign_id VARCHAR(64),
  agent_id VARCHAR(64),
  event_type VARCHAR(64) NOT NULL,
  event_value VARCHAR(255),
  project_id VARCHAR(64),
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_events_conv_id ON conversation_events (conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_events_contact_id ON conversation_events (contact_id);
CREATE INDEX IF NOT EXISTS idx_conversation_events_type ON conversation_events (event_type);
CREATE INDEX IF NOT EXISTS idx_conversation_events_project ON conversation_events (project_id);
CREATE INDEX IF NOT EXISTS idx_conversation_events_created_at ON conversation_events (created_at);

-- 6. AUDIT LOGS (Milestone 2)
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  action VARCHAR(64) NOT NULL, -- 'CONTACT_VIEWED', 'CONVERSATION_VIEWED', 'CONTACT_EXPORTED'
  entity_type VARCHAR(64) NOT NULL, -- 'contact', 'conversation'
  entity_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64),
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);

-- 7. META TEMPLATE ANALYTICS (Official Meta WhatsApp Business API Verified Insights)
CREATE TABLE IF NOT EXISTS meta_template_analytics (
  id VARCHAR(64) PRIMARY KEY,
  template_id VARCHAR(64) NOT NULL,
  template_name VARCHAR(128) NOT NULL,
  date_str VARCHAR(16) NOT NULL,
  batch_number INT,
  start_timestamp BIGINT NOT NULL,
  end_timestamp BIGINT NOT NULL,
  sent_count INT NOT NULL DEFAULT 0,
  delivered_count INT NOT NULL DEFAULT 0,
  read_count INT NOT NULL DEFAULT 0,
  replied_count INT NOT NULL DEFAULT 0,
  button_clicks INT NOT NULL DEFAULT 0,
  button_content VARCHAR(128),
  amount_spent NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  cost_per_delivered NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_meta_template_date UNIQUE (template_id, date_str)
);

CREATE INDEX IF NOT EXISTS idx_meta_template_date ON meta_template_analytics (date_str);
CREATE INDEX IF NOT EXISTS idx_meta_batch ON meta_template_analytics (batch_number);

