import { getProject } from "../content/project-service.js";
import { sendText } from "../meta/messages.js";
import { markSiteVisitHandoff } from "./conversation-state.js";

type BookingStep = "name" | "phone" | "project" | "date" | "time";

export type SiteVisitBooking = {
  projectId: string;
  step: BookingStep;
  name?: string;
  phone?: string;
  interestedProjectName?: string;
  date?: string;
  time?: string;
};

type SiteVisitDependencies = {
  sendText: typeof sendText;
};

const bookings = new Map<string, SiteVisitBooking>();

const defaultDependencies: SiteVisitDependencies = { sendText };

export async function startSiteVisitBooking(
  to: string,
  projectId?: string,
  dependencies: SiteVisitDependencies = defaultDependencies
): Promise<boolean> {
  const project = projectId ? getProject(projectId) : undefined;
  if (!project || !project.active) {
    return false;
  }

  markSiteVisitHandoff(to, projectId);
  bookings.set(to, { projectId: project.id, step: "name" });
  console.info("[SITE_VISIT] FORM STARTED");
  await dependencies.sendText(to, `Please share your name to book a site visit for ${project.name}.`);
  return true;
}

/**
 * Handles one form field at a time. Values remain only in demo memory and are
 * never written to logs.
 */
export async function continueSiteVisitBooking(
  to: string,
  response: string,
  dependencies: SiteVisitDependencies = defaultDependencies
): Promise<boolean> {
  const booking = bookings.get(to);
  if (!booking) {
    return false;
  }

  const value = response.trim();
  if (!value) {
    await dependencies.sendText(to, promptForStep(booking.step));
    return true;
  }

  if (booking.step === "name") {
    booking.name = value;
    booking.step = "phone";
    await dependencies.sendText(to, "Please share your phone number.");
    return true;
  }

  if (booking.step === "phone") {
    if (!looksLikePhoneNumber(value)) {
      await dependencies.sendText(to, "Please share a valid phone number.");
      return true;
    }
    booking.phone = value;
    booking.step = "project";
    await dependencies.sendText(to, "Please share the project you are interested in.");
    return true;
  }

  if (booking.step === "project") {
    booking.interestedProjectName = value;
    booking.step = "date";
    await dependencies.sendText(to, "Please share your preferred site visit date.");
    return true;
  }

  if (booking.step === "date") {
    booking.date = value;
    booking.step = "time";
    await dependencies.sendText(to, "Please share your preferred site visit time.");
    return true;
  }

  booking.time = value;
  bookings.delete(to);
  console.info("[SITE_VISIT] FORM COMPLETED");
  await dependencies.sendText(to, "see you at site.");
  return true;
}

function looksLikePhoneNumber(value: string): boolean {
  return value.replace(/\D/g, "").length >= 7;
}

export function getSiteVisitBooking(to: string): SiteVisitBooking | undefined {
  const booking = bookings.get(to);
  return booking ? { ...booking } : undefined;
}

function promptForStep(step: BookingStep): string {
  switch (step) {
    case "name":
      return "Please share your name.";
    case "phone":
      return "Please share your phone number.";
    case "project":
      return "Please share the project you are interested in.";
    case "date":
      return "Please share your preferred site visit date.";
    case "time":
      return "Please share your preferred site visit time.";
  }
}
