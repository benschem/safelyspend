import type { PersonaConfig } from '../types';

export const studentSooJin: PersonaConfig = {
  id: 'student-soo-jin',
  name: 'Student Soo-Jin',
  tagline: 'Uni student, tight budget but disciplined',
  description:
    'Soo-Jin works part-time at a cafe while studying. Every dollar is accounted for. Saving for a laptop.',

  categories: [
    'Rent',
    'Groceries',
    'Transport',
    'Uni Supplies',
    'Dining Out',
    'Entertainment',
    'Phone',
    'Health',
  ],

  income: {
    primary: {
      description: 'Pay - Morning Brew Cafe',
      amountCents: 49654, // $496.54/week, casual rates (~$2,151/month) - balanced tight budget
      cadence: 'weekly',
      variance: 0.08,
    },
    extras: [
      {
        description: 'Tutoring - Maths',
        amountCents: 8000, // $80 for a session
        frequency: 'occasional',
        probability: 0.3,
      },
    ],
  },

  expenses: [
    {
      category: 'Rent',
      patterns: [
        {
          description: 'Rent - 15 King St',
          amountCents: 25000, // $250/week including utilities
          frequency: 'weekly',
          dayOfWeek: 1, // Monday
          variance: 0,
        },
      ],
    },
    {
      category: 'Groceries',
      patterns: [
        {
          description: ['Aldi Newtown', 'Aldi Marrickville'],
          amountCents: 4500, // $45 average
          frequency: 'weekly',
          variance: 0.15,
        },
        {
          description: ['Woolworths Metro', 'Coles Express'],
          amountCents: 1200,
          frequency: 'weekly',
          probability: 0.35,
          variance: 0.25,
        },
      ],
    },
    {
      category: 'Transport',
      patterns: [
        {
          description: 'Opal Concession Top Up',
          amountCents: 2000, // $20/week with student concession
          frequency: 'weekly',
          variance: 0.15,
        },
      ],
    },
    {
      category: 'Uni Supplies',
      patterns: [
        {
          description: ['Officeworks', 'Dymocks'],
          amountCents: 2200,
          frequency: 'monthly',
          probability: 0.45,
          variance: 0.35,
        },
        {
          description: 'Uni Print Credit',
          amountCents: 800,
          frequency: 'monthly',
          probability: 0.6,
        },
      ],
    },
    {
      category: 'Dining Out',
      patterns: [
        {
          description: ['Guzman y Gomez', 'Soul Origin', 'Subway'],
          amountCents: 1400,
          frequency: 'weekly',
          probability: 0.55,
          variance: 0.15,
        },
        {
          description: 'Uni Food Court',
          amountCents: 1000,
          frequency: 'weekly',
          probability: 0.45,
          variance: 0.15,
        },
      ],
    },
    {
      category: 'Entertainment',
      patterns: [
        {
          description: 'Netflix (shared)',
          amountCents: 650, // Split with housemates
          frequency: 'monthly',
          dayOfMonth: 10,
        },
        {
          description: 'Spotify Student',
          amountCents: 699,
          frequency: 'monthly',
          dayOfMonth: 15,
        },
        {
          description: ['The Townie', 'Uni Bar'],
          amountCents: 3000,
          frequency: 'monthly',
          probability: 0.5,
          variance: 0.25,
        },
      ],
    },
    {
      category: 'Phone',
      patterns: [
        {
          description: 'Belong Mobile',
          amountCents: 2500, // Cheap plan
          frequency: 'monthly',
          dayOfMonth: 5,
        },
      ],
    },
    {
      category: 'Health',
      patterns: [
        {
          description: 'Priceline Pharmacy',
          amountCents: 1800,
          frequency: 'monthly',
          probability: 0.4,
          variance: 0.25,
        },
      ],
    },
  ],

  // Soo-Jin is disciplined - budgets set above expected spending so she stays under
  // Expected: Groceries ~$213/mo, Transport ~$87/mo, Uni ~$15/mo, Dining ~$52/mo, Entertainment ~$28/mo
  budgets: [
    { category: 'Rent', amountCents: 25000, cadence: 'weekly' },
    { category: 'Groceries', amountCents: 5800, cadence: 'weekly' }, // ~$251/mo budget, spends ~$213 (15% under)
    { category: 'Transport', amountCents: 2400, cadence: 'weekly' }, // ~$104/mo budget, spends ~$87 (16% under)
    { category: 'Uni Supplies', amountCents: 2500, cadence: 'monthly' }, // Spends ~$15 (well under)
    { category: 'Dining Out', amountCents: 7000, cadence: 'monthly' }, // Spends ~$52 (26% under)
    { category: 'Entertainment', amountCents: 4000, cadence: 'monthly' }, // Spends ~$28 (30% under)
    { category: 'Phone', amountCents: 2500, cadence: 'monthly' },
    { category: 'Health', amountCents: 1500, cadence: 'monthly' },
  ],

  savingsGoals: [
    {
      name: 'New Laptop',
      targetAmountCents: 180000, // $1,800
      deadline: { monthsFromNow: 4 },
      startingBalanceCents: 90000, // Already saved $900
      monthlyContributionCents: 35000, // $350/month - aggressive to hit deadline
    },
    {
      name: 'Emergency Buffer',
      targetAmountCents: 200000, // $2,000 small emergency fund
      isEmergencyFund: true,
      startingBalanceCents: 50000, // $500 saved
      monthlyContributionCents: 15000, // $150/month - building the habit
    },
  ],

  scenarios: [
    {
      name: 'Tight Budget',
      description:
        'Every dollar counts. Meal prep on Sundays, concession Opal, shared Netflix. On track for the laptop by semester end.',
      isDefault: true,
    },
    {
      name: 'Summer Internship',
      description:
        'Landed a paid tech internship! $1,200/week for 12 weeks. Time to fast-track the laptop fund and build that emergency buffer.',
      isDefault: false,
      incomeMultiplier: 2.5, // $1,200/week vs $485/week
      budgetOverrides: [
        { category: 'Groceries', amountCents: 7000 },
        { category: 'Transport', amountCents: 4000 },
        { category: 'Dining Out', amountCents: 10000 },
        { category: 'Entertainment', amountCents: 6000 },
      ],
      savingsOverrides: [
        { goalName: 'New Laptop', monthlyContributionCents: 60000 },
        { goalName: 'Emergency Buffer', monthlyContributionCents: 35000 },
      ],
    },
    {
      name: 'Cafe Closes',
      description:
        'Morning Brew shut down unexpectedly. Only income is occasional tutoring. Need to pause savings and survive on basics.',
      isDefault: false,
      incomeMultiplier: 0.35,
      budgetOverrides: [
        { category: 'Groceries', amountCents: 3500 },
        { category: 'Transport', amountCents: 1500 },
        { category: 'Dining Out', amountCents: 1000 },
        { category: 'Entertainment', amountCents: 1350 },
        { category: 'Uni Supplies', amountCents: 1000 },
        { category: 'Phone', amountCents: 1500 },
        { category: 'Health', amountCents: 800 },
      ],
      savingsOverrides: [
        { goalName: 'New Laptop', monthlyContributionCents: 0 },
        { goalName: 'Emergency Buffer', monthlyContributionCents: 0 },
      ],
    },
  ],
};
