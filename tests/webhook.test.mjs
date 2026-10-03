import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { createApp } from "../dist/src/app.js";
import { env } from "../dist/src/config/env.js";
import { parseWebhookEvents } from "../dist/src/webhooks/parser.js";

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

function signature(body) {
  return `sha256=${createHmac("sha256", env.metaAppSecret).update(body).digest("hex")}`;
}

function webhookPayload(message) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              messages: [message]
            }
          }
        ]
      }
    ]
  };
}

test("GET /webhook returns the challenge for a valid verification request", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(env.webhookVerifyToken)}&hub.challenge=challenge-value`
    );

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "challenge-value");
  });
});

test("GET /webhook rejects an invalid verification token", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/webhook?hub.mode=subscribe&hub.verify_token=invalid-token&hub.challenge=challenge-value`
    );

    assert.equal(response.status, 403);
  });
});

test("POST /webhook parses a text message", async () => {
  const body = JSON.stringify(
    webhookPayload({ id: "message-text", from: "test-user", type: "text", text: { body: "Hello" } })
  );
  assert.deepEqual(parseWebhookEvents(JSON.parse(body)), [
    { type: "TEXT", waId: "test-user", messageId: "message-text", text: "Hello" }
  ]);

  await withServer(async (baseUrl) => {
    const deliveryBody = JSON.stringify(
      webhookPayload({ id: "message-status", status: "sent" })
    );
    const response = await fetch(`${baseUrl}/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": signature(deliveryBody) },
      body: deliveryBody
    });

    assert.equal(response.status, 200);
  });
});

test("POST /webhook parses an interactive button reply", async () => {
  const body = JSON.stringify(
    webhookPayload({
      id: "message-button",
      from: "test-user",
      type: "interactive",
      interactive: { type: "button_reply", button_reply: { id: "button-id" } }
    })
  );
  assert.deepEqual(parseWebhookEvents(JSON.parse(body)), [
    { type: "BUTTON_REPLY", waId: "test-user", messageId: "message-button", buttonId: "button-id" }
  ]);

  await withServer(async (baseUrl) => {
    const deliveryBody = JSON.stringify(
      webhookPayload({ id: "message-status", status: "sent" })
    );
    const response = await fetch(`${baseUrl}/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": signature(deliveryBody) },
      body: deliveryBody
    });

    assert.equal(response.status, 200);
  });
});

test("POST /webhook parses an interactive list reply", async () => {
  const body = JSON.stringify(
    webhookPayload({
      id: "message-list",
      from: "test-user",
      type: "interactive",
      interactive: { type: "list_reply", list_reply: { id: "row-id" } }
    })
  );
  assert.deepEqual(parseWebhookEvents(JSON.parse(body)), [
    { type: "LIST_REPLY", waId: "test-user", messageId: "message-list", rowId: "row-id" }
  ]);

  await withServer(async (baseUrl) => {
    const deliveryBody = JSON.stringify(
      webhookPayload({ id: "message-status", status: "sent" })
    );
    const response = await fetch(`${baseUrl}/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": signature(deliveryBody) },
      body: deliveryBody
    });

    assert.equal(response.status, 200);
  });
});
