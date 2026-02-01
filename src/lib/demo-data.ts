import type { BudgetData } from './types';
import { now } from './utils';
import { loadDemoData, resetDatabase } from './db';
import { generatePersonaData, personas, defaultPersonaId, getPersona } from './demo-personas';
import type { GeneratedData } from './demo-personas';
import { STORAGE_KEYS } from './storage-keys';

const USER_ID = 'local';

/**
 * Get the current demo persona ID from localStorage
 */
export function getDemoPersonaId(): string {
  if (typeof window === 'undefined') return defaultPersonaId;
  return localStorage.getItem(STORAGE_KEYS.DEMO_PERSONA) ?? defaultPersonaId;
}

/**
 * Set the current demo persona ID in localStorage
 */
export function setDemoPersonaId(personaId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.DEMO_PERSONA, personaId);
}

/**
 * Get all available personas for the selector
 */
export function getAvailablePersonas(): Array<{ id: string; name: string; tagline: string }> {
  return personas.map((p) => ({
    id: p.id,
    name: p.name,
    tagline: p.tagline,
  }));
}

/**
 * Convert GeneratedData to BudgetData format (adds BaseEntity fields)
 */
function convertToBudgetData(generated: GeneratedData): BudgetData {
  const timestamp = now();

  return {
    scenarios: generated.scenarios.map((s) => {
      const scenario: BudgetData['scenarios'][0] = {
        id: s.id,
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        name: s.name,
        isDefault: s.isDefault,
      };
      if (s.description) scenario.description = s.description;
      return scenario;
    }),

    categories: generated.categories.map((c) => ({
      id: c.id,
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      name: c.name,
      isArchived: false,
    })),

    budgetRules: generated.budgetRules.map((r) => ({
      id: r.id,
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      scenarioId: r.scenarioId,
      categoryId: r.categoryId,
      amountCents: r.amountCents,
      cadence: r.cadence,
    })),

    forecastRules: generated.forecastRules.map((r) => {
      const rule: BudgetData['forecastRules'][0] = {
        id: r.id,
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        scenarioId: r.scenarioId,
        type: r.type === 'adjustment' ? 'expense' : r.type,
        amountCents: r.amountCents,
        cadence: r.cadence,
        description: r.description,
        categoryId: r.categoryId,
        savingsGoalId: r.savingsGoalId ?? null,
      };
      if (r.dayOfWeek !== undefined) rule.dayOfWeek = r.dayOfWeek;
      if (r.dayOfMonth !== undefined) rule.dayOfMonth = r.dayOfMonth;
      return rule;
    }),

    transactions: generated.transactions.map((t) => {
      const transaction: BudgetData['transactions'][0] = {
        id: t.id,
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: t.type,
        date: t.date,
        amountCents: t.amountCents,
        description: t.description,
        categoryId: t.categoryId,
        savingsGoalId: t.savingsGoalId ?? null,
      };
      if (t.notes) transaction.notes = t.notes;
      return transaction;
    }),

    savingsGoals: generated.savingsGoals.map((g) => {
      const goal: BudgetData['savingsGoals'][0] = {
        id: g.id,
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        name: g.name,
        targetAmountCents: g.targetAmountCents,
      };
      if (g.deadline) goal.deadline = g.deadline;
      if (g.annualInterestRate) goal.annualInterestRate = g.annualInterestRate;
      if (g.isEmergencyFund) goal.isEmergencyFund = g.isEmergencyFund;
      return goal;
    }),

    balanceAnchors: generated.balanceAnchors.map((a) => ({
      id: a.id,
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      date: a.date,
      balanceCents: a.balanceCents,
      label: a.description,
    })),

    savingsAnchors: [],

    categoryRules: [],
  };
}

/**
 * Generate demo data for a specific persona
 */
export function generateDemoData(personaId?: string): BudgetData {
  const id = personaId ?? getDemoPersonaId();
  const persona = getPersona(id) ?? getPersona(defaultPersonaId)!;
  const generated = generatePersonaData(persona, new Date());
  return convertToBudgetData(generated);
}

/**
 * Load demo data for the current persona into IndexedDB
 */
export async function loadDemoDataToStorage(personaId?: string): Promise<void> {
  const id = personaId ?? getDemoPersonaId();
  setDemoPersonaId(id);
  const data = generateDemoData(id);
  await loadDemoData(data);
}

/**
 * Switch to a different persona (regenerates all data)
 */
export async function switchPersona(personaId: string): Promise<void> {
  await loadDemoDataToStorage(personaId);
}

/**
 * Clear all data and reset to initial state
 */
export async function clearAllData(): Promise<void> {
  localStorage.removeItem(STORAGE_KEYS.DEMO_PERSONA);
  await resetDatabase();
}
