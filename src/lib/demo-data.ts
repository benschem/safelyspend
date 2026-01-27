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
  const periodId = generateId();
  const everydayAccountId = generateId();
  const savingsAccountId = generateId();
  const groceriesCatId = generateId();
  const rentCatId = generateId();
  const utilitiesCatId = generateId();
  const transportCatId = generateId();
  const entertainmentCatId = generateId();
  const diningCatId = generateId();
  const emergencyFundGoalId = generateId();
  const holidayGoalId = generateId();

  const periods = [
    {
      id: periodId,
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      name: 'FY 2025-26',
      startDate: '2025-07-01',
      endDate: '2026-06-30',
    },
  ];

  const accounts = [
    {
      id: everydayAccountId,
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      name: 'Everyday',
      isArchived: false,
    },
    {
      id: savingsAccountId,
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      name: 'Savings',
      isArchived: false,
    },
  ];

  const openingBalances = [
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      periodId,
      accountId: everydayAccountId,
      amountCents: 520000, // $5,200
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      periodId,
      accountId: savingsAccountId,
      amountCents: 1200000, // $12,000
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

  const budgetLines = [
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      periodId,
      categoryId: groceriesCatId,
      amountCents: 60000,
    }, // $600/month
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      periodId,
      categoryId: rentCatId,
      amountCents: 180000,
    }, // $1,800/month
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      periodId,
      categoryId: utilitiesCatId,
      amountCents: 25000,
    }, // $250/month
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      periodId,
      categoryId: transportCatId,
      amountCents: 20000,
    }, // $200/month
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      periodId,
      categoryId: entertainmentCatId,
      amountCents: 15000,
    }, // $150/month
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      periodId,
      categoryId: diningCatId,
      amountCents: 20000,
    }, // $200/month
  ];

  // Past transactions (last 30 days)
  const transactions = [
    // Income
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      accountId: everydayAccountId,
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
      accountId: everydayAccountId,
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
      accountId: everydayAccountId,
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
      accountId: everydayAccountId,
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
      accountId: everydayAccountId,
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
      accountId: everydayAccountId,
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
      accountId: everydayAccountId,
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
      accountId: everydayAccountId,
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
      accountId: everydayAccountId,
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
      accountId: everydayAccountId,
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
      accountId: everydayAccountId,
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
      accountId: everydayAccountId,
      type: 'expense' as const,
      date: daysAgo(1),
      amountCents: 7200,
      description: 'Dinner date',
      categoryId: diningCatId,
      savingsGoalId: null,
    },
    // Starting balance savings transactions
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      accountId: savingsAccountId,
      type: 'savings' as const,
      date: '2025-07-01', // Period start date
      amountCents: 1200000, // $12,000
      description: 'Starting balance',
      categoryId: null,
      savingsGoalId: emergencyFundGoalId,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      accountId: savingsAccountId,
      type: 'savings' as const,
      date: '2025-07-01', // Period start date
      amountCents: 150000, // $1,500
      description: 'Starting balance',
      categoryId: null,
      savingsGoalId: holidayGoalId,
    },
  ];

  // Future forecasts (next 3 months)
  const forecasts = [
    // Income forecasts
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      periodId,
      type: 'income' as const,
      date: daysFromNow(0),
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
      periodId,
      type: 'income' as const,
      date: daysFromNow(14),
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
      periodId,
      type: 'income' as const,
      date: daysFromNow(28),
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
      periodId,
      type: 'income' as const,
      date: daysFromNow(42),
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
      periodId,
      type: 'income' as const,
      date: daysFromNow(56),
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
      periodId,
      type: 'income' as const,
      date: daysFromNow(70),
      amountCents: 450000,
      description: 'Salary',
      categoryId: null,
      savingsGoalId: null,
    },
    // Expense forecasts
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      periodId,
      type: 'expense' as const,
      date: daysFromNow(5),
      amountCents: 180000,
      description: 'Rent',
      categoryId: rentCatId,
      savingsGoalId: null,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      periodId,
      type: 'expense' as const,
      date: daysFromNow(35),
      amountCents: 180000,
      description: 'Rent',
      categoryId: rentCatId,
      savingsGoalId: null,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      periodId,
      type: 'expense' as const,
      date: daysFromNow(65),
      amountCents: 180000,
      description: 'Rent',
      categoryId: rentCatId,
      savingsGoalId: null,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      periodId,
      type: 'expense' as const,
      date: daysFromNow(10),
      amountCents: 15000,
      description: 'Groceries',
      categoryId: groceriesCatId,
      savingsGoalId: null,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      periodId,
      type: 'expense' as const,
      date: daysFromNow(20),
      amountCents: 15000,
      description: 'Groceries',
      categoryId: groceriesCatId,
      savingsGoalId: null,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      periodId,
      type: 'expense' as const,
      date: daysFromNow(30),
      amountCents: 15000,
      description: 'Groceries',
      categoryId: groceriesCatId,
      savingsGoalId: null,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      periodId,
      type: 'expense' as const,
      date: daysFromNow(15),
      amountCents: 25000,
      description: 'Utilities',
      categoryId: utilitiesCatId,
      savingsGoalId: null,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      periodId,
      type: 'expense' as const,
      date: daysFromNow(45),
      amountCents: 25000,
      description: 'Utilities',
      categoryId: utilitiesCatId,
      savingsGoalId: null,
    },
  ];

  const transfers = [
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      fromAccountId: everydayAccountId,
      toAccountId: savingsAccountId,
      date: daysAgo(20),
      amountCents: 50000, // $500
      notes: 'Monthly savings',
    },
  ];

  const savingsGoals = [
    {
      id: emergencyFundGoalId,
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      periodId: null, // Global goal
      name: 'Emergency Fund',
      targetAmountCents: 2000000, // $20,000
      deadline: '2026-06-30',
    },
    {
      id: holidayGoalId,
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      periodId,
      name: 'Holiday',
      targetAmountCents: 500000, // $5,000
      deadline: '2025-12-01',
    },
  ];

  // Recurring Items
  const recurringItems = [
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      type: 'expense' as const,
      name: 'Rent',
      amountCents: 200000, // $2,000
      frequency: 'monthly' as const,
      dayOfMonth: 1,
      categoryId: categories[0]!.id, // Housing
      isActive: true,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      type: 'expense' as const,
      name: 'Phone Bill',
      amountCents: 8000, // $80
      frequency: 'monthly' as const,
      dayOfMonth: 15,
      categoryId: categories[4]!.id, // Utilities
      isActive: true,
    },
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      type: 'income' as const,
      name: 'Salary',
      amountCents: 650000, // $6,500
      frequency: 'fortnightly' as const,
      dayOfWeek: 5, // Friday
      categoryId: null,
      isActive: true,
    },
  ];

  return {
    periods,
    accounts,
    openingBalances,
    categories,
    budgetLines,
    forecasts,
    transactions,
    transfers,
    savingsGoals,
    recurringItems,
  };
}

export function loadDemoDataToStorage(): void {
  const data = generateDemoData();

  localStorage.setItem('budget:periods', JSON.stringify(data.periods));
  localStorage.setItem('budget:activePeriodId', JSON.stringify(data.periods[0]?.id ?? null));
  localStorage.setItem('budget:accounts', JSON.stringify(data.accounts));
  localStorage.setItem('budget:openingBalances', JSON.stringify(data.openingBalances));
  localStorage.setItem('budget:categories', JSON.stringify(data.categories));
  localStorage.setItem('budget:budgetLines', JSON.stringify(data.budgetLines));
  localStorage.setItem('budget:forecasts', JSON.stringify(data.forecasts));
  localStorage.setItem('budget:transactions', JSON.stringify(data.transactions));
  localStorage.setItem('budget:transfers', JSON.stringify(data.transfers));
  localStorage.setItem('budget:savingsGoals', JSON.stringify(data.savingsGoals));
  localStorage.setItem('budget:recurringItems', JSON.stringify(data.recurringItems));
}

export function clearAllData(): void {
  localStorage.removeItem('budget:periods');
  localStorage.removeItem('budget:activePeriodId');
  localStorage.removeItem('budget:accounts');
  localStorage.removeItem('budget:openingBalances');
  localStorage.removeItem('budget:categories');
  localStorage.removeItem('budget:budgetLines');
  localStorage.removeItem('budget:forecasts');
  localStorage.removeItem('budget:transactions');
  localStorage.removeItem('budget:transfers');
  localStorage.removeItem('budget:savingsGoals');
  localStorage.removeItem('budget:recurringItems');
}
