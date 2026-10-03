import assert from "node:assert/strict";
import test from "node:test";

import { sendLocationHighlights, sendWelcomeFlow } from "../dist/src/flows/welcome.js";

test("a normal inbound text sends the configured welcome sequence", async () => {
  const calls = [];

  await sendWelcomeFlow("test-user", {
    sendImage: async (_to, imagePath, caption) => {
      calls.push(["image", imagePath, caption]);
      return { httpStatus: 200 };
    },
    sendCtaUrl: async (_to, body, button, url) => {
      calls.push(["cta", body, button, url]);
      return { httpStatus: 200 };
    },
    sendText: async (_to, welcomeMessage) => {
      calls.push(["text", welcomeMessage]);
      return { httpStatus: 200 };
    },
    sendMainMenu: async () => {
      calls.push(["menu"]);
    },
    sendWelcomeTemplate: async () => {
      throw new Error("Template unavailable in fallback test.");
    }
  });

  assert.deepEqual(calls.map(([type]) => type), ["image", "cta", "cta", "menu"]);
  assert.equal(calls[0][1].includes("Welcome image.jpeg"), true);
  assert.equal(calls[1][1].replace(/\u00A0/g, " ").includes("SILVERSTONE DEVELOPERS"), true);
  assert.equal(calls[1][1].includes("https://"), false);
  assert.equal(calls[1][1].includes("WhatsApp Message Copy:"), false);
  assert.equal(calls[1][2], "Open Location");
  assert.equal(calls[1][3].startsWith("https://maps.google.com"), true);
  assert.equal(calls[2][1].includes("LOCATION HIGHLIGHTS"), true);
  assert.equal(calls[2][2], "▶ Watch Area Video");
  assert.equal(calls[2][3], "https://youtu.be/K_j_2J0510A");
});

test("sendLocationHighlights sends the detailed location message and video CTA", async () => {
  const calls = [];

  await sendLocationHighlights("test-user", {
    sendText: async (_to, message) => {
      calls.push(["text", message]);
      return { httpStatus: 200 };
    },
    sendCtaUrl: async (_to, body, button, url) => {
      calls.push(["cta", body, button, url]);
      return { httpStatus: 200 };
    }
  });

  assert.deepEqual(calls.map(([type]) => type), ["cta"]);
  assert.equal(calls[0][1].includes("LOCATION HIGHLIGHTS"), true);
  assert.equal(calls[0][2], "▶ Watch Area Video");
  assert.equal(calls[0][3], "https://youtu.be/K_j_2J0510A");
});

