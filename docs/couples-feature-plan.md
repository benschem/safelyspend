# Couples Feature Plan

> Design doc for shared household budgeting. Saved for future implementation.

## Overview

Two people share a household budget with pooled income. Each person has their own login and their own personal "spending money" allowance carved from the shared budget. Personal spending has sub-budgets visible only to that person, though the total spent is visible to their partner.

## User Experience

### How it works

1. **Ben creates a household budget** (the current app, as it works today)
2. **Ben invites Sarah** via email from Settings
3. **Sarah signs up, clicks the invite link**, and joins the household
4. **Both see the shared dashboard by default** — total income, shared expenses, and each person's spending money as a line item
5. **Each person can tap into their own spending money** to see/edit their personal sub-budgets and transactions
6. **Both can edit shared categories, log shared transactions, and modify shared budget rules** (equal access, trust-based)

### Default view: Shared dashboard

The main dashboard shows the household view:
- Total pooled income
- Shared expense categories and spending
- "Ben's spending money: $X of $Y" and "Sarah's spending money: $X of $Y" as summary line items
- Savings goals (shared)

### Personal spending money

Each person gets an allowance from the shared budget (e.g. $200/month). Within that allowance, they can:
- Create personal categories (e.g. coffee, games, clothes)
- Set personal sub-budgets against those categories
- Log personal transactions
- Their partner sees the total spent ("Ben has spent $120 of $200") but NOT the breakdown

### Privacy model

| Data | Ben sees | Sarah sees |
|------|----------|------------|
| Shared income | Yes | Yes |
| Shared expenses & categories | Yes | Yes |
| Shared budget rules | Yes | Yes |
| Shared transactions | Yes | Yes |
| Ben's spending money total | Yes | Yes |
| Ben's personal categories | Yes | No |
| Ben's personal transactions | Yes | No |
| Ben's personal sub-budgets | Yes | No |
| Sarah's spending money total | Yes | Yes |
| Sarah's personal categories | No | Yes |
| Sarah's personal transactions | No | Yes |

### Scenarios

Scenarios remain shared — both people see and can edit them. Personal spending money doesn't have its own scenarios (the allowance amount is set in the shared budget).

## Data Model Changes

### New: Household entity

```typescript
interface Household {
  id: string;
  name: string;          // e.g. "Ben & Sarah"
  createdAt: string;
  updatedAt: string;
}
```

### New: Membership

```typescript
interface HouseholdMember {
  id: string;
  householdId: string;
  userId: string;
  role: 'owner' | 'member';  // for future use, both equal for now
  spendingAllowanceCents: number;
  cadence: Cadence;           // weekly, fortnightly, monthly, etc.
  joinedAt: string;
}
```

### New: Invite

```typescript
interface HouseholdInvite {
  id: string;
  householdId: string;
  invitedByUserId: string;
  invitedEmail: string;
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: string;
  createdAt: string;
}
```

### Modified: Existing entities gain a scope

Existing entities need to distinguish between shared (household) and personal:

```typescript
// Option A: Add scope field to entities
interface Transaction {
  // ... existing fields
  scope: 'household' | 'personal';  // NEW
  // When 'household': visible to all members
  // When 'personal': visible only to the owning userId
}

// Same for Category, BudgetRule, ForecastRule
```

The `userId` field (currently hardcoded as `'local'`) becomes the real user ID from auth. Shared data uses `scope: 'household'`, personal data uses `scope: 'personal'`.

### Spending money as a budget concept

The spending money allowance per member is defined in `HouseholdMember.spendingAllowanceCents`. This acts like a special budget rule — it deducts from the shared budget and creates a personal budget pool.

On the shared dashboard, each member's spending money shows as:
- Budget line item: "Ben's spending money — $200/month"
- Actual: sum of all Ben's `scope: 'personal'` transactions

## Sync Architecture

### Current state

One encrypted vault blob per user. The entire `BudgetData` export is encrypted and stored in R2.

### Challenge

With shared data, two people are writing to the same logical dataset. Options:

### Option A: Shared vault (recommended for v1)

- One vault per **household** (not per user)
- Both users sync to the same vault
- Personal data is included in the vault but **filtered in the UI** (not encrypted separately)
- Conflict resolution: last-write-wins with version checks (already built)
- Trust model: both partners can technically see all data in the encrypted blob — privacy is enforced in the UI, not cryptographically

**Tradeoffs:**
- Simple to implement — minimal sync changes
- Privacy is UI-enforced, not crypto-enforced (fine for a trusting couple)
- Conflict risk is low (two people, infrequent writes)

### Option B: Separate vaults with shared sync

- Household vault for shared data
- Personal vault per user for personal data
- Three sync streams: shared + Ben's personal + Sarah's personal

**Tradeoffs:**
- Cryptographic privacy (personal data in a separate blob)
- Much more complex sync logic
- Overkill for a trusting couple

### Recommendation

**Go with Option A** (shared vault). The app is for couples who trust each other — UI-level privacy is sufficient. If someone really wants to snoop, they could look at IndexedDB anyway. Keep it simple.

## Implementation Phases

### Phase 1: Multi-user auth (prerequisite)

- Replace hardcoded `userId: 'local'` with real user ID from auth
- Thread userId through all hooks
- Add userId indexes to Dexie tables
- Filter all queries by userId
- Existing single-user experience unchanged

### Phase 2: Households

- Create Household and HouseholdMember tables (D1 + Dexie)
- Add invite flow (backend endpoint + email)
- First user auto-creates a household on sign-up
- Switch vault from per-user to per-household
- Both members sync to the same vault

### Phase 3: Shared vs personal scope

- Add `scope` field to entities (categories, transactions, budget rules, forecast rules)
- Default scope is `household` (backwards compatible)
- Personal scope entities filtered to owning user in UI
- Spending money allowance in HouseholdMember

### Phase 4: Personal spending money UI

- Personal dashboard view (toggle from shared)
- Personal category management
- Personal sub-budgets within allowance
- "Spent $X of $Y" summary visible to partner on shared dashboard
- Personal transactions hidden from partner

## Migration Path

For existing single-user data:
1. All existing entities get `scope: 'household'`
2. Existing user becomes owner of an auto-created household
3. Vault continues working — just associated with household instead of user
4. No data loss, backwards compatible

## Open Questions

- **Notifications:** Should Sarah get a notification when Ben logs a shared transaction? (Probably not for v1)
- **Leaving:** What happens if someone leaves the household? (Keep it simple: delete membership, personal data stays with them, shared data stays with household)
- **Multiple households:** Support it? (Probably not — one household per user for v1)
- **Spending money visibility toggle:** Could make the "total visible" behaviour configurable per person, but adds complexity. Start with always-visible totals.
