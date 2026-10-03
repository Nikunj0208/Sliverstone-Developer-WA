import assert from "node:assert/strict";
import test from "node:test";

import { sendMainMenu } from "../dist/src/flows/main-menu.js";

test("main menu sends interactive reply buttons in approved order", async () => {
  const calls = [];

  await sendMainMenu("test-user", {
    sendReplyButtons: async (_to, body, buttons) => {
      calls.push(["reply", body, buttons]);
      return { httpStatus: 200 };
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "reply");
  assert.deepEqual(calls[0][2], [
    { id: "MAIN_VIEW_PROJECTS", title: "View Projects" },
    { id: "MAIN_CHAT", title: "Chat" },
    { id: "MAIN_CALL", title: "Call" }
  ]);
});
