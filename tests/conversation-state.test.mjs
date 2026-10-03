import assert from "node:assert/strict";
import test from "node:test";

import {
  getConversationHandoff,
  markChatHandoff,
  markSiteVisitHandoff
} from "../dist/src/flows/conversation-state.js";

test("chat marks a conversation for future human handling", () => {
  markChatHandoff("test-chat");
  assert.equal(getConversationHandoff("test-chat")?.mode, "chat");
});

test("site visit handoff preserves the selected project", () => {
  markSiteVisitHandoff("test-site-visit", "spring-hill");
  assert.deepEqual(getConversationHandoff("test-site-visit"), {
    mode: "site-visit",
    projectId: "spring-hill",
    markedAt: getConversationHandoff("test-site-visit")?.markedAt
  });
});
