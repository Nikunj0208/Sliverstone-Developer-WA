/**
 * Normalizes phone numbers safely into E.164-compatible international format.
 * Strips whitespace, dashes, and invalid non-digit symbols.
 * Preserves or adds leading '+' prefix.
 */
export function normalizePhoneNumber(raw: string): string {
  if (!raw || typeof raw !== "string") {
    return "";
  }

  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) {
    return trimmed;
  }

  // Handle standard 10-digit Indian numbers without country code (defaulting to +91)
  if (digits.length === 10 && !trimmed.startsWith("+")) {
    return `+91${digits}`;
  }

  // Handle 11-digit numbers starting with 0 (e.g. 09876543210 -> +919876543210)
  if (digits.length === 11 && digits.startsWith("0")) {
    return `+91${digits.slice(1)}`;
  }

  return `+${digits}`;
}

/**
 * Safely masks a phone number for display in CRM dashboards and read-only views.
 * Preserves country code prefix and the last 4 digits, masking intermediate digits.
 * Example: "+919876541234" -> "+91 ******1234"
 */
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone || typeof phone !== "string") {
    return "—";
  }
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return "—";

  if (normalized.length >= 8) {
    const last4 = normalized.slice(-4);
    let prefix = "+91";
    if (normalized.startsWith("+91")) {
      prefix = "+91";
    } else {
      const prefixMatch = normalized.match(/^(\+\d{1,2})/);
      prefix = prefixMatch ? prefixMatch[1] : "+";
    }
    return `${prefix} ******${last4}`;
  }

  return normalized;
}
