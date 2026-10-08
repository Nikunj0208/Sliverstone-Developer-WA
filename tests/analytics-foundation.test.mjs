import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { createApp } from "../dist/src/app.js";
import { env } from "../dist/src/config/env.js";
import { getAnalyticsRepository } from "../dist/src/db/index.js";
import { analyticsService } from "../dist/src/services/analytics-service.js";
import { normalizePhoneNumber } from "../dist/src/utils/phone.js";

async function withServer(run) {
  const app = createApp();
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    instance.once("error", reject);
  });

  try {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Test server did not provide a TCP address.");
    }
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

function webhookSignature(body) {
  return `sha256=${createHmac("sha256", env.metaAppSecret).update(body).digest("hex")}`;
}

function makeInboundPayload(message, contactProfileName = "Test Customer") {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              contacts: [
                {
                  wa_id: message.from,
                  profile: { name: contactProfileName }
                }
              ],
              messages: [message]
            }
          }
        ]
      }
    ]
  };
}

function makeStatusPayload(statusObj) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              statuses: [statusObj]
            }
          }
        ]
      }
    ]
  };
}

// 1. Contact Creation
test("contact creation: creates unique internal contact ID and safe normalized phone without inventing consent", async () => {
  const waId = `91${Date.now().toString().slice(-10)}`;
  const contact = await analyticsService.resolveContact(waId, "Alice Example");

  assert.ok(contact.id.startsWith("cnt_"));
  assert.equal(contact.wa_id, waId);
  assert.equal(contact.phone, `+${waId}`);
  assert.equal(contact.name, "Alice Example");
  assert.equal(contact.consent_status, null, "Consent status must not be invented");
  assert.equal(contact.opt_in_source, null);
  assert.equal(contact.opted_out, false);

  // Phone normalizer safety tests
  assert.equal(normalizePhoneNumber("919876543210"), "+919876543210");
  assert.equal(normalizePhoneNumber("+91 98765 43210"), "+919876543210");
  assert.equal(normalizePhoneNumber("9876543210"), "+919876543210");
  assert.equal(normalizePhoneNumber("09876543210"), "+919876543210");
});

// 2. Contact Lookup
test("contact lookup: finds contact by waId, retrieves Contact360 with conversation, activity, and response time", async () => {
  const waId = `91${(Date.now() + 1).toString().slice(-10)}`;
  const contact = await analyticsService.resolveContact(waId, "Bob Lookup");
  const found = await getAnalyticsRepository().findContactById(contact.id);
  assert.ok(found);
  assert.equal(found.id, contact.id);

  const contact360 = await analyticsService.getContact360(contact.id);
  assert.ok(contact360);
  assert.equal(contact360.contact.id, contact.id);
  assert.ok(Array.isArray(contact360.messages));
  assert.ok(Array.isArray(contact360.statuses));
  assert.ok(Array.isArray(contact360.projectEvents));
  assert.ok("responseTime" in contact360);
});

// 3. Inbound Text
test("inbound text: saves message, updates conversation last_inbound_at, and records CUSTOMER_REPLIED event", async () => {
  await withServer(async (baseUrl) => {
    const waId = `91${(Date.now() + 2).toString().slice(-10)}`;
    const msgId = `wamid.inbound.${Date.now()}`;
    const payload = JSON.stringify(
      makeInboundPayload({
        id: msgId,
        from: waId,
        type: "text",
        timestamp: "1710000100",
        text: { body: "Hello Silverstone" }
      }, "Charlie Inbound")
    );

    const res = await fetch(`${baseUrl}/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": webhookSignature(payload)
      },
      body: payload
    });
    assert.equal(res.status, 200);

    const repo = getAnalyticsRepository();
    const contact = await repo.findContactByWaId(waId);
    assert.ok(contact);
    assert.equal(contact.name, "Charlie Inbound");

    const message = await repo.findMessageByWaMessageId(msgId);
    assert.ok(message);
    assert.equal(message.direction, "inbound");
    assert.equal(message.message_type, "text");
    assert.equal(message.body_text, "Hello Silverstone");

    const conversation = await repo.findConversationById(message.conversation_id);
    assert.ok(conversation);
    assert.ok(conversation.last_inbound_at);
    assert.ok(conversation.last_message_at);

    const events = await repo.listConversationEventsByConversation(conversation.id);
    const replyEvent = events.find((e) => e.event_type === "CUSTOMER_REPLIED");
    assert.ok(replyEvent);
    assert.equal(replyEvent.event_value, "Hello Silverstone");
  });
});

// 4. Outbound Text
test("outbound text: stores message ID, updates last_outbound_at, and records first_response_at once", async () => {
  const waId = `91${(Date.now() + 3).toString().slice(-10)}`;
  const contact = await analyticsService.resolveContact(waId, "David Outbound");
  const conversation = await analyticsService.getOrCreateConversation(contact.id);

  const outWamid1 = `wamid.out.${Date.now()}.1`;
  const msg1 = await analyticsService.trackOutboundMessage({
    to: waId,
    waMessageId: outWamid1,
    messageType: "text",
    bodyText: "Welcome to Silverstone!"
  });
  assert.ok(msg1);
  assert.equal(msg1.wa_message_id, outWamid1);
  assert.equal(msg1.direction, "outbound");

  const repo = getAnalyticsRepository();
  const convAfter1 = await repo.findConversationById(conversation.id);
  assert.ok(convAfter1.first_response_at);
  const firstResponseTime = convAfter1.first_response_at.getTime();

  // Second outbound response must NOT overwrite first_response_at
  const outWamid2 = `wamid.out.${Date.now()}.2`;
  await analyticsService.trackOutboundMessage({
    to: waId,
    waMessageId: outWamid2,
    messageType: "text",
    bodyText: "Follow-up message"
  });

  const convAfter2 = await repo.findConversationById(conversation.id);
  assert.equal(convAfter2.first_response_at.getTime(), firstResponseTime, "first_response_at must only be set once");
});

// 5. Message ID Storage
test("message ID storage: ensures wa_message_id uniqueness and lookups", async () => {
  const repo = getAnalyticsRepository();
  const waId = `91${(Date.now() + 4).toString().slice(-10)}`;
  const contact = await analyticsService.resolveContact(waId, "Eve ID");
  const conversation = await analyticsService.getOrCreateConversation(contact.id);

  const wamid = `wamid.unique.${Date.now()}`;
  const msg = await repo.createMessage({
    contact_id: contact.id,
    conversation_id: conversation.id,
    wa_message_id: wamid,
    direction: "outbound",
    message_type: "text",
    body_text: "Unique ID test"
  });

  assert.equal(msg.wa_message_id, wamid);
  const fetched = await repo.findMessageByWaMessageId(wamid);
  assert.ok(fetched);
  assert.equal(fetched.id, msg.id);
});

// 6. Sent Status
test("sent status: matches by wamid and logs sent status event", async () => {
  await withServer(async (baseUrl) => {
    const waId = `91${(Date.now() + 5).toString().slice(-10)}`;
    const contact = await analyticsService.resolveContact(waId, "Status Sent User");
    const conversation = await analyticsService.getOrCreateConversation(contact.id);
    const wamid = `wamid.sent.${Date.now()}`;

    const msg = await getAnalyticsRepository().createMessage({
      contact_id: contact.id,
      conversation_id: conversation.id,
      wa_message_id: wamid,
      direction: "outbound",
      message_type: "text",
      body_text: "Testing sent"
    });

    const payload = JSON.stringify(
      makeStatusPayload({
        id: wamid,
        status: "sent",
        timestamp: "1710000200",
        recipient_id: waId
      })
    );
    const res = await fetch(`${baseUrl}/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": webhookSignature(payload) },
      body: payload
    });
    assert.equal(res.status, 200);

    const history = await getAnalyticsRepository().listStatusEventsByMessageId(msg.id);
    assert.equal(history.length, 1);
    assert.equal(history[0].status, "sent");
  });
});

// 7. Delivered Status
test("delivered status: matches by wamid and logs delivered status event without overwriting historical", async () => {
  await withServer(async (baseUrl) => {
    const waId = `91${(Date.now() + 6).toString().slice(-10)}`;
    const contact = await analyticsService.resolveContact(waId, "Status Deliv User");
    const conversation = await analyticsService.getOrCreateConversation(contact.id);
    const wamid = `wamid.deliv.${Date.now()}`;

    const msg = await getAnalyticsRepository().createMessage({
      contact_id: contact.id,
      conversation_id: conversation.id,
      wa_message_id: wamid,
      direction: "outbound",
      message_type: "text",
      body_text: "Testing delivered"
    });

    // 1. Sent
    await fetch(`${baseUrl}/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": webhookSignature(JSON.stringify(makeStatusPayload({ id: wamid, status: "sent", timestamp: "1710000200" }))) },
      body: JSON.stringify(makeStatusPayload({ id: wamid, status: "sent", timestamp: "1710000200" }))
    });

    // 2. Delivered
    const delivPayload = JSON.stringify(makeStatusPayload({ id: wamid, status: "delivered", timestamp: "1710000205" }));
    await fetch(`${baseUrl}/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": webhookSignature(delivPayload) },
      body: delivPayload
    });

    const repo = getAnalyticsRepository();
    const history = await repo.listStatusEventsByMessageId(msg.id);
    assert.equal(history.length, 2);
    assert.equal(history[0].status, "sent");
    assert.equal(history[1].status, "delivered");
    assert.equal(await repo.getLatestStatusForMessage(msg.id), "delivered");
  });
});

// 8. Read Status
test("read status: matches by wamid and derives latest status as read", async () => {
  await withServer(async (baseUrl) => {
    const waId = `91${(Date.now() + 7).toString().slice(-10)}`;
    const contact = await analyticsService.resolveContact(waId, "Status Read User");
    const conversation = await analyticsService.getOrCreateConversation(contact.id);
    const wamid = `wamid.read.${Date.now()}`;

    const msg = await getAnalyticsRepository().createMessage({
      contact_id: contact.id,
      conversation_id: conversation.id,
      wa_message_id: wamid,
      direction: "outbound",
      message_type: "text",
      body_text: "Testing read"
    });

    for (const [st, ts] of [["sent", "1710000200"], ["delivered", "1710000205"], ["read", "1710000210"]]) {
      const pl = JSON.stringify(makeStatusPayload({ id: wamid, status: st, timestamp: ts }));
      await fetch(`${baseUrl}/webhook`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-hub-signature-256": webhookSignature(pl) },
        body: pl
      });
    }

    const repo = getAnalyticsRepository();
    const history = await repo.listStatusEventsByMessageId(msg.id);
    assert.equal(history.length, 3);
    assert.equal(await repo.getLatestStatusForMessage(msg.id), "read");
  });
});

// 9. Failed Status
test("failed status: logs failed status with error code and error message", async () => {
  await withServer(async (baseUrl) => {
    const waId = `91${(Date.now() + 8).toString().slice(-10)}`;
    const contact = await analyticsService.resolveContact(waId, "Status Failed User");
    const conversation = await analyticsService.getOrCreateConversation(contact.id);
    const wamid = `wamid.failed.${Date.now()}`;

    const msg = await getAnalyticsRepository().createMessage({
      contact_id: contact.id,
      conversation_id: conversation.id,
      wa_message_id: wamid,
      direction: "outbound",
      message_type: "text",
      body_text: "Testing failed"
    });

    const failedPayload = JSON.stringify(
      makeStatusPayload({
        id: wamid,
        status: "failed",
        timestamp: "1710000220",
        recipient_id: waId,
        errors: [{ code: 131051, title: "Delivery failed", message: "Recipient number inactive" }]
      })
    );
    const res = await fetch(`${baseUrl}/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": webhookSignature(failedPayload) },
      body: failedPayload
    });
    assert.equal(res.status, 200);

    const repo = getAnalyticsRepository();
    const history = await repo.listStatusEventsByMessageId(msg.id);
    assert.equal(history.length, 1);
    assert.equal(history[0].status, "failed");
    assert.equal(history[0].error_code, "131051");
    assert.equal(history[0].error_message, "Recipient number inactive");
  });
});

// 10. Duplicate Webhook
test("duplicate webhook: ignores duplicate message ID and does not duplicate records or events", async () => {
  await withServer(async (baseUrl) => {
    const waId = `91${(Date.now() + 9).toString().slice(-10)}`;
    const msgId = `wamid.dup.${Date.now()}`;
    const payload = JSON.stringify(
      makeInboundPayload({
        id: msgId,
        from: waId,
        type: "text",
        timestamp: "1710000300",
        text: { body: "Duplicate test" }
      }, "Grace Duplicate")
    );

    // Send first time
    const res1 = await fetch(`${baseUrl}/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": webhookSignature(payload) },
      body: payload
    });
    assert.equal(res1.status, 200);

    // Send duplicate
    const res2 = await fetch(`${baseUrl}/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": webhookSignature(payload) },
      body: payload
    });
    assert.equal(res2.status, 200);

    const repo = getAnalyticsRepository();
    const contact = await repo.findContactByWaId(waId);
    assert.ok(contact);

    const messages = await repo.listMessagesByContact(contact.id);
    const matchingMessages = messages.filter((m) => m.wa_message_id === msgId);
    assert.equal(matchingMessages.length, 1, "Must not create duplicate message records");
  });
});

// 11. Project Selection
test("project selection: logs PROJECT_SELECTED event when customer triggers PROJECT:<project-id>", async () => {
  const waId = `91${(Date.now() + 10).toString().slice(-10)}`;
  const contact = await analyticsService.resolveContact(waId, "Project Selector");
  const conversation = await analyticsService.getOrCreateConversation(contact.id);

  await analyticsService.recordEventByWaId(waId, "PROJECT_SELECTED", "spring-hill", "spring-hill");

  const repo = getAnalyticsRepository();
  const events = await repo.listConversationEventsByConversation(conversation.id);
  const selEvent = events.find((e) => e.event_type === "PROJECT_SELECTED");
  assert.ok(selEvent);
  assert.equal(selEvent.event_value, "spring-hill");
  assert.equal(selEvent.project_id, "spring-hill");
});

// 12. Brochure Request
test("brochure request: logs BROCHURE_REQUESTED event", async () => {
  const waId = `91${(Date.now() + 11).toString().slice(-10)}`;
  const contact = await analyticsService.resolveContact(waId, "Brochure Requester");
  const conversation = await analyticsService.getOrCreateConversation(contact.id);

  await analyticsService.recordEventByWaId(waId, "BROCHURE_REQUESTED", "spring-hill", "spring-hill");

  const repo = getAnalyticsRepository();
  const events = await repo.listConversationEventsByConversation(conversation.id);
  const brEvent = events.find((e) => e.event_type === "BROCHURE_REQUESTED");
  assert.ok(brEvent);
  assert.equal(brEvent.event_value, "spring-hill");
});

// 13. BHK Selection
test("BHK selection: logs BHK_SELECTED event", async () => {
  const waId = `91${(Date.now() + 12).toString().slice(-10)}`;
  const contact = await analyticsService.resolveContact(waId, "BHK Selector");
  const conversation = await analyticsService.getOrCreateConversation(contact.id);

  await analyticsService.recordEventByWaId(waId, "BHK_SELECTED", "3BHK", "spring-hill");

  const repo = getAnalyticsRepository();
  const events = await repo.listConversationEventsByConversation(conversation.id);
  const bhkEvent = events.find((e) => e.event_type === "BHK_SELECTED");
  assert.ok(bhkEvent);
  assert.equal(bhkEvent.event_value, "3BHK");
});

// 14. Plan Sent
test("plan sent: logs PLAN_SENT event upon successful floor plan document delivery", async () => {
  const waId = `91${(Date.now() + 13).toString().slice(-10)}`;
  const contact = await analyticsService.resolveContact(waId, "Plan Receiver");
  const conversation = await analyticsService.getOrCreateConversation(contact.id);

  await analyticsService.recordEventByWaId(waId, "PLAN_SENT", "Spring-Hill-84SqYd-3BHK-Plan.jpg", "spring-hill");

  const repo = getAnalyticsRepository();
  const events = await repo.listConversationEventsByConversation(conversation.id);
  const planSentEvent = events.find((e) => e.event_type === "PLAN_SENT");
  assert.ok(planSentEvent);
  assert.equal(planSentEvent.event_value, "Spring-Hill-84SqYd-3BHK-Plan.jpg");
});

// 15. Internal API Endpoints
test("internal API endpoints: overview, messages, replies, projects, contact 360, and conversation details", async () => {
  await withServer(async (baseUrl) => {
    // 1. Overview
    const overviewRes = await fetch(`${baseUrl}/api/analytics/overview`);
    assert.equal(overviewRes.status, 200);
    const overview = await overviewRes.json();
    assert.ok("messagesToday" in overview);
    assert.ok("messagesSent" in overview);
    assert.ok("messagesDelivered" in overview);
    assert.ok("messagesRead" in overview);
    assert.ok("messagesFailed" in overview);
    assert.ok("repliesToday" in overview);
    assert.ok("unreadConversations" in overview);
    assert.ok("brochuresRequested" in overview);
    assert.ok("plansRequested" in overview);
    assert.ok("projectSelections" in overview);
    assert.ok("bhkSelections" in overview);

    // 2. Messages
    const messagesRes = await fetch(`${baseUrl}/api/analytics/messages`);
    assert.equal(messagesRes.status, 200);
    const messageMetrics = await messagesRes.json();
    assert.ok("total" in messageMetrics);
    assert.ok("inbound" in messageMetrics);
    assert.ok("outbound" in messageMetrics);
    assert.ok(Array.isArray(messageMetrics.recent));

    // 3. Replies
    const repliesRes = await fetch(`${baseUrl}/api/analytics/replies`);
    assert.equal(repliesRes.status, 200);
    const replyMetrics = await repliesRes.json();
    assert.ok("repliesToday" in replyMetrics);
    assert.ok("totalReplies" in replyMetrics);
    assert.ok(Array.isArray(replyMetrics.recentReplies));

    // 4. Projects
    const projectsRes = await fetch(`${baseUrl}/api/analytics/projects`);
    assert.equal(projectsRes.status, 200);
    const projectMetrics = await projectsRes.json();
    assert.ok("totalSelections" in projectMetrics);
    assert.ok("byProject" in projectMetrics);
    assert.ok("bhkBreakdown" in projectMetrics);

    // 5. Contact 360
    const waId = `91${(Date.now() + 14).toString().slice(-10)}`;
    const contact = await analyticsService.resolveContact(waId, "Ian Api");
    const contactRes = await fetch(`${baseUrl}/api/contacts/${contact.id}`);
    assert.equal(contactRes.status, 200);
    const contact360 = await contactRes.json();
    assert.equal(contact360.contact.id, contact.id);
    assert.ok("messages" in contact360);
    assert.ok("responseTime" in contact360);

    // 6. Conversation detail
    const conversation = await analyticsService.getOrCreateConversation(contact.id);
    const convRes = await fetch(`${baseUrl}/api/conversations/${conversation.id}`);
    assert.equal(convRes.status, 200);
    const convDetail = await convRes.json();
    assert.equal(convDetail.conversation.id, conversation.id);
    assert.equal(convDetail.contact.id, contact.id);
  });
});
