import { describe, it, expect } from 'vitest';
import {
  sha256,
  sha256ArrayBuffer,
  generateAuthCode,
  jwtSign,
  jwtVerify,
} from '../../lib/crypto.js';

describe('sha256', () => {
  it('produces consistent hex hash for known input', async () => {
    const hash = await sha256('hello');
    expect(hash).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });

  it('produces different hashes for different inputs', async () => {
    const hash1 = await sha256('hello');
    const hash2 = await sha256('world');
    expect(hash1).not.toBe(hash2);
  });
});

describe('sha256ArrayBuffer', () => {
  it('produces hex hash for binary data', async () => {
    const encoder = new TextEncoder();
    const buffer = encoder.encode('hello').buffer;
    const hash = await sha256ArrayBuffer(buffer);
    // Same input as sha256('hello') should produce same hash
    expect(hash).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });
});

describe('generateAuthCode', () => {
  it('returns a 6-digit numeric string', () => {
    const code = generateAuthCode();
    expect(code).toMatch(/^\d{6}$/);
    const num = parseInt(code, 10);
    expect(num).toBeGreaterThanOrEqual(100000);
    expect(num).toBeLessThanOrEqual(999999);
  });

  it('generates different codes across calls', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      codes.add(generateAuthCode());
    }
    // With 20 random 6-digit codes, extremely unlikely to get all the same
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('jwtSign and jwtVerify', () => {
  const secret = 'test-secret-key';
  const payload = { sub: 'user-123', sid: 'session-456', email: 'test@example.com' };

  it('round-trips a payload through sign then verify', async () => {
    const token = await jwtSign(payload, secret, 3600);
    const verified = await jwtVerify(token, secret);

    expect(verified.sub).toBe('user-123');
    expect(verified.email).toBe('test@example.com');
  });

  it('rejects tokens signed with a different secret', async () => {
    const token = await jwtSign(payload, secret, 3600);

    await expect(jwtVerify(token, 'wrong-secret')).rejects.toThrow(
      'Invalid token signature',
    );
  });

  it('rejects expired tokens', async () => {
    // Sign with 0 seconds expiry — token is already expired
    const token = await jwtSign(payload, secret, 0);

    await expect(jwtVerify(token, secret)).rejects.toThrow('Token expired');
  });

  it('rejects malformed token strings', async () => {
    await expect(jwtVerify('not-a-jwt', secret)).rejects.toThrow(
      'Invalid token format',
    );

    await expect(jwtVerify('a.b', secret)).rejects.toThrow(
      'Invalid token format',
    );
  });

  it('includes iat and exp in the verified payload', async () => {
    const beforeSign = Math.floor(Date.now() / 1000);
    const token = await jwtSign(payload, secret, 3600);
    const verified = await jwtVerify(token, secret);

    expect(verified.iat).toBeGreaterThanOrEqual(beforeSign);
    expect(verified.exp).toBe(verified.iat + 3600);
  });
});
