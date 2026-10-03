import assert from "node:assert/strict";
import test from "node:test";

import {
  continueSiteVisitBooking,
  getSiteVisitBooking,
  startSiteVisitBooking
} from "../dist/src/flows/site-visit.js";

function createDependencies() {
  const messages = [];
  return {
    messages,
    dependencies: {
      async sendText(_to, text) {
        messages.push(text);
        return { httpStatus: 200 };
      }
    }
  };
}

test("site visit form collects name, phone, project, date, and time", async () => {
  const { messages, dependencies } = createDependencies();
  const customer = "site-visit-test";

  assert.equal(await startSiteVisitBooking(customer, "spring-hill", dependencies), true);
  assert.equal(getSiteVisitBooking(customer)?.projectId, "spring-hill");
  assert.equal(getSiteVisitBooking(customer)?.step, "name");

  for (const value of ["Test Customer", "9000000000", "Spring Hill"]) {
    assert.equal(await continueSiteVisitBooking(customer, value, dependencies), true);
  }

  assert.equal(getSiteVisitBooking(customer)?.interestedProjectName, "Spring Hill");

  for (const value of ["2026-08-12", "11:00 AM"]) {
    assert.equal(await continueSiteVisitBooking(customer, value, dependencies), true);
  }

  assert.equal(getSiteVisitBooking(customer), undefined);
  assert.equal(messages.length, 6);
  assert.equal(messages.at(-1), "see you at site.");
});

test("site visit form refuses an unknown project", async () => {
  const { dependencies } = createDependencies();
  assert.equal(await startSiteVisitBooking("invalid-site-visit", "unknown", dependencies), false);
});

test("site visit form keeps asking until it receives a valid phone number", async () => {
  const { messages, dependencies } = createDependencies();
  const customer = "phone-validation-test";

  await startSiteVisitBooking(customer, "mahal", dependencies);
  await continueSiteVisitBooking(customer, "Test Customer", dependencies);
  await continueSiteVisitBooking(customer, "not-a-number", dependencies);

  assert.equal(getSiteVisitBooking(customer)?.step, "phone");
  assert.equal(messages.at(-1), "Please share a valid phone number.");
});
