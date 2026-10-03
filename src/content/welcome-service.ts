import welcome from "../../data/welcome.json" with { type: "json" };

import { normalizeCustomerCopy } from "./copy-normalizer.js";

export type WelcomeContent = typeof welcome & {
  message: string;
  locationHighlightsMessage: string;
};

export function getWelcomeContent(): WelcomeContent {
  return {
    ...welcome,
    message: normalizeCustomerCopy(welcome.message),
    locationHighlightsMessage: normalizeCustomerCopy(welcome.locationHighlightsMessage)
  };
}
