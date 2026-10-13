import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BudgetStep } from '@/components/first-run-wizard';

const GROCERIES_ENTRY = { tempId: 'entry-1', categoryName: 'Groceries', amount: '200' };

/** Render the step with the given entries and open its "New allowance" form */
function renderBudgetStepWithFormOpen(budgetEntries: (typeof GROCERIES_ENTRY)[]) {
  const onAddEntry = vi.fn();
  render(
    <BudgetStep
      budgetEntries={budgetEntries}
      onAddEntry={onAddEntry}
      onRemoveEntry={vi.fn()}
      onNext={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add a category' }));
  return { onAddEntry };
}

function enterAllowance(categoryName: string, amount: string) {
  fireEvent.change(screen.getByLabelText('Category name'), { target: { value: categoryName } });
  fireEvent.change(screen.getByLabelText('Monthly allowance ($)'), { target: { value: amount } });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
}

describe('BudgetStep', () => {
  it('adds an allowance for a category not yet entered', () => {
    const { onAddEntry } = renderBudgetStepWithFormOpen([GROCERIES_ENTRY]);

    enterAllowance('Transport', '80');

    expect(onAddEntry).toHaveBeenCalledTimes(1);
    expect(onAddEntry.mock.calls[0]?.[0]).toMatchObject({
      categoryName: 'Transport',
      amount: '80',
    });
  });

  it('refuses a second allowance for a category already entered', () => {
    const { onAddEntry } = renderBudgetStepWithFormOpen([GROCERIES_ENTRY]);

    enterAllowance('Groceries', '50');

    expect(onAddEntry).not.toHaveBeenCalled();
    expect(screen.getByText('You have already added an allowance for this category')).toBeTruthy();
  });

  it('treats a name that differs only in case or spacing as the same category', () => {
    const { onAddEntry } = renderBudgetStepWithFormOpen([GROCERIES_ENTRY]);

    enterAllowance('  groceries ', '50');

    expect(onAddEntry).not.toHaveBeenCalled();
  });
});
