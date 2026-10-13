# Conventions

## Money

Amounts are stored as integer cents, which avoids floating-point error.

```typescript
const amountCents = 1234; // $12.34
```

- `formatCents(cents)`: dollars with a $ sign, for example `$12`
- `formatCentsShort(cents)`: short form with a k or M suffix, for example `$1.5k`
- `formatMoney(cents, currency)`: a specific currency
- `parseCents(dollarString)`: a dollar string to cents, with validation

Use `parseCentsFromInput()` for what a person typed and `parseCents()` from
the schemas for validated form data.

## Dates

Dates are ISO 8601 strings.

```typescript
const date = '2025-07-01'; // a date
const timestamp = '2025-07-01T10:30:00.000Z'; // a timestamp
```

Use `today()` from utils to get the current date in this format. As of 0.47.1 it returns the UTC date, which is yesterday for part of the morning in Australia; `docs/work/dates.md` is the fix.

Never parse a date with `new Date('YYYY-MM-DD')`: that reads the string as UTC midnight and is a day out in local time. `src/lib/cadence.ts` has a local-time parser.

## Logging

Use the `debug` utility, not `console.*`.

```typescript
import { debug } from '@/lib/debug';

// Categories: 'db' | 'import' | 'storage' | 'ui' | 'security'
debug.error('db', 'Operation failed', { error });
debug.info('import', 'Processing file', { filename });
debug.warn('security', 'Suspicious input detected');
```

Turn debug mode on in any of three ways:

- Settings > Developer > Debug Mode
- the URL parameter `?debug=1`
- `window.__budgetDebug.setEnabled(true)` in the console

## Components

`src/components/ui/` holds shadcn components, which are ours to edit.
Re-adding one with the CLI overwrites local changes.

### Editing in dialogs

Every entity is edited in a dialog, opened like this:

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

### Errors in mutations

Wrap every database mutation in try/catch:

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

### Icon buttons

An icon-only button takes `aria-label`, not `title`:

```typescript
<Button aria-label="Edit transaction">
  <Pencil className="h-4 w-4" />
</Button>
```

## Forms

### Validation

Validate forms with Zod schemas:

```typescript
import { z } from 'zod';
import { moneyInputSchema } from '@/lib/schemas';

const formSchema = z.object({
  amount: moneyInputSchema,
  description: z.string().min(1, 'Required'),
});
```

### Form actions

Use React 19 form actions for new forms. `useActionState` replaces the
hand-written loading flag and `preventDefault`, and `useFormStatus` allows one
shared submit button in place of a spinner block copied into each form.

Convert old forms when they are next rewritten, starting with `login.tsx` when
its state is reworked. Not worth a sweep on its own.

- A form action resets uncontrolled fields when it finishes, even on a returned
  error. Keep inputs controlled, or a failed submit wipes what was typed.
- An error thrown in an action reaches the error boundary. Return failures as
  state instead.
- Buttons outside a form need `useTransition`; `useActionState` does not cover
  them.

## State

- UI preferences go through the `useLocalStorage` hook, with a `budget:` key.
- Everything else goes through Dexie, read with `useLiveQuery`. `CLAUDE.md`
  shows the pattern an entity hook follows.

## Import and export

Every export carries a version number, `CURRENT_DATA_VERSION` in `db.ts`.

Every import is validated before anything is written:

```typescript
import { validateImport } from '@/lib/import-schema';

const validatedData = validateImport(rawData);
```

## TypeScript

Strict mode, with these on as well:

- `noUncheckedIndexedAccess`: array access needs a null check
- `exactOptionalPropertyTypes`: optional properties must be explicit
- `noImplicitReturns`: every code path returns
- `noPropertyAccessFromIndexSignature`: bracket notation for index access

Prefer a type guard to an assertion:

```typescript
// Good
if (result.success) {
  return result.data;
}

// Avoid when possible
return result as SomeType;
```

## Where things go, and tests

The directory layout is in `CLAUDE.md` under "Key Directories". Test commands
and where tests live are in [DEVELOPMENT.md](DEVELOPMENT.md).
