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
  const { activeCategories, addCategory } = useCategories();

  const options = useMemo(
    () =>
      activeCategories.map((cat) => ({
        value: cat.id,
        label: cat.name,
      })),
    [activeCategories],
  );

  const handleCreateNew = useCallback(
    (name: string) => {
      const newCategory = addCategory({ name, isArchived: false });
      return newCategory.id;
    },
    [addCategory],
  );

  return (
    <CreatableSelect
      options={options}
      value={value}
      onChange={onChange}
      onCreateNew={handleCreateNew}
      placeholder="Select category"
      allowNone={allowNone}
      noneLabel="Uncategorized"
      createLabel="Create category"
      disabled={disabled}
    />
  );
}
