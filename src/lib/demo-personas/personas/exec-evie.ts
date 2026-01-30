import type { PersonaConfig } from '../types';

export const execEvie: PersonaConfig = {
  id: 'exec-evie',
  name: 'Exec Evie',
  tagline: 'Senior director, high earner with lifestyle inflation',
  description:
    'Evie earns well but enjoys the lifestyle. Full emergency fund, investing in property, but occasionally overspends on dining and shopping.',

  categories: [
    'Mortgage',
    'Groceries',
    'Transport',
    'Utilities',
    'Dining Out',
    'Entertainment',
    'Shopping',
    'Health & Wellness',
    'Travel',
    'Subscriptions',
    'Personal Care',
  ],

  income: {
    primary: {
      description: 'Pay - Deloitte',
      amountCents: 1150000, // $11,500/month after tax
      cadence: 'monthly',
      variance: 0,
    },
    extras: [
      {
        description: 'Annual Bonus - Deloitte',
        amountCents: 2000000, // $20,000
        frequency: 'yearly',
        months: [12],
      },
    ],
  },

  expenses: [
    {
      category: 'Mortgage',
      patterns: [
        {
          description: 'Mortgage - CBA',
          amountCents: 320000, // $3,200/month
          frequency: 'monthly',
          dayOfMonth: 15,
          variance: 0,
        },
      ],
    },
    {
      category: 'Groceries',
      patterns: [
        {
          description: 'Harris Farm Delivery',
          amountCents: 18000, // Premium groceries
          frequency: 'weekly',
          variance: 0.15,
        },
        {
          description: ['Whole Foods', 'About Life'],
          amountCents: 8000,
          frequency: 'weekly',
          probability: 0.35,
          variance: 0.2,
        },
      ],
    },
    {
      category: 'Transport',
      patterns: [
        {
          description: ['Uber Premier', 'Uber Comfort'],
          amountCents: 4500,
          frequency: 'daily',
          probability: 0.35,
          variance: 0.25,
        },
        {
          description: 'Secure Parking Monthly',
          amountCents: 45000,
          frequency: 'monthly',
          dayOfMonth: 1,
        },
        {
          description: 'Ampol Fuel',
          amountCents: 12000,
          frequency: 'fortnightly',
          variance: 0.15,
        },
      ],
    },
    {
      category: 'Utilities',
      patterns: [
        {
          description: 'AGL Energy',
          amountCents: 18000,
          frequency: 'monthly',
          dayOfMonth: 20,
          variance: 0.1,
        },
        {
          description: 'Telstra Bundle',
          amountCents: 15000,
          frequency: 'monthly',
          dayOfMonth: 12,
        },
      ],
    },
    {
      category: 'Dining Out',
      patterns: [
        {
          description: ['Quay', 'Aria', 'Bennelong'],
          amountCents: 30000, // High-end dinner
          frequency: 'monthly',
          probability: 0.4,
          variance: 0.2,
        },
        {
          description: ['Mr Wong', 'Chin Chin', 'Sake'],
          amountCents: 15000,
          frequency: 'weekly',
          probability: 0.35,
          variance: 0.2,
        },
        {
          description: 'Client Lunch',
          amountCents: 12000,
          frequency: 'weekly',
          probability: 0.4,
          variance: 0.25,
        },
        {
          description: ['Edition Coffee', 'Single O'],
          amountCents: 650,
          frequency: 'daily',
          probability: 0.7,
        },
        {
          description: ['Uber Eats', 'DoorDash'],
          amountCents: 4500,
          frequency: 'weekly',
          probability: 0.5,
          variance: 0.2,
        },
      ],
    },
    {
      category: 'Entertainment',
      patterns: [
        {
          description: 'Sydney Opera House',
          amountCents: 20000,
          frequency: 'monthly',
          probability: 0.3,
          variance: 0.25,
        },
        {
          description: ['Palace Cinemas Gold', 'Event Gold Class'],
          amountCents: 7000,
          frequency: 'monthly',
          probability: 0.4,
          variance: 0.15,
        },
        {
          description: ['Ivy Pool Club', 'Merivale'],
          amountCents: 12000,
          frequency: 'monthly',
          probability: 0.35,
          variance: 0.3,
        },
      ],
    },
    {
      category: 'Shopping',
      patterns: [
        {
          description: ['David Jones', 'Myer'],
          amountCents: 30000,
          frequency: 'monthly',
          probability: 0.4,
          variance: 0.35,
        },
        {
          description: ['Country Road', 'Scanlan Theodore'],
          amountCents: 25000,
          frequency: 'monthly',
          probability: 0.35,
          variance: 0.25,
        },
        {
          description: ['Net-a-Porter', 'Farfetch'],
          amountCents: 40000,
          frequency: 'monthly',
          probability: 0.2,
          variance: 0.35,
        },
      ],
    },
    {
      category: 'Health & Wellness',
      patterns: [
        {
          description: 'Equinox Membership',
          amountCents: 25000,
          frequency: 'monthly',
          dayOfMonth: 1,
        },
        {
          description: 'Personal Trainer',
          amountCents: 12000,
          frequency: 'weekly',
          probability: 0.5,
        },
        {
          description: ['Endota Spa', 'Glow Day Spa'],
          amountCents: 28000,
          frequency: 'monthly',
          probability: 0.3,
          variance: 0.2,
        },
        {
          description: 'Priceline Pharmacy',
          amountCents: 6000,
          frequency: 'monthly',
          probability: 0.5,
          variance: 0.25,
        },
      ],
    },
    {
      category: 'Travel',
      patterns: [
        {
          description: 'Qantas Club',
          amountCents: 5000, // Amortised monthly cost
          frequency: 'monthly',
          dayOfMonth: 8,
        },
        {
          description: 'Qantas Domestic',
          amountCents: 35000,
          frequency: 'monthly',
          probability: 0.35,
          variance: 0.25,
        },
        {
          description: ['Park Hyatt', 'Crown Towers'],
          amountCents: 60000,
          frequency: 'monthly',
          probability: 0.15,
          variance: 0.25,
        },
      ],
    },
    {
      category: 'Subscriptions',
      patterns: [
        {
          description: 'Netflix Premium',
          amountCents: 2499,
          frequency: 'monthly',
          dayOfMonth: 5,
        },
        {
          description: 'Stan Premium',
          amountCents: 2100,
          frequency: 'monthly',
          dayOfMonth: 10,
        },
        {
          description: 'Apple One Premier',
          amountCents: 4495,
          frequency: 'monthly',
          dayOfMonth: 12,
        },
        {
          description: 'AFR Digital',
          amountCents: 6999,
          frequency: 'monthly',
          dayOfMonth: 1,
        },
        {
          description: 'LinkedIn Premium',
          amountCents: 3999,
          frequency: 'monthly',
          dayOfMonth: 18,
        },
      ],
    },
    {
      category: 'Personal Care',
      patterns: [
        {
          description: ['Mecca Cosmetica', 'Sephora'],
          amountCents: 18000,
          frequency: 'monthly',
          probability: 0.45,
          variance: 0.3,
        },
        {
          description: 'Hair - Edwards & Co',
          amountCents: 28000,
          frequency: 'monthly',
          probability: 0.6,
        },
      ],
    },
  ],

  // Evie has lifestyle inflation - splurges on dining and shopping
  // Expected: Groceries ~$900, Transport ~$1183, Dining ~$789, Entertainment ~$130, Shopping ~$288, Health ~$624, Travel ~$263, Personal ~$249
  budgets: [
    { category: 'Mortgage', amountCents: 320000, cadence: 'monthly' },
    { category: 'Groceries', amountCents: 95000, cadence: 'monthly' }, // Spends ~$900 (5% under)
    { category: 'Transport', amountCents: 125000, cadence: 'monthly' }, // Spends ~$1183 (5% under)
    { category: 'Utilities', amountCents: 35000, cadence: 'monthly' },
    { category: 'Dining Out', amountCents: 65000, cadence: 'monthly' }, // Spends ~$789 (21% OVER - her splurge)
    { category: 'Entertainment', amountCents: 15000, cadence: 'monthly' }, // Spends ~$130 (13% under)
    { category: 'Shopping', amountCents: 25000, cadence: 'monthly' }, // Spends ~$288 (15% OVER - occasional overspend)
    { category: 'Health & Wellness', amountCents: 65000, cadence: 'monthly' }, // Spends ~$624 (4% under)
    { category: 'Travel', amountCents: 28000, cadence: 'monthly' }, // Spends ~$263 (6% under)
    { category: 'Subscriptions', amountCents: 20100, cadence: 'monthly' },
    { category: 'Personal Care', amountCents: 28000, cadence: 'monthly' }, // Spends ~$249 (11% under)
  ],

  savingsGoals: [
    {
      name: 'Emergency Fund',
      targetAmountCents: 3000000, // $30,000 (fully funded)
      isEmergencyFund: true,
      startingBalanceCents: 3000000, // Already full
      monthlyContributionCents: 0,
      annualInterestRate: 5.0,
    },
    {
      name: 'Investment Property',
      targetAmountCents: 15000000, // $150,000 deposit
      startingBalanceCents: 4000000, // $40k saved
      monthlyContributionCents: 80000, // $800/month
      annualInterestRate: 4.5,
    },
    {
      name: 'New Car Fund',
      targetAmountCents: 8000000, // $80,000 (luxury car)
      deadline: { monthsFromNow: 18 },
      startingBalanceCents: 2000000, // $20k saved
      monthlyContributionCents: 40000, // $400/month
    },
  ],

  scenarios: [
    {
      name: 'Current Lifestyle',
      description:
        'Living the executive life. Nice restaurants, Equinox, quality shopping. Emergency fund is full, investing in property, saving for a Porsche.',
      isDefault: true,
    },
    {
      name: 'Tighten Up',
      description:
        'Time to be more intentional. Skip the fancy dinners, cook at home twice a week. Cancel personal trainer, use Equinox classes instead. Extra savings go to property deposit.',
      isDefault: false,
      budgetOverrides: [
        { category: 'Groceries', amountCents: 70000 },
        { category: 'Dining Out', amountCents: 40000 },
        { category: 'Entertainment', amountCents: 8000 },
        { category: 'Shopping', amountCents: 15000 },
        { category: 'Health & Wellness', amountCents: 30000 },
        { category: 'Travel', amountCents: 12000 },
        { category: 'Personal Care', amountCents: 15000 },
      ],
      savingsOverrides: [
        { goalName: 'Investment Property', monthlyContributionCents: 150000 },
        { goalName: 'New Car Fund', monthlyContributionCents: 30000 },
      ],
    },
    {
      name: 'No Bonus This Year',
      description:
        'Company restructure means no $20k bonus this December. Keep lifestyle similar but reduce savings targets to compensate.',
      isDefault: false,
      excludeExtras: true, // This removes the $20k bonus from income forecasts
      savingsOverrides: [
        { goalName: 'Investment Property', monthlyContributionCents: 60000 },
        { goalName: 'New Car Fund', monthlyContributionCents: 30000 },
      ],
    },
  ],
};
