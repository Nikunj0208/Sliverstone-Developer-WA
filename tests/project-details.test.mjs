import assert from "node:assert/strict";
import test from "node:test";

import projects from "../data/projects.json" with { type: "json" };
import { sendProjectDetails } from "../dist/src/flows/projects.js";

function createDependencies() {
  const calls = [];
  return {
    calls,
    dependencies: {
      async sendImage(_to, imagePath, caption) {
        calls.push(["image", imagePath, caption]);
      },
      async sendText(_to, text) {
        calls.push(["text", text]);
      },
      async sendCtaUrl(_to, body, button, url) {
        calls.push(["cta", body, button, url]);
        return { httpStatus: 200 };
      },
      async sendDocument(_to, documentPath, filename) {
        calls.push(["document", documentPath, filename]);
      },
      async sendReplyButtons(_to, body, buttons) {
        calls.push(["actions", body, buttons]);
      },
      logMissing(projectId, contentType) {
        calls.push(["missing", projectId, contentType]);
      }
    }
  };
}

for (const project of projects) {
  test(`PROJECT:${project.id} sends the approved project sequence`, async () => {
    const { calls, dependencies } = createDependencies();

    const found = await sendProjectDetails("recipient", project.id, dependencies);

    assert.equal(found, true);

    if (project.id === "rajmahal") {
      const actionCalls = calls.filter((call) => call[0] === "actions");
      assert.deepEqual(calls.map((call) => call[0]), ["image", "missing", "actions", "cta", "missing", "actions"]);
      assert.deepEqual(actionCalls[0][2], [
        { id: "DOWNLOAD_BROCHURE:rajmahel", title: "📄 Brochure" },
        { id: "MAIN_CHAT", title: "💬 Chat" }
      ]);
      assert.deepEqual(actionCalls[1][2], [{ id: "MAIN_CALL", title: "📞 Call" }]);
      assert.deepEqual(calls.find((call) => call[0] === "cta"), [
        "cta",
        "📍 Project Location",
        "📍 Open Location",
        project.locationUrl
      ]);
      assert.equal(calls.some((call) => call[0] === "document"), false);
      return;
    }

    if (project.id === "spring-hill") {
      const actionCalls = calls.filter((call) => call[0] === "actions");
      assert.deepEqual(calls.map((call) => call[0]), ["image", "missing", "actions", "cta", "cta", "actions"]);
      assert.deepEqual(actionCalls[0][2], [
        { id: "DOWNLOAD_BROCHURE:spring-hill", title: "📄 Brochure" },
        { id: "MAIN_CHAT", title: "💬 Chat" }
      ]);
      assert.deepEqual(actionCalls[1][2], [{ id: "MAIN_CALL", title: "📞 Call" }]);
      assert.deepEqual(calls.find((call) => call[0] === "cta"), [
        "cta",
        "📍 Project Location",
        "📍 Open Location",
        project.locationUrl
      ]);
      assert.equal(calls.some((call) => call[0] === "document"), false);
      return;
    }

    const imageCall = calls.find((call) => call[0] === "image");
    const descriptionCall = calls.find((call) => call[0] === "text");
    const locationCall = calls.find((call) => call[0] === "cta" && call[1] === "📍 Project Location");
    const videoCall = calls.find((call) => call[0] === "cta" && call[1] === "▶ Project Video");
    const brochureCall = calls.find((call) => call[0] === "document");
    const actionsCall = calls.at(-1);

    if (project.imagePath) {
      assert.equal(imageCall[0], "image");
      assert.equal(imageCall[1], project.imagePath);
      assert.equal(imageCall[2], project.description);
    } else {
      assert.deepEqual(calls.find((call) => call[2] === "image"), ["missing", project.id, "image"]);
    }

    if (!project.imagePath && project.description) {
      assert.deepEqual(descriptionCall, ["text", project.description]);
    }

    if (project.locationUrl) assert.deepEqual(locationCall, ["cta", "📍 Project Location", "Open Location", project.locationUrl]);
    else assert.deepEqual(calls.find((call) => call[2] === "location"), ["missing", project.id, "location"]);
    if (project.videoUrl) assert.deepEqual(videoCall, ["cta", "▶ Project Video", "Watch Video", project.videoUrl]);
    else assert.deepEqual(calls.find((call) => call[2] === "video"), ["missing", project.id, "video"]);
    if (project.brochurePath) assert.deepEqual(brochureCall, ["document", project.brochurePath, `${project.name}-Brochure.pdf`]);
    else assert.deepEqual(calls.find((call) => call[2] === "brochure"), ["missing", project.id, "brochure"]);

    assert.equal(actionsCall[0], "actions");
    assert.equal(actionsCall[1], project.name);
    assert.deepEqual(actionsCall[2], [
      { id: "MAIN_VIEW_PROJECTS", title: "View Projects" },
      { id: "MAIN_CHAT", title: "Chat" },
      { id: `BOOK_SITE_VISIT:${project.id}`, title: "Book Site Visit" }
    ]);

    const visibleSequence = calls
      .filter((call) => call[0] !== "missing")
      .map((call) => call[0]);
    const expectedSequence = [
      ...(project.imagePath ? ["image"] : project.description ? ["text"] : []),
      ...(project.locationUrl ? ["cta"] : []),
      ...(project.videoUrl ? ["cta"] : []),
      ...(project.brochurePath ? ["document"] : []),
      "actions"
    ];
    assert.deepEqual(visibleSequence, expectedSequence);

    for (const call of calls) {
      const customerText = call.filter((value) => typeof value === "string");
      assert.equal(customerText.some((value) => value.includes("WhatsApp Message Copy:")), false);
      assert.equal(customerText.some((value) => value.includes("Please select an option.")), false);
    }

    if (descriptionCall) {
      assert.equal(descriptionCall[1].includes("http://"), false);
      assert.equal(descriptionCall[1].includes("https://"), false);
    }

    for (const ctaCall of calls.filter((call) => call[0] === "cta")) {
      assert.equal(ctaCall[1].includes("http://"), false);
      assert.equal(ctaCall[1].includes("https://"), false);
    }
  });
}

test("invalid project ID is rejected without sending content", async () => {
  const { calls, dependencies } = createDependencies();

  const found = await sendProjectDetails("recipient", "not-a-project", dependencies);

  assert.equal(found, false);
  assert.deepEqual(calls, [["missing", "not-a-project", "project"]]);
});
