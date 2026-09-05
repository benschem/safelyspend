import type { BudgetBackup } from './db';

const FORMAT_VERSION = 1;
const PBKDF2_ITERATIONS = 600_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

/**
 * Binary format: [VERSION(1)] [SALT(16)] [IV(12)] [CIPHERTEXT+GCM_TAG]
 */

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as Uint8Array<ArrayBuffer>,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt a BudgetBackup into an ArrayBuffer.
 * Uses PBKDF2 + AES-256-GCM with random salt and IV.
 */
export async function encrypt(data: BudgetBackup, passphrase: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(data));

  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(passphrase, salt);

  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  // Pack: [version(1)] [salt(16)] [iv(12)] [ciphertext+tag]
  const result = new Uint8Array(1 + SALT_LENGTH + IV_LENGTH + ciphertext.byteLength);
  result[0] = FORMAT_VERSION;
  result.set(salt, 1);
  result.set(iv, 1 + SALT_LENGTH);
  result.set(new Uint8Array(ciphertext), 1 + SALT_LENGTH + IV_LENGTH);

  return result.buffer;
}

/**
 * Decrypt an encrypted ArrayBuffer back to a BudgetBackup.
 * Throws if passphrase is wrong (GCM auth tag failure).
 */
export async function decrypt(encrypted: ArrayBuffer, passphrase: string): Promise<BudgetBackup> {
  const data = new Uint8Array(encrypted);

  const version = data[0];
  if (version !== FORMAT_VERSION) {
    throw new Error(`Unsupported encryption format version: ${version}`);
  }

  const salt = data.slice(1, 1 + SALT_LENGTH);
  const iv = data.slice(1 + SALT_LENGTH, 1 + SALT_LENGTH + IV_LENGTH);
  const ciphertext = data.slice(1 + SALT_LENGTH + IV_LENGTH);

  const key = await deriveKey(passphrase, salt);

  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(plaintext)) as BudgetBackup;
}

/**
 * Check if an error is a wrong passphrase error (AES-GCM auth tag failure).
 */
export function isWrongPassphrase(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'OperationError';
  }
  return false;
}
