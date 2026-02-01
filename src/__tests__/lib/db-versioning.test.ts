import { describe, it, expect } from 'vitest';
import { CURRENT_DATA_VERSION } from '@/lib/db';
import { validateImport, budgetDataSchema } from '@/lib/import-schema';

// =============================================================================
// Version Compatibility Tests
// =============================================================================

describe('data versioning', () => {
  const minimalValidData = {
    scenarios: [],
    categories: [],
    transactions: [],
    budgetRules: [],
    forecastRules: [],
    forecastEvents: [],
    savingsGoals: [],
  };

  describe('CURRENT_DATA_VERSION', () => {
    it('is a positive integer', () => {
      expect(Number.isInteger(CURRENT_DATA_VERSION)).toBe(true);
      expect(CURRENT_DATA_VERSION).toBeGreaterThan(0);
    });

    it('current version is 2', () => {
      expect(CURRENT_DATA_VERSION).toBe(2);
    });
  });

  describe('version compatibility', () => {
    it('accepts data without version (legacy format)', () => {
      const result = budgetDataSchema.safeParse(minimalValidData);
      expect(result.success).toBe(true);
    });

    it('accepts version 1 data', () => {
      const v1Data = { ...minimalValidData, version: 1 };
      const result = budgetDataSchema.safeParse(v1Data);
      expect(result.success).toBe(true);
    });

    it('accepts version 2 data', () => {
      const v2Data = { ...minimalValidData, version: 2 };
      const result = budgetDataSchema.safeParse(v2Data);
      expect(result.success).toBe(true);
    });

    it('accepts current version data', () => {
      const currentData = { ...minimalValidData, version: CURRENT_DATA_VERSION };
      const result = budgetDataSchema.safeParse(currentData);
      expect(result.success).toBe(true);
    });

    it('accepts future versions (forward compatibility)', () => {
      // Schema should accept higher versions to allow manual upgrades
      const futureData = { ...minimalValidData, version: 99 };
      const result = budgetDataSchema.safeParse(futureData);
      expect(result.success).toBe(true);
    });

    it('rejects version 0', () => {
      const invalidData = { ...minimalValidData, version: 0 };
      const result = budgetDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects negative versions', () => {
      const invalidData = { ...minimalValidData, version: -1 };
      const result = budgetDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects non-integer versions', () => {
      const invalidData = { ...minimalValidData, version: 1.5 };
      const result = budgetDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('validateImport version handling', () => {
    it('validates v1 exports successfully', () => {
      const v1Export = {
        ...minimalValidData,
        version: 1,
        exportedAt: '2024-01-01T00:00:00.000Z',
      };
      expect(() => validateImport(v1Export)).not.toThrow();
    });

    it('validates current version exports successfully', () => {
      const currentExport = {
        ...minimalValidData,
        version: CURRENT_DATA_VERSION,
        exportedAt: new Date().toISOString(),
      };
      expect(() => validateImport(currentExport)).not.toThrow();
    });
  });
});

// =============================================================================
// Schema Migration Path Tests
// =============================================================================

describe('schema migration paths', () => {
  it('v1 data with optional fields omitted validates', () => {
    // v1 might not have balanceAnchors or categoryRules
    const v1Data = {
      version: 1,
      scenarios: [],
      categories: [],
      transactions: [],
      budgetRules: [],
      forecastRules: [],
      forecastEvents: [],
      savingsGoals: [],
      // balanceAnchors and categoryRules intentionally omitted
    };
    const result = budgetDataSchema.safeParse(v1Data);
    expect(result.success).toBe(true);
  });

  it('v2 data with all fields validates', () => {
    const v2Data = {
      version: 2,
      exportedAt: '2025-01-01T00:00:00.000Z',
      scenarios: [],
      categories: [],
      transactions: [],
      budgetRules: [],
      forecastRules: [],
      forecastEvents: [],
      savingsGoals: [],
      balanceAnchors: [],
      savingsAnchors: [],
      categoryRules: [],
      activeScenarioId: null,
    };
    const result = budgetDataSchema.safeParse(v2Data);
    expect(result.success).toBe(true);
  });

  it('v2 data with savings anchors validates', () => {
    const v2Data = {
      version: 2,
      exportedAt: '2025-01-01T00:00:00.000Z',
      scenarios: [],
      categories: [],
      transactions: [],
      budgetRules: [],
      forecastRules: [],
      forecastEvents: [],
      savingsGoals: [],
      balanceAnchors: [],
      savingsAnchors: [
        {
          id: '1',
          userId: 'local',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          savingsGoalId: 'goal-1',
          date: '2025-01-01',
          balanceCents: 50000,
        },
      ],
      categoryRules: [],
      activeScenarioId: null,
    };
    const result = budgetDataSchema.safeParse(v2Data);
    expect(result.success).toBe(true);
  });

  it('mixed version data (v1 structure with v2 version) validates', () => {
    // User might manually edit version number
    const mixedData = {
      version: 2,
      scenarios: [],
      categories: [],
      transactions: [],
      budgetRules: [],
      forecastRules: [],
      forecastEvents: [],
      savingsGoals: [],
      // No v2-specific fields
    };
    const result = budgetDataSchema.safeParse(mixedData);
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Export Format Tests
// =============================================================================

describe('export format expectations', () => {
  it('exportedAt should be ISO 8601 format', () => {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
    const exportedAt = new Date().toISOString();
    expect(exportedAt).toMatch(isoDateRegex);
  });

  it('version field is included in schema output type', () => {
    const data = {
      version: CURRENT_DATA_VERSION,
      scenarios: [],
      categories: [],
      transactions: [],
      budgetRules: [],
      forecastRules: [],
      forecastEvents: [],
      savingsGoals: [],
    };
    const result = budgetDataSchema.parse(data);
    expect(result.version).toBe(CURRENT_DATA_VERSION);
  });
});
