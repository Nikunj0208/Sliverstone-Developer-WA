import assert from "node:assert/strict";
import test from "node:test";

import { enqueueConversationAction } from "../dist/src/flows/conversation-queue.js";
import { acceptIncomingMessage } from "../dist/src/webhooks/dedupe.js";

test("conversation queue preserves outgoing action order for one customer", async () => {
  const sent = [];
  let releaseFirst;
  const first = enqueueConversationAction("test-customer", async () => {
    sent.push("image");
    await new Promise((resolve) => {
      releaseFirst = resolve;
    });
    sent.push("description");
  });
  const second = enqueueConversationAction("test-customer", async () => {
    sent.push("location");
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(sent, ["image"]);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(sent, ["image", "description", "location"]);
});

test("duplicate inbound message IDs are ignored", () => {
  assert.equal(acceptIncomingMessage("dedupe-test", 1_000), true);
  assert.equal(acceptIncomingMessage("dedupe-test", 1_001), false);
  assert.equal(acceptIncomingMessage("dedupe-test", 700_001), true);
});
