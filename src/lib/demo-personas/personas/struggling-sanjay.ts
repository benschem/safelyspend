import type { PersonaConfig } from '../types';

export const strugglingSanjay: PersonaConfig = {
  id: 'struggling-sanjay',
  name: 'Struggling Sanjay',
  tagline: 'Warehouse worker, living paycheck to paycheck',
  description:
    'Sanjay earns a decent wage but struggles with impulse spending. Often over budget, minimal savings.',

  categories: [
    'Rent',
    'Groceries',
    'Transport',
    'Utilities',
    'Dining Out',
    'Entertainment',
    'Shopping',
    'Subscriptions',
    'Health',
  ],

  income: {
    primary: {
      description: 'Pay - Warehouse Co',
      amountCents: 172000, // $1,720 fortnightly after tax (~$3,730/month)
      cadence: 'fortnightly',
      variance: 0.05,
    },
    extras: [
      {
        description: 'Overtime Pay',
        amountCents: 28000, // $280
        frequency: 'occasional',
        probability: 0.15,
      },
    ],
  },

  expenses: [
    {
      category: 'Rent',
      patterns: [
        {
          description: 'Rent - 42 Smith St',
          amountCents: 140000, // $1,400/month (shared house)
          frequency: 'monthly',
          dayOfMonth: 1,
          variance: 0,
        },
      ],
    },
    {
      category: 'Groceries',
      patterns: [
        {
          description: ['Coles Waterloo', 'Woolworths Metro', 'Aldi Surry Hills'],
          amountCents: 7500, // $75 average shop
          frequency: 'weekly',
          variance: 0.2,
        },
        {
          description: ['IGA Express', 'Coles Express'],
          amountCents: 1800,
          frequency: 'weekly',
          variance: 0.25,
          probability: 0.5,
        },
      ],
    },
    {
      category: 'Transport',
      patterns: [
        {
          description: 'Opal Top Up',
          amountCents: 4500, // $45/week
          frequency: 'weekly',
          variance: 0.15,
        },
        {
          description: 'Uber',
          amountCents: 2500,
          frequency: 'weekly',
          probability: 0.3,
          variance: 0.25,
        },
      ],
    },
    {
      category: 'Utilities',
      patterns: [
        {
          description: 'AGL Electricity',
          amountCents: 8500, // $85/month
          frequency: 'monthly',
          dayOfMonth: 15,
          variance: 0.15,
        },
        {
          description: 'Telstra Mobile',
          amountCents: 4500,
          frequency: 'monthly',
          dayOfMonth: 20,
        },
      ],
    },
    {
      category: 'Dining Out',
      patterns: [
        {
          description: ['Uber Eats', 'DoorDash', 'Menulog'],
          amountCents: 4500, // $45 orders - too lazy to cook
          frequency: 'weekly',
          probability: 0.85, // Almost every week
          variance: 0.2,
        },
        {
          description: ['Maccas', 'Hungry Jacks', 'KFC'],
          amountCents: 1800,
          frequency: 'weekly',
          probability: 0.85,
          variance: 0.15,
        },
        {
          description: ['Thai Panda', 'Pizza Hut', 'Subway'],
          amountCents: 2500,
          frequency: 'weekly',
          probability: 0.6,
          variance: 0.2,
        },
      ],
    },
    {
      category: 'Entertainment',
      patterns: [
        {
          description: ['The Star Bar', 'Frankies Pizza', 'The Lansdowne'],
          amountCents: 12000, // $120 on a night out (drinks add up)
          frequency: 'weekly',
          probability: 0.75, // Most weekends, sometimes both nights
          variance: 0.3,
        },
        {
          description: ['TAB', 'Sportsbet'],
          amountCents: 5000, // $50 gambling habit
          frequency: 'weekly',
          probability: 0.5,
          variance: 0.4,
        },
        {
          description: ['Event Cinemas', 'Hoyts'],
          amountCents: 3500,
          frequency: 'monthly',
          probability: 0.6,
          variance: 0.2,
        },
      ],
    },
    {
      category: 'Shopping',
      patterns: [
        {
          description: ['JB Hi-Fi', 'Kmart', 'Big W'],
          amountCents: 10000, // $100 impulse purchases
          frequency: 'monthly',
          probability: 0.8,
          variance: 0.35,
        },
        {
          description: ['BWS', 'Dan Murphys', 'Liquorland'],
          amountCents: 5500, // $55/week on drinks at home
          frequency: 'weekly',
          probability: 0.7,
          variance: 0.2,
        },
        {
          description: ['eBay', 'Facebook Marketplace'],
          amountCents: 6000, // Random online purchases
          frequency: 'monthly',
          probability: 0.5,
          variance: 0.4,
        },
      ],
    },
    {
      category: 'Subscriptions',
      patterns: [
        {
          description: 'Spotify Premium',
          amountCents: 1299,
          frequency: 'monthly',
          dayOfMonth: 12,
        },
        {
          description: 'Netflix',
          amountCents: 1790,
          frequency: 'monthly',
          dayOfMonth: 8,
        },
        {
          description: 'Stan',
          amountCents: 1400,
          frequency: 'monthly',
          dayOfMonth: 5,
        },
        {
          description: 'Xbox Game Pass',
          amountCents: 1699,
          frequency: 'monthly',
          dayOfMonth: 18,
        },
      ],
    },
    {
      category: 'Health',
      patterns: [
        {
          description: 'Chemist Warehouse',
          amountCents: 3000,
          frequency: 'monthly',
          probability: 0.6,
          variance: 0.3,
        },
      ],
    },
  ],

  // Budgets are what Sanjay WANTS to spend (aspirational)
  // But his actual spending patterns above regularly exceed these - he's paycheck to paycheck
  // Income: ~$3,730/month. Actual spending: ~$3,500/month (leaves almost nothing)
  // Expected actual: Groceries ~$364, Transport ~$227, Dining ~$297, Entertainment ~$519, Shopping ~$277
  budgets: [
    { category: 'Rent', amountCents: 140000, cadence: 'monthly' },
    { category: 'Groceries', amountCents: 30000, cadence: 'monthly' }, // Wants $300, spends ~$364 (21% over)
    { category: 'Transport', amountCents: 20000, cadence: 'monthly' }, // Wants $200, spends ~$227 (14% over)
    { category: 'Utilities', amountCents: 13000, cadence: 'monthly' },
    { category: 'Dining Out', amountCents: 15000, cadence: 'monthly' }, // Wants $150, spends ~$297 (98% over!)
    { category: 'Entertainment', amountCents: 15000, cadence: 'monthly' }, // Wants $150, spends ~$519 (246% over!)
    { category: 'Shopping', amountCents: 10000, cadence: 'monthly' }, // Wants $100, spends ~$277 (177% over)
    { category: 'Subscriptions', amountCents: 6200, cadence: 'monthly' },
    { category: 'Health', amountCents: 2000, cadence: 'monthly' },
  ],

  savingsGoals: [
    {
      name: 'Emergency Buffer',
      targetAmountCents: 500000, // $5,000 starter emergency fund
      isEmergencyFund: true,
      startingBalanceCents: 0,
      monthlyContributionCents: 5000, // Trying to save $50/month, often fails
    },
  ],

  scenarios: [
    {
      name: 'Current Situation',
      description:
        'Living paycheck to paycheck. Regularly over budget on food and entertainment. Trying to save but usually ends up spending it.',
      isDefault: true,
    },
    {
      name: 'Get Back on Track',
      description:
        'Time to get serious. Cancel extra streaming services, cook at home more, limit nights out to once a fortnight.',
      isDefault: false,
      budgetOverrides: [
        { category: 'Groceries', amountCents: 32000 },
        { category: 'Dining Out', amountCents: 12000 },
        { category: 'Entertainment', amountCents: 8000 },
        { category: 'Shopping', amountCents: 6000 },
        { category: 'Subscriptions', amountCents: 3100 }, // Keep Netflix and Spotify only
      ],
      savingsOverrides: [
        { goalName: 'Emergency Buffer', monthlyContributionCents: 15000 },
      ],
    },
    {
      name: 'Hours Get Cut',
      description:
        'Warehouse slowdown means 20% fewer shifts. Need to cut everything to essentials.',
      isDefault: false,
      incomeMultiplier: 0.8,
      budgetOverrides: [
        { category: 'Groceries', amountCents: 25000 },
        { category: 'Transport', amountCents: 18000 },
        { category: 'Dining Out', amountCents: 5000 },
        { category: 'Entertainment', amountCents: 4000 },
        { category: 'Shopping', amountCents: 3000 },
        { category: 'Subscriptions', amountCents: 1300 },
        { category: 'Health', amountCents: 2000 },
      ],
      savingsOverrides: [
        { goalName: 'Emergency Buffer', monthlyContributionCents: 0 },
      ],
    },
  ],
};
