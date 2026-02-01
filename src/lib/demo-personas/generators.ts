import { generateId } from '@/lib/utils';
import type {
  PersonaConfig,
  GeneratedData,
  GeneratedCategory,
  GeneratedScenario,
  GeneratedBudgetRule,
  GeneratedForecastRule,
  GeneratedTransaction,
  GeneratedSavingsGoal,
  GeneratedBalanceAnchor,
} from './types';

// Seeded random number generator for reproducible results
function seededRandom(seed: number): () => number {
  return function () {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

// Get a random item from an array
function randomItem<T>(arr: T[], random: () => number): T {
  return arr[Math.floor(random() * arr.length)]!;
}

// Apply variance to an amount
function applyVariance(amount: number, variance: number, random: () => number): number {
  if (variance === 0) return amount;
  const factor = 1 + (random() * 2 - 1) * variance;
  return Math.round(amount * factor);
}

// Format date as YYYY-MM-DD (using local timezone, not UTC)
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Add days to a date
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function generatePersonaData(
  config: PersonaConfig,
  today: Date = new Date(),
): GeneratedData {
  // Use persona ID as seed for reproducible random data
  const seedNum = config.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = seededRandom(seedNum + today.getFullYear() * 1000 + today.getMonth());

  // Date range: 12 months back, 12 months forward
  const startDate = new Date(today);
  startDate.setMonth(startDate.getMonth() - 12);
  startDate.setDate(1);

  const endDate = new Date(today);
  endDate.setMonth(endDate.getMonth() + 12);
  endDate.setDate(0); // Last day of that month

  // Generate categories
  const categories: GeneratedCategory[] = config.categories.map((name) => ({
    id: generateId(),
    name,
  }));

  const categoryMap = new Map(categories.map((c) => [c.name, c.id]));

  // Generate scenarios
  const scenarios: GeneratedScenario[] = config.scenarios.map((s) => {
    const scenario: GeneratedScenario = {
      id: generateId(),
      name: s.name,
      isDefault: s.isDefault,
    };
    if (s.description) scenario.description = s.description;
    return scenario;
  });

  // Generate budget rules
  const budgetRules: GeneratedBudgetRule[] = [];
  for (const scenario of scenarios) {
    for (const budget of config.budgets) {
      const categoryId = categoryMap.get(budget.category);
      if (!categoryId) continue;

      // Check for scenario-specific override
      const scenarioConfig = config.scenarios.find((s) => s.name === scenario.name);
      const override = scenarioConfig?.budgetOverrides?.find((o) => o.category === budget.category);

      budgetRules.push({
        id: generateId(),
        scenarioId: scenario.id,
        categoryId,
        amountCents: override?.amountCents ?? budget.amountCents,
        cadence: budget.cadence,
      });
    }
  }

  // Generate savings goals
  const savingsGoals: GeneratedSavingsGoal[] = config.savingsGoals.map((goal) => {
    const sg: GeneratedSavingsGoal = {
      id: generateId(),
      name: goal.name,
      targetAmountCents: goal.targetAmountCents,
    };
    if (goal.isEmergencyFund) sg.isEmergencyFund = goal.isEmergencyFund;
    if (goal.deadline) sg.deadline = formatDate(addDays(today, goal.deadline.monthsFromNow * 30));
    if (goal.annualInterestRate) sg.annualInterestRate = goal.annualInterestRate;
    return sg;
  });

  const savingsGoalMap = new Map(
    config.savingsGoals.map((sg, i) => [sg.name, savingsGoals[i]!.id]),
  );

  // Generate transactions (past only - from startDate to today)
  const transactions: GeneratedTransaction[] = [];

  // Generate income transactions
  generateIncomeTransactions(config, startDate, today, random, transactions);

  // Generate expense transactions
  generateExpenseTransactions(config, startDate, today, categoryMap, random, transactions);

  // Generate unbudgeted/miscellaneous expenses (no category)
  generateUnbudgetedTransactions(config, startDate, today, random, transactions);

  // Generate savings transactions
  generateSavingsTransactions(config, startDate, today, savingsGoalMap, random, transactions);

  // Ensure current month has transactions for charts
  ensureCurrentMonthTransactions(config, today, categoryMap, random, transactions);

  // Ensure current month has income if payday has passed
  ensureCurrentMonthIncome(config, today, random, transactions);

  // Sort transactions by date
  transactions.sort((a, b) => a.date.localeCompare(b.date));

  // Generate forecast rules for ALL scenarios
  const forecastRules: GeneratedForecastRule[] = [];

  for (const scenario of scenarios) {
    const scenarioConfig = config.scenarios.find((s) => s.name === scenario.name);
    const scenarioRules = generateForecastRules(
      config,
      scenario.id,
      categoryMap,
      savingsGoalMap,
      scenarioConfig,
    );
    forecastRules.push(...scenarioRules);
  }

  // Calculate opening balance (what balance would result in current state)
  const balanceAnchors: GeneratedBalanceAnchor[] = calculateBalanceAnchor(
    config,
    startDate,
  );

  return {
    categories,
    scenarios,
    budgetRules,
    forecastRules,
    transactions,
    savingsGoals,
    balanceAnchors,
  };
}

function generateIncomeTransactions(
  config: PersonaConfig,
  startDate: Date,
  endDate: Date,
  random: () => number,
  transactions: GeneratedTransaction[],
): void {
  const { income } = config;

  // Primary income
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    let payDate: Date | null = null;

    switch (income.primary.cadence) {
      case 'weekly': {
        // Pay every Friday
        const friday = new Date(currentDate);
        friday.setDate(friday.getDate() + ((5 - friday.getDay() + 7) % 7));
        if (friday <= endDate && friday >= startDate) {
          payDate = friday;
        }
        currentDate = addDays(currentDate, 7);
        break;
      }
      case 'fortnightly': {
        // Pay every second Friday (use epoch to determine which weeks)
        const epoch = new Date('2024-01-05'); // A Friday
        const daysSinceEpoch = Math.floor(
          (currentDate.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24),
        );
        const weeksFromEpoch = Math.floor(daysSinceEpoch / 7);
        if (weeksFromEpoch % 2 === 0) {
          const friday = new Date(currentDate);
          friday.setDate(friday.getDate() + ((5 - friday.getDay() + 7) % 7));
          if (friday <= endDate && friday >= startDate) {
            payDate = friday;
          }
        }
        currentDate = addDays(currentDate, 7);
        break;
      }
      case 'monthly': {
        // Pay on the last working day of month or 15th
        const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        // Adjust for weekend
        while (lastDay.getDay() === 0 || lastDay.getDay() === 6) {
          lastDay.setDate(lastDay.getDate() - 1);
        }
        if (lastDay <= endDate && lastDay >= startDate) {
          payDate = lastDay;
        }
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        break;
      }
      default:
        currentDate = addDays(currentDate, 30);
    }

    if (payDate) {
      const amount = applyVariance(
        income.primary.amountCents,
        income.primary.variance ?? 0,
        random,
      );
      transactions.push({
        id: generateId(),
        date: formatDate(payDate),
        description: income.primary.description,
        type: 'income',
        amountCents: amount,
        categoryId: null,
      });
    }
  }

  // Extra income (bonuses, etc.)
  if (income.extras) {
    for (const extra of income.extras) {
      if (extra.frequency === 'quarterly' || extra.frequency === 'yearly') {
        const months = extra.months ?? (extra.frequency === 'quarterly' ? [3, 6, 9, 12] : [12]);
        let checkDate = new Date(startDate);

        while (checkDate <= endDate) {
          if (months.includes(checkDate.getMonth() + 1)) {
            // Pay mid-month for bonuses
            const bonusDate = new Date(checkDate.getFullYear(), checkDate.getMonth(), 15);
            if (bonusDate >= startDate && bonusDate <= endDate) {
              transactions.push({
                id: generateId(),
                date: formatDate(bonusDate),
                description: extra.description,
                type: 'income',
                amountCents: extra.amountCents,
                categoryId: null,
              });
            }
          }
          checkDate = new Date(checkDate.getFullYear(), checkDate.getMonth() + 1, 1);
        }
      } else if (extra.frequency === 'occasional') {
        // Random occasional income
        let checkDate = new Date(startDate);
        while (checkDate <= endDate) {
          if (random() < (extra.probability ?? 0.1)) {
            const dayInMonth = Math.floor(random() * 28) + 1;
            const incomeDate = new Date(checkDate.getFullYear(), checkDate.getMonth(), dayInMonth);
            if (incomeDate >= startDate && incomeDate <= endDate) {
              transactions.push({
                id: generateId(),
                date: formatDate(incomeDate),
                description: extra.description,
                type: 'income',
                amountCents: applyVariance(extra.amountCents, 0.3, random),
                categoryId: null,
              });
            }
          }
          checkDate = new Date(checkDate.getFullYear(), checkDate.getMonth() + 1, 1);
        }
      }
    }
  }
}

function generateExpenseTransactions(
  config: PersonaConfig,
  startDate: Date,
  endDate: Date,
  categoryMap: Map<string, string>,
  random: () => number,
  transactions: GeneratedTransaction[],
): void {
  // Helper to create a transaction
  const createTransaction = (
    transactionDate: Date,
    pattern: (typeof config.expenses)[0]['patterns'][0],
    categoryId: string | null,
  ) => {
    if (transactionDate >= startDate && transactionDate <= endDate) {
      const description = Array.isArray(pattern.description)
        ? randomItem(pattern.description, random)
        : pattern.description;

      const amount = applyVariance(pattern.amountCents, pattern.variance ?? 0.15, random);

      transactions.push({
        id: generateId(),
        date: formatDate(transactionDate),
        description,
        type: 'expense',
        amountCents: amount,
        categoryId,
      });
    }
  };

  for (const expenseCategory of config.expenses) {
    const categoryId = categoryMap.get(expenseCategory.category) ?? null;

    for (const pattern of expenseCategory.patterns) {
      let currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        let shouldGenerate = false;
        let transactionDate = new Date(currentDate);

        switch (pattern.frequency) {
          case 'daily':
            shouldGenerate = random() < (pattern.probability ?? 0.7);
            if (shouldGenerate) {
              createTransaction(transactionDate, pattern, categoryId);
            }
            currentDate = addDays(currentDate, 1);
            break;

          case 'weekly':
            if (pattern.dayOfWeek !== undefined) {
              // Specific day of week
              const targetDay = pattern.dayOfWeek;
              const currentDay = currentDate.getDay();
              const daysUntilTarget = (targetDay - currentDay + 7) % 7;
              transactionDate = addDays(currentDate, daysUntilTarget);
              if (transactionDate <= endDate) {
                createTransaction(transactionDate, pattern, categoryId);
              }
            } else {
              // Random day in week
              shouldGenerate = random() < (pattern.probability ?? 0.8);
              if (shouldGenerate) {
                transactionDate = addDays(currentDate, Math.floor(random() * 7));
                createTransaction(transactionDate, pattern, categoryId);
              }
            }
            currentDate = addDays(currentDate, 7);
            break;

          case 'fortnightly': {
            // Every two weeks
            const epoch = new Date('2024-01-01');
            const weekNum = Math.floor(
              (currentDate.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24 * 7),
            );
            if (weekNum % 2 === 0) {
              if (pattern.dayOfWeek !== undefined) {
                const daysToAdd = (pattern.dayOfWeek - currentDate.getDay() + 7) % 7;
                transactionDate = addDays(currentDate, daysToAdd);
              }
              createTransaction(transactionDate, pattern, categoryId);
            }
            currentDate = addDays(currentDate, 7);
            break;
          }

          case 'monthly':
            if (pattern.dayOfMonth !== undefined) {
              const day = Math.min(pattern.dayOfMonth, 28); // Avoid month overflow issues
              transactionDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
              if (transactionDate >= startDate && transactionDate <= endDate) {
                createTransaction(transactionDate, pattern, categoryId);
              }
            } else {
              shouldGenerate = random() < (pattern.probability ?? 0.9);
              if (shouldGenerate) {
                const day = Math.floor(random() * 28) + 1;
                transactionDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                createTransaction(transactionDate, pattern, categoryId);
              }
            }
            currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
            break;

          case 'occasional':
            shouldGenerate = random() < (pattern.probability ?? 0.3);
            if (shouldGenerate) {
              transactionDate = addDays(currentDate, Math.floor(random() * 7));
              createTransaction(transactionDate, pattern, categoryId);
            }
            currentDate = addDays(currentDate, 7);
            break;

          default:
            currentDate = addDays(currentDate, 1);
        }
      }
    }
  }
}

function generateSavingsTransactions(
  config: PersonaConfig,
  startDate: Date,
  endDate: Date,
  savingsGoalMap: Map<string, string>,
  random: () => number,
  transactions: GeneratedTransaction[],
): void {
  // Calculate financial stress level (affects savings consistency)
  const monthlyIncome = estimateMonthlyIncome(config);
  const monthlyExpenses = estimateMonthlyExpenses(config);
  const stressRatio = monthlyExpenses / monthlyIncome; // Higher = more stressed

  for (const goalConfig of config.savingsGoals) {
    const goalId = savingsGoalMap.get(goalConfig.name);
    if (!goalId) continue;

    // Add starting balance as a transaction BEFORE the anchor date.
    // This way it counts toward the savings goal total but doesn't affect
    // the checking account balance (which filters t.date >= anchorDate).
    if (goalConfig.startingBalanceCents && goalConfig.startingBalanceCents > 0) {
      const dayBeforeStart = new Date(startDate);
      dayBeforeStart.setDate(dayBeforeStart.getDate() - 1);
      transactions.push({
        id: generateId(),
        date: formatDate(dayBeforeStart),
        description: `Opening balance - ${goalConfig.name}`,
        type: 'savings',
        amountCents: goalConfig.startingBalanceCents,
        categoryId: null,
        savingsGoalId: goalId,
      });
    }

    if (!goalConfig.monthlyContributionCents) continue;

    // Determine savings behavior based on goal type and financial situation
    const isEmergencyFund = goalConfig.isEmergencyFund ?? false;
    const hasDeadline = !!goalConfig.deadline;

    // Skip probability: financially stressed people skip more often
    // Emergency funds get skipped more than deadline goals
    let skipProbability = 0;
    if (stressRatio > 0.9) {
      skipProbability = isEmergencyFund ? 0.4 : hasDeadline ? 0.15 : 0.25;
    } else if (stressRatio > 0.8) {
      skipProbability = isEmergencyFund ? 0.15 : hasDeadline ? 0.05 : 0.1;
    }

    // Extra contribution probability (tax return, bonus, etc.)
    const extraProbability = stressRatio < 0.7 ? 0.08 : stressRatio < 0.85 ? 0.04 : 0.02;

    // Variance in regular contribution amount
    const contributionVariance = stressRatio > 0.85 ? 0.2 : 0.1;

    // Generate monthly contributions
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      // Contribute on the 1st of each month (or nearest weekday)
      let contributeDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      if (contributeDate.getDay() === 0) contributeDate.setDate(2);
      if (contributeDate.getDay() === 6) contributeDate.setDate(3);

      if (contributeDate >= startDate && contributeDate <= endDate) {
        // Check if skipping this month
        const shouldSkip = random() < skipProbability;

        if (!shouldSkip) {
          // Regular contribution with variance
          const amount = applyVariance(goalConfig.monthlyContributionCents, contributionVariance, random);
          transactions.push({
            id: generateId(),
            date: formatDate(contributeDate),
            description: `Transfer to ${goalConfig.name}`,
            type: 'savings',
            amountCents: amount,
            categoryId: null,
            savingsGoalId: goalId,
          });

          // Occasional extra contribution (mid-month)
          if (random() < extraProbability) {
            const extraDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 15);
            if (extraDate <= endDate) {
              const extraDescriptions = [
                `Extra savings - ${goalConfig.name}`,
                `Bonus to ${goalConfig.name}`,
                `Top up - ${goalConfig.name}`,
              ];
              // Extra is 50-150% of regular contribution
              const extraAmount = Math.round(goalConfig.monthlyContributionCents * (0.5 + random()));
              transactions.push({
                id: generateId(),
                date: formatDate(extraDate),
                description: randomItem(extraDescriptions, random),
                type: 'savings',
                amountCents: extraAmount,
                categoryId: null,
                savingsGoalId: goalId,
              });
            }
          }
        }
      }

      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    }
  }
}

function generateForecastRules(
  config: PersonaConfig,
  scenarioId: string,
  categoryMap: Map<string, string>,
  savingsGoalMap: Map<string, string>,
  scenarioConfig?: PersonaConfig['scenarios'][0],
): GeneratedForecastRule[] {
  const rules: GeneratedForecastRule[] = [];

  // Get income multiplier for this scenario (default to 1.0)
  const incomeMultiplier = scenarioConfig?.incomeMultiplier ?? 1.0;

  // Income forecast (only if income multiplier > 0)
  if (incomeMultiplier > 0) {
    const adjustedIncome = Math.round(config.income.primary.amountCents * incomeMultiplier);
    const incomeDescription =
      incomeMultiplier !== 1.0
        ? `${config.income.primary.description} (adjusted)`
        : config.income.primary.description;

    const incomeRule: GeneratedForecastRule = {
      id: generateId(),
      scenarioId,
      categoryId: null,
      description: incomeDescription,
      type: 'income',
      amountCents: adjustedIncome,
      cadence: config.income.primary.cadence,
    };
    if (
      config.income.primary.cadence === 'weekly' ||
      config.income.primary.cadence === 'fortnightly'
    ) {
      incomeRule.dayOfWeek = 5; // Friday
    }
    if (config.income.primary.cadence === 'monthly') {
      incomeRule.dayOfMonth = 28;
    }
    rules.push(incomeRule);
    // Note: Bonuses/extras are NOT added as forecast rules.
    // They appear as past transactions (generated in generateIncomeTransactions)
    // and can be added as one-off forecast events via scenario.forecastEvents
  }

  // Recurring expense forecasts (monthly bills, rent, etc.)
  for (const expense of config.expenses) {
    for (const pattern of expense.patterns) {
      // Only create forecast rules for regular monthly expenses
      if (pattern.frequency === 'monthly' && pattern.dayOfMonth !== undefined) {
        const categoryId = categoryMap.get(expense.category) ?? null;
        const description = Array.isArray(pattern.description)
          ? pattern.description[0]!
          : pattern.description;

        rules.push({
          id: generateId(),
          scenarioId,
          categoryId,
          description,
          type: 'expense',
          amountCents: pattern.amountCents,
          cadence: 'monthly',
          dayOfMonth: pattern.dayOfMonth,
        });
      }
    }
  }

  // Savings forecasts - check for scenario overrides
  for (const goal of config.savingsGoals) {
    // Check if this goal has a scenario override
    const savingsOverride = scenarioConfig?.savingsOverrides?.find((o) => o.goalName === goal.name);

    // Use override amount, or default monthly contribution
    const contributionAmount = savingsOverride
      ? savingsOverride.monthlyContributionCents
      : (goal.monthlyContributionCents ?? 0);

    // Only create rule if there's a contribution
    if (contributionAmount > 0) {
      const goalId = savingsGoalMap.get(goal.name);
      const savingsRule: GeneratedForecastRule = {
        id: generateId(),
        scenarioId,
        categoryId: null,
        description: `Transfer to ${goal.name}`,
        type: 'savings',
        amountCents: contributionAmount,
        cadence: 'monthly',
        dayOfMonth: 1,
      };
      if (goalId) savingsRule.savingsGoalId = goalId;
      rules.push(savingsRule);
    }
  }

  return rules;
}

function ensureCurrentMonthTransactions(
  config: PersonaConfig,
  today: Date,
  categoryMap: Map<string, string>,
  random: () => number,
  transactions: GeneratedTransaction[],
): void {
  // Get first day of current month
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const currentMonthStr = formatDate(monthStart).slice(0, 7); // YYYY-MM

  // Check if we already have transactions this month
  const currentMonthTransactions = transactions.filter((t) => t.date.startsWith(currentMonthStr));

  // If we have fewer than 5 transactions this month, add some guaranteed ones
  if (currentMonthTransactions.length < 5) {
    // Add a few transactions from the first week of the month
    for (const expense of config.expenses) {
      const categoryId = categoryMap.get(expense.category) ?? null;

      for (const pattern of expense.patterns) {
        // Only add for frequent patterns (weekly/daily)
        if (pattern.frequency === 'weekly' || pattern.frequency === 'daily') {
          // Add one transaction in the first week
          const dayOffset = Math.floor(random() * Math.min(7, today.getDate()));
          const transactionDate = new Date(monthStart);
          transactionDate.setDate(transactionDate.getDate() + dayOffset);

          if (transactionDate <= today) {
            const description = Array.isArray(pattern.description)
              ? randomItem(pattern.description, random)
              : pattern.description;

            transactions.push({
              id: generateId(),
              date: formatDate(transactionDate),
              description,
              type: 'expense',
              amountCents: applyVariance(pattern.amountCents, pattern.variance ?? 0.15, random),
              categoryId,
            });
          }
        }

        // Add monthly bills that fall on dates before today
        if (pattern.frequency === 'monthly' && pattern.dayOfMonth !== undefined) {
          if (pattern.dayOfMonth <= today.getDate()) {
            const transactionDate = new Date(
              today.getFullYear(),
              today.getMonth(),
              pattern.dayOfMonth,
            );

            // Check if we already have this transaction
            const description = Array.isArray(pattern.description)
              ? pattern.description[0]!
              : pattern.description;

            const exists = transactions.some(
              (t) => t.date === formatDate(transactionDate) && t.description === description,
            );

            if (!exists) {
              transactions.push({
                id: generateId(),
                date: formatDate(transactionDate),
                description,
                type: 'expense',
                amountCents: applyVariance(pattern.amountCents, pattern.variance ?? 0, random),
                categoryId,
              });
            }
          }
        }
      }
    }
  }
}

function calculateBalanceAnchor(
  config: PersonaConfig,
  startDate: Date,
): GeneratedBalanceAnchor[] {
  // Calculate a realistic checking account balance at start of data period.
  // This needs to account for 12 months of transaction variance.

  const monthlyIncome = estimateMonthlyIncome(config);
  const monthlyExtras = estimateMonthlyExtras(config);
  const totalMonthlyIncome = monthlyIncome + monthlyExtras;
  const monthlyExpenses = estimateMonthlyExpenses(config);
  const monthlySavings = estimateMonthlySavings(config);

  // Calculate what percentage of income goes to expenses+savings
  const burnRate = (monthlyExpenses + monthlySavings) / totalMonthlyIncome;

  let startingBalance: number;

  if (burnRate >= 0.95) {
    // Paycheck to paycheck - very little buffer, maybe just rent money
    startingBalance = Math.round(totalMonthlyIncome * 0.2);
  } else if (burnRate >= 0.85) {
    // Tight budget - about 1 month buffer
    startingBalance = Math.round(totalMonthlyIncome * 0.4);
  } else if (burnRate >= 0.7) {
    // Comfortable - about 1.5 months buffer
    startingBalance = Math.round(totalMonthlyIncome * 0.6);
  } else {
    // High saver - 2 months buffer (rest goes to savings accounts)
    startingBalance = Math.round(totalMonthlyIncome * 0.8);
  }

  // Add buffer for transaction variance over 12 months (~10% variance)
  // This prevents ending up negative due to random expense spikes
  startingBalance += Math.round(monthlyExpenses * 0.15 * 12);

  // Minimum floor: at least 1 month of expenses
  startingBalance = Math.max(startingBalance, monthlyExpenses);

  return [
    {
      id: generateId(),
      date: formatDate(startDate),
      balanceCents: startingBalance,
      description: 'Opening balance',
    },
  ];
}

function estimateMonthlyExtras(config: PersonaConfig): number {
  if (!config.income.extras) return 0;

  let total = 0;
  for (const extra of config.income.extras) {
    if (extra.frequency === 'yearly') {
      total += extra.amountCents / 12;
    } else if (extra.frequency === 'quarterly') {
      total += extra.amountCents / 3;
    }
  }
  return Math.round(total);
}

function estimateMonthlySavings(config: PersonaConfig): number {
  let total = 0;
  for (const goal of config.savingsGoals) {
    total += goal.monthlyContributionCents ?? 0;
  }
  return total;
}

function estimateMonthlyIncome(config: PersonaConfig): number {
  const primary = config.income.primary;
  let monthly = 0;

  switch (primary.cadence) {
    case 'weekly':
      monthly = primary.amountCents * 4.33;
      break;
    case 'fortnightly':
      monthly = primary.amountCents * 2.17;
      break;
    case 'monthly':
      monthly = primary.amountCents;
      break;
    case 'quarterly':
      monthly = primary.amountCents / 3;
      break;
    case 'yearly':
      monthly = primary.amountCents / 12;
      break;
  }

  return Math.round(monthly);
}

function estimateMonthlyExpenses(config: PersonaConfig): number {
  let total = 0;

  for (const expense of config.expenses) {
    for (const pattern of expense.patterns) {
      let monthlyAmount = 0;
      const probability = pattern.probability ?? 1;

      switch (pattern.frequency) {
        case 'daily':
          monthlyAmount = pattern.amountCents * 30 * probability;
          break;
        case 'weekly':
          monthlyAmount = pattern.amountCents * 4.33 * probability;
          break;
        case 'fortnightly':
          monthlyAmount = pattern.amountCents * 2.17 * probability;
          break;
        case 'monthly':
          monthlyAmount = pattern.amountCents * probability;
          break;
        case 'occasional':
          monthlyAmount = pattern.amountCents * 4 * probability; // ~4 chances per month
          break;
      }

      total += monthlyAmount;
    }
  }

  return Math.round(total);
}

/**
 * Generate unbudgeted/miscellaneous expenses without categories.
 * These represent random purchases, impulse buys, cash withdrawals, etc.
 */
function generateUnbudgetedTransactions(
  config: PersonaConfig,
  startDate: Date,
  endDate: Date,
  random: () => number,
  transactions: GeneratedTransaction[],
): void {
  // Estimate monthly income to scale unbudgeted spending appropriately
  const monthlyIncome = estimateMonthlyIncome(config);

  // Unbudgeted spending patterns based on income level
  // Lower income = less discretionary spending, higher income = more random purchases
  const unbudgetedPatterns = getUnbudgetedPatterns(monthlyIncome);

  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    for (const pattern of unbudgetedPatterns) {
      if (random() < pattern.probability) {
        const dayOffset = Math.floor(random() * 7);
        const transactionDate = addDays(currentDate, dayOffset);

        if (transactionDate >= startDate && transactionDate <= endDate) {
          transactions.push({
            id: generateId(),
            date: formatDate(transactionDate),
            description: randomItem(pattern.descriptions, random),
            type: 'expense',
            amountCents: applyVariance(pattern.amountCents, 0.3, random),
            categoryId: null, // No category = unbudgeted
          });
        }
      }
    }
    currentDate = addDays(currentDate, 7); // Check weekly
  }
}

interface UnbudgetedPattern {
  descriptions: string[];
  amountCents: number;
  probability: number;
}

function getUnbudgetedPatterns(monthlyIncome: number): UnbudgetedPattern[] {
  // Scale patterns based on income
  const incomeMultiplier = Math.max(0.5, Math.min(2, monthlyIncome / 600000)); // Base on $6k/month

  const patterns: UnbudgetedPattern[] = [
    // Small random purchases
    {
      descriptions: ['Amazon', 'eBay', 'Kmart', 'Target', 'Big W'],
      amountCents: Math.round(3500 * incomeMultiplier),
      probability: 0.4,
    },
    // Cash withdrawals
    {
      descriptions: ['ATM Withdrawal', 'Cash Out'],
      amountCents: Math.round(6000 * incomeMultiplier),
      probability: 0.25,
    },
    // Food delivery when too tired to cook
    {
      descriptions: ['Uber Eats', 'DoorDash', 'Menulog', 'Deliveroo'],
      amountCents: Math.round(4500 * incomeMultiplier),
      probability: 0.35,
    },
    // Random convenience store
    {
      descriptions: ['7-Eleven', 'Coles Express', 'Servo'],
      amountCents: Math.round(1500 * incomeMultiplier),
      probability: 0.3,
    },
    // One-off services
    {
      descriptions: ['Airtasker', 'Car Wash', 'Dry Cleaning', 'Cobbler'],
      amountCents: Math.round(4000 * incomeMultiplier),
      probability: 0.15,
    },
    // Random gifts/misc
    {
      descriptions: ['Gift - Birthday', 'Gift - Thank You', 'Flowers'],
      amountCents: Math.round(6000 * incomeMultiplier),
      probability: 0.1,
    },
  ];

  return patterns;
}

/**
 * Ensure current month has income if payday has passed.
 * This fixes the issue where income might not appear because the generator
 * didn't catch the current month's payday.
 */
function ensureCurrentMonthIncome(
  config: PersonaConfig,
  today: Date,
  random: () => number,
  transactions: GeneratedTransaction[],
): void {
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const currentMonthStr = formatDate(monthStart).slice(0, 7);

  // Check if we have income this month
  const currentMonthIncome = transactions.filter(
    (t) => t.type === 'income' && t.date.startsWith(currentMonthStr),
  );

  // If no income this month, add it based on cadence and day of month
  if (currentMonthIncome.length === 0) {
    const { income } = config;
    let payDate: Date | null = null;

    switch (income.primary.cadence) {
      case 'weekly':
      case 'fortnightly': {
        // Find most recent Friday before or on today
        const daysUntilFriday = (today.getDay() + 2) % 7; // Days since last Friday
        if (daysUntilFriday <= today.getDate()) {
          payDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysUntilFriday);
        }
        break;
      }
      case 'monthly': {
        // Last working day of month or a specific day
        // Check if the typical pay day (28th or last weekday) has passed
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const typicalPayDay = Math.min(28, lastDayOfMonth);
        if (today.getDate() >= typicalPayDay) {
          payDate = new Date(today.getFullYear(), today.getMonth(), typicalPayDay);
          // Adjust for weekends
          while (payDate.getDay() === 0 || payDate.getDay() === 6) {
            payDate.setDate(payDate.getDate() - 1);
          }
        }
        break;
      }
    }

    if (payDate && payDate >= monthStart && payDate <= today) {
      const amount = applyVariance(
        income.primary.amountCents,
        income.primary.variance ?? 0,
        random,
      );
      transactions.push({
        id: generateId(),
        date: formatDate(payDate),
        description: income.primary.description,
        type: 'income',
        amountCents: amount,
        categoryId: null,
      });
    }
  }
}
