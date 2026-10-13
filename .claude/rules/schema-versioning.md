---
paths:
  - "src/lib/db.ts"
  - "src/lib/types.ts"
  - "src/lib/import-schema.ts"
---

# Schema versioning

A field added to `types.ts` and missed in `import-schema.ts` is silently
stripped on every restore and every sync pull, because Zod drops keys a schema
does not list.

The app uses Dexie (IndexedDB) with versioned schema migrations. Two version
numbers live in `src/lib/db.ts`:

- `CURRENT_SCHEMA_VERSION`: the IndexedDB schema
- `CURRENT_DATA_VERSION`: the export and import format

## Adding a field

- **Not indexed** (most cases). Add it to `types.ts` and, as optional, to
  `import-schema.ts`. No schema version bump: Dexie stores whole objects.
- **Indexed.** Also bump `CURRENT_SCHEMA_VERSION` and add a `this.version(N)`
  block in `db.ts`.
- **A breaking change to an existing field.** Add an `.upgrade()` function to
  the new version block.

```typescript
// In db.ts constructor
this.version(2).stores({
  // Only specify tables/indexes that changed
  forecastRules: 'id, scenarioId, newIndexedField',
}).upgrade(tx => {
  return tx.table('forecastRules').toCollection().modify(rule => {
    rule.newField = rule.newField ?? 'default';
  });
});
```

## Import compatibility

- Add migration logic in `migrateImportData()` if the format changes.
- Bump `CURRENT_DATA_VERSION` if the export format changes.
