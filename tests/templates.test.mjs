import assert from "node:assert/strict";
import test from "node:test";

import projects from "../data/projects.json" with { type: "json" };
import { buildProjectCard } from "../dist/src/layouts/project-card.js";
import { buildProjectTemplateComponents, sendTemplate } from "../dist/src/meta/templates.js";

test("sendTemplate sends a template payload with stable quick-reply components", async () => {
  const calls = [];
  const client = {
    post: async (path, payload) => {
      calls.push({ path, payload });
      return { status: 200, data: { messages: [{ id: "test-message" }] } };
    }
  };

  await sendTemplate("test-user", "approved_welcome", [
    { type: "button", sub_type: "quick_reply", index: "3", parameters: [{ type: "payload", payload: "MAIN_CHAT" }] },
    { type: "button", sub_type: "quick_reply", index: "4", parameters: [{ type: "payload", payload: "MAIN_VIEW_PROJECTS" }] }
  ], client);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].payload.type, "template");
  assert.deepEqual(calls[0].payload.template.components.map((component) => component.parameters?.[0]?.payload), [
    "MAIN_CHAT",
    "MAIN_VIEW_PROJECTS"
  ]);
});

for (const project of projects) {
  test(`project template components preserve ${project.name} data or require fallback`, () => {
    const card = buildProjectCard(project);
    const isTemplateReady = Boolean(
      project.imagePath && project.description && project.locationUrl && project.videoUrl && project.brochurePath
    );

    if (!isTemplateReady) {
      assert.throws(() => buildProjectTemplateComponents(card));
      return;
    }

    const components = buildProjectTemplateComponents(card);
    const body = components.find((component) => component.type === "body");
    const location = components.find((component) => component.index === "0");
    const video = components.find((component) => component.index === "1");
    const brochure = components.find((component) => component.index === "2");
    const siteVisit = components.find((component) => component.index === "4");

    assert.equal(body.parameters[0].text, project.description);
    assert.equal(location.parameters[0].text, project.locationUrl);
    assert.equal(video.parameters[0].text, project.videoUrl);
    assert.equal(brochure.parameters[0].payload, `DOWNLOAD_BROCHURE:${project.id}`);
    assert.equal(siteVisit.parameters[0].payload, `BOOK_SITE_VISIT:${project.id}`);
  });
}
