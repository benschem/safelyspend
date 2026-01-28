import { useMemo, useCallback } from 'react';
import { CreatableSelect } from './creatable-select';
import { useSavingsGoals } from '@/hooks/use-savings-goals';

interface SavingsGoalSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function SavingsGoalSelect({
  value,
  onChange,
  disabled = false,
}: SavingsGoalSelectProps) {
  const { savingsGoals, addSavingsGoal } = useSavingsGoals();

  const options = useMemo(
    () =>
      savingsGoals
        .map((goal) => ({
          value: goal.id,
          label: goal.name,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [savingsGoals],
  );

  const handleCreateNew = useCallback(
    async (name: string) => {
      // Create a basic savings goal - user can edit details later
      const newGoal = await addSavingsGoal({
        name,
        targetAmountCents: 0,
      });
      return newGoal.id;
    },
    [addSavingsGoal],
  );

  return (
    <CreatableSelect
      options={options}
      value={value}
      onChange={onChange}
      onCreateNew={handleCreateNew}
      placeholder="Select savings goal"
      createLabel="Create goal"
      disabled={disabled}
    />
  );
}
