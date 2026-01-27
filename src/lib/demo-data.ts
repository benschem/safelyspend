import type { BudgetData } from './types';
import { generateId, now } from './utils';

const USER_ID = 'local';
const timestamp = now();

// Helper to create dates relative to today
function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number): string {
  return daysFromNow(-days);
}

export function generateDemoData(): BudgetData {
  // IDs
  const scenarioId = generateId();
  const groceriesCatId = generateId();
  const rentCatId = generateId();
  const utilitiesCatId = generateId();
  const transportCatId = generateId();
  const entertainmentCatId = generateId();
  const diningCatId = generateId();
  const emergencyFundGoalId = generateId();
  const holidayGoalId = generateId();

  // Scenarios (replaces periods)
  const scenarios = [
    {
      id: scenarioId,
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      name: 'Main Budget',
      description: 'My primary budget scenario',
      isDefault: true,
    },
  ];

  const categories = [
    {
      id: groceriesCatId,
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      name: 'Groceries',
      isArchived: false,
    },
    {
      id: rentCatId,
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      name: 'Rent',
      isArchived: false,
    },
    {
      id: utilitiesCatId,
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      name: 'Utilities',
      isArchived: false,
    },
    {
      id: transportCatId,
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      name: 'Transport',
      isArchived: false,
    },
    {
      id: entertainmentCatId,
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      name: 'Entertainment',
      isArchived: false,
    },
    {
      id: diningCatId,
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      name: 'Dining Out',
      isArchived: false,
    },
  ];

  // Budget rules with cadence (replaces budgetLines)
  const budgetRules = [
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      scenarioId,
      categoryId: groceriesCatId,
      amountCents: 60000, // $600/month
      cadence: 'monthly' as const,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      scenarioId,
      categoryId: rentCatId,
      amountCents: 180000, // $1,800/month
      cadence: 'monthly' as const,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      scenarioId,
      categoryId: utilitiesCatId,
      amountCents: 25000, // $250/month
      cadence: 'monthly' as const,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      scenarioId,
      categoryId: transportCatId,
      amountCents: 20000, // $200/month
      cadence: 'monthly' as const,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      scenarioId,
      categoryId: entertainmentCatId,
      amountCents: 15000, // $150/month
      cadence: 'monthly' as const,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      scenarioId,
      categoryId: diningCatId,
      amountCents: 20000, // $200/month
      cadence: 'monthly' as const,
    },
  ];

  // Forecast rules (recurring patterns - replaces recurringItems)
  const forecastRules = [
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      scenarioId,
      type: 'income' as const,
      amountCents: 450000, // $4,500 fortnightly
      cadence: 'fortnightly' as const,
      dayOfWeek: 5, // Friday
      description: 'Salary',
      categoryId: null,
      savingsGoalId: null,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      scenarioId,
      type: 'expense' as const,
      amountCents: 180000, // $1,800/month
      cadence: 'monthly' as const,
      dayOfMonth: 1,
      description: 'Rent',
      categoryId: rentCatId,
      savingsGoalId: null,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      scenarioId,
      type: 'expense' as const,
      amountCents: 15000, // $150/week groceries
      cadence: 'weekly' as const,
      dayOfWeek: 6, // Saturday
      description: 'Groceries',
      categoryId: groceriesCatId,
      savingsGoalId: null,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      scenarioId,
      type: 'expense' as const,
      amountCents: 25000, // $250/month utilities
      cadence: 'monthly' as const,
      dayOfMonth: 15,
      description: 'Utilities',
      categoryId: utilitiesCatId,
      savingsGoalId: null,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      scenarioId,
      type: 'savings' as const,
      amountCents: 50000, // $500/month to emergency fund
      cadence: 'monthly' as const,
      dayOfMonth: 1,
      description: 'Emergency fund contribution',
      categoryId: null,
      savingsGoalId: emergencyFundGoalId,
    },
  ];

  // Forecast events (one-off specific date forecasts)
  const forecastEvents = [
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      scenarioId,
      type: 'expense' as const,
      date: daysFromNow(45),
      amountCents: 120000, // $1,200 car service
      description: 'Car service',
      categoryId: transportCatId,
      savingsGoalId: null,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      scenarioId,
      type: 'expense' as const,
      date: daysFromNow(90),
      amountCents: 80000, // $800 car rego
      description: 'Car registration',
      categoryId: transportCatId,
      savingsGoalId: null,
    },
  ];

  // Past transactions (global facts)
  const transactions = [
    // Opening balance adjustment
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      type: 'adjustment' as const,
      date: daysAgo(30),
      amountCents: 520000, // $5,200 starting balance
      description: 'Opening balance',
      categoryId: null,
      savingsGoalId: null,
    },
    // Income
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      type: 'income' as const,
      date: daysAgo(28),
      amountCents: 450000,
      description: 'Salary',
      categoryId: null,
      savingsGoalId: null,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      type: 'income' as const,
      date: daysAgo(14),
      amountCents: 450000,
      description: 'Salary',
      categoryId: null,
      savingsGoalId: null,
    },
    // Expenses
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      type: 'expense' as const,
      date: daysAgo(25),
      amountCents: 180000,
      description: 'Monthly rent',
      categoryId: rentCatId,
      savingsGoalId: null,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      type: 'expense' as const,
      date: daysAgo(20),
      amountCents: 15600,
      description: 'Woolworths',
      categoryId: groceriesCatId,
      savingsGoalId: null,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      type: 'expense' as const,
      date: daysAgo(18),
      amountCents: 8500,
      description: 'Electricity bill',
      categoryId: utilitiesCatId,
      savingsGoalId: null,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      type: 'expense' as const,
      date: daysAgo(15),
      amountCents: 4500,
      description: 'Uber',
      categoryId: transportCatId,
      savingsGoalId: null,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      type: 'expense' as const,
      date: daysAgo(12),
      amountCents: 12300,
      description: 'Coles',
      categoryId: groceriesCatId,
      savingsGoalId: null,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      type: 'expense' as const,
      date: daysAgo(10),
      amountCents: 6500,
      description: 'Netflix + Spotify',
      categoryId: entertainmentCatId,
      savingsGoalId: null,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      type: 'expense' as const,
      date: daysAgo(8),
      amountCents: 4800,
      description: 'Lunch with friends',
      categoryId: diningCatId,
      savingsGoalId: null,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      type: 'expense' as const,
      date: daysAgo(5),
      amountCents: 9800,
      description: 'Aldi',
      categoryId: groceriesCatId,
      savingsGoalId: null,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      type: 'expense' as const,
      date: daysAgo(3),
      amountCents: 3500,
      description: 'Bus pass',
      categoryId: transportCatId,
      savingsGoalId: null,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      type: 'expense' as const,
      date: daysAgo(1),
      amountCents: 7200,
      description: 'Dinner date',
      categoryId: diningCatId,
      savingsGoalId: null,
    },
    // Savings transactions
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      type: 'savings' as const,
      date: daysAgo(25),
      amountCents: 50000, // $500
      description: 'Monthly savings',
      categoryId: null,
      savingsGoalId: emergencyFundGoalId,
    },
  ];

  // Savings goals are now global (no periodId)
  const savingsGoals = [
    {
      id: emergencyFundGoalId,
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      name: 'Emergency Fund',
      targetAmountCents: 2000000, // $20,000
      deadline: '2026-06-30',
    },
    {
      id: holidayGoalId,
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      name: 'Holiday',
      targetAmountCents: 500000, // $5,000
      deadline: '2025-12-01',
    },
  ];

  return {
    scenarios,
    categories,
    budgetRules,
    forecastRules,
    forecastEvents,
    transactions,
    savingsGoals,
  };
}

export function loadDemoDataToStorage(): void {
  const data = generateDemoData();

  localStorage.setItem('budget:scenarios', JSON.stringify(data.scenarios));
  localStorage.setItem('budget:activeScenarioId', JSON.stringify(data.scenarios[0]?.id ?? null));
  localStorage.setItem('budget:categories', JSON.stringify(data.categories));
  localStorage.setItem('budget:budgetRules', JSON.stringify(data.budgetRules));
  localStorage.setItem('budget:forecastRules', JSON.stringify(data.forecastRules));
  localStorage.setItem('budget:forecastEvents', JSON.stringify(data.forecastEvents));
  localStorage.setItem('budget:transactions', JSON.stringify(data.transactions));
  localStorage.setItem('budget:savingsGoals', JSON.stringify(data.savingsGoals));
  localStorage.setItem('budget:appConfig', JSON.stringify({ isInitialized: true }));
}

export function clearAllData(): void {
  localStorage.removeItem('budget:scenarios');
  localStorage.removeItem('budget:activeScenarioId');
  localStorage.removeItem('budget:categories');
  localStorage.removeItem('budget:budgetRules');
  localStorage.removeItem('budget:forecastRules');
  localStorage.removeItem('budget:forecastEvents');
  localStorage.removeItem('budget:transactions');
  localStorage.removeItem('budget:savingsGoals');
  localStorage.removeItem('budget:viewState');
  localStorage.removeItem('budget:appConfig');
}
