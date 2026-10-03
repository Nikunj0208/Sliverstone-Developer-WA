import type { WelcomeContent } from "../content/welcome-service.js";

export type WelcomeCard = {
  message: string;
  locationHighlightsMessage: string;
  imagePath: string;
  video: { bodyText: string; buttonText: string; url: string } | null;
  location: { bodyText: string; buttonText: string; url: string } | null;
};

export function buildWelcomeCard(content: WelcomeContent): WelcomeCard {
  return {
    message: content.message,
    locationHighlightsMessage: content.locationHighlightsMessage,
    imagePath: content.imagePath,
    video: content.videoUrl
      ? { bodyText: "▶ Welcome Video", buttonText: "Watch Video", url: content.videoUrl }
      : null,
    location: content.locationUrl
      ? { bodyText: "📍 Office Location", buttonText: "Open Location", url: content.locationUrl }
      : null
  };
}
