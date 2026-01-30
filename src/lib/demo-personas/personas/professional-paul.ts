import type { PersonaConfig } from '../types';

export const professionalPaul: PersonaConfig = {
  id: 'professional-paul',
  name: 'Professional Paul',
  tagline: 'Marketing manager, comfortable and organised',
  description:
    'Paul has good financial habits. Emergency fund building, regular savings, living within his means with occasional splurges.',

  categories: [
    'Rent',
    'Groceries',
    'Transport',
    'Utilities',
    'Dining Out',
    'Entertainment',
    'Shopping',
    'Health & Fitness',
    'Subscriptions',
    'Personal Care',
  ],

  income: {
    primary: {
      description: 'Pay - MediaCorp',
      amountCents: 305000, // $3,050 fortnightly after tax (~$6,600/month)
      cadence: 'fortnightly',
      variance: 0,
    },
    extras: [
      {
        description: 'Quarterly Bonus - MediaCorp',
        amountCents: 250000, // $2,500
        frequency: 'quarterly',
        months: [3, 6, 9, 12],
      },
    ],
  },

  expenses: [
    {
      category: 'Rent',
      patterns: [
        {
          description: 'Rent - 8/120 Pacific Hwy',
          amountCents: 220000, // $2,200/month
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
          description: ['Coles Online', 'Woolworths Delivery'],
          amountCents: 12000, // $120 big shop
          frequency: 'weekly',
          variance: 0.12,
        },
        {
          description: ['Harris Farm', 'IGA Gourmet'],
          amountCents: 4500,
          frequency: 'weekly',
          probability: 0.4,
          variance: 0.2,
        },
      ],
    },
    {
      category: 'Transport',
      patterns: [
        {
          description: 'Opal Auto Top Up',
          amountCents: 3500,
          frequency: 'weekly',
          variance: 0.15,
        },
        {
          description: ['Uber', 'DiDi'],
          amountCents: 3000,
          frequency: 'weekly',
          probability: 0.4,
          variance: 0.25,
        },
      ],
    },
    {
      category: 'Utilities',
      patterns: [
        {
          description: 'Origin Energy',
          amountCents: 11000,
          frequency: 'monthly',
          dayOfMonth: 18,
          variance: 0.12,
        },
        {
          description: 'Optus NBN',
          amountCents: 7900,
          frequency: 'monthly',
          dayOfMonth: 22,
        },
        {
          description: 'Telstra Mobile',
          amountCents: 5500,
          frequency: 'monthly',
          dayOfMonth: 14,
        },
      ],
    },
    {
      category: 'Dining Out',
      patterns: [
        {
          description: ['Three Blue Ducks', 'Bistro Rex', 'Porteño'],
          amountCents: 8500, // Nice dinner
          frequency: 'weekly',
          probability: 0.3,
          variance: 0.2,
        },
        {
          description: ['Guzman y Gomez', 'Fishbowl', "Nando's"],
          amountCents: 2200,
          frequency: 'weekly',
          probability: 0.6,
          variance: 0.15,
        },
        {
          description: 'Coffee - Local Cafe',
          amountCents: 550,
          frequency: 'daily',
          probability: 0.6,
        },
      ],
    },
    {
      category: 'Entertainment',
      patterns: [
        {
          description: ['Palace Cinemas', 'Dendy'],
          amountCents: 4000,
          frequency: 'monthly',
          probability: 0.5,
          variance: 0.15,
        },
        {
          description: ['The Baxter Inn', 'Eau de Vie'],
          amountCents: 7000,
          frequency: 'monthly',
          probability: 0.4,
          variance: 0.2,
        },
      ],
    },
    {
      category: 'Shopping',
      patterns: [
        {
          description: ['ASOS', 'The Iconic'],
          amountCents: 12000,
          frequency: 'monthly',
          probability: 0.45,
          variance: 0.3,
        },
        {
          description: 'Bunnings',
          amountCents: 5000,
          frequency: 'monthly',
          probability: 0.4,
          variance: 0.35,
        },
      ],
    },
    {
      category: 'Health & Fitness',
      patterns: [
        {
          description: 'Fitness First DD',
          amountCents: 7000,
          frequency: 'monthly',
          dayOfMonth: 1,
        },
        {
          description: 'Chemist Warehouse',
          amountCents: 4000,
          frequency: 'monthly',
          probability: 0.5,
          variance: 0.3,
        },
      ],
    },
    {
      category: 'Subscriptions',
      patterns: [
        {
          description: 'Stan',
          amountCents: 1699,
          frequency: 'monthly',
          dayOfMonth: 8,
        },
        {
          description: 'Spotify Premium',
          amountCents: 1299,
          frequency: 'monthly',
          dayOfMonth: 12,
        },
        {
          description: 'Apple iCloud',
          amountCents: 449,
          frequency: 'monthly',
          dayOfMonth: 5,
        },
        {
          description: 'Adobe Creative Cloud',
          amountCents: 2299,
          frequency: 'monthly',
          dayOfMonth: 15,
        },
      ],
    },
    {
      category: 'Personal Care',
      patterns: [
        {
          description: ['Mecca', 'Sephora'],
          amountCents: 6000,
          frequency: 'monthly',
          probability: 0.4,
          variance: 0.35,
        },
        {
          description: 'Haircut - Barber',
          amountCents: 4500,
          frequency: 'monthly',
          probability: 0.7,
        },
      ],
    },
  ],

  // Paul is comfortable and mostly on budget - dining is his splurge area
  // Expected: Groceries ~$598, Transport ~$204, Dining ~$266, Entertainment ~$48, Shopping ~$74, Health ~$90, Personal ~$56
  budgets: [
    { category: 'Rent', amountCents: 220000, cadence: 'monthly' },
    { category: 'Groceries', amountCents: 62000, cadence: 'monthly' }, // Spends ~$598 (3% under)
    { category: 'Transport', amountCents: 22000, cadence: 'monthly' }, // Spends ~$204 (7% under)
    { category: 'Utilities', amountCents: 25000, cadence: 'monthly' },
    { category: 'Dining Out', amountCents: 22000, cadence: 'monthly' }, // Spends ~$266 (21% OVER - his splurge)
    { category: 'Entertainment', amountCents: 5500, cadence: 'monthly' }, // Spends ~$48 (13% under)
    { category: 'Shopping', amountCents: 8500, cadence: 'monthly' }, // Spends ~$74 (13% under)
    { category: 'Health & Fitness', amountCents: 10000, cadence: 'monthly' }, // Spends ~$90 (10% under)
    { category: 'Subscriptions', amountCents: 5800, cadence: 'monthly' },
    { category: 'Personal Care', amountCents: 6500, cadence: 'monthly' }, // Spends ~$56 (14% under)
  ],

  savingsGoals: [
    {
      name: 'Emergency Fund',
      targetAmountCents: 1500000, // $15,000
      isEmergencyFund: true,
      startingBalanceCents: 1100000, // Started with $11k - almost there!
      monthlyContributionCents: 30000, // $300/month
      annualInterestRate: 5.0, // ING Savings Maximiser rate
      deadline: { monthsFromNow: 8 }, // Soft deadline to finish building
    },
    {
      name: 'Japan Holiday',
      targetAmountCents: 600000, // $6,000
      deadline: { monthsFromNow: 8 }, // October trip
      startingBalanceCents: 350000, // $3,500 saved already
      monthlyContributionCents: 50000, // $500/month - will hit ~$7,500, well ahead!
      annualInterestRate: 4.5,
    },
    {
      name: 'House Deposit',
      targetAmountCents: 10000000, // $100,000
      deadline: { monthsFromNow: 36 }, // 3 year goal
      startingBalanceCents: 1200000, // $12k saved
      monthlyContributionCents: 25000, // $250/month - will need to increase
      annualInterestRate: 5.0,
    },
    {
      name: 'New Laptop',
      targetAmountCents: 350000, // $3,500 MacBook Pro
      deadline: { monthsFromNow: 4 }, // Need it soon
      startingBalanceCents: 200000, // $2k saved
      monthlyContributionCents: 40000, // $400/month - will be $200 short, slightly late
    },
  ],

  scenarios: [
    {
      name: 'Current Plan',
      description:
        'Balanced lifestyle with steady savings. Building emergency fund, saving for Japan trip. Nice dinners occasionally, staying mostly on budget.',
      isDefault: true,
    },
    {
      name: 'Save for House Deposit',
      description:
        'Time to get serious about property. Cancel Japan trip, cut dining out, redirect savings to house deposit.',
      isDefault: false,
      budgetOverrides: [
        { category: 'Groceries', amountCents: 50000 },
        { category: 'Dining Out', amountCents: 12000 },
        { category: 'Entertainment', amountCents: 3000 },
        { category: 'Shopping', amountCents: 4000 },
        { category: 'Subscriptions', amountCents: 4000 },
        { category: 'Personal Care', amountCents: 4000 },
      ],
      savingsOverrides: [
        { goalName: 'Japan Holiday', monthlyContributionCents: 0 },
        { goalName: 'House Deposit', monthlyContributionCents: 100000 },
        { goalName: 'Emergency Fund', monthlyContributionCents: 20000 },
        { goalName: 'New Laptop', monthlyContributionCents: 0 },
      ],
    },
    {
      name: 'Made Redundant',
      description:
        'Marketing layoffs hit. No income, need to cut everything non-essential and pause all savings.',
      isDefault: false,
      incomeMultiplier: 0,
      budgetOverrides: [
        { category: 'Groceries', amountCents: 30000 },
        { category: 'Transport', amountCents: 8000 },
        { category: 'Dining Out', amountCents: 4000 },
        { category: 'Entertainment', amountCents: 2000 },
        { category: 'Shopping', amountCents: 2000 },
        { category: 'Health & Fitness', amountCents: 4000 },
        { category: 'Subscriptions', amountCents: 3000 },
        { category: 'Personal Care', amountCents: 2000 },
      ],
      savingsOverrides: [
        { goalName: 'Japan Holiday', monthlyContributionCents: 0 },
        { goalName: 'Emergency Fund', monthlyContributionCents: 0 },
        { goalName: 'House Deposit', monthlyContributionCents: 0 },
        { goalName: 'New Laptop', monthlyContributionCents: 0 },
      ],
    },
  ],
};
