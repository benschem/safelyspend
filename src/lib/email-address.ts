const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Whether a string has the shape of an email address: something, an @, a
 * domain with a dot, and no spaces. Deliberately loose. It catches a typo
 * before a request is spent on it, and the email that follows is what proves
 * the address is real.
 */
export function isValidEmailAddress(address: string): boolean {
  return EMAIL_ADDRESS_PATTERN.test(address);
}

/**
 * An address as typed, in the one form it is compared and sent in: no
 * surrounding whitespace, all lower case. The worker stores addresses the same
 * way, so two spellings of one address match here as they would there.
 */
export function normaliseEmailAddress(address: string): string {
  return address.trim().toLowerCase();
}
