# Conventions

This document describes the coding conventions and patterns used in this codebase.

## Money Handling

All monetary amounts are stored as **integer cents** to avoid floating-point precision issues.

```typescript
// Good: Store as cents
const amountCents = 1234; // $12.34

// Bad: Store as dollars
const amountDollars = 12.34; // Precision issues
```

### Formatting Functions

- `formatCents(cents)` - Format cents as dollars with $ sign (e.g., `$12`)
- `formatCentsShort(cents)` - Short format with k/M suffix (e.g., `$1.5k`)
- `formatMoney(cents, currency)` - Format with specific currency
- `parseCents(dollarString)` - Parse dollar string to cents with validation

### Input Parsing

Use `parseCentsFromInput()` for user input and `parseCents()` from schemas for validated form data.

## Dates

All dates are stored as **ISO 8601 strings**.

```typescript
// Dates: YYYY-MM-DD
const date = '2025-07-01';

// Timestamps: Full ISO with time
const timestamp = '2025-07-01T10:30:00.000Z';
```

Use `today()` from utils to get current date in correct format.

## Logging

Use the `debug` utility instead of raw `console.*` calls.

```typescript
import { debug } from '@/lib/debug';

// Categories: 'db' | 'import' | 'storage' | 'ui' | 'security'
debug.error('db', 'Operation failed', { error });
debug.info('import', 'Processing file', { filename });
debug.warn('security', 'Suspicious input detected');
```

Enable debug mode via:
- Settings > Developer > Debug Mode toggle
- URL parameter: `?debug=1`
- Console: `window.__budgetDebug.setEnabled(true)`

## Component Patterns

### Dialog-based Editing

All entity editing uses dialogs with this pattern:

```typescript
const [dialogOpen, setDialogOpen] = useState(false);
const [editingId, setEditingId] = useState<string | null>(null);

// Open for new
const handleAdd = () => {
  setEditingId(null);
  setDialogOpen(true);
};

// Open for edit
const handleEdit = (id: string) => {
  setEditingId(id);
  setDialogOpen(true);
};
```

### Error Handling in Mutations

Wrap all database mutations in try/catch:

```typescript
const handleSave = async () => {
  try {
    await saveEntity(data);
    setDialogOpen(false);
  } catch (error) {
    debug.error('db', 'Save failed', error);
    setError('Save failed. Please try again.');
  }
};
```

### Icon Buttons

Use `aria-label` instead of `title` for icon-only buttons:

```typescript
// Good
<Button aria-label="Edit transaction">
  <Pencil className="h-4 w-4" />
</Button>

// Bad
<Button title="Edit transaction">
  <Pencil className="h-4 w-4" />
</Button>
```

## Form Validation

Use Zod schemas for form validation:

```typescript
import { z } from 'zod';
import { moneyInputSchema } from '@/lib/schemas';

const formSchema = z.object({
  amount: moneyInputSchema,
  description: z.string().min(1, 'Required'),
});
```

## State Management

### Local Storage (Preferences)

Use `useLocalStorage` hook for UI preferences only:

```typescript
const [viewState, setViewState] = useLocalStorage('budget:viewState', defaultState);
```

### IndexedDB (Data)

Use Dexie hooks for all persistent data:

```typescript
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

const transactions = useLiveQuery(() => db.transactions.toArray());
```

## Import/Export

### Data Versioning

All exports include a version number. The current version is defined in `db.ts`:

```typescript
import { CURRENT_DATA_VERSION } from '@/lib/db';
```

### Schema Validation

All imports are validated against Zod schemas before processing:

```typescript
import { validateImport } from '@/lib/import-schema';

const validatedData = validateImport(rawData);
```

## TypeScript

### Strict Mode

The project uses strict TypeScript settings including:
- `noUncheckedIndexedAccess` - Array access requires null checks
- `exactOptionalPropertyTypes` - Optional properties must be explicit
- `noImplicitReturns` - All code paths must return
- `noPropertyAccessFromIndexSignature` - Use bracket notation for index access

### Type Assertions

Prefer type guards over assertions:

```typescript
// Good
if (result.success) {
  return result.data;
}

// Avoid when possible
return result as SomeType;
```

## File Organization

```
src/
├── components/
│   ├── ui/           # shadcn components (don't modify)
│   ├── dialogs/      # Entity editing dialogs
│   ├── charts/       # Recharts visualizations
│   └── layout/       # Header, Sidebar, etc.
├── hooks/            # Custom React hooks
├── lib/              # Utilities, types, schemas
├── routes/           # Page components (React Router)
└── __tests__/        # Test files mirror src/ structure
```

## Testing

Tests use Vitest with React Testing Library:

```typescript
import { describe, it, expect } from 'vitest';

describe('functionName', () => {
  it('does something specific', () => {
    expect(result).toBe(expected);
  });
});
```

Run tests:
- `npm test` - Watch mode
- `npm run test:run` - Single run
