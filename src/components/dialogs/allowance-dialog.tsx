import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { CategorySelect } from '@/components/category-select';
import { parseCentsFromInput, formatCents } from '@/lib/utils';
import { isAllowanceNameTaken } from '@/lib/allowances';
import { describeAverageSpending, type SpendingAverages } from '@/lib/spending-averages';
import type { Cadence, Category, BudgetRule, CreateEntity } from '@/lib/types';
import type { BudgetRuleUpdates } from '@/hooks/use-budget-rules';
import { db } from '@/lib/db';

interface AllowanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenarioId: string | null;
  // The allowance to edit. Left out, the dialog adds a new one.
  allowance?: BudgetRule | null;
  // The category the allowance started on, which the archive and delete
  // buttons act on
  category?: Category | null;
  // Whether that category can be deleted (no transactions)
  canDeleteCategory?: boolean;
  // Budget context for overcommitment indicator
  unallocatedAmount?: number; // Current unallocated income in cents
  hasIncome?: boolean; // Whether there is any income set
  // Every allowance in the scenario, to keep names unique within a category
  existingAllowances: BudgetRule[];
  // What each category has cost on average, shown as a guide to the allowance
  spendingAverages?: SpendingAverages | null;
  // Callbacks
  updateCategory?: (
    id: string,
    updates: Partial<Omit<Category, 'id' | 'userId' | 'createdAt'>>,
  ) => Promise<void>;
  deleteCategory?: (id: string) => Promise<void>;
  addBudgetRule: (data: CreateEntity<BudgetRule>) => Promise<BudgetRule>;
  updateBudgetRule: (id: string, updates: BudgetRuleUpdates) => Promise<void>;
  deleteBudgetRule?: (id: string) => Promise<void>;
}

export function AllowanceDialog({
  open,
  onOpenChange,
  scenarioId,
  allowance,
  category,
  canDeleteCategory,
  unallocatedAmount,
  hasIncome,
  existingAllowances,
  spendingAverages,
  updateCategory,
  deleteCategory,
  addBudgetRule,
  updateBudgetRule,
  deleteBudgetRule,
}: AllowanceDialogProps) {
  const isEditing = !!allowance;

  // Form state
  // The picker creates a new category as soon as one is typed, so this is
  // always an existing id. In edit mode it starts on the allowance's own category.
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [formError, setFormError] = useState<string | null>(null);

  const enteredAmountCents = parseCentsFromInput(amount);

  useEffect(() => {
    if (open) {
      if (allowance) {
        // Edit mode - pre-fill with existing values
        setSelectedCategoryId(allowance.categoryId);
        setName(allowance.name ?? '');
        setAmount((allowance.amountCents / 100).toFixed(2));
        setCadence(allowance.cadence);
      } else {
        // Create mode - reset to defaults
        setSelectedCategoryId('');
        setName('');
        setAmount('');
        setCadence('monthly');
      }
      setFormError(null);
    }
  }, [open, allowance]);

  const handleSave = async () => {
    setFormError(null);

    if (!selectedCategoryId) {
      setFormError('Please choose a category');
      return;
    }

    // A blank name is stored as no name
    const trimmedName = name.trim();
    const allowanceName = trimmedName === '' ? undefined : trimmedName;

    try {
      const amountCents = enteredAmountCents;

      if (!isEditing && amountCents <= 0) {
        setFormError('Please enter an allowance');
        return;
      }

      if (amountCents === 0) {
        // Only reachable in edit mode: clearing the amount removes the allowance
        if (allowance && deleteBudgetRule) {
          await deleteBudgetRule(allowance.id);
        }
        onOpenChange(false);
        return;
      }

      if (isAllowanceNameTaken(existingAllowances, selectedCategoryId, allowanceName, allowance)) {
        setFormError(
          allowanceName
            ? `This category already has an allowance called "${allowanceName}"`
            : 'This category already has an allowance with no name. Give this one a name',
        );
        return;
      }

      if (allowance) {
        await updateBudgetRule(allowance.id, {
          categoryId: selectedCategoryId,
          name: allowanceName,
          amountCents,
          cadence,
        });
      } else if (scenarioId) {
        await addBudgetRule({
          scenarioId,
          categoryId: selectedCategoryId,
          amountCents,
          cadence,
          ...(allowanceName !== undefined && { name: allowanceName }),
        });
      }
      onOpenChange(false);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : `Failed to ${isEditing ? 'update' : 'add'} allowance. Please try again.`,
      );
    }
  };

  const averageSpendingHint = describeAverageSpending(
    spendingAverages,
    selectedCategoryId,
    cadence,
  );

  const handleArchiveToggle = async () => {
    if (category && updateCategory) {
      await updateCategory(category.id, { isArchived: !category.isArchived });
      onOpenChange(false);
    }
  };

  const handleDelete = useCallback(async () => {
    if (category && deleteCategory) {
      const capturedCategory = { ...category };
      await deleteCategory(category.id);
      onOpenChange(false);
      toast(`"${capturedCategory.name}" deleted`, {
        action: {
          label: 'Undo',
          onClick: () => {
            db.categories.put(capturedCategory);
          },
        },
        duration: 5000,
      });
    }
  }, [category, deleteCategory, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Allowance' : 'Add Allowance'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Change the category or the allowance.'
              : 'Pick a category, or type a new one, and set an allowance for it.'}
            {/* A span, not a p: the description already renders as a paragraph */}
            {!isEditing && (
              <span className="mt-1 block text-xs">
                A limit on day-to-day spending. If you know the amount and the date, add a bill.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-4"
        >
          {formError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          <div className="space-y-2">
            <Label className="select-none">Category</Label>
            <CategorySelect value={selectedCategoryId} onChange={setSelectedCategoryId} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="allowance-name" className="select-none">
              Name (optional)
            </Label>
            <Input
              id="allowance-name"
              placeholder="e.g. Lashes"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              A category can have several allowances, each with its own amount and frequency.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="allowance-amount" className="select-none">
                Allowance ($)
              </Label>
              <Input
                id="allowance-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="select-none">Frequency</Label>
              <Select value={cadence} onValueChange={(value) => setCadence(value as Cadence)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="fortnightly">Fortnightly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {averageSpendingHint && (
            <p className="text-xs text-muted-foreground">{averageSpendingHint}</p>
          )}

          {/* Budget impact indicator */}
          {hasIncome &&
            unallocatedAmount !== undefined &&
            (() => {
              const enteredAmount = enteredAmountCents;
              const existingAmount = allowance?.amountCents ?? 0;
              const netChange = enteredAmount - existingAmount;
              const newUnallocated = unallocatedAmount - netChange;

              if (enteredAmount === 0) return null;

              if (newUnallocated >= 0) {
                return (
                  <p className="text-xs text-green-600">
                    Room in budget: {formatCents(newUnallocated)} remaining
                  </p>
                );
              } else {
                return (
                  <p className="text-xs text-orange-600">
                    Overcommitting by {formatCents(Math.abs(newUnallocated))}
                  </p>
                );
              }
            })()}

          <div className="flex items-center justify-between gap-3 pt-2">
            {/* Left side: Archive/Delete buttons (edit mode only) */}
            <div className="flex gap-1">
              {isEditing && category && updateCategory && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleArchiveToggle}
                      >
                        {category.isArchived ? (
                          <ArchiveRestore className="h-4 w-4" />
                        ) : (
                          <Archive className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {category.isArchived ? 'Restore category' : 'Archive category'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {isEditing && canDeleteCategory && deleteCategory && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" onClick={handleDelete}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete category</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Right side: Cancel/Save buttons */}
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">{isEditing ? 'Save Changes' : 'Add Allowance'}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
