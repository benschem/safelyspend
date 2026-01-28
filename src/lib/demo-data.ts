import type { BudgetData } from './types';
import { generateId, now } from './utils';

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

// Add slight variation to an amount (±10%)
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

export function generateDemoData(): BudgetData {
  const timestamp = now();

  // Generate all IDs upfront
  const scenarioId = generateId();

  // Categories - organized by how humans think
  const catRent = generateId();
  const catElectricity = generateId();
  const catGas = generateId();
  const catInternet = generateId();
  const catGroceries = generateId();
  const catTransport = generateId();
  const catPhone = generateId();
  const catDiningOut = generateId();
  const catEntertainment = generateId();
  const catShopping = generateId();
  const catSubscriptions = generateId();
  const catHealthcare = generateId();

  // Savings goals
  const goalEmergency = generateId();
  const goalHoliday = generateId();
  const goalLaptop = generateId();
  const goalHouseDeposit = generateId();

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
      description: 'My primary budget scenario',
      isDefault: true,
    },
  ];

  // ==========================================================================
  // CATEGORIES
  // ==========================================================================
  const categories = [
    // Home
    { id: catRent, name: 'Rent' },
    { id: catElectricity, name: 'Electricity' },
    { id: catGas, name: 'Gas' },
    { id: catInternet, name: 'Internet' },
    // Living
    { id: catGroceries, name: 'Groceries' },
    { id: catTransport, name: 'Transport' },
    { id: catPhone, name: 'Phone' },
    { id: catHealthcare, name: 'Healthcare' },
    // Lifestyle
    { id: catDiningOut, name: 'Dining Out' },
    { id: catEntertainment, name: 'Entertainment' },
    { id: catShopping, name: 'Shopping' },
    { id: catSubscriptions, name: 'Subscriptions' },
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
      targetAmountCents: 1500000, // $15,000
      deadline: monthsFromNow(18),
    },
    {
      id: goalHoliday,
      name: 'Bali Holiday',
      targetAmountCents: 350000, // $3,500
      deadline: monthsFromNow(8),
    },
    {
      id: goalLaptop,
      name: 'New Laptop',
      targetAmountCents: 250000, // $2,500
      deadline: monthsFromNow(5),
    },
    {
      id: goalHouseDeposit,
      name: 'House Deposit',
      targetAmountCents: 8000000, // $80,000 - long term
      deadline: monthsFromNow(60),
    },
  ].map((g) => ({
    ...g,
    userId: USER_ID,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  // ==========================================================================
  // BUDGET RULES (monthly limits)
  // ==========================================================================
  const budgetRules = [
    { categoryId: catRent, amountCents: 200000 }, // $2,000
    { categoryId: catElectricity, amountCents: 15000 }, // $150
    { categoryId: catGas, amountCents: 8000 }, // $80
    { categoryId: catInternet, amountCents: 9000 }, // $90
    { categoryId: catGroceries, amountCents: 60000 }, // $600
    { categoryId: catTransport, amountCents: 25000 }, // $250
    { categoryId: catPhone, amountCents: 6500 }, // $65
    { categoryId: catDiningOut, amountCents: 30000 }, // $300
    { categoryId: catEntertainment, amountCents: 15000 }, // $150
    { categoryId: catShopping, amountCents: 20000 }, // $200
    { categoryId: catSubscriptions, amountCents: 8000 }, // $80
    { categoryId: catHealthcare, amountCents: 10000 }, // $100
  ].map((r) => ({
    id: generateId(),
    userId: USER_ID,
    createdAt: timestamp,
    updatedAt: timestamp,
    scenarioId,
    ...r,
    cadence: 'monthly' as const,
  }));

  // ==========================================================================
  // FORECAST RULES (recurring patterns)
  // ==========================================================================
  const forecastRules = [
    // Income - fortnightly salary on Thursday
    {
      type: 'income' as const,
      amountCents: 285000, // $2,850 net fortnightly (~$74k gross annual)
      cadence: 'fortnightly' as const,
      dayOfWeek: 4, // Thursday
      description: 'Salary',
      categoryId: null,
      savingsGoalId: null,
    },
    // Rent - 1st of month
    {
      type: 'expense' as const,
      amountCents: 200000, // $2,000
      cadence: 'monthly' as const,
      dayOfMonth: 1,
      description: 'Rent',
      categoryId: catRent,
      savingsGoalId: null,
    },
    // Utilities - quarterly
    {
      type: 'expense' as const,
      amountCents: 42000, // $420 quarterly electricity
      cadence: 'quarterly' as const,
      dayOfMonth: 15,
      description: 'Electricity bill',
      categoryId: catElectricity,
      savingsGoalId: null,
    },
    {
      type: 'expense' as const,
      amountCents: 18000, // $180 quarterly gas
      cadence: 'quarterly' as const,
      dayOfMonth: 20,
      description: 'Gas bill',
      categoryId: catGas,
      savingsGoalId: null,
    },
    // Monthly bills
    {
      type: 'expense' as const,
      amountCents: 8900, // $89 internet
      cadence: 'monthly' as const,
      dayOfMonth: 5,
      description: 'Internet',
      categoryId: catInternet,
      savingsGoalId: null,
    },
    {
      type: 'expense' as const,
      amountCents: 6500, // $65 phone
      cadence: 'monthly' as const,
      dayOfMonth: 12,
      description: 'Phone plan',
      categoryId: catPhone,
      savingsGoalId: null,
    },
    // Weekly groceries - Saturday
    {
      type: 'expense' as const,
      amountCents: 14000, // $140/week
      cadence: 'weekly' as const,
      dayOfWeek: 6, // Saturday
      description: 'Groceries',
      categoryId: catGroceries,
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
      amountCents: 999, // iCloud
      cadence: 'monthly' as const,
      dayOfMonth: 22,
      description: 'iCloud Storage',
      categoryId: catSubscriptions,
      savingsGoalId: null,
    },
    // Savings contributions
    {
      type: 'savings' as const,
      amountCents: 40000, // $400/month to emergency fund
      cadence: 'monthly' as const,
      dayOfMonth: 2,
      description: 'Emergency fund',
      categoryId: null,
      savingsGoalId: goalEmergency,
    },
    {
      type: 'savings' as const,
      amountCents: 20000, // $200/month to holiday
      cadence: 'monthly' as const,
      dayOfMonth: 2,
      description: 'Holiday savings',
      categoryId: null,
      savingsGoalId: goalHoliday,
    },
    {
      type: 'savings' as const,
      amountCents: 30000, // $300/month to house deposit
      cadence: 'monthly' as const,
      dayOfMonth: 2,
      description: 'House deposit',
      categoryId: null,
      savingsGoalId: goalHouseDeposit,
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
  // FORECAST EVENTS (one-off future items)
  // ==========================================================================
  const forecastEvents = [
    {
      type: 'expense' as const,
      date: daysFromNow(45),
      amountCents: 85000, // $850 car service
      description: 'Car service',
      categoryId: catTransport,
      savingsGoalId: null,
    },
    {
      type: 'expense' as const,
      date: daysFromNow(90),
      amountCents: 78000, // $780 car rego
      description: 'Car registration',
      categoryId: catTransport,
      savingsGoalId: null,
    },
    {
      type: 'expense' as const,
      date: daysFromNow(120),
      amountCents: 45000, // $450 car insurance
      description: 'Car insurance (annual)',
      categoryId: catTransport,
      savingsGoalId: null,
    },
    {
      type: 'expense' as const,
      date: daysFromNow(60),
      amountCents: 25000, // $250 dentist
      description: 'Dentist checkup',
      categoryId: catHealthcare,
      savingsGoalId: null,
    },
    {
      type: 'income' as const,
      date: daysFromNow(75),
      amountCents: 35000, // $350 tax refund
      description: 'Tax refund',
      categoryId: null,
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
      balanceCents: 320000, // $3,200 opening balance
      label: 'Opening balance',
    },
  ];

  // ==========================================================================
  // TRANSACTIONS (12 months of history)
  // ==========================================================================
  const transactions: BudgetData['transactions'] = [];

  // Generate 12 months of transaction history
  for (let month = -12; month <= 0; month++) {
    const isCurrentMonth = month === 0;
    const currentDate = new Date();
    const currentDayOfMonth = currentDate.getDate();

    // Salary - fortnightly on Thursdays (roughly 2 per month)
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
        amountCents: vary(285000, 0.02), // Slight variation for bonuses/deductions
        description: 'Salary',
        categoryId: null,
        savingsGoalId: null,
      });
    }

    // Occasional bonus/refund (roughly every 4 months)
    if (month % 4 === -2) {
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'income',
        date: randomDayInMonth(month, 10, 20),
        amountCents: vary(25000, 0.5), // $150-$375 random refund
        description: ['Cashback reward', 'Sold item on Marketplace', 'Work expense reimbursement'][Math.floor(Math.random() * 3)] ?? 'Other income',
        categoryId: null,
        savingsGoalId: null,
      });
    }

    // Only add expenses if date has passed (for current month)
    const maxDay = isCurrentMonth ? currentDayOfMonth : 28;

    // Rent - 1st of month
    if (!isCurrentMonth || currentDayOfMonth >= 1) {
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'expense',
        date: getDateInMonth(month, 1),
        amountCents: 200000,
        description: 'Rent',
        categoryId: catRent,
        savingsGoalId: null,
      });
    }

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
        description: 'Internet',
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
        description: 'Phone plan',
        categoryId: catPhone,
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
        amountCents: 999,
        description: 'iCloud Storage',
        categoryId: catSubscriptions,
        savingsGoalId: null,
      });
    }

    // Quarterly utilities (every 3 months)
    if (month % 3 === 0) {
      if (!isCurrentMonth || currentDayOfMonth >= 15) {
        transactions.push({
          id: generateId(),
          userId: USER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          type: 'expense',
          date: getDateInMonth(month, 15),
          amountCents: vary(42000, 0.15), // Electricity varies with season
          description: 'Electricity bill',
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
          amountCents: vary(18000, 0.2),
          description: 'Gas bill',
          categoryId: catGas,
          savingsGoalId: null,
        });
      }
    }

    // Weekly groceries (4-5 per month, usually Saturday)
    const groceryDates = [
      getWeekdayInMonth(month, 1, 6),
      getWeekdayInMonth(month, 2, 6),
      getWeekdayInMonth(month, 3, 6),
      getWeekdayInMonth(month, 4, 6),
    ].filter((d) => !isCurrentMonth || d <= daysFromNow(0));

    // Intentional imperfection: one month had an expensive grocery week
    const isExpensiveGroceryMonth = month === -3;

    for (let i = 0; i < groceryDates.length; i++) {
      const date = groceryDates[i]!;
      let amount = vary(14000, 0.15);

      // Expensive week in the imperfect month
      if (isExpensiveGroceryMonth && i === 2) {
        amount = 22500; // Had guests over
      }

      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'expense',
        date,
        amountCents: amount,
        description: ['Woolworths', 'Coles', 'Aldi', 'IGA'][i % 4] ?? 'Groceries',
        categoryId: catGroceries,
        savingsGoalId: null,
      });
    }

    // Transport - mix of weekly public transport and occasional uber
    const transportDays = Math.min(maxDay, 28);
    for (let week = 0; week < 4; week++) {
      const day = 3 + week * 7; // Roughly Wednesdays
      if (day <= transportDays) {
        transactions.push({
          id: generateId(),
          userId: USER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          type: 'expense',
          date: getDateInMonth(month, day),
          amountCents: vary(4500, 0.1), // Weekly Opal top-up
          description: 'Opal card',
          categoryId: catTransport,
          savingsGoalId: null,
        });
      }
    }

    // 1-2 Ubers per month
    if (Math.random() > 0.3) {
      const uberDay = 5 + Math.floor(Math.random() * 20);
      if (uberDay <= maxDay) {
        transactions.push({
          id: generateId(),
          userId: USER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          type: 'expense',
          date: getDateInMonth(month, uberDay),
          amountCents: vary(2800, 0.3),
          description: 'Uber',
          categoryId: catTransport,
          savingsGoalId: null,
        });
      }
    }

    // Dining out - 3-5 times per month, scattered
    const diningCount = 3 + Math.floor(Math.random() * 3);

    // Intentional imperfection: one month had extra dining (birthday month)
    const isBirthdayMonth = month === -5;
    const actualDiningCount = isBirthdayMonth ? diningCount + 3 : diningCount;

    for (let i = 0; i < actualDiningCount; i++) {
      const day = 2 + Math.floor(Math.random() * Math.min(26, maxDay - 2));
      if (day <= maxDay) {
        const descriptions = [
          'Coffee catch-up', 'Lunch with friends', 'Dinner date',
          'Takeaway Thai', 'Friday drinks', 'Brunch', 'Pizza night',
        ];
        transactions.push({
          id: generateId(),
          userId: USER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          type: 'expense',
          date: getDateInMonth(month, day),
          amountCents: vary(isBirthdayMonth && i > diningCount - 1 ? 8500 : 4500, 0.4),
          description: descriptions[Math.floor(Math.random() * descriptions.length)] ?? 'Dining out',
          categoryId: catDiningOut,
          savingsGoalId: null,
        });
      }
    }

    // Entertainment - 1-3 times per month
    const entertainmentCount = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < entertainmentCount; i++) {
      const day = 5 + Math.floor(Math.random() * Math.min(20, maxDay - 5));
      if (day <= maxDay) {
        const items = [
          { desc: 'Cinema', amount: 2500 },
          { desc: 'Concert tickets', amount: 12000 },
          { desc: 'Museum entry', amount: 2000 },
          { desc: 'Bowling', amount: 3500 },
          { desc: 'Mini golf', amount: 2800 },
        ];
        const item = items[Math.floor(Math.random() * items.length)]!;
        transactions.push({
          id: generateId(),
          userId: USER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          type: 'expense',
          date: getDateInMonth(month, day),
          amountCents: vary(item.amount, 0.2),
          description: item.desc,
          categoryId: catEntertainment,
          savingsGoalId: null,
        });
      }
    }

    // Shopping - 0-2 times per month
    const shoppingCount = Math.floor(Math.random() * 3);

    // Intentional imperfection: surprise expense month
    const isSurpriseExpenseMonth = month === -2;

    for (let i = 0; i < shoppingCount; i++) {
      const day = 3 + Math.floor(Math.random() * Math.min(24, maxDay - 3));
      if (day <= maxDay) {
        const items = [
          { desc: 'Kmart', amount: 4500 },
          { desc: 'Target', amount: 6000 },
          { desc: 'Amazon', amount: 5500 },
          { desc: 'IKEA', amount: 12000 },
        ];
        const item = items[Math.floor(Math.random() * items.length)]!;
        transactions.push({
          id: generateId(),
          userId: USER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          type: 'expense',
          date: getDateInMonth(month, day),
          amountCents: vary(item.amount, 0.3),
          description: item.desc,
          categoryId: catShopping,
          savingsGoalId: null,
        });
      }
    }

    // Surprise expense: washing machine broke
    if (isSurpriseExpenseMonth) {
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'expense',
        date: getDateInMonth(month, 18),
        amountCents: 65000, // $650 emergency appliance replacement
        description: 'Washing machine replacement',
        categoryId: catShopping,
        savingsGoalId: null,
      });
    }

    // Healthcare - occasional
    if (Math.random() > 0.6) {
      const day = 5 + Math.floor(Math.random() * Math.min(20, maxDay - 5));
      if (day <= maxDay) {
        const items = [
          { desc: 'Pharmacy', amount: 3500 },
          { desc: 'GP visit', amount: 4500 },
          { desc: 'Physio', amount: 9000 },
        ];
        const item = items[Math.floor(Math.random() * items.length)]!;
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

    // Savings contributions - 2nd of month
    if (!isCurrentMonth || currentDayOfMonth >= 2) {
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'savings',
        date: getDateInMonth(month, 2),
        amountCents: 40000,
        description: 'Emergency fund',
        categoryId: null,
        savingsGoalId: goalEmergency,
      });
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'savings',
        date: getDateInMonth(month, 2),
        amountCents: 20000,
        description: 'Holiday savings',
        categoryId: null,
        savingsGoalId: goalHoliday,
      });
      transactions.push({
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        type: 'savings',
        date: getDateInMonth(month, 2),
        amountCents: 30000,
        description: 'House deposit',
        categoryId: null,
        savingsGoalId: goalHouseDeposit,
      });

      // Intentional imperfection: skipped laptop savings for 2 months (underfunded goal)
      if (month < -6 || month > -5) {
        transactions.push({
          id: generateId(),
          userId: USER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          type: 'savings',
          date: getDateInMonth(month, 2),
          amountCents: 15000, // Only saving $150/month for laptop (slower progress)
          description: 'Laptop fund',
          categoryId: null,
          savingsGoalId: goalLaptop,
        });
      }
    }
  }

  // Sort transactions by date
  transactions.sort((a, b) => a.date.localeCompare(b.date));

  return {
    scenarios,
    categories,
    budgetRules,
    forecastRules,
    forecastEvents,
    transactions,
    savingsGoals,
    balanceAnchors,
    categoryRules: [],
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
  localStorage.setItem('budget:balanceAnchors', JSON.stringify(data.balanceAnchors));
  localStorage.setItem('budget:categoryRules', JSON.stringify(data.categoryRules));
  localStorage.setItem('budget:appConfig', JSON.stringify({ isInitialized: true, isDemo: true }));
}

export function clearAllData(): void {
  const keys = [
    'budget:scenarios',
    'budget:activeScenarioId',
    'budget:categories',
    'budget:budgetRules',
    'budget:forecastRules',
    'budget:forecastEvents',
    'budget:transactions',
    'budget:savingsGoals',
    'budget:balanceAnchors',
    'budget:categoryRules',
    'budget:paymentMethods',
    'budget:viewState',
    'budget:appConfig',
  ];
  keys.forEach((key) => localStorage.removeItem(key));
}
