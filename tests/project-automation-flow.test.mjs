import assert from "node:assert/strict";
import test from "node:test";

import { WhatsAppConversationSimulator } from "../dist/src/simulator/simulator.js";
import { getConversationState } from "../dist/src/flows/conversation-state.js";
import { getProject, getAllProjects, getSquareFeetOptions, getBhkOptions, getBrochure, getPlan } from "../dist/src/content/project-service.js";

test("Project Service returns complete data-driven project models", () => {
  const projects = getAllProjects();
  assert.equal(projects.length, 6);

  const springHill = getProject("spring-hill");
  assert.ok(springHill);
  assert.equal(springHill.name, "Spring Hill");

  // Normalized springhill matching
  const springHillAlias = getProject("springhill");
  assert.ok(springHillAlias);
  assert.equal(springHillAlias.id, "spring-hill");

  // Rajmahel alias matching
  const rajmahelAlias = getProject("rajmahel");
  assert.ok(rajmahelAlias);
  assert.equal(rajmahelAlias.id, "rajmahal");

  // Square feet options query
  const sqftOptions = getSquareFeetOptions("spring-hill");
  assert.ok(sqftOptions.length > 0);

  // BHK options query
  const bhkOptions = getBhkOptions("spring-hill", "sqft-bhk");
  assert.equal(bhkOptions.length, 3);
  assert.deepEqual(bhkOptions.map((b) => b.id), ["3bhk", "4bhk", "5bhk"]);

  // Brochure query
  const brochure = getBrochure("spring-hill");
  assert.ok(brochure);
  assert.ok(brochure.file.includes("brochure.pdf"));
  assert.equal(brochure.filename, "Spring-Hill-Brochure.pdf");
});

test("Section 31: Full 17-Step Customer Journey Simulation", async () => {
  const sim = new WhatsAppConversationSimulator();
  const user = "customer-999";

  // STEP 1: Customer sends: Hi
  await sim.simulateInboundText(user, "Hi");

  // STEP 2: Main Welcome appears: View Projects, Chat, Call
  let messages = sim.getSentMessages(user);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, "buttons");
  assert.deepEqual(messages[0].buttons, [
    { id: "MAIN_VIEW_PROJECTS", title: "View Projects" },
    { id: "MAIN_CHAT", title: "Chat" },
    { id: "MAIN_CALL", title: "Call" }
  ]);
  assert.equal(sim.getState(user)?.state, "MAIN_MENU");

  // STEP 3: Customer clicks: View Projects
  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "MAIN_VIEW_PROJECTS");

  // STEP 4: Project list appears
  messages = sim.getSentMessages(user);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, "list");
  assert.equal(messages[0].buttonText, "View Projects");
  assert.ok(messages[0].rows.some((row) => row.id === "PROJECT:spring-hill"));
  assert.equal(sim.getState(user)?.state, "PROJECT_LIST");

  // STEP 5: Customer selects: Spring Hill
  sim.clearSentMessages(user);
  await sim.simulateListSelect(user, "PROJECT:spring-hill");

  // STEP 6: System sends informational messages:
  // 1. Image with Description attached as caption (Single standalone card in one go), 2. Location, 3. Video, 4. Short links
  // STEP 7: System sends Message 5: Download Brochure, View Plans
  messages = sim.getSentMessages(user);
  assert.equal(messages.length, 5);

  assert.equal(messages[0].type, "image");
  assert.ok(messages[0].imagePath.includes("Springhill welcome image.jpeg"));
  assert.ok(messages[0].caption.includes("SPRINGHILL HOMES"));

  assert.equal(messages[1].type, "text");
  assert.ok(messages[1].text.includes("📍 Location:"));

  assert.equal(messages[2].type, "text");
  assert.ok(messages[2].text.includes("🎥 Project Video:"));

  assert.equal(messages[3].type, "text");
  assert.ok(messages[3].text.includes("🎥 Project Video:"));
  assert.ok(messages[3].text.includes("📍 Project Location:"));

  assert.equal(messages[4].type, "buttons");
  assert.deepEqual(messages[4].buttons, [
    { id: "PROJECT_BROCHURE", title: "Download Brochure" },
    { id: "PROJECT_PLANS", title: "View Plans" }
  ]);
  assert.equal(sim.getState(user)?.state, "PROJECT_ACTIONS");
  assert.equal(sim.getState(user)?.projectId, "spring-hill");

  // STEP 8: Customer clicks: Download Brochure
  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "PROJECT_BROCHURE");

  // System sends correct Spring Hill brochure PDF
  messages = sim.getSentMessages(user);
  assert.equal(messages.length, 3);
  assert.equal(messages[0].type, "document");
  assert.equal(messages[0].filename, "Spring-Hill-Brochure.pdf");
  assert.ok(messages[0].documentPath.includes("brochure.pdf"));

  // STEP 9: System returns to MAIN WELCOME MENU: View Projects, Chat, Call
  assert.equal(messages[1].type, "text");
  assert.equal(messages[1].text, "Here are the main options again.");
  assert.equal(messages[2].type, "buttons");
  assert.deepEqual(messages[2].buttons, [
    { id: "MAIN_VIEW_PROJECTS", title: "View Projects" },
    { id: "MAIN_CHAT", title: "Chat" },
    { id: "MAIN_CALL", title: "Call" }
  ]);
  assert.equal(sim.getState(user)?.state, "MAIN_MENU");

  // STEP 10: Start again. Customer selects: Spring Hill
  sim.clearSentMessages(user);
  await sim.simulateListSelect(user, "PROJECT:springhill"); // test with springhill trigger

  messages = sim.getSentMessages(user);
  assert.equal(messages.length, 5);
  assert.equal(messages[4].type, "buttons");
  assert.equal(sim.getState(user)?.projectId, "spring-hill");

  // STEP 11: Customer clicks: View Plans
  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "PROJECT_PLANS");

  // STEP 12: Yard options appear
  messages = sim.getSentMessages(user);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, "buttons");
  assert.ok(messages[0].buttons.some((b) => b.id.includes("PLAN_SQFT:spring-hill:sqft-84")));
  assert.equal(sim.getState(user)?.state, "SELECT_SQFT");

  // STEP 13: Customer selects a yard option (84 Sq.Yd Plots)
  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "PLAN_SQFT:spring-hill:sqft-84");

  // STEP 14: System displays: 3 BHK, 4 BHK, 5 BHK
  messages = sim.getSentMessages(user);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, "buttons");
  assert.deepEqual(messages[0].buttons, [
    { id: "PLAN_BHK:spring-hill:sqft-84:3BHK", title: "3 BHK" },
    { id: "PLAN_BHK:spring-hill:sqft-84:4BHK", title: "4 BHK" },
    { id: "PLAN_BHK:spring-hill:sqft-84:5BHK", title: "5 BHK" }
  ]);
  assert.equal(sim.getState(user)?.state, "SELECT_BHK");

  // STEP 15: Customer selects: 3 BHK
  sim.clearSentMessages(user);
  await sim.simulateButtonClick(user, "PLAN_BHK:spring-hill:sqft-84:3BHK");

  // STEP 16: Downloadable floor plan sent
  messages = sim.getSentMessages(user);
  assert.equal(messages.length, 2);
  assert.equal(messages[0].type, "document");
  assert.equal(messages[0].filename, "Spring-Hill-84SqYd-3BHK-Plan.jpg");
  assert.ok(messages[0].documentPath.includes("3bhk-84sqyd-Spring-Hills.jpg"));

  // STEP 17: System returns to MAIN WELCOME MENU: View Projects, Chat, Call
  assert.equal(messages[1].type, "buttons");
  assert.deepEqual(messages[1].buttons, [
    { id: "MAIN_VIEW_PROJECTS", title: "View Projects" },
    { id: "MAIN_CHAT", title: "Chat" },
    { id: "MAIN_CALL", title: "Call" }
  ]);
  assert.equal(sim.getState(user)?.state, "MAIN_MENU");
});

test("Section 30: Simulator supports all 10 required simulation triggers", async () => {
  const sim = new WhatsAppConversationSimulator();
  const user = "sim-tester";

  // 1. MAIN_VIEW_PROJECTS
  sim.clearSentMessages(user);
  assert.equal(await sim.simulateButtonClick(user, "MAIN_VIEW_PROJECTS"), true);
  assert.equal(sim.getSentMessages(user)[0].type, "list");

  // 2. PROJECT:springhill
  sim.clearSentMessages(user);
  assert.equal(await sim.simulateListSelect(user, "PROJECT:springhill"), true);
  assert.equal(sim.getSentMessages(user).length, 5);

  // 3. PROJECT_BROCHURE
  sim.clearSentMessages(user);
  assert.equal(await sim.simulateButtonClick(user, "PROJECT_BROCHURE"), true);
  assert.equal(sim.getSentMessages(user)[0].type, "document");

  // Re-select project
  await sim.simulateListSelect(user, "PROJECT:springhill");

  // 4. PROJECT_PLANS
  sim.clearSentMessages(user);
  assert.equal(await sim.simulateButtonClick(user, "PROJECT_PLANS"), true);
  assert.equal(sim.getSentMessages(user)[0].type, "buttons");

  // 5. PLAN_SQFT:springhill:<sqft>
  sim.clearSentMessages(user);
  assert.equal(await sim.simulateButtonClick(user, "PLAN_SQFT:spring-hill:sqft-bhk"), true);
  assert.equal(sim.getSentMessages(user)[0].type, "buttons");

  // 6. PLAN_BHK:springhill:<sqft>:3BHK
  sim.clearSentMessages(user);
  assert.equal(await sim.simulateButtonClick(user, "PLAN_BHK:spring-hill:sqft-bhk:3BHK"), true);
  assert.ok(sim.getSentMessages(user).some((m) => m.type === "buttons" && m.buttons[0].id === "MAIN_VIEW_PROJECTS"));

  // 7. PLAN_BHK:springhill:<sqft>:4BHK
  sim.clearSentMessages(user);
  assert.equal(await sim.simulateButtonClick(user, "PLAN_BHK:spring-hill:sqft-bhk:4BHK"), true);
  assert.ok(sim.getSentMessages(user).some((m) => m.type === "buttons" && m.buttons[0].id === "MAIN_VIEW_PROJECTS"));

  // 8. PLAN_BHK:springhill:<sqft>:5BHK
  sim.clearSentMessages(user);
  assert.equal(await sim.simulateButtonClick(user, "PLAN_BHK:spring-hill:sqft-bhk:5BHK"), true);
  assert.ok(sim.getSentMessages(user).some((m) => m.type === "buttons" && m.buttons[0].id === "MAIN_VIEW_PROJECTS"));

  // 9. MAIN_CHAT
  sim.clearSentMessages(user);
  assert.equal(await sim.simulateButtonClick(user, "MAIN_CHAT"), true);
  assert.equal(sim.getState(user)?.state, "CHAT");
  assert.ok(sim.getSentMessages(user)[0].text.includes("sales team"));

  // 10. MAIN_CALL
  sim.clearSentMessages(user);
  assert.equal(await sim.simulateButtonClick(user, "MAIN_CALL"), true);
  assert.equal(sim.getState(user)?.state, "CALL");
  assert.ok(sim.getSentMessages(user)[0].text.includes("📞"));
});

test("Brochure download works across all 6 projects and returns to main menu", async () => {
  const sim = new WhatsAppConversationSimulator();
  const projects = ["spring-hill", "mahal", "rajmahal", "applewood", "elements", "villas"];

  for (const pid of projects) {
    const user = `user-${pid}`;
    await sim.simulateProjectSelection(user, pid);
    sim.clearSentMessages(user);

    const success = await sim.simulateButtonClick(user, "PROJECT_BROCHURE");
    assert.equal(success, true);

    const sent = sim.getSentMessages(user);
    assert.equal(sent[0].type, "document");
    assert.ok(sent[0].filename.endsWith("-Brochure.pdf"));

    // Follow-up always returns to main menu
    const lastMsg = sent.at(-1);
    assert.equal(lastMsg.type, "buttons");
    assert.deepEqual(lastMsg.buttons.map((b) => b.id), [
      "MAIN_VIEW_PROJECTS",
      "MAIN_CHAT",
      "MAIN_CALL"
    ]);
    assert.equal(sim.getState(user)?.state, "MAIN_MENU");
  }
});
