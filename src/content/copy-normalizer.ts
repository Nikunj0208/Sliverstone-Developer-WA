const editorialLabels = [
  /^(?:📲\s*)?WhatsApp\s+Message\s+Copy:\s*[^\n]*\n?/i,
  // Only remove a standalone project-name field. A same-line value is retained
  // because it may be deliberate customer-facing project copy.
  /^Project\s+Names?:\s*(?:\r?\n|$)/i
];

/** Removes only confirmed document metadata from customer-facing copy. */
export function normalizeCustomerCopy(copy: string): string {
  return editorialLabels.reduce((normalized, label) => normalized.replace(label, ""), copy).trim();
}
