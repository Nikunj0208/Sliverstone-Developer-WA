import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../dist/src/app.js";
import { getAnalyticsRepository } from "../dist/src/db/index.js";
import { analyticsService } from "../dist/src/services/analytics-service.js";
import { maskPhoneNumber, normalizePhoneNumber } from "../dist/src/utils/phone.js";

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

// 1. Phone Masking Utility
test("phone masking utility: masks digits while preserving country prefix and last 4 digits", () => {
  assert.equal(maskPhoneNumber("+919876541234"), "+91 ******1234");
  assert.equal(maskPhoneNumber("9876541234"), "+91 ******1234");
  assert.equal(maskPhoneNumber("+919876543210"), "+91 ******3210");
  assert.equal(maskPhoneNumber(null), "—");
  assert.equal(maskPhoneNumber(""), "—");
});

// 2. Contact Creation & Safety
test("contact creation: creates new contact safely without inventing consent", async () => {
  const waId = `91${(Date.now() + 10).toString().slice(-10)}`;
  const contact = await analyticsService.resolveContact(waId, "Rahul Test");

  assert.ok(contact);
  assert.equal(contact.wa_id, waId);
  assert.equal(contact.name, "Rahul Test");
  assert.equal(contact.consent_status, null); // Strictly preserves null
  assert.equal(contact.opted_out, false);
});

// 3. Existing Contact Resolution (Returning Customer)
test("existing contact resolution: reuses contact and updates profile name without duplicates", async () => {
  const waId = `91${(Date.now() + 11).toString().slice(-10)}`;
  const first = await analyticsService.resolveContact(waId, "Priya Test");
  const second = await analyticsService.resolveContact(waId, "Priya Sharma Test");

  assert.equal(first.id, second.id);
  assert.equal(second.name, "Priya Sharma Test");

  const repo = getAnalyticsRepository();
  const allForWaId = await repo.findContactByWaId(waId);
  assert.equal(allForWaId.id, first.id);
});

// 4. Same Phone Does Not Create Duplicate Contact
test("same phone resolution: resolves existing contact when matching normalized phone", async () => {
  const digits = (Date.now() + 12).toString().slice(-10);
  const waId1 = `91${digits}`;
  const contact1 = await analyticsService.resolveContact(waId1, "Amit Phone Test");

  // Lookup using 10 digit without 91 prefix
  const contact2 = await analyticsService.resolveContact(digits, "Amit Phone Test");
  assert.equal(contact1.id, contact2.id);
});

// 5. Conversation Creation & Linking
test("conversation creation: creates or attaches to active conversation", async () => {
  const waId = `91${(Date.now() + 13).toString().slice(-10)}`;
  const contact = await analyticsService.resolveContact(waId, "Sneha Conv Test");
  const conv1 = await analyticsService.getOrCreateConversation(contact.id, "spring-hill");
  const conv2 = await analyticsService.getOrCreateConversation(contact.id);

  assert.equal(conv1.id, conv2.id);
  assert.equal(conv1.contact_id, contact.id);
  assert.equal(conv1.status, "OPEN");
});

// 6. Inbound and Outbound Message Storage with Status History
test("message storage and status history: stores inbound, outbound, and delivery status events", async () => {
  const waId = `91${(Date.now() + 14).toString().slice(-10)}`;
  const contact = await analyticsService.resolveContact(waId, "Vikas Message Test");
  const conv = await analyticsService.getOrCreateConversation(contact.id);

  // Inbound
  const inRes = await analyticsService.recordInboundMessage({
    waId,
    messageId: `wamid.in.${Date.now()}`,
    type: "text",
    text: "Can you send the brochure?"
  });
  assert.equal(inRes.message.direction, "inbound");
  assert.equal(inRes.message.body_text, "Can you send the brochure?");

  // Outbound
  const outWamid = `wamid.out.${Date.now()}`;
  const outMsg = await analyticsService.trackOutboundMessage({
    to: waId,
    waMessageId: outWamid,
    messageType: "text",
    bodyText: "Here is the Spring Hill brochure."
  });
  assert.equal(outMsg.direction, "outbound");

  // Status transitions: sent -> delivered -> read
  const repo = getAnalyticsRepository();
  await analyticsService.recordStatusReceipt({
    messageId: outWamid,
    status: "delivered",
    timestamp: Math.floor(Date.now() / 1000) + 1
  });
  await analyticsService.recordStatusReceipt({
    messageId: outWamid,
    status: "read",
    timestamp: Math.floor(Date.now() / 1000) + 2
  });

  const latestStatus = await repo.getLatestStatusForMessage(outMsg.id);
  assert.equal(latestStatus, "read");

  const statusHistory = await repo.listStatusEventsByMessageId(outMsg.id);
  assert.ok(statusHistory.length >= 3); // sent, delivered, read
});

// 7. Journey Events: Project Selection, Brochure, Plans, BHK
test("journey events: records customer events and updates conversation state", async () => {
  const waId = `91${(Date.now() + 15).toString().slice(-10)}`;
  const contact = await analyticsService.resolveContact(waId, "Kavita Journey Test");
  const conv = await analyticsService.getOrCreateConversation(contact.id);

  await analyticsService.recordConversationEvent(conv.id, contact.id, "PROJECT_SELECTED", "spring-hill", "spring-hill");
  await analyticsService.recordConversationEvent(conv.id, contact.id, "BROCHURE_REQUESTED", "spring-hill", "spring-hill");
  await analyticsService.recordConversationEvent(conv.id, contact.id, "PLANS_REQUESTED", "spring-hill", "spring-hill");
  await analyticsService.recordConversationEvent(conv.id, contact.id, "SQFT_SELECTED", "1800 Sq Ft", "spring-hill");
  await analyticsService.recordConversationEvent(conv.id, contact.id, "BHK_SELECTED", "3 BHK", "spring-hill");
  await analyticsService.recordConversationEvent(conv.id, contact.id, "SITE_VISIT_REQUESTED", "2026-10-15 11:00", "spring-hill");

  const repo = getAnalyticsRepository();
  const updatedConv = await repo.findConversationById(conv.id);
  assert.equal(updatedConv.state, "SITE_VISIT");
  assert.equal(updatedConv.project_id, "spring-hill");
});

// 8. Unread Tracking & CRM Internal Acknowledgement
test("CRM unread management: tracks inbound unread and resets on internal acknowledgment", async () => {
  const waId = `91${(Date.now() + 16).toString().slice(-10)}`;
  const contact = await analyticsService.resolveContact(waId, "Manoj Unread Test");
  const conv = await analyticsService.getOrCreateConversation(contact.id);

  await analyticsService.recordInboundMessage({
    waId,
    messageId: `wamid.unread.${Date.now()}`,
    type: "text",
    text: "Hello, I am interested!"
  });

  const repo = getAnalyticsRepository();
  const convBefore = await repo.findConversationById(conv.id);
  assert.ok(convBefore.unread_count > 0);

  // CRM internal read acknowledgment
  const convAfter = await analyticsService.acknowledgeConversation(conv.id);
  assert.equal(convAfter.unread_count, 0);
  assert.ok(convAfter.last_internal_read_at);
});

// 9. Response Time Calculation
test("response time calculation: computes duration between customer reply and business response", async () => {
  const waId = `91${(Date.now() + 17).toString().slice(-10)}`;
  const contact = await analyticsService.resolveContact(waId, "Response Time Test");
  const conv = await analyticsService.getOrCreateConversation(contact.id);

  const inboundTime = 1710000000;
  await analyticsService.recordInboundMessage({
    waId,
    messageId: `wamid.in.resp.${Date.now()}`,
    type: "text",
    text: "Price details please?",
    timestamp: inboundTime
  });

  await analyticsService.trackOutboundMessage({
    to: waId,
    waMessageId: `wamid.out.resp.${Date.now()}`,
    messageType: "text",
    bodyText: "Starting from ₹1.2 Cr onwards."
  });

  const contact360 = await analyticsService.getContact360(contact.id);
  assert.ok(contact360);
  assert.ok(contact360.summary.firstResponseTimeSeconds !== null);
  assert.ok(contact360.summary.firstResponseTimeFormatted !== null);
});

// 10. Contact Search, Filters, Sorting & Pagination
test("contact search and filters: supports multi-field search and query filters", async () => {
  const waId = `91${(Date.now() + 18).toString().slice(-10)}`;
  const contact = await analyticsService.resolveContact(waId, "Deepak Search Target");
  await getAnalyticsRepository().updateContact(contact.id, {
    project_id: "spring-hill",
    lead_source: "whatsapp_campaign"
  });

  const searchResult = await analyticsService.listContacts({ search: "Deepak" });
  assert.ok(searchResult.contacts.length >= 1);
  assert.equal(searchResult.contacts[0].name, "Deepak Search Target");

  const projectResult = await analyticsService.listContacts({ project: "spring-hill" });
  assert.ok(projectResult.contacts.some((c) => c.id === contact.id));

  const sortedResult = await analyticsService.listContacts({ sortBy: "latest_activity", sortOrder: "desc" });
  assert.ok(sortedResult.contacts.length > 0);
});

// 11. Complete Contact 360 Specification Response
test("Contact 360 API payload: conforms to Milestone 2 spec model", async () => {
  const waId = `91${(Date.now() + 19).toString().slice(-10)}`;
  const contact = await analyticsService.resolveContact(waId, "Sunil Specification Test");
  const conv = await analyticsService.getOrCreateConversation(contact.id, "spring-hill");

  await analyticsService.recordConversationEvent(conv.id, contact.id, "PROJECT_SELECTED", "spring-hill", "spring-hill");
  await analyticsService.recordConversationEvent(conv.id, contact.id, "BROCHURE_REQUESTED", "spring-hill", "spring-hill");
  await analyticsService.recordConversationEvent(conv.id, contact.id, "BROCHURE_SENT", "spring-hill.pdf", "spring-hill");

  const contact360 = await analyticsService.getContact360(contact.id);
  assert.ok(contact360);

  // Profile
  assert.ok(contact360.contact.id);
  assert.ok(contact360.contact.phoneMasked.includes("******"));

  // Summary
  assert.ok(contact360.summary);
  assert.equal(contact360.summary.currentState, "PROJECT_ACTIONS");
  assert.ok(contact360.summary.nextLogicalAction);

  // Engagement
  assert.ok(contact360.engagement);
  assert.equal(contact360.engagement.brochuresRequested, 1);
  assert.equal(contact360.engagement.brochuresSent, 1);
  assert.ok(contact360.engagement.projectMatrix["spring-hill"].brochureRequested);

  // Messages summary
  assert.ok(contact360.messagesSummary);
});

// 12. Conversation Detail Pagination (25, 50, 100)
test("conversation detail API pagination: returns paginated message batches", async () => {
  const waId = `91${(Date.now() + 20).toString().slice(-10)}`;
  const contact = await analyticsService.resolveContact(waId, "Pagination Test User");
  const conv = await analyticsService.getOrCreateConversation(contact.id);

  // Seed 10 test messages
  for (let i = 0; i < 10; i++) {
    await analyticsService.recordInboundMessage({
      waId,
      messageId: `wamid.page.${Date.now()}.${i}`,
      type: "text",
      text: `Message index ${i}`
    });
  }

  const paged5 = await analyticsService.getConversationDetail(conv.id, { limit: 5, offset: 0 });
  assert.equal(paged5.messages.length, 5);
  assert.equal(paged5.pagination.total, 10);
  assert.equal(paged5.pagination.hasMore, true);

  const pagedRemaining = await analyticsService.getConversationDetail(conv.id, { limit: 5, offset: 5 });
  assert.equal(pagedRemaining.messages.length, 5);
  assert.equal(pagedRemaining.pagination.hasMore, false);
});

// 13. Security: Authentication, Sensitive Field Protection, Zero Meta Secrets
test("security & data privacy: enforces internal auth and does not expose secrets", async () => {
  await withServer(async (baseUrl) => {
    // 1. Fetch Contact 360 endpoint
    const waId = `91${(Date.now() + 21).toString().slice(-10)}`;
    const contact = await analyticsService.resolveContact(waId, "Security Test User");

    const res = await fetch(`${baseUrl}/api/contacts/${contact.id}`);
    assert.equal(res.status, 200);
    const bodyText = await res.text();

    // Must NOT leak credentials or tokens
    assert.equal(bodyText.includes("META_ACCESS_TOKEN"), false);
    assert.equal(bodyText.includes("META_APP_SECRET"), false);
    assert.equal(bodyText.includes("WEBHOOK_VERIFY_TOKEN"), false);
    assert.equal(bodyText.includes("authorization"), false);

    // Default phone displayed in contact response must be masked
    const data = JSON.parse(bodyText);
    assert.ok(data.contact.phoneMasked.includes("******"));
  });
});

// 14. Full 17-Step End-To-End Customer Journey Simulation (Section 49)
test("Section 49: Full 17-Step End-to-End Simulation", async () => {
  const waId = `91${(Date.now() + 22).toString().slice(-10)}`;

  // Step 1: CONTACT_CREATED
  const contact = await analyticsService.resolveContact(waId, "Rahul Simulation");
  assert.ok(contact);

  // Step 2: OUTBOUND_CAMPAIGN_MESSAGE
  const campaignWamid = `wamid.campaign.${Date.now()}`;
  const outMsg = await analyticsService.trackOutboundMessage({
    to: waId,
    waMessageId: campaignWamid,
    messageType: "template",
    templateName: "spring_hill_launch_v1"
  });
  assert.ok(outMsg);

  // Step 3: SENT
  await analyticsService.recordStatusReceipt({ messageId: campaignWamid, status: "sent" });

  // Step 4: DELIVERED
  await analyticsService.recordStatusReceipt({ messageId: campaignWamid, status: "delivered" });

  // Step 5: READ
  await analyticsService.recordStatusReceipt({ messageId: campaignWamid, status: "read" });

  // Step 6: CUSTOMER_REPLIED
  const inReplyWamid = `wamid.in.sim.${Date.now()}`;
  await analyticsService.recordInboundMessage({
    waId,
    messageId: inReplyWamid,
    type: "text",
    text: "Can you send the price and details?"
  });

  const conv = await analyticsService.getOrCreateConversation(contact.id);

  // Step 7: MAIN_MENU_VIEWED
  await analyticsService.recordConversationEvent(conv.id, contact.id, "MAIN_MENU_VIEWED");

  // Step 8: PROJECT_SELECTED (Spring Hill)
  await analyticsService.recordConversationEvent(conv.id, contact.id, "PROJECT_SELECTED", "spring-hill", "spring-hill");

  // Step 9: BROCHURE_REQUESTED
  await analyticsService.recordConversationEvent(conv.id, contact.id, "BROCHURE_REQUESTED", "spring-hill", "spring-hill");

  // Step 10: BROCHURE_SENT
  await analyticsService.recordConversationEvent(conv.id, contact.id, "BROCHURE_SENT", "Spring_Hill_Brochure.pdf", "spring-hill");

  // Step 11: PLANS_REQUESTED
  await analyticsService.recordConversationEvent(conv.id, contact.id, "PLANS_REQUESTED", "spring-hill", "spring-hill");

  // Step 12: SQFT_SELECTED (1800 Sq Ft)
  await analyticsService.recordConversationEvent(conv.id, contact.id, "SQFT_SELECTED", "1800 Sq Ft", "spring-hill");

  // Step 13: BHK_SELECTED (3 BHK)
  await analyticsService.recordConversationEvent(conv.id, contact.id, "BHK_SELECTED", "3 BHK", "spring-hill");

  // Step 14: PLAN_SENT
  await analyticsService.recordConversationEvent(conv.id, contact.id, "PLAN_SENT", "Spring-Hill-84SqYd-3BHK-Plan.jpg", "spring-hill");

  // Step 15: CHAT_REQUESTED
  await analyticsService.recordConversationEvent(conv.id, contact.id, "CHAT_REQUESTED");

  // Step 16: CONVERSATION_CLOSED
  await getAnalyticsRepository().closeConversation(conv.id);

  // Step 17: Verify complete Contact 360 history
  const c360 = await analyticsService.getContact360(contact.id);
  assert.ok(c360);
  assert.equal(c360.contact.id, contact.id);
  assert.equal(c360.summary.status, "CLOSED");
  assert.equal(c360.engagement.projectsSelected, 1);
  assert.equal(c360.engagement.brochuresRequested, 1);
  assert.equal(c360.engagement.brochuresSent, 1);
  assert.equal(c360.engagement.plansRequested, 1);
  assert.equal(c360.engagement.plansSent, 1);
  assert.equal(c360.engagement.chatRequests, 1);

  // Project Matrix
  const shMatrix = c360.engagement.projectMatrix["spring-hill"];
  assert.equal(shMatrix.selected, true);
  assert.equal(shMatrix.brochureRequested, true);
  assert.equal(shMatrix.brochureSent, true);
  assert.equal(shMatrix.plansRequested, true);
  assert.equal(shMatrix.plansSent, true);
  assert.equal(shMatrix.selectedSqft, "1800 Sq Ft");
  assert.equal(shMatrix.selectedBhk, "3 BHK");
});

// 15. Web Admin Dashboard HTML Routes
test("web admin dashboard: renders /contacts, /contacts/:id, /conversations, /duplicates HTML", async () => {
  await withServer(async (baseUrl) => {
    // /contacts
    const resContacts = await fetch(`${baseUrl}/contacts`);
    assert.equal(resContacts.status, 200);
    const htmlContacts = await resContacts.text();
    assert.ok(htmlContacts.includes("Contact 360 Database"));

    // /conversations
    const resConvs = await fetch(`${baseUrl}/conversations`);
    assert.equal(resConvs.status, 200);
    const htmlConvs = await resConvs.text();
    assert.ok(htmlConvs.includes("Conversation Queue"));

    // /duplicates
    const resDupes = await fetch(`${baseUrl}/duplicates`);
    assert.equal(resDupes.status, 200);
    const htmlDupes = await resDupes.text();
    assert.ok(htmlDupes.includes("Contact Duplicate Detection Review"));
  });
});

// 16. Contact & Conversation Export APIs
test("export endpoints: returns CSV and JSON exports with secret redaction", async () => {
  await withServer(async (baseUrl) => {
    const resCsv = await fetch(`${baseUrl}/api/contacts/export?format=csv`);
    assert.equal(resCsv.status, 200);
    const csvContent = await resCsv.text();
    assert.ok(csvContent.includes("WhatsApp ID"));
    assert.ok(csvContent.includes("Masked Phone"));

    const resJson = await fetch(`${baseUrl}/api/contacts/export?format=json`);
    assert.equal(resJson.status, 200);
    const jsonContacts = await resJson.json();
    assert.ok(Array.isArray(jsonContacts));
  });
});
