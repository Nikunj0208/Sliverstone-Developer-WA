import assert from "node:assert/strict";
import test from "node:test";

import { routeButtonAction } from "../dist/src/flows/actions.js";
import { getActiveProjects } from "../dist/src/content/project-service.js";
import { buildProjectList } from "../dist/src/layouts/project-list.js";
import {
  projectIdFromTrigger,
  sendRajmahalBuildPlan,
  sendRajmahalBuildPlanList,
  sendSpringHillBuildPlan,
  sendSpringHillBuildPlanList
} from "../dist/src/flows/projects.js";
import { parseWebhookEvents } from "../dist/src/webhooks/parser.js";

function dependencies(calls) {
  return {
    handleChat: async () => calls.push("chat"),
    handleCall: async () => calls.push("call"),
    handleLocationHighlights: async () => calls.push("location-highlights"),
    handleSiteVisit: async (_to, projectId) => {
      calls.push(projectId ? `site-visit:${projectId}` : "site-visit");
      return true;
    },
    sendProjectList: async () => calls.push("projects"),
    sendProjectBrochure: async (_to, projectId) => {
      calls.push(`brochure:${projectId}`);
      return true;
    },
    sendProjectDetails: async (_to, projectId) => {
      calls.push(`project:${projectId}`);
      return true;
    },
    sendRajmahalBuildPlanList: async () => {
      calls.push("build-plan-list");
      return true;
    },
    sendRajmahalBuildPlan: async (_to, planId) => {
      calls.push(`build-plan:${planId}`);
      return true;
    },
    sendSpringHillBuildPlanList: async () => {
      calls.push("spring-hill-build-plan-list");
      return true;
    },
    sendSpringHillBuildPlan: async (_to, planId) => {
      calls.push(`spring-hill-build-plan:${planId}`);
      return true;
    },
    sendWelcomeFlow: async () => {
      calls.push("welcome");
      return true;
    }
  };
}

test("BOOK_SITE_VISIT preserves its selected project", async () => {
  const calls = [];

  assert.equal(
    await routeButtonAction("test-user", "BOOK_SITE_VISIT:rajmahal", dependencies(calls)),
    true
  );
  assert.deepEqual(calls, ["site-visit:rajmahal"]);
});

test("PROJECT action routes by its stable project ID", async () => {
  const calls = [];

  assert.equal(
    await routeButtonAction("test-user", "PROJECT:elements", dependencies(calls)),
    true
  );
  assert.deepEqual(calls, ["project:elements"]);
});

test("a failed optional action is contained", async () => {
  const calls = [];
  const injected = dependencies(calls);
  injected.handleChat = async () => {
    throw new Error("test failure");
  };

  assert.equal(await routeButtonAction("test-user", "MAIN_CHAT", injected), false);
  assert.deepEqual(calls, []);
});

test("DOWNLOAD_BROCHURE routes by its stable project action ID", async () => {
  const calls = [];

  assert.equal(
    await routeButtonAction("test-user", "DOWNLOAD_BROCHURE:applewood", dependencies(calls)),
    true
  );
  assert.deepEqual(calls, ["brochure:applewood"]);
});

test("DOWNLOAD_BROCHURE rejects an unknown project without sending", async () => {
  const calls = [];
  const injected = dependencies(calls);
  injected.sendProjectBrochure = async () => false;

  assert.equal(
    await routeButtonAction("test-user", "DOWNLOAD_BROCHURE:not-a-project", injected),
    false
  );
  assert.deepEqual(calls, []);
});

test("BUILD_PLAN actions route by their stable IDs", async () => {
  const calls = [];
  const planIds = [
    "124-44-sqyd",
    "124-44-sqyd-with-lift",
    "137-77-sqyd",
    "137-77-sqyd-with-shop",
    "180-sqyd",
    "202-sqyd"
  ];

  assert.equal(await routeButtonAction("test-user", "BUILD_PLAN:rajmahel", dependencies(calls)), true);
  assert.equal(await routeButtonAction("test-user", "BUILD_PLAN:rajmahal", dependencies(calls)), true);
  for (const planId of planIds) {
    assert.equal(
      await routeButtonAction("test-user", `BUILD_PLAN:rajmahel:${planId}`, dependencies(calls)),
      true
    );
    assert.equal(
      await routeButtonAction("test-user", `BUILD_PLAN:rajmahal:${planId}`, dependencies(calls)),
      true
    );
  }
  assert.deepEqual(calls, [
    "build-plan-list",
    "build-plan-list",
    ...planIds.flatMap((planId) => [`build-plan:${planId}`, `build-plan:${planId}`])
  ]);
});

test("Rajmahel build-plan actions stay disabled until client files are mapped", async () => {
  assert.equal(await sendRajmahalBuildPlanList("test-user"), false);
  assert.equal(await sendRajmahalBuildPlan("test-user", "124-44-sqyd"), false);
});

test("Spring Hill build-plan actions route by their stable IDs", async () => {
  const calls = [];
  const planIds = ["3bhk", "4bhk", "5bhk"];

  assert.equal(await routeButtonAction("test-user", "BUILD_PLAN:spring-hill", dependencies(calls)), true);
  for (const planId of planIds) {
    assert.equal(
      await routeButtonAction("test-user", `BUILD_PLAN:spring-hill:${planId}`, dependencies(calls)),
      true
    );
  }

  assert.deepEqual(calls, [
    "spring-hill-build-plan-list",
    ...planIds.map((planId) => `spring-hill-build-plan:${planId}`)
  ]);
});

test("Spring Hill build-plan actions stay disabled until client files are mapped", async () => {
  assert.equal(await sendSpringHillBuildPlanList("test-user"), false);
  assert.equal(await sendSpringHillBuildPlan("test-user", "3bhk"), false);
  assert.equal(await sendSpringHillBuildPlan("test-user", "invalid"), false);
});

test("project list uses sorted data, project icons, and stable PROJECT IDs", () => {
  const projects = getActiveProjects();
  const rows = buildProjectList(projects);

  assert.deepEqual(rows.map((row) => row.id), projects.map((project) => `PROJECT:${project.id}`));
  assert.deepEqual(rows.map((row) => row.title), projects.map((project) => `${project.icon} ${project.name}`));
  assert.deepEqual(projects.map((project) => project.id), [
    "spring-hill", "mahal", "rajmahal", "applewood", "elements", "villas"
  ]);
});

for (const [id, expected] of [
  ["MAIN_LOCATION_HIGHLIGHTS", "location-highlights"],
  ["MAIN_CHAT", "chat"],
  ["MAIN_CALL", "call"],
  ["MAIN_VIEW_PROJECTS", "projects"],
  ["BOOK_SITE_VISIT", "site-visit"],
  ["MORE_DETAILS", "welcome"],
  ["More Details", "welcome"]
]) {
  test(`${id} routes by stable button ID`, async () => {
    const calls = [];
    assert.equal(await routeButtonAction("test-user", id, dependencies(calls)), true);
    assert.deepEqual(calls, [expected]);
  });
}

for (const projectId of ["spring-hill", "applewood"]) {
  test(`PROJECT:${projectId} list reply resolves to its project ID`, () => {
    const payload = {
      entry: [{ changes: [{ value: { messages: [{
        id: "test-message",
        from: "test-user",
        type: "interactive",
        interactive: { type: "list_reply", list_reply: { id: `PROJECT:${projectId}` } }
      }] } }] }]
    };
    const [event] = parseWebhookEvents(payload);
    assert.equal(event.type, "LIST_REPLY");
    assert.equal(projectIdFromTrigger(event.rowId), projectId);
  });
}

test("Meta template quick-reply button click parses as BUTTON_REPLY", () => {
  const payload = {
    entry: [{ changes: [{ value: { messages: [{
      id: "test-template-btn",
      from: "918866751322",
      type: "button",
      button: { text: "More Details", payload: "MORE_DETAILS" }
    }] } }] }]
  };
  const [event] = parseWebhookEvents(payload);
  assert.equal(event.type, "BUTTON_REPLY");
  assert.equal(event.buttonId, "MORE_DETAILS");
});
