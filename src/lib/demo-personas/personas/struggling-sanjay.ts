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
      amountCents: 156000, // $1,560 fortnightly after tax (~$3,380/month) - lower base rate
      cadence: 'fortnightly',
      variance: 0.05,
    },
    extras: [
      {
        description: 'Overtime Pay',
        amountCents: 28000, // $280
        frequency: 'occasional',
        probability: 0.1, // Rarely gets overtime
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

  // Budgets reflect what Sanjay actually allocates (not aspirational - he knows his habits)
  // Income: ~$3,380/month. Total budgeted: ~$3,500/month = overcommitted by ~$120
  // This is realistic for someone living paycheck to paycheck
  budgets: [
    { category: 'Rent', amountCents: 140000, cadence: 'monthly' },
    { category: 'Groceries', amountCents: 38000, cadence: 'monthly' }, // $380 - realistic for his shopping habits
    { category: 'Transport', amountCents: 25000, cadence: 'monthly' }, // $250 - Opal + occasional Uber
    { category: 'Utilities', amountCents: 15000, cadence: 'monthly' }, // $150
    { category: 'Dining Out', amountCents: 35000, cadence: 'monthly' }, // $350 - delivery apps and takeaway
    { category: 'Entertainment', amountCents: 55000, cadence: 'monthly' }, // $550 - nights out and gambling
    { category: 'Shopping', amountCents: 30000, cadence: 'monthly' }, // $300 - impulse buys and alcohol
    { category: 'Subscriptions', amountCents: 6200, cadence: 'monthly' }, // $62
    { category: 'Health', amountCents: 3000, cadence: 'monthly' }, // $30
  ],

  savingsGoals: [
    {
      name: 'Emergency Buffer',
      targetAmountCents: 500000, // $5,000 starter emergency fund
      isEmergencyFund: true,
      startingBalanceCents: 0,
      monthlyContributionCents: 0, // Can't afford to save right now
    },
  ],

  scenarios: [
    {
      name: 'Current Reality',
      description:
        'Overcommitted by $120/month. No savings, credit card debt growing. Something has to change.',
      isDefault: true,
    },
    {
      name: 'Getting Serious',
      description:
        'Cut the gambling, cook at home, one night out per fortnight max. Finally building an emergency fund.',
      isDefault: false,
      budgetOverrides: [
        { category: 'Groceries', amountCents: 30000 }, // $300 - meal prep
        { category: 'Transport', amountCents: 20000 }, // $200 - no Ubers
        { category: 'Dining Out', amountCents: 12000 }, // $120 - rare treats only
        { category: 'Entertainment', amountCents: 15000 }, // $150 - one night out, no gambling
        { category: 'Shopping', amountCents: 8000 }, // $80 - essentials only
        { category: 'Subscriptions', amountCents: 3100 }, // $31 - Netflix + Spotify only
      ],
      savingsOverrides: [
        { goalName: 'Emergency Buffer', monthlyContributionCents: 20000 }, // $200/month finally
      ],
    },
    {
      name: 'Hours Slashed',
      description:
        'Warehouse cut shifts by 30%. Even cutting everything, still $400/month in the red. Crisis mode.',
      isDefault: false,
      incomeMultiplier: 0.7,
      budgetOverrides: [
        { category: 'Rent', amountCents: 140000 }, // Can't change this
        { category: 'Groceries', amountCents: 22000 }, // $220 - bare minimum
        { category: 'Transport', amountCents: 15000 }, // $150 - only for work
        { category: 'Utilities', amountCents: 12000 }, // $120 - conserving
        { category: 'Dining Out', amountCents: 0 }, // $0 - can't afford it
        { category: 'Entertainment', amountCents: 0 }, // $0 - staying home
        { category: 'Shopping', amountCents: 0 }, // $0 - nothing extra
        { category: 'Subscriptions', amountCents: 1300 }, // $13 - Spotify only
        { category: 'Health', amountCents: 2000 }, // $20
      ],
      savingsOverrides: [{ goalName: 'Emergency Buffer', monthlyContributionCents: 0 }],
    },
  ],
};
