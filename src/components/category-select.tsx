import { useMemo, useCallback } from 'react';
import { CreatableSelect } from './creatable-select';
import { useCategories } from '@/hooks/use-categories';

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  allowNone?: boolean;
  disabled?: boolean;
}

export function CategorySelect({
  value,
  onChange,
  allowNone = false,
  disabled = false,
}: CategorySelectProps) {
  const { categories, getOrCreate } = useCategories();

  // Archived categories are not offered, except the one already selected:
  // without it the select has no name to show and falls back to the raw id.
  const options = useMemo(
    () =>
      categories
        .filter((cat) => !cat.isArchived || cat.id === value)
        .map((cat) => ({
          value: cat.id,
          label: cat.name,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [categories, value],
  );

  const handleCreateNew = useCallback(
    async (name: string) => {
      // Reuses a category of the same name instead of making a duplicate. Only
      // null for a blank name, which the select never passes.
      const categoryId = await getOrCreate(name);
      return categoryId ?? '';
    },
    [getOrCreate],
  );

  return (
    <CreatableSelect
      options={options}
      value={value}
      onChange={onChange}
      onCreateNew={handleCreateNew}
      placeholder="Select category"
      allowNone={allowNone}
      noneLabel="Uncategorised"
      createLabel="Create category"
      disabled={disabled}
    />
  );
}
