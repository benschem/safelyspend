import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, isWrongPassphrase } from '@/lib/e2e-crypto';
import type { BudgetBackup } from '@/lib/db';

function makeBudgetBackup(
  overrides: Partial<BudgetBackup> = {},
): BudgetBackup {
  return {
    version: 3,
    exportedAt: '2026-02-15T00:00:00.000Z',
    activeScenarioId: 'scenario-1',
    scenarios: [],
    categories: [],
    transactions: [],
    budgetRules: [],
    forecastRules: [],
    savingsGoals: [],
    balanceAnchors: [],
    savingsAnchors: [],
    categoryRules: [],
    ...overrides,
  };
}

describe('encrypt and decrypt', { timeout: 30_000 }, () => {
  it('round-trips budget data through encrypt then decrypt', async () => {
    const backup = makeBudgetBackup({
      scenarios: [
        {
          id: 's1',
          userId: 'local',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          name: 'Default',
          isDefault: true,
        },
      ],
    });
    const passphrase = 'correct-horse-battery-staple';

    const encrypted = await encrypt(backup, passphrase);
    const decrypted = await decrypt(encrypted, passphrase);

    expect(decrypted).toEqual(backup);
  });

  it('produces different ciphertext for the same input', async () => {
    const backup = makeBudgetBackup();
    const passphrase = 'test-passphrase';

    const encrypted1 = await encrypt(backup, passphrase);
    const encrypted2 = await encrypt(backup, passphrase);

    const bytes1 = new Uint8Array(encrypted1);
    const bytes2 = new Uint8Array(encrypted2);
    // Salt and IV are random, so the output should differ
    expect(bytes1).not.toEqual(bytes2);
  });

  it('rejects decryption with the wrong passphrase', async () => {
    const backup = makeBudgetBackup();
    const encrypted = await encrypt(backup, 'right-passphrase');

    await expect(decrypt(encrypted, 'wrong-passphrase')).rejects.toThrow();
  });

  it('rejects decryption of corrupted data', async () => {
    const backup = makeBudgetBackup();
    const encrypted = await encrypt(backup, 'my-passphrase');

    // Flip a byte in the ciphertext region (after version + salt + IV = 29 bytes)
    const corrupted = new Uint8Array(encrypted);
    corrupted[30]! ^= 0xff;

    await expect(
      decrypt(corrupted.buffer, 'my-passphrase'),
    ).rejects.toThrow();
  });

  it('rejects data with unsupported format version', async () => {
    const backup = makeBudgetBackup();
    const encrypted = await encrypt(backup, 'my-passphrase');

    const tampered = new Uint8Array(encrypted);
    tampered[0] = 99;

    await expect(decrypt(tampered.buffer, 'my-passphrase')).rejects.toThrow(
      'Unsupported encryption format version: 99',
    );
  });

  it('output starts with format version byte 1', async () => {
    const backup = makeBudgetBackup();
    const encrypted = await encrypt(backup, 'my-passphrase');
    const bytes = new Uint8Array(encrypted);

    expect(bytes[0]).toBe(1);
  });
});

describe('isWrongPassphrase', () => {
  it('returns true for DOMException with name OperationError', () => {
    const error = new DOMException('The operation failed', 'OperationError');
    expect(isWrongPassphrase(error)).toBe(true);
  });

  it('returns false for other DOMExceptions', () => {
    const error = new DOMException('Something else', 'NotAllowedError');
    expect(isWrongPassphrase(error)).toBe(false);
  });

  it('returns false for regular Error', () => {
    expect(isWrongPassphrase(new Error('fail'))).toBe(false);
  });

  it('returns false for non-error values', () => {
    expect(isWrongPassphrase(null)).toBe(false);
    expect(isWrongPassphrase(undefined)).toBe(false);
    expect(isWrongPassphrase('string')).toBe(false);
  });
});
