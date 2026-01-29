import type { BudgetData } from './types';
import { generateId, now } from './utils';
import { loadDemoData, resetDatabase } from './db';

const USER_ID = 'local';

// Helper to create dates relative to today
function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function monthsFromNow(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

// Get a specific day of month, months from now
function getDateInMonth(monthsFromNow: number, dayOfMonth: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + monthsFromNow);
  date.setDate(Math.min(dayOfMonth, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  return date.toISOString().slice(0, 10);
}

// Get the Nth occurrence of a weekday in a month relative to now
function getWeekdayInMonth(monthsFromNow: number, weekNumber: number, dayOfWeek: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + monthsFromNow);
  date.setDate(1);

  // Find first occurrence of the day
  while (date.getDay() !== dayOfWeek) {
    date.setDate(date.getDate() + 1);
  }

  // Add weeks
  date.setDate(date.getDate() + (weekNumber - 1) * 7);

  return date.toISOString().slice(0, 10);
}

// Add slight variation to an amount (±variance%)
function vary(amount: number, variance: number = 0.1): number {
  const factor = 1 + (Math.random() * 2 - 1) * variance;
  return Math.round(amount * factor);
}

// Random day within a range in a month
function randomDayInMonth(monthsFromNow: number, startDay: number, endDay: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + monthsFromNow);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const day = startDay + Math.floor(Math.random() * (Math.min(endDay, lastDay) - startDay + 1));
  date.setDate(day);
  return date.toISOString().slice(0, 10);
}

// Pick random item from array
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function generateDemoData(): BudgetData {
  const timestamp = now();

  // Generate all IDs upfront
  const scenarioId = generateId();
  const scenarioPayRiseId = generateId();
  const scenarioAggressiveSavingsId = generateId();

  // ==========================================================================
  // CATEGORIES - Organised like a real Aussie budget
  // ==========================================================================
  const catRent = generateId();
  const catElectricity = generateId();
  const catGas = generateId();
  const catWater = generateId();
  const catInternet = generateId();
  const catGroceries = generateId();
  const catPetrol = generateId();
  const catPublicTransport = generateId();
  const catCarMaintenance = generateId();
  const catCarInsurance = generateId();
  const catPhone = generateId();
  const catCoffee = generateId();
  const catDiningOut = generateId();
  const catTakeaway = generateId();
  const catEntertainment = generateId();
  const catShopping = generateId();
  const catClothing = generateId();
  const catSubscriptions = generateId();
  const catHealthcare = generateId();
  const catPersonalCare = generateId();
  const catGifts = generateId();
  const catPet = generateId();
  const catHomeInsurance = generateId();
  const catHealthInsurance = generateId();

  // Savings goals
  const goalEmergency = generateId();
  const goalHoliday = generateId();
  const goalNewCar = generateId();
  const goalHouseDeposit = generateId();
  const goalChristmas = generateId();

  // ==========================================================================
  // SCENARIOS
  // ==========================================================================
  const scenarios = [
    {
      id: scenarioId,
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      name: 'Main Budget',
      description: 'My everyday budget',
      isDefault: true,
    },
    {
      id: scenarioPayRiseId,
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      name: 'Pay Rise',
      description: 'What if I get a 15% raise?',
      isDefault: false,
    },
    {
      id: scenarioAggressiveSavingsId,
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      name: 'Aggressive Savings',
      description: 'Cut spending, maximise house deposit',
      isDefault: false,
    },
  ];

  // ==========================================================================
  // CATEGORIES
  // ==========================================================================
  const categories = [
    // Housing & Utilities
    { id: catRent, name: 'Rent' },
    { id: catElectricity, name: 'Electricity' },
    { id: catGas, name: 'Gas' },
    { id: catWater, name: 'Water' },
    { id: catInternet, name: 'Internet' },
    { id: catHomeInsurance, name: 'Home Insurance' },
    // Transport
    { id: catPetrol, name: 'Petrol' },
    { id: catPublicTransport, name: 'Public Transport' },
    { id: catCarMaintenance, name: 'Car Maintenance' },
    { id: catCarInsurance, name: 'Car Insurance' },
    // Food & Drink
    { id: catGroceries, name: 'Groceries' },
    { id: catCoffee, name: 'Coffee' },
    { id: catDiningOut, name: 'Dining Out' },
    { id: catTakeaway, name: 'Takeaway' },
    // Lifestyle
    { id: catEntertainment, name: 'Entertainment' },
    { id: catShopping, name: 'Shopping' },
    { id: catClothing, name: 'Clothing' },
    { id: catSubscriptions, name: 'Subscriptions' },
    { id: catGifts, name: 'Gifts' },
    // Health & Personal
    { id: catHealthcare, name: 'Healthcare' },
    { id: catHealthInsurance, name: 'Health Insurance' },
    { id: catPersonalCare, name: 'Personal Care' },
    // Other
    { id: catPhone, name: 'Phone' },
    { id: catPet, name: 'Pet' },
  ].map((c) => ({
    ...c,
    userId: USER_ID,
    createdAt: timestamp,
    updatedAt: timestamp,
    isArchived: false,
  }));

  // ==========================================================================
  // SAVINGS GOALS
  // ==========================================================================
  const savingsGoals = [
    {
      id: goalEmergency,
      name: 'Emergency Fund',
      targetAmountCents: 1500000, // $15,000 (3 months expenses)
      deadline: monthsFromNow(18),
      annualInterestRate: 4.5, // High-yield savings account
      compoundingFrequency: 'monthly' as const,
    },
    {
      id: goalHoliday,
      name: 'Bali Trip',
      targetAmountCents: 400000, // $4,000
      deadline: monthsFromNow(6),
    },
    {
      id: goalNewCar,
      name: 'New Car Fund',
      targetAmountCents: 2500000, // $25,000
      deadline: monthsFromNow(36),
      annualInterestRate: 4.5,
      compoundingFrequency: 'monthly' as const,
    },
    {
      id: goalHouseDeposit,
      name: 'House Deposit',
      targetAmountCents: 10000000, // $100,000
      deadline: monthsFromNow(60),
      annualInterestRate: 5.0, // Term deposit
      compoundingFrequency: 'monthly' as const,
    },
    {
      id: goalChristmas,
      name: 'Christmas Fund',
      targetAmountCents: 150000, // $1,500
      deadline: monthsFromNow(11), // Next Christmas
    },
  ].map((g) => ({
    ...g,
    userId: USER_ID,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  // ==========================================================================
  // BUDGET RULES - Mixed cadences like a real Aussie budget
  // ==========================================================================
  const budgetRules = [
    // FORTNIGHTLY - Aligned with typical Aussie pay cycle
    { categoryId: catRent, amountCents: 92500, cadence: 'fortnightly' as const }, // $925/fn ($2,000/mo equivalent)
    { categoryId: catGroceries, amountCents: 30000, cadence: 'fortnightly' as const }, // $300/fn
    { categoryId: catPetrol, amountCents: 12000, cadence: 'fortnightly' as const }, // $120/fn
    { categoryId: catDiningOut, amountCents: 15000, cadence: 'fortnightly' as const }, // $150/fn
    { categoryId: catTakeaway, amountCents: 8000, cadence: 'fortnightly' as const }, // $80/fn (Uber Eats etc)

    // WEEKLY - Things you track week by week
    { categoryId: catCoffee, amountCents: 3500, cadence: 'weekly' as const }, // $35/wk (about $5/day)
    { categoryId: catPublicTransport, amountCents: 5000, cadence: 'weekly' as const }, // $50/wk Opal
    { categoryId: catEntertainment, amountCents: 5000, cadence: 'weekly' as const }, // $50/wk

    // MONTHLY - Regular monthly expenses
    { categoryId: catInternet, amountCents: 8900, cadence: 'monthly' as const }, // $89/mo
    { categoryId: catPhone, amountCents: 6500, cadence: 'monthly' as const }, // $65/mo
    { categoryId: catSubscriptions, amountCents: 7500, cadence: 'monthly' as const }, // $75/mo (Netflix, Spotify, etc)
    { categoryId: catShopping, amountCents: 20000, cadence: 'monthly' as const }, // $200/mo
    // catClothing intentionally unbudgeted to demo the warning
    { categoryId: catPersonalCare, amountCents: 8000, cadence: 'monthly' as const }, // $80/mo
    { categoryId: catHealthcare, amountCents: 10000, cadence: 'monthly' as const }, // $100/mo
    { categoryId: catPet, amountCents: 15000, cadence: 'monthly' as const }, // $150/mo (food + vet fund)
    // catGifts intentionally unbudgeted to demo the warning

    // QUARTERLY - Australian utilities are typically quarterly
    { categoryId: catElectricity, amountCents: 45000, cadence: 'quarterly' as const }, // $450/qtr
    { categoryId: catGas, amountCents: 20000, cadence: 'quarterly' as const }, // $200/qtr
    { categoryId: catWater, amountCents: 25000, cadence: 'quarterly' as const }, // $250/qtr
    { categoryId: catCarMaintenance, amountCents: 40000, cadence: 'quarterly' as const }, // $400/qtr (service fund)

    // YEARLY - Annual expenses
    { categoryId: catCarInsurance, amountCents: 120000, cadence: 'yearly' as const }, // $1,200/yr
    { categoryId: catHomeInsurance, amountCents: 150000, cadence: 'yearly' as const }, // $1,500/yr (contents)
    { categoryId: catHealthInsurance, amountCents: 180000, cadence: 'yearly' as const }, // $1,800/yr (after rebate)
  ].map((r) => ({
    id: generateId(),
    userId: USER_ID,
    createdAt: timestamp,
    updatedAt: timestamp,
    scenarioId,
    ...r,
  }));

  // ==========================================================================
  // BUDGET RULES - Pay Rise Scenario (same budgets as main)
  // ==========================================================================
  const budgetRulesPayRise = [
    // Same budgets as main - the difference is in income forecast
    { categoryId: catRent, amountCents: 92500, cadence: 'fortnightly' as const },
    { categoryId: catGroceries, amountCents: 30000, cadence: 'fortnightly' as const },
    { categoryId: catPetrol, amountCents: 12000, cadence: 'fortnightly' as const },
    { categoryId: catDiningOut, amountCents: 15000, cadence: 'fortnightly' as const },
    { categoryId: catTakeaway, amountCents: 8000, cadence: 'fortnightly' as const },
    { categoryId: catCoffee, amountCents: 3500, cadence: 'weekly' as const },
    { categoryId: catPublicTransport, amountCents: 5000, cadence: 'weekly' as const },
    { categoryId: catEntertainment, amountCents: 5000, cadence: 'weekly' as const },
    { categoryId: catInternet, amountCents: 8900, cadence: 'monthly' as const },
    { categoryId: catPhone, amountCents: 6500, cadence: 'monthly' as const },
    { categoryId: catSubscriptions, amountCents: 7500, cadence: 'monthly' as const },
    { categoryId: catShopping, amountCents: 20000, cadence: 'monthly' as const },
    { categoryId: catPersonalCare, amountCents: 8000, cadence: 'monthly' as const },
    { categoryId: catHealthcare, amountCents: 10000, cadence: 'monthly' as const },
    { categoryId: catPet, amountCents: 15000, cadence: 'monthly' as const },
    { categoryId: catElectricity, amountCents: 45000, cadence: 'quarterly' as const },
    { categoryId: catGas, amountCents: 20000, cadence: 'quarterly' as const },
    { categoryId: catWater, amountCents: 25000, cadence: 'quarterly' as const },
    { categoryId: catCarMaintenance, amountCents: 40000, cadence: 'quarterly' as const },
    { categoryId: catCarInsurance, amountCents: 120000, cadence: 'yearly' as const },
    { categoryId: catHomeInsurance, amountCents: 150000, cadence: 'yearly' as const },
    { categoryId: catHealthInsurance, amountCents: 180000, cadence: 'yearly' as const },
  ].map((r) => ({
    id: generateId(),
    userId: USER_ID,
    createdAt: timestamp,
    updatedAt: timestamp,
    scenarioId: scenarioPayRiseId,
    ...r,
  }));

  // ==========================================================================
  // BUDGET RULES - Aggressive Savings (reduced discretionary spending)
  // ==========================================================================
  const budgetRulesAggressiveSavings = [
    // Essential spending - same as main
    { categoryId: catRent, amountCents: 92500, cadence: 'fortnightly' as const },
    { categoryId: catGroceries, amountCents: 25000, cadence: 'fortnightly' as const }, // Reduced from $300
    { categoryId: catPetrol, amountCents: 10000, cadence: 'fortnightly' as const }, // Reduced
    // Discretionary - heavily reduced
    { categoryId: catDiningOut, amountCents: 5000, cadence: 'fortnightly' as const }, // Reduced from $150
    { categoryId: catTakeaway, amountCents: 3000, cadence: 'fortnightly' as const }, // Reduced from $80
    { categoryId: catCoffee, amountCents: 1500, cadence: 'weekly' as const }, // Reduced - make at home more
    { categoryId: catPublicTransport, amountCents: 5000, cadence: 'weekly' as const },
    { categoryId: catEntertainment, amountCents: 2500, cadence: 'weekly' as const }, // Reduced from $50
    // Monthly - reduced discretionary
    { categoryId: catInternet, amountCents: 8900, cadence: 'monthly' as const },
    { categoryId: catPhone, amountCents: 6500, cadence: 'monthly' as const },
    { categoryId: catSubscriptions, amountCents: 4000, cadence: 'monthly' as const }, // Cut some subscriptions
    { categoryId: catShopping, amountCents: 10000, cadence: 'monthly' as const }, // Reduced from $200
    { categoryId: catPersonalCare, amountCents: 5000, cadence: 'monthly' as const }, // Reduced
    { categoryId: catHealthcare, amountCents: 10000, cadence: 'monthly' as const },
    { categoryId: catPet, amountCents: 15000, cadence: 'monthly' as const },
    // Utilities - same
    { categoryId: catElectricity, amountCents: 45000, cadence: 'quarterly' as const },
    { categoryId: catGas, amountCents: 20000, cadence: 'quarterly' as const },
    { categoryId: catWater, amountCents: 25000, cadence: 'quarterly' as const },
    { categoryId: catCarMaintenance, amountCents: 40000, cadence: 'quarterly' as const },
    { categoryId: catCarInsurance, amountCents: 120000, cadence: 'yearly' as const },
    { categoryId: catHomeInsurance, amountCents: 150000, cadence: 'yearly' as const },
    { categoryId: catHealthInsurance, amountCents: 180000, cadence: 'yearly' as const },
  ].map((r) => ({
    id: generateId(),
    userId: USER_ID,
    createdAt: timestamp,
    updatedAt: timestamp,
    scenarioId: scenarioAggressiveSavingsId,
    ...r,
  }));

  // ==========================================================================
  // FORECAST RULES (recurring patterns)
  // ==========================================================================
  const forecastRules = [
    // Income - fortnightly salary on Thursday (typical Aussie pay day)
    {
      type: 'income' as const,
      amountCents: 295000, // $2,950 net fortnightly (~$77k gross annual)
      cadence: 'fortnightly' as const,
      dayOfWeek: 4, // Thursday
      description: 'Salary - PAYG',
      categoryId: null,
      savingsGoalId: null,
    },
    // Rent - fortnightly on Monday (common in Aus)
    {
      type: 'expense' as const,
      amountCents: 92500, // $925 fortnightly
      cadence: 'fortnightly' as const,
      dayOfWeek: 1, // Monday
      description: 'Rent',
      categoryId: catRent,
      savingsGoalId: null,
    },
    // Utilities - quarterly (Australian standard)
    {
      type: 'expense' as const,
      amountCents: 45000, // $450 quarterly electricity
      cadence: 'quarterly' as const,
      dayOfMonth: 15,
      monthOfQuarter: 1, // 2nd month of quarter
      description: 'AGL Electricity',
      categoryId: catElectricity,
      savingsGoalId: null,
    },
    {
      type: 'expense' as const,
      amountCents: 20000, // $200 quarterly gas
      cadence: 'quarterly' as const,
      dayOfMonth: 20,
      monthOfQuarter: 1,
      description: 'Origin Gas',
      categoryId: catGas,
      savingsGoalId: null,
    },
    {
      type: 'expense' as const,
      amountCents: 25000, // $250 quarterly water
      cadence: 'quarterly' as const,
      dayOfMonth: 10,
      monthOfQuarter: 2, // 3rd month of quarter
      description: 'Sydney Water',
      categoryId: catWater,
      savingsGoalId: null,
    },
    // Monthly bills
    {
      type: 'expense' as const,
      amountCents: 8900, // $89 internet
      cadence: 'monthly' as const,
      dayOfMonth: 5,
      description: 'Aussie Broadband',
      categoryId: catInternet,
      savingsGoalId: null,
    },
    {
      type: 'expense' as const,
      amountCents: 6500, // $65 phone
      cadence: 'monthly' as const,
      dayOfMonth: 12,
      description: 'Telstra Mobile',
      categoryId: catPhone,
      savingsGoalId: null,
    },
    {
      type: 'expense' as const,
      amountCents: 15000, // $150 health insurance
      cadence: 'monthly' as const,
      dayOfMonth: 1,
      description: 'Medibank Private',
      categoryId: catHealthInsurance,
      savingsGoalId: null,
    },
    // Weekly groceries - Saturday shop
    {
      type: 'expense' as const,
      amountCents: 15000, // $150/week main shop
      cadence: 'weekly' as const,
      dayOfWeek: 6, // Saturday
      description: 'Weekly groceries',
      categoryId: catGroceries,
      savingsGoalId: null,
    },
    // Weekly public transport
    {
      type: 'expense' as const,
      amountCents: 5000, // $50/week Opal
      cadence: 'weekly' as const,
      dayOfWeek: 1, // Monday (weekly cap resets)
      description: 'Opal top-up',
      categoryId: catPublicTransport,
      savingsGoalId: null,
    },
    // Fortnightly petrol
    {
      type: 'expense' as const,
      amountCents: 12000, // $120 fortnightly
      cadence: 'fortnightly' as const,
      dayOfWeek: 0, // Sunday fill-up
      description: 'Petrol',
      categoryId: catPetrol,
      savingsGoalId: null,
    },
    // Monthly subscriptions
    {
      type: 'expense' as const,
      amountCents: 2299, // Netflix
      cadence: 'monthly' as const,
      dayOfMonth: 8,
      description: 'Netflix',
      categoryId: catSubscriptions,
      savingsGoalId: null,
    },
    {
      type: 'expense' as const,
      amountCents: 1299, // Spotify
      cadence: 'monthly' as const,
      dayOfMonth: 15,
      description: 'Spotify',
      categoryId: catSubscriptions,
      savingsGoalId: null,
    },
    {
      type: 'expense' as const,
      amountCents: 699, // iCloud
      cadence: 'monthly' as const,
      dayOfMonth: 22,
      description: 'iCloud Storage',
      categoryId: catSubscriptions,
      savingsGoalId: null,
    },
    {
      type: 'expense' as const,
      amountCents: 1799, // Stan
      cadence: 'monthly' as const,
      dayOfMonth: 3,
      description: 'Stan',
      categoryId: catSubscriptions,
      savingsGoalId: null,
    },
    // Pet expenses - monthly
    {
      type: 'expense' as const,
      amountCents: 8000, // $80 pet food
      cadence: 'monthly' as const,
      dayOfMonth: 1,
      description: 'Pet Circle - Dog food',
      categoryId: catPet,
      savingsGoalId: null,
    },
    // Annual insurance (monthly direct debit equivalent shown)
    {
      type: 'expense' as const,
      amountCents: 10000, // $100/mo car insurance
      cadence: 'monthly' as const,
      dayOfMonth: 28,
      description: 'NRMA Car Insurance',
      categoryId: catCarInsurance,
      savingsGoalId: null,
    },
    {
      type: 'expense' as const,
      amountCents: 12500, // $125/mo contents insurance
      cadence: 'monthly' as const,
      dayOfMonth: 28,
      description: 'RACV Contents Insurance',
      categoryId: catHomeInsurance,
      savingsGoalId: null,
    },
    // Savings contributions - day after pay day
    {
      type: 'savings' as const,
      amountCents: 20000, // $200/fortnight to emergency fund
      cadence: 'fortnightly' as const,
      dayOfWeek: 5, // Friday (day after payday)
      description: 'Emergency fund',
      categoryId: null,
      savingsGoalId: goalEmergency,
    },
    {
      type: 'savings' as const,
      amountCents: 15000, // $150/fortnight to holiday
      cadence: 'fortnightly' as const,
      dayOfWeek: 5,
      description: 'Bali trip fund',
      categoryId: null,
      savingsGoalId: goalHoliday,
    },
    {
      type: 'savings' as const,
      amountCents: 20000, // $200/fortnight to house deposit
      cadence: 'fortnightly' as const,
      dayOfWeek: 5,
      description: 'House deposit',
      categoryId: null,
      savingsGoalId: goalHouseDeposit,
    },
    {
      type: 'savings' as const,
      amountCents: 10000, // $100/fortnight to car fund
      cadence: 'fortnightly' as const,
      dayOfWeek: 5,
      description: 'New car fund',
      categoryId: null,
      savingsGoalId: goalNewCar,
    },
    {
      type: 'savings' as const,
      amountCents: 5000, // $50/fortnight to Christmas
      cadence: 'fortnightly' as const,
      dayOfWeek: 5,
      description: 'Christmas fund',
      categoryId: null,
      savingsGoalId: goalChristmas,
    },
  ].map((r) => ({
    id: generateId(),
    userId: USER_ID,
    createdAt: timestamp,
    updatedAt: timestamp,
    scenarioId,
    ...r,
  }));

  // ==========================================================================
  // FORECAST RULES - Pay Rise Scenario (15% higher salary, extra goes to savings)
  // ==========================================================================
  const forecastRulesPayRise = [
    // Income - 15% higher salary ($3,393 vs $2,950)
    {
      type: 'income' as const,
      amountCents: 339250, // $3,392.50 net fortnightly (~$88k gross)
      cadence: 'fortnightly' as const,
      dayOfWeek: 4,
      description: 'Salary - PAYG (after raise)',
      categoryId: null,
      savingsGoalId: null,
    },
    // Same expenses as main scenario
    { type: 'expense' as const, amountCents: 92500, cadence: 'fortnightly' as const, dayOfWeek: 1, description: 'Rent', categoryId: catRent, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 45000, cadence: 'quarterly' as const, dayOfMonth: 15, monthOfQuarter: 1, description: 'AGL Electricity', categoryId: catElectricity, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 20000, cadence: 'quarterly' as const, dayOfMonth: 20, monthOfQuarter: 1, description: 'Origin Gas', categoryId: catGas, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 25000, cadence: 'quarterly' as const, dayOfMonth: 10, monthOfQuarter: 2, description: 'Sydney Water', categoryId: catWater, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 8900, cadence: 'monthly' as const, dayOfMonth: 5, description: 'Aussie Broadband', categoryId: catInternet, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 6500, cadence: 'monthly' as const, dayOfMonth: 12, description: 'Telstra Mobile', categoryId: catPhone, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 15000, cadence: 'monthly' as const, dayOfMonth: 1, description: 'Medibank Private', categoryId: catHealthInsurance, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 15000, cadence: 'weekly' as const, dayOfWeek: 6, description: 'Weekly groceries', categoryId: catGroceries, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 5000, cadence: 'weekly' as const, dayOfWeek: 1, description: 'Opal top-up', categoryId: catPublicTransport, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 12000, cadence: 'fortnightly' as const, dayOfWeek: 0, description: 'Petrol', categoryId: catPetrol, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 2299, cadence: 'monthly' as const, dayOfMonth: 8, description: 'Netflix', categoryId: catSubscriptions, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 1299, cadence: 'monthly' as const, dayOfMonth: 15, description: 'Spotify', categoryId: catSubscriptions, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 699, cadence: 'monthly' as const, dayOfMonth: 22, description: 'iCloud Storage', categoryId: catSubscriptions, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 1799, cadence: 'monthly' as const, dayOfMonth: 3, description: 'Stan', categoryId: catSubscriptions, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 8000, cadence: 'monthly' as const, dayOfMonth: 1, description: 'Pet Circle - Dog food', categoryId: catPet, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 10000, cadence: 'monthly' as const, dayOfMonth: 28, description: 'NRMA Car Insurance', categoryId: catCarInsurance, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 12500, cadence: 'monthly' as const, dayOfMonth: 28, description: 'RACV Contents Insurance', categoryId: catHomeInsurance, savingsGoalId: null },
    // Enhanced savings - extra income goes to house deposit
    { type: 'savings' as const, amountCents: 20000, cadence: 'fortnightly' as const, dayOfWeek: 5, description: 'Emergency fund', categoryId: null, savingsGoalId: goalEmergency },
    { type: 'savings' as const, amountCents: 15000, cadence: 'fortnightly' as const, dayOfWeek: 5, description: 'Bali trip fund', categoryId: null, savingsGoalId: goalHoliday },
    { type: 'savings' as const, amountCents: 45000, cadence: 'fortnightly' as const, dayOfWeek: 5, description: 'House deposit (boosted)', categoryId: null, savingsGoalId: goalHouseDeposit }, // $450 vs $200
    { type: 'savings' as const, amountCents: 10000, cadence: 'fortnightly' as const, dayOfWeek: 5, description: 'New car fund', categoryId: null, savingsGoalId: goalNewCar },
    { type: 'savings' as const, amountCents: 5000, cadence: 'fortnightly' as const, dayOfWeek: 5, description: 'Christmas fund', categoryId: null, savingsGoalId: goalChristmas },
  ].map((r) => ({
    id: generateId(),
    userId: USER_ID,
    createdAt: timestamp,
    updatedAt: timestamp,
    scenarioId: scenarioPayRiseId,
    ...r,
  }));

  // ==========================================================================
  // FORECAST RULES - Aggressive Savings (cut expenses, max savings)
  // ==========================================================================
  const forecastRulesAggressiveSavings = [
    // Same income
    {
      type: 'income' as const,
      amountCents: 295000,
      cadence: 'fortnightly' as const,
      dayOfWeek: 4,
      description: 'Salary - PAYG',
      categoryId: null,
      savingsGoalId: null,
    },
    // Essential expenses only
    { type: 'expense' as const, amountCents: 92500, cadence: 'fortnightly' as const, dayOfWeek: 1, description: 'Rent', categoryId: catRent, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 45000, cadence: 'quarterly' as const, dayOfMonth: 15, monthOfQuarter: 1, description: 'AGL Electricity', categoryId: catElectricity, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 20000, cadence: 'quarterly' as const, dayOfMonth: 20, monthOfQuarter: 1, description: 'Origin Gas', categoryId: catGas, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 25000, cadence: 'quarterly' as const, dayOfMonth: 10, monthOfQuarter: 2, description: 'Sydney Water', categoryId: catWater, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 8900, cadence: 'monthly' as const, dayOfMonth: 5, description: 'Aussie Broadband', categoryId: catInternet, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 6500, cadence: 'monthly' as const, dayOfMonth: 12, description: 'Telstra Mobile', categoryId: catPhone, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 15000, cadence: 'monthly' as const, dayOfMonth: 1, description: 'Medibank Private', categoryId: catHealthInsurance, savingsGoalId: null },
    // Reduced groceries
    { type: 'expense' as const, amountCents: 12500, cadence: 'weekly' as const, dayOfWeek: 6, description: 'Weekly groceries (budget)', categoryId: catGroceries, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 5000, cadence: 'weekly' as const, dayOfWeek: 1, description: 'Opal top-up', categoryId: catPublicTransport, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 10000, cadence: 'fortnightly' as const, dayOfWeek: 0, description: 'Petrol (less driving)', categoryId: catPetrol, savingsGoalId: null },
    // Cut to essential subscriptions only
    { type: 'expense' as const, amountCents: 1299, cadence: 'monthly' as const, dayOfMonth: 15, description: 'Spotify', categoryId: catSubscriptions, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 699, cadence: 'monthly' as const, dayOfMonth: 22, description: 'iCloud Storage', categoryId: catSubscriptions, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 8000, cadence: 'monthly' as const, dayOfMonth: 1, description: 'Pet Circle - Dog food', categoryId: catPet, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 10000, cadence: 'monthly' as const, dayOfMonth: 28, description: 'NRMA Car Insurance', categoryId: catCarInsurance, savingsGoalId: null },
    { type: 'expense' as const, amountCents: 12500, cadence: 'monthly' as const, dayOfMonth: 28, description: 'RACV Contents Insurance', categoryId: catHomeInsurance, savingsGoalId: null },
    // Aggressive savings - focus on house deposit
    { type: 'savings' as const, amountCents: 15000, cadence: 'fortnightly' as const, dayOfWeek: 5, description: 'Emergency fund', categoryId: null, savingsGoalId: goalEmergency },
    { type: 'savings' as const, amountCents: 5000, cadence: 'fortnightly' as const, dayOfWeek: 5, description: 'Bali trip (reduced)', categoryId: null, savingsGoalId: goalHoliday },
    { type: 'savings' as const, amountCents: 50000, cadence: 'fortnightly' as const, dayOfWeek: 5, description: 'House deposit (max)', categoryId: null, savingsGoalId: goalHouseDeposit }, // $500 vs $200
    { type: 'savings' as const, amountCents: 5000, cadence: 'fortnightly' as const, dayOfWeek: 5, description: 'New car fund (reduced)', categoryId: null, savingsGoalId: goalNewCar },
    { type: 'savings' as const, amountCents: 5000, cadence: 'fortnightly' as const, dayOfWeek: 5, description: 'Christmas fund', categoryId: null, savingsGoalId: goalChristmas },
  ].map((r) => ({
    id: generateId(),
    userId: USER_ID,
    createdAt: timestamp,
    updatedAt: timestamp,
    scenarioId: scenarioAggressiveSavingsId,
    ...r,
  }));

  // ==========================================================================
  // FORECAST EVENTS (one-off future items)
  // ==========================================================================
  const forecastEvents = [
    // Car expenses
    {
      type: 'expense' as const,
      date: daysFromNow(60),
      amountCents: 55000, // $550 car service
      description: 'Car service - 80,000km',
      categoryId: catCarMaintenance,
      savingsGoalId: null,
    },
    {
      type: 'expense' as const,
      date: daysFromNow(90),
      amountCents: 78000, // $780 car rego
      description: 'Car rego renewal',
      categoryId: catCarMaintenance,
      savingsGoalId: null,
    },
    {
      type: 'expense' as const,
      date: daysFromNow(120),
      amountCents: 35000, // $350 green slip
      description: 'CTP Green Slip',
      categoryId: catCarInsurance,
      savingsGoalId: null,
    },
    // Health
    {
      type: 'expense' as const,
      date: daysFromNow(45),
      amountCents: 22000, // $220 dentist
      description: 'Dentist checkup',
      categoryId: catHealthcare,
      savingsGoalId: null,
    },
    {
      type: 'expense' as const,
      date: daysFromNow(75),
      amountCents: 18000, // $180 optometrist
      description: 'Eye test + new glasses',
      categoryId: catHealthcare,
      savingsGoalId: null,
    },
    // Pet
    {
      type: 'expense' as const,
      date: daysFromNow(30),
      amountCents: 25000, // $250 vet
      description: 'Dog annual vaccination',
      categoryId: catPet,
      savingsGoalId: null,
    },
    // Tax refund
    {
      type: 'income' as const,
      date: daysFromNow(150),
      amountCents: 180000, // $1,800 tax refund
      description: 'ATO Tax Refund',
      categoryId: null,
      savingsGoalId: null,
    },
    // Near-term forecasts to demonstrate budget states
    // These appear in the remaining period for their respective cadences
    {
      type: 'expense' as const,
      date: daysFromNow(1), // Tomorrow
      amountCents: 8500, // $85 - will push dining out toward limit
      description: "Friend's birthday dinner",
      categoryId: catDiningOut,
      savingsGoalId: null,
    },
    {
      type: 'expense' as const,
      date: daysFromNow(2),
      amountCents: 4500, // $45 - entertainment forecast
      description: 'Movie tickets',
      categoryId: catEntertainment,
      savingsGoalId: null,
    },
    {
      type: 'expense' as const,
      date: daysFromNow(3),
      amountCents: 15000, // $150 - shopping forecast
      description: 'New headphones',
      categoryId: catShopping,
      savingsGoalId: null,
    },
    {
      type: 'expense' as const,
      date: daysFromNow(4),
      amountCents: 3500, // $35 - coffee week
      description: 'Coffee subscription box',
      categoryId: catCoffee,
      savingsGoalId: null,
    },
  ].map((e) => ({
    id: generateId(),
    userId: USER_ID,
    createdAt: timestamp,
    updatedAt: timestamp,
    scenarioId,
    ...e,
  }));

  // ==========================================================================
  // BALANCE ANCHORS
  // ==========================================================================
  const balanceAnchors = [
    {
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      date: monthsFromNow(-12),
      balanceCents: 850000, // $8,500 opening balance
      label: 'Starting balance',
    },
  ];

  // ==========================================================================
  // TRANSACTIONS (12 months of history)
  // ==========================================================================
  const transactions: BudgetData['transactions'] = [];

  // Australian grocery stores
  const groceryStores = ['Woolworths', 'Coles', 'Aldi', 'IGA', 'Harris Farm'];
  const coffeeShops = ['The Local', 'Soul Origin', 'Guzman y Gomez', 'Campos', 'Single O'];
  const petrolStations = ['7-Eleven', 'BP', 'Ampol', 'Shell', 'Costco Fuel'];
  const restaurants = [
    'Thai Pothong', 'Grill\'d', 'Nando\'s', 'Oporto', 'Betty\'s Burgers',
    'Pho Pasteur', 'Sake Restaurant', 'Bar Luca', 'Mister Wong',
  ];
  const takeawayPlaces = [
    'Uber Eats - Thai', 'DoorDash - Indian', 'Menulog - Pizza', 'Uber Eats - Sushi',
    'DoorDash - Burgers', 'Uber Eats - Chinese', 'Menulog - Kebab',
  ];
  const entertainmentPlaces = [
    'Event Cinemas', 'Hoyts', 'Palace Cinema', 'Strike Bowling', 'Archie Brothers',
    'Timezone', 'Taronga Zoo', 'Vivid Sydney', 'Sydney FC tickets',
  ];
  const shoppingPlaces = [
    'Kmart', 'Target', 'Big W', 'JB Hi-Fi', 'Officeworks', 'IKEA', 'Bunnings',
    'Amazon AU', 'eBay', 'Catch',
  ];
  const clothingStores = [
    'Uniqlo', 'H&M', 'Cotton On', 'The Iconic', 'ASOS', 'Country Road',
  ];
  const personalCare = [
    'Priceline', 'Chemist Warehouse', 'Mecca', 'Sephora', 'Barber',
  ];

  // Generate 12 months of transaction history
  for (let month = -12; month <= 0; month++) {
    const isCurrentMonth = month === 0;
    const currentDate = new Date();
    const currentDayOfMonth = currentDate.getDate();
    const maxDay = isCurrentMonth ? currentDayOfMonth : 28;

    // ==========================================================================
    // INCOME - Fortnightly on Thursdays
    // ==========================================================================
    const salaryDates = [
      getWeekdayInMonth(month, 1, 4),
      getWeekdayInMonth(month, 3, 4),
    ].filter((d) => !isCurrentMonth || d <= daysFromNow(0));

    for (const date of salaryDates) {
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'income',
        date,
        amountCents: vary(295000, 0.02),
        description: 'Salary - PAYG',
        categoryId: null,
        savingsGoalId: null,
      });
    }

    // Occasional extra income
    if (month % 3 === -1) {
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'income',
        date: randomDayInMonth(month, 10, 20),
        amountCents: vary(15000, 0.5),
        description: pick(['Sold on Marketplace', 'Cash back reward', 'Work expense claim']),
        categoryId: null,
        savingsGoalId: null,
      });
    }

    // ==========================================================================
    // RENT - Fortnightly on Mondays
    // ==========================================================================
    const rentDates = [
      getWeekdayInMonth(month, 1, 1),
      getWeekdayInMonth(month, 3, 1),
    ].filter((d) => !isCurrentMonth || d <= daysFromNow(0));

    for (const date of rentDates) {
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'expense',
        date,
        amountCents: 92500,
        description: 'Rent',
        categoryId: catRent,
        savingsGoalId: null,
      });
    }

    // ==========================================================================
    // QUARTERLY UTILITIES (every 3 months)
    // ==========================================================================
    if (month % 3 === 0) {
      if (!isCurrentMonth || currentDayOfMonth >= 15) {
        transactions.push({
          id: generateId(),
          userId: USER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          type: 'expense',
          date: getDateInMonth(month, 15),
          amountCents: vary(45000, 0.15), // Electricity varies with season
          description: 'AGL Electricity',
          categoryId: catElectricity,
          savingsGoalId: null,
        });
      }
      if (!isCurrentMonth || currentDayOfMonth >= 20) {
        transactions.push({
          id: generateId(),
          userId: USER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          type: 'expense',
          date: getDateInMonth(month, 20),
          amountCents: vary(20000, 0.2),
          description: 'Origin Gas',
          categoryId: catGas,
          savingsGoalId: null,
        });
      }
      if (!isCurrentMonth || currentDayOfMonth >= 10) {
        transactions.push({
          id: generateId(),
          userId: USER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          type: 'expense',
          date: getDateInMonth(month, 10),
          amountCents: vary(25000, 0.1),
          description: 'Sydney Water',
          categoryId: catWater,
          savingsGoalId: null,
        });
      }
    }

    // ==========================================================================
    // MONTHLY BILLS
    // ==========================================================================
    // Internet - 5th
    if (!isCurrentMonth || currentDayOfMonth >= 5) {
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'expense',
        date: getDateInMonth(month, 5),
        amountCents: 8900,
        description: 'Aussie Broadband',
        categoryId: catInternet,
        savingsGoalId: null,
      });
    }

    // Phone - 12th
    if (!isCurrentMonth || currentDayOfMonth >= 12) {
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'expense',
        date: getDateInMonth(month, 12),
        amountCents: 6500,
        description: 'Telstra Mobile',
        categoryId: catPhone,
        savingsGoalId: null,
      });
    }

    // Health Insurance - 1st
    if (!isCurrentMonth || currentDayOfMonth >= 1) {
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'expense',
        date: getDateInMonth(month, 1),
        amountCents: 15000,
        description: 'Medibank Private',
        categoryId: catHealthInsurance,
        savingsGoalId: null,
      });
    }

    // Insurance direct debits - 28th
    if (!isCurrentMonth || currentDayOfMonth >= 28) {
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'expense',
        date: getDateInMonth(month, 28),
        amountCents: 10000,
        description: 'NRMA Car Insurance',
        categoryId: catCarInsurance,
        savingsGoalId: null,
      });
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'expense',
        date: getDateInMonth(month, 28),
        amountCents: 12500,
        description: 'RACV Contents Insurance',
        categoryId: catHomeInsurance,
        savingsGoalId: null,
      });
    }

    // Subscriptions
    if (!isCurrentMonth || currentDayOfMonth >= 8) {
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'expense',
        date: getDateInMonth(month, 8),
        amountCents: 2299,
        description: 'Netflix',
        categoryId: catSubscriptions,
        savingsGoalId: null,
      });
    }
    if (!isCurrentMonth || currentDayOfMonth >= 15) {
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'expense',
        date: getDateInMonth(month, 15),
        amountCents: 1299,
        description: 'Spotify',
        categoryId: catSubscriptions,
        savingsGoalId: null,
      });
    }
    if (!isCurrentMonth || currentDayOfMonth >= 22) {
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'expense',
        date: getDateInMonth(month, 22),
        amountCents: 699,
        description: 'iCloud Storage',
        categoryId: catSubscriptions,
        savingsGoalId: null,
      });
    }
    if (!isCurrentMonth || currentDayOfMonth >= 3) {
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'expense',
        date: getDateInMonth(month, 3),
        amountCents: 1799,
        description: 'Stan',
        categoryId: catSubscriptions,
        savingsGoalId: null,
      });
    }

    // Pet food - 1st
    if (!isCurrentMonth || currentDayOfMonth >= 1) {
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'expense',
        date: getDateInMonth(month, 1),
        amountCents: vary(8000, 0.1),
        description: 'Pet Circle - Dog food',
        categoryId: catPet,
        savingsGoalId: null,
      });
    }

    // ==========================================================================
    // WEEKLY GROCERIES (Saturday shop)
    // ==========================================================================
    const groceryDates = [
      getWeekdayInMonth(month, 1, 6),
      getWeekdayInMonth(month, 2, 6),
      getWeekdayInMonth(month, 3, 6),
      getWeekdayInMonth(month, 4, 6),
    ].filter((d) => !isCurrentMonth || d <= daysFromNow(0));

    for (const date of groceryDates) {
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'expense',
        date,
        amountCents: vary(15000, 0.2),
        description: pick(groceryStores),
        categoryId: catGroceries,
        savingsGoalId: null,
      });
    }

    // Mid-week top-up shop
    if (Math.random() > 0.3) {
      const topUpDay = 3 + Math.floor(Math.random() * 2); // Tue or Wed
      const topUpDate = getWeekdayInMonth(month, 2, topUpDay);
      if (!isCurrentMonth || topUpDate <= daysFromNow(0)) {
        transactions.push({
          id: generateId(),
          userId: USER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          type: 'expense',
          date: topUpDate,
          amountCents: vary(4500, 0.3),
          description: pick(['Woolworths', 'Coles', 'IGA']) + ' - top up',
          categoryId: catGroceries,
          savingsGoalId: null,
        });
      }
    }

    // ==========================================================================
    // WEEKLY PUBLIC TRANSPORT (Opal)
    // ==========================================================================
    for (let week = 1; week <= 4; week++) {
      const opalDate = getWeekdayInMonth(month, week, 1); // Mondays
      if (!isCurrentMonth || opalDate <= daysFromNow(0)) {
        transactions.push({
          id: generateId(),
          userId: USER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          type: 'expense',
          date: opalDate,
          amountCents: vary(5000, 0.15),
          description: 'Opal top-up',
          categoryId: catPublicTransport,
          savingsGoalId: null,
        });
      }
    }

    // ==========================================================================
    // FORTNIGHTLY PETROL
    // ==========================================================================
    const petrolDates = [
      getWeekdayInMonth(month, 1, 0), // Sunday week 1
      getWeekdayInMonth(month, 3, 0), // Sunday week 3
    ].filter((d) => !isCurrentMonth || d <= daysFromNow(0));

    for (const date of petrolDates) {
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'expense',
        date,
        amountCents: vary(12000, 0.15),
        description: pick(petrolStations),
        categoryId: catPetrol,
        savingsGoalId: null,
      });
    }

    // ==========================================================================
    // COFFEE - Daily habit (weekdays)
    // ==========================================================================
    for (let week = 1; week <= 4; week++) {
      // 3-5 coffees per week
      const coffeeCount = 3 + Math.floor(Math.random() * 3);
      const coffeeDays = [1, 2, 3, 4, 5].sort(() => Math.random() - 0.5).slice(0, coffeeCount);
      for (const dayOfWeek of coffeeDays) {
        const coffeeDate = getWeekdayInMonth(month, week, dayOfWeek);
        if (!isCurrentMonth || coffeeDate <= daysFromNow(0)) {
          transactions.push({
            id: generateId(),
            userId: USER_ID,
            createdAt: timestamp,
            updatedAt: timestamp,
            type: 'expense',
            date: coffeeDate,
            amountCents: vary(550, 0.2), // $5.50 average flat white
            description: pick(coffeeShops),
            categoryId: catCoffee,
            savingsGoalId: null,
          });
        }
      }
    }

    // ==========================================================================
    // DINING OUT - 2-4 times per fortnight
    // ==========================================================================
    const diningCount = 2 + Math.floor(Math.random() * 3);

    for (let i = 0; i < diningCount; i++) {
      const day = 2 + Math.floor(Math.random() * Math.min(26, maxDay - 2));
      if (day <= maxDay) {
        transactions.push({
          id: generateId(),
          userId: USER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          type: 'expense',
          date: getDateInMonth(month, day),
          amountCents: vary(5500, 0.3),
          description: pick(restaurants),
          categoryId: catDiningOut,
          savingsGoalId: null,
        });
      }
    }

    // ==========================================================================
    // TAKEAWAY - 2-3 times per fortnight
    // ==========================================================================
    const takeawayCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < takeawayCount; i++) {
      const day = 3 + Math.floor(Math.random() * Math.min(24, maxDay - 3));
      if (day <= maxDay) {
        transactions.push({
          id: generateId(),
          userId: USER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          type: 'expense',
          date: getDateInMonth(month, day),
          amountCents: vary(3500, 0.3),
          description: pick(takeawayPlaces),
          categoryId: catTakeaway,
          savingsGoalId: null,
        });
      }
    }

    // ==========================================================================
    // ENTERTAINMENT - 1-3 times per week
    // ==========================================================================
    for (let week = 1; week <= 4; week++) {
      const entertainmentCount = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < entertainmentCount; i++) {
        // Usually on weekends
        const dayOfWeek = Math.random() > 0.3 ? pick([5, 6, 0]) : pick([3, 4]);
        const entertainmentDate = getWeekdayInMonth(month, week, dayOfWeek);
        if (!isCurrentMonth || entertainmentDate <= daysFromNow(0)) {
          transactions.push({
            id: generateId(),
            userId: USER_ID,
            createdAt: timestamp,
            updatedAt: timestamp,
            type: 'expense',
            date: entertainmentDate,
            amountCents: vary(3500, 0.4),
            description: pick(entertainmentPlaces),
            categoryId: catEntertainment,
            savingsGoalId: null,
          });
        }
      }
    }

    // ==========================================================================
    // SHOPPING - 1-3 times per month
    // ==========================================================================
    const shoppingCount = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < shoppingCount; i++) {
      const day = 3 + Math.floor(Math.random() * Math.min(24, maxDay - 3));
      if (day <= maxDay) {
        transactions.push({
          id: generateId(),
          userId: USER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          type: 'expense',
          date: getDateInMonth(month, day),
          amountCents: vary(6000, 0.5),
          description: pick(shoppingPlaces),
          categoryId: catShopping,
          savingsGoalId: null,
        });
      }
    }

    // ==========================================================================
    // CLOTHING - 0-2 times per month
    // ==========================================================================
    const clothingCount = Math.floor(Math.random() * 3);
    for (let i = 0; i < clothingCount; i++) {
      const day = 5 + Math.floor(Math.random() * Math.min(20, maxDay - 5));
      if (day <= maxDay) {
        transactions.push({
          id: generateId(),
          userId: USER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          type: 'expense',
          date: getDateInMonth(month, day),
          amountCents: vary(7500, 0.4),
          description: pick(clothingStores),
          categoryId: catClothing,
          savingsGoalId: null,
        });
      }
    }

    // ==========================================================================
    // PERSONAL CARE - 1-2 times per month
    // ==========================================================================
    const personalCareCount = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < personalCareCount; i++) {
      const day = 5 + Math.floor(Math.random() * Math.min(20, maxDay - 5));
      if (day <= maxDay) {
        transactions.push({
          id: generateId(),
          userId: USER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          type: 'expense',
          date: getDateInMonth(month, day),
          amountCents: vary(4000, 0.4),
          description: pick(personalCare),
          categoryId: catPersonalCare,
          savingsGoalId: null,
        });
      }
    }

    // ==========================================================================
    // HEALTHCARE - occasional
    // ==========================================================================
    if (Math.random() > 0.6) {
      const day = 5 + Math.floor(Math.random() * Math.min(20, maxDay - 5));
      if (day <= maxDay) {
        const healthcareItems = [
          { desc: 'Chemist Warehouse', amount: 3500 },
          { desc: 'GP bulk-billed (gap)', amount: 4500 },
          { desc: 'Physio', amount: 9000 },
          { desc: 'Pharmacy - prescription', amount: 2500 },
        ];
        const item = pick(healthcareItems);
        transactions.push({
          id: generateId(),
          userId: USER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          type: 'expense',
          date: getDateInMonth(month, day),
          amountCents: vary(item.amount, 0.2),
          description: item.desc,
          categoryId: catHealthcare,
          savingsGoalId: null,
        });
      }
    }

    // ==========================================================================
    // PET - occasional extras
    // ==========================================================================
    if (Math.random() > 0.7) {
      const day = 5 + Math.floor(Math.random() * Math.min(20, maxDay - 5));
      if (day <= maxDay) {
        const petItems = [
          { desc: 'PetBarn - treats', amount: 2500 },
          { desc: 'Vet checkup', amount: 8500 },
          { desc: 'Dog grooming', amount: 6500 },
          { desc: 'PetStock - toys', amount: 3500 },
        ];
        const item = pick(petItems);
        transactions.push({
          id: generateId(),
          userId: USER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          type: 'expense',
          date: getDateInMonth(month, day),
          amountCents: vary(item.amount, 0.2),
          description: item.desc,
          categoryId: catPet,
          savingsGoalId: null,
        });
      }
    }

    // ==========================================================================
    // GIFTS - occasional
    // ==========================================================================
    if (Math.random() > 0.6) {
      const day = 5 + Math.floor(Math.random() * Math.min(20, maxDay - 5));
      if (day <= maxDay) {
        const giftItems = [
          { desc: 'Birthday present', amount: 5000 },
          { desc: 'Flowers delivery', amount: 6500 },
          { desc: 'Gift card', amount: 5000 },
          { desc: 'Donation', amount: 2500 },
        ];
        const item = pick(giftItems);
        transactions.push({
          id: generateId(),
          userId: USER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          type: 'expense',
          date: getDateInMonth(month, day),
          amountCents: vary(item.amount, 0.3),
          description: item.desc,
          categoryId: catGifts,
          savingsGoalId: null,
        });
      }
    }

    // ==========================================================================
    // CAR MAINTENANCE - occasional
    // ==========================================================================
    if (month % 4 === -2) {
      // Roughly quarterly
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'expense',
        date: randomDayInMonth(month, 10, 20),
        amountCents: vary(25000, 0.4),
        description: pick(['Car wash', 'New tyres', 'Oil change', 'Windscreen repair']),
        categoryId: catCarMaintenance,
        savingsGoalId: null,
      });
    }

    // ==========================================================================
    // SAVINGS - Fortnightly on Fridays (day after payday)
    // ==========================================================================
    const savingsDates = [
      getWeekdayInMonth(month, 1, 5),
      getWeekdayInMonth(month, 3, 5),
    ].filter((d) => !isCurrentMonth || d <= daysFromNow(0));

    for (const date of savingsDates) {
      // Emergency fund
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'savings',
        date,
        amountCents: 20000,
        description: 'Emergency fund',
        categoryId: null,
        savingsGoalId: goalEmergency,
      });
      // Holiday
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'savings',
        date,
        amountCents: 15000,
        description: 'Bali trip fund',
        categoryId: null,
        savingsGoalId: goalHoliday,
      });
      // House deposit
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'savings',
        date,
        amountCents: 20000,
        description: 'House deposit',
        categoryId: null,
        savingsGoalId: goalHouseDeposit,
      });
      // Car fund
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'savings',
        date,
        amountCents: 10000,
        description: 'New car fund',
        categoryId: null,
        savingsGoalId: goalNewCar,
      });
      // Christmas fund
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'savings',
        date,
        amountCents: 5000,
        description: 'Christmas fund',
        categoryId: null,
        savingsGoalId: goalChristmas,
      });
    }
  }

  // ==========================================================================
  // ADD SPECIFIC TRANSACTIONS IN CURRENT FORTNIGHT TO DEMO FORECAST FEATURE
  // ==========================================================================
  // Calculate current fortnight boundaries (same logic as budget page)
  const currentDate = new Date();
  const epoch = new Date('2024-01-01');
  const diffDays = Math.floor((currentDate.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24));
  const fortnightNumber = Math.floor(diffDays / 14);
  const fortnightStart = new Date(epoch);
  fortnightStart.setDate(fortnightStart.getDate() + fortnightNumber * 14);

  // Add dining out transactions in current fortnight to demonstrate forecast bar
  // Budget is $150/fn. We want to show the two-tone bar clearly:
  // - Spent: $50 (33%) - solid color
  // - Forecast: $85 (57%) - lighter color
  // - Total: $135 (90%) = warning status, nice visible two-tone yellow bar
  const daysIntoFortnight = Math.floor((currentDate.getTime() - fortnightStart.getTime()) / (1000 * 60 * 60 * 24));

  if (daysIntoFortnight >= 1) {
    // Add a dinner from earlier in the fortnight
    const dinnerDate = new Date(fortnightStart);
    dinnerDate.setDate(dinnerDate.getDate() + Math.min(daysIntoFortnight - 1, 1));
    transactions.push({
      id: generateId(),
      userId: USER_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      type: 'expense',
      date: dinnerDate.toISOString().slice(0, 10),
      amountCents: 5000, // $50
      description: 'Thai Pothong',
      categoryId: catDiningOut,
      savingsGoalId: null,
    });
  }

  // Sort transactions by date
  transactions.sort((a, b) => a.date.localeCompare(b.date));

  return {
    scenarios,
    categories,
    budgetRules: [...budgetRules, ...budgetRulesPayRise, ...budgetRulesAggressiveSavings],
    forecastRules: [...forecastRules, ...forecastRulesPayRise, ...forecastRulesAggressiveSavings],
    forecastEvents,
    transactions,
    savingsGoals,
    balanceAnchors,
    categoryRules: [],
  };
}

export async function loadDemoDataToStorage(): Promise<void> {
  const data = generateDemoData();
  await loadDemoData(data);
}

export async function clearAllData(): Promise<void> {
  await resetDatabase();
}
