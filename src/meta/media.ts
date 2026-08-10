export type MediaReference = {
  id?: string;
  link?: string;
};

/** Reserved for future WhatsApp media support. */
export function uploadMedia(): never {
  throw new Error("WhatsApp media upload is not implemented in Milestone 1.");
}
