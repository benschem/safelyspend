/**
 * base64url codec for the wire.
 *
 * Every binary field the API carries is base64url — salts, verifiers, public
 * keys, wrapped blobs (`02_backend_schema_endpoints_design.md` section 11).
 * `worker/src/lib/bytes.ts` is the server's half of this, and the two must
 * agree byte for byte.
 *
 * Separate module rather than a third concern in `bytes.ts`: that file is
 * `concatBytes` and deliberately nothing else, and the crypto modules have no
 * business knowing what the transport looks like. Separate from `envelope.ts`
 * too, for the reason given there — a general-purpose helper exported from the
 * codec reads as part of the wire format it specifies.
 *
 * We emit unpadded base64url. We accept padded or unpadded, and the standard
 * `+/` alphabet as well as `-_`, because the server does and a decoder that is
 * stricter than its counterpart only invents failures.
 */

export class Base64UrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Base64UrlError';
  }
}

/** Both alphabets, with at most the two padding characters base64 can end in. */
const BASE64_ANY_ALPHABET = /^[A-Za-z0-9_\-+/]*={0,2}$/;

export function bytesToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode to raw bytes, or throw.
 *
 * The server's decoder returns null here and lets each caller turn that into
 * an `INVALID_BLOB` response. The client has no such envelope to map onto, and
 * a null that gets fed onwards as key material surfaces much later as an
 * unexplained decrypt failure. Throwing puts the error at the byte that caused
 * it.
 */
export function base64urlToBytes(value: string): Uint8Array {
  if (!BASE64_ANY_ALPHABET.test(value)) {
    throw new Base64UrlError('Value is not base64url');
  }

  let padded = value.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4 !== 0) {
    padded += '=';
  }

  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new Base64UrlError('Value is not base64url');
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
