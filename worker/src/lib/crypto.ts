import { unauthorized } from './errors.js';
import type { JwtPayload } from '../types.js';

// --- Hashing ---

export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return arrayBufferToHex(buffer);
}

export async function sha256ArrayBuffer(data: ArrayBuffer): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return arrayBufferToHex(buffer);
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const hexParts: string[] = [];
  for (const byte of bytes) {
    hexParts.push(byte.toString(16).padStart(2, '0'));
  }
  return hexParts.join('');
}

// --- Auth Code ---

export function generateAuthCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  // Generate a 6-digit code (100000-999999)
  const code = (array[0] % 900000) + 100000;
  return code.toString();
}

// --- Base64url ---

function base64urlEncode(data: Uint8Array): string {
  let binary = '';
  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  // Restore padding
  let padded = str.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4 !== 0) {
    padded += '=';
  }
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64urlEncodeString(str: string): string {
  const encoder = new TextEncoder();
  return base64urlEncode(encoder.encode(str));
}

// --- JWT ---

const JWT_HEADER = '{"alg":"HS256","typ":"JWT"}';
const JWT_HEADER_B64 = base64urlEncodeString(JWT_HEADER);

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function jwtSign(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  secret: string,
  expiresInSeconds: number,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const payloadB64 = base64urlEncodeString(JSON.stringify(fullPayload));
  const signingInput = `${JWT_HEADER_B64}.${payloadB64}`;

  const key = await getHmacKey(secret);
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signingInput),
  );

  const signatureB64 = base64urlEncode(new Uint8Array(signature));
  return `${signingInput}.${signatureB64}`;
}

export async function jwtVerify(
  token: string,
  secret: string,
): Promise<JwtPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw unauthorized('Invalid token format');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;

  // Verify signature
  const key = await getHmacKey(secret);
  const encoder = new TextEncoder();
  const signature = base64urlDecode(signatureB64);

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    encoder.encode(signingInput),
  );

  if (!valid) {
    throw unauthorized('Invalid token signature');
  }

  // Decode and validate payload
  const decoder = new TextDecoder();
  const payloadBytes = base64urlDecode(payloadB64);
  let payload: JwtPayload;
  try {
    payload = JSON.parse(decoder.decode(payloadBytes)) as JwtPayload;
  } catch {
    throw unauthorized('Invalid token payload');
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    throw unauthorized('Token expired');
  }

  return payload;
}
