import assert from "node:assert/strict";
import test from "node:test";

import { MetaApiRequestError, sendCtaUrl } from "../dist/src/meta/messages.js";

function createClient({ response, error } = {}) {
  const calls = [];
  return {
    calls,
    client: {
      async post(path, payload) {
        calls.push({ path, payload });
        if (error) {
          throw error;
        }
        return response ?? { status: 200, data: { messages: [{ id: "wamid-test" }] } };
      }
    }
  };
}

test("sendCtaUrl sends a valid CTA URL without placing it in the body", async () => {
  const { client, calls } = createClient();
  const url = "https://maps.example.test/location?project=spring-hill";

  const result = await sendCtaUrl("recipient", "📍 Project Location", "Open Location", url, client);

  assert.deepEqual(result, { httpStatus: 200, metaMessageId: "wamid-test" });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].payload, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: "recipient",
    type: "interactive",
    interactive: {
      type: "cta_url",
      body: { text: "📍 Project Location" },
      action: {
        name: "cta_url",
        parameters: { display_text: "Open Location", url }
      }
    }
  });
  assert.equal(calls[0].payload.interactive.body.text.includes(url), false);
});

test("sendCtaUrl skips a missing URL", async () => {
  const { client, calls } = createClient();

  const result = await sendCtaUrl("recipient", "▶ Project Video", "Watch Video", "", client);

  assert.equal(result, null);
  assert.equal(calls.length, 0);
});

test("sendCtaUrl skips a malformed URL", async () => {
  const { client, calls } = createClient();

  const result = await sendCtaUrl(
    "recipient",
    "▶ Project Video",
    "Watch Video",
    "not a URL",
    client
  );

  assert.equal(result, null);
  assert.equal(calls.length, 0);
});

test("sendCtaUrl reports a safe Meta API failure", async () => {
  const apiError = Object.assign(new Error("ignored"), {
    isAxiosError: true,
    response: {
      status: 400,
      data: {
        error: {
          code: 100,
          message: "CTA URL is invalid."
        }
      }
    }
  });
  const { client } = createClient({ error: apiError });

  await assert.rejects(
    () => sendCtaUrl("recipient", "📍 Project Location", "Open Location", "https://example.test", client),
    (error) =>
      error instanceof MetaApiRequestError &&
      error.httpStatus === 400 &&
      error.metaErrorCode === 100 &&
      error.message === "CTA URL is invalid."
  );
});
