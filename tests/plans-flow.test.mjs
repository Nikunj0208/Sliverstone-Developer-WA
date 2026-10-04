import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";

import { WhatsAppConversationSimulator } from "../dist/src/simulator/simulator.js";
import { getProject, getSquareFeetOptions, getBhkOptions, getPlan, hasProjectPlans } from "../dist/src/content/project-service.js";
import { sendProjectActionButtons } from "../dist/src/flows/project-flow.js";

test("Plan button visibility: Spring Hill, Applewood, Mahal, and Rajmahal show View Plans button", async () => {
  assert.equal(hasProjectPlans("spring-hill"), true);
  assert.equal(hasProjectPlans("applewood"), true);
  assert.equal(hasProjectPlans("mahal"), true);
  assert.equal(hasProjectPlans("rajmahal"), true);
  assert.equal(hasProjectPlans("elements"), false);
  assert.equal(hasProjectPlans("villas"), false);

  const projects = ["spring-hill", "applewood", "mahal", "rajmahal", "elements", "villas"];
  for (const pid of projects) {
    const project = getProject(pid);
    assert.ok(project);
    let sentButtons = null;
    await sendProjectActionButtons("user", project, async (_to, _text, buttons) => {
      sentButtons = buttons;
    });

    assert.ok(sentButtons);
    const hasPlansButton = sentButtons.some((b) => b.id === "PROJECT_PLANS");
    if (["spring-hill", "applewood", "mahal", "rajmahal"].includes(pid)) {
      assert.equal(hasPlansButton, true, `${pid} should show View Plans`);
      assert.deepEqual(sentButtons, [
        { id: "PROJECT_BROCHURE", title: "Download Brochure" },
        { id: "PROJECT_PLANS", title: "View Plans" }
      ]);
    } else {
      assert.equal(hasPlansButton, false, `${pid} should NOT show View Plans`);
      assert.deepEqual(sentButtons, [
        { id: "PROJECT_BROCHURE", title: "Download Brochure" }
      ]);
    }
  }
});

test("Spring Hill plans: Yard -> BHK -> Downloadable Plan", async () => {
  const sim = new WhatsAppConversationSimulator();
  const user = "customer-spring-hill";

  // Select Spring Hill
  await sim.simulateListSelect(user, "PROJECT:spring-hill");
  let messages = sim.getSentMessages(user);
  const actionMsg = messages.at(-1);
  assert.equal(actionMsg.type, "buttons");
  assert.ok(actionMsg.buttons.some((b) => b.id === "PROJECT_PLANS"));

  // Click View Plans
  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "PROJECT_PLANS");
  messages = sim.getSentMessages(user);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, "buttons");
  assert.deepEqual(messages[0].buttons, [
    { id: "PLAN_SQFT:spring-hill:sqft-84", title: "84 Sq.Yd Plots" },
    { id: "PLAN_SQFT:spring-hill:sqft-124", title: "124 Sq.Yd Anchor" }
  ]);

  // Click 84 Sq.Yd Plots
  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "PLAN_SQFT:spring-hill:sqft-84");
  messages = sim.getSentMessages(user);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, "buttons");
  assert.deepEqual(messages[0].buttons, [
    { id: "PLAN_BHK:spring-hill:sqft-84:3BHK", title: "3 BHK" },
    { id: "PLAN_BHK:spring-hill:sqft-84:4BHK", title: "4 BHK" },
    { id: "PLAN_BHK:spring-hill:sqft-84:5BHK", title: "5 BHK" }
  ]);

  // Click 3 BHK
  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "PLAN_BHK:spring-hill:sqft-84:3BHK");
  messages = sim.getSentMessages(user);
  assert.equal(messages[0].type, "document");
  assert.equal(messages[0].filename, "Spring-Hill-84SqYd-3BHK-Plan.jpg");
  assert.ok(existsSync(messages[0].documentPath));

  // Click 4 BHK
  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "PLAN_BHK:spring-hill:sqft-84:4BHK");
  messages = sim.getSentMessages(user);
  assert.equal(messages[0].type, "document");
  assert.equal(messages[0].filename, "Spring-Hill-84SqYd-4BHK-Plan.jpg");
  assert.ok(existsSync(messages[0].documentPath));

  // Click 5 BHK
  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "PLAN_BHK:spring-hill:sqft-84:5BHK");
  messages = sim.getSentMessages(user);
  assert.equal(messages[0].type, "document");
  assert.equal(messages[0].filename, "Spring-Hill-84SqYd-5BHK-Plan.jpg");
  assert.ok(existsSync(messages[0].documentPath));

  // Test 124 Sq.Yd Anchor Plot
  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "PLAN_SQFT:spring-hill:sqft-124");
  messages = sim.getSentMessages(user);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, "buttons");
  assert.deepEqual(messages[0].buttons, [
    { id: "PLAN_BHK:spring-hill:sqft-124:4BHK", title: "4 BHK" }
  ]);

  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "PLAN_BHK:spring-hill:sqft-124:4BHK");
  messages = sim.getSentMessages(user);
  assert.equal(messages[0].type, "document");
  assert.equal(messages[0].filename, "Spring-Hill-124SqYd-Anchor-Plot-Plan.jpg");
  assert.ok(existsSync(messages[0].documentPath));
});

test("Applewood plans: Yard -> BHK -> Downloadable Plan", async () => {
  const sim = new WhatsAppConversationSimulator();
  const user = "customer-applewood";

  // Select Applewood
  await sim.simulateListSelect(user, "PROJECT:applewood");
  let messages = sim.getSentMessages(user);
  const actionMsg = messages.at(-1);
  assert.equal(actionMsg.type, "buttons");
  assert.deepEqual(actionMsg.buttons, [
    { id: "PROJECT_BROCHURE", title: "Download Brochure" },
    { id: "PROJECT_PLANS", title: "View Plans" }
  ]);

  // Click View Plans
  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "PROJECT_PLANS");
  messages = sim.getSentMessages(user);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, "buttons");
  assert.deepEqual(messages[0].buttons, [
    { id: "PLAN_SQFT:applewood:sqft-89", title: "89 Sq.Yd Plots" }
  ]);

  // Click 89 Sq.Yd Plots
  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "PLAN_SQFT:applewood:sqft-89");
  messages = sim.getSentMessages(user);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, "buttons");
  assert.deepEqual(messages[0].buttons, [
    { id: "PLAN_BHK:applewood:sqft-89:3BHK", title: "3 BHK" },
    { id: "PLAN_BHK:applewood:sqft-89:4BHK", title: "4 BHK" },
    { id: "PLAN_BHK:applewood:sqft-89:5BHK", title: "5 BHK" }
  ]);

  // Click 3 BHK
  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "PLAN_BHK:applewood:sqft-89:3BHK");
  messages = sim.getSentMessages(user);
  assert.equal(messages[0].type, "document");
  assert.equal(messages[0].filename, "Applewood-89SqYd-3BHK-Plan.jpg");
  assert.ok(existsSync(messages[0].documentPath));

  // Click 4 BHK
  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "PLAN_BHK:applewood:sqft-89:4BHK");
  messages = sim.getSentMessages(user);
  assert.equal(messages[0].type, "document");
  assert.equal(messages[0].filename, "Applewood-89SqYd-4BHK-Plan.jpg");
  assert.ok(existsSync(messages[0].documentPath));

  // Click 5 BHK
  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "PLAN_BHK:applewood:sqft-89:5BHK");
  messages = sim.getSentMessages(user);
  assert.equal(messages[0].type, "document");
  assert.equal(messages[0].filename, "Applewood-89SqYd-5BHK-Plan.jpg");
  assert.ok(existsSync(messages[0].documentPath));
});

test("Mahal plans: Direct buttons with given names -> Downloadable Plan", async () => {
  const sim = new WhatsAppConversationSimulator();
  const user = "customer-mahal";

  // Select Mahal
  await sim.simulateListSelect(user, "PROJECT:mahal");
  let messages = sim.getSentMessages(user);
  const actionMsg = messages.at(-1);
  assert.equal(actionMsg.type, "buttons");
  assert.deepEqual(actionMsg.buttons, [
    { id: "PROJECT_BROCHURE", title: "Download Brochure" },
    { id: "PROJECT_PLANS", title: "View Plans" }
  ]);

  // Click View Plans
  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "PROJECT_PLANS");
  messages = sim.getSentMessages(user);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, "buttons");
  assert.deepEqual(messages[0].buttons, [
    { id: "PLAN_SQFT:mahal:125-sqyd", title: "125 sqyd" },
    { id: "PLAN_SQFT:mahal:125-sqyd-with-lift", title: "125 sqyd with lift" },
    { id: "PLAN_SQFT:mahal:140-sqyd", title: "140 sqyd" }
  ]);

  // Click 125 sqyd -> directly delivers plan
  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "PLAN_SQFT:mahal:125-sqyd");
  messages = sim.getSentMessages(user);
  assert.equal(messages[0].type, "document");
  assert.equal(messages[0].filename, "125 sqyd.jpg");
  assert.ok(existsSync(messages[0].documentPath));

  // Click 125 sqyd with lift -> directly delivers plan
  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "PLAN_SQFT:mahal:125-sqyd-with-lift");
  messages = sim.getSentMessages(user);
  assert.equal(messages[0].type, "document");
  assert.equal(messages[0].filename, "125 sqyd with lift.jpg");
  assert.ok(existsSync(messages[0].documentPath));

  // Click 140 sqyd -> directly delivers plan
  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "PLAN_SQFT:mahal:140-sqyd");
  messages = sim.getSentMessages(user);
  assert.equal(messages[0].type, "document");
  assert.equal(messages[0].filename, "140 sqyd.jpg");
  assert.ok(existsSync(messages[0].documentPath));
});

test("Rajmahal plans: Given names list -> Downloadable Plan", async () => {
  const sim = new WhatsAppConversationSimulator();
  const user = "customer-rajmahal";

  // Select Rajmahal
  await sim.simulateListSelect(user, "PROJECT:rajmahal");
  let messages = sim.getSentMessages(user);
  const actionMsg = messages.at(-1);
  assert.equal(actionMsg.type, "buttons");
  assert.deepEqual(actionMsg.buttons, [
    { id: "PROJECT_BROCHURE", title: "Download Brochure" },
    { id: "PROJECT_PLANS", title: "View Plans" }
  ]);

  // Click View Plans
  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "PROJECT_PLANS");
  messages = sim.getSentMessages(user);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, "list");
  assert.deepEqual(messages[0].rows, [
    { id: "PLAN_SQFT:rajmahal:125-sqyd", title: "125 sqyd" },
    { id: "PLAN_SQFT:rajmahal:125sqyd-with-lift", title: "125sqyd with lift" },
    { id: "PLAN_SQFT:rajmahal:137sqyd", title: "137sqyd" },
    { id: "PLAN_SQFT:rajmahal:200sqyrd", title: "200sqyrd" }
  ]);

  // Click 125 sqyd
  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "PLAN_SQFT:rajmahal:125-sqyd");
  messages = sim.getSentMessages(user);
  assert.equal(messages[0].type, "document");
  assert.equal(messages[0].filename, "125 sqyd.jpg");
  assert.ok(existsSync(messages[0].documentPath));

  // Click 125sqyd with lift
  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "PLAN_SQFT:rajmahal:125sqyd-with-lift");
  messages = sim.getSentMessages(user);
  assert.equal(messages[0].type, "document");
  assert.equal(messages[0].filename, "125sqyd with lift.jpg");
  assert.ok(existsSync(messages[0].documentPath));

  // Click 137sqyd
  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "PLAN_SQFT:rajmahal:137sqyd");
  messages = sim.getSentMessages(user);
  assert.equal(messages[0].type, "document");
  assert.equal(messages[0].filename, "137sqyd.jpg");
  assert.ok(existsSync(messages[0].documentPath));

  // Click 200sqyrd
  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "PLAN_SQFT:rajmahal:200sqyrd");
  messages = sim.getSentMessages(user);
  assert.equal(messages[0].type, "document");
  assert.equal(messages[0].filename, "200sqyrd.jpg");
  assert.ok(existsSync(messages[0].documentPath));
});

test("Missing items handling: Mahal has no video -> no unavailable text", async () => {
  const sim = new WhatsAppConversationSimulator();
  const user = "customer-mahal";

  await sim.simulateListSelect(user, "PROJECT:mahal");
  const messages = sim.getSentMessages(user);

  // Assert NO "Project video is currently unavailable" message was sent
  const hasVideoUnavailableNotice = messages.some(
    (m) => m.type === "text" && m.text?.toLowerCase().includes("video is currently unavailable")
  );
  assert.equal(hasVideoUnavailableNotice, false, "Should not send video unavailable notice");
});

