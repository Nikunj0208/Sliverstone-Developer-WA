import assert from "node:assert/strict";
import test from "node:test";

import { normalizeCustomerCopy } from "../dist/src/content/copy-normalizer.js";
import { getActiveProjects } from "../dist/src/content/project-service.js";
import { getWelcomeContent } from "../dist/src/content/welcome-service.js";

const forbiddenCustomerText = [
  "WhatsApp Message Copy:",
  "Please select an option."
];

test("copy normalizer removes only confirmed standalone editorial labels", () => {
  assert.equal(normalizeCustomerCopy("WhatsApp Message Copy: Welcome\nApproved copy"), "Approved copy");
  assert.equal(normalizeCustomerCopy("Whatsapp Message Copy: Welcome\nApproved copy"), "Approved copy");
  assert.equal(normalizeCustomerCopy("Project Name:\nApproved copy"), "Approved copy");
  assert.equal(normalizeCustomerCopy("Project Name: Spring Hill\nApproved copy"), "Project Name: Spring Hill\nApproved copy");
});

test("active welcome customer payload is free of editorial labels and raw URLs", () => {
  const message = getWelcomeContent().message;

  for (const forbidden of forbiddenCustomerText) {
    assert.equal(message.includes(forbidden), false);
  }
  assert.equal(message.includes("http://"), false);
  assert.equal(message.includes("https://"), false);
});

test("active project descriptions are free of editorial labels and raw URLs", () => {
  for (const project of getActiveProjects()) {
    for (const forbidden of forbiddenCustomerText) {
      assert.equal(project.description.includes(forbidden), false, project.id);
    }
    assert.equal(project.description.includes("http://"), false, project.id);
    assert.equal(project.description.includes("https://"), false, project.id);
  }
});
