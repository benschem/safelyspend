import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { Archive, ArchiveRestore, Plus, Trash2, X } from 'lucide-react';
import { CategorySelect } from '@/components/category-select';
import { parseCentsFromInput, formatCents, generateId } from '@/lib/utils';
import { describeAverageSpending, type SpendingAverages } from '@/lib/spending-averages';
import type { AllowanceItem, Cadence, Category, BudgetRule } from '@/lib/types';
import { db } from '@/lib/db';

/** An allowance item as it is being typed: the amount is still text */
interface AllowanceItemDraft {
  id: string;
  name: string;
  amount: string;
}

interface CategoryBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenarioId: string | null;
  // For edit mode
  category?: Category | null;
  existingRule?: BudgetRule | null;
  // Focus the limit field when opening
  focusLimit?: boolean;
  // Whether this category can be deleted (no transactions)
  canDeleteCategory?: boolean;
  // Budget context for overcommitment indicator
  unallocatedAmount?: number; // Current unallocated income in cents
  hasIncome?: boolean; // Whether there is any income set
  // Categories that already have a budget, left out of the picker
  budgetedCategoryIds?: ReadonlySet<string>;
  // What each category has cost on average, shown as a guide to the allowance
  spendingAverages?: SpendingAverages | null;
  // Callbacks
  updateCategory?: (
    id: string,
    updates: Partial<Omit<Category, 'id' | 'userId' | 'createdAt'>>,
  ) => Promise<void>;
  deleteCategory?: (id: string) => Promise<void>;
  setBudgetForCategory: (
    categoryId: string,
    amountCents: number,
    cadence: Cadence,
    items?: AllowanceItem[],
  ) => Promise<void>;
  deleteBudgetRule?: (id: string) => Promise<void>;
}

export function CategoryBudgetDialog({
  open,
  onOpenChange,
  scenarioId,
  category,
  existingRule,
  focusLimit,
  canDeleteCategory,
  unallocatedAmount,
  hasIncome,
  budgetedCategoryIds,
  spendingAverages,
  updateCategory,
  deleteCategory,
  setBudgetForCategory,
  deleteBudgetRule,
}: CategoryBudgetDialogProps) {
  const isEditing = !!category;
  const limitInputRef = useRef<HTMLInputElement>(null);

  // Form state
  // The picker creates a new category as soon as one is typed, so this is
  // always an existing id. In edit mode it starts on the budget's own category.
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [cadence, setCadence] = useState<Cadence>('monthly');
  // The named parts of the allowance. With any, the allowance is their sum
  // and the amount field is read-only.
  const [itemDrafts, setItemDrafts] = useState<AllowanceItemDraft[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const isItemised = itemDrafts.length > 0;
  const itemisedTotalCents = itemDrafts.reduce(
    (sum, itemDraft) => sum + parseCentsFromInput(itemDraft.amount),
    0,
  );
  const enteredAmountCents = isItemised ? itemisedTotalCents : parseCentsFromInput(amount);

  const addItemDraft = () => {
    setItemDrafts((drafts) => [...drafts, { id: generateId(), name: '', amount: '' }]);
  };

  const updateItemDraft = (itemId: string, changes: Partial<Omit<AllowanceItemDraft, 'id'>>) => {
    setItemDrafts((drafts) =>
      drafts.map((itemDraft) =>
        itemDraft.id === itemId ? { ...itemDraft, ...changes } : itemDraft,
      ),
    );
  };

  const removeItemDraft = (itemId: string) => {
    setItemDrafts((drafts) => drafts.filter((itemDraft) => itemDraft.id !== itemId));
  };

  // The budget being edited belongs to a budgeted category too, and that one
  // has to stay in its own picker
  const otherBudgetedCategoryIds = useMemo(() => {
    if (!budgetedCategoryIds || !category) return budgetedCategoryIds;
    const withoutOwnCategory = new Set(budgetedCategoryIds);
    withoutOwnCategory.delete(category.id);
    return withoutOwnCategory;
  }, [budgetedCategoryIds, category]);

  useEffect(() => {
    if (open) {
      if (category) {
        // Edit mode - pre-fill with existing values
        setSelectedCategoryId(category.id);
        if (existingRule) {
          setAmount((existingRule.amountCents / 100).toFixed(2));
          setCadence(existingRule.cadence);
          setItemDrafts(
            (existingRule.items ?? []).map((item) => ({
              id: item.id,
              name: item.name,
              amount: (item.amountCents / 100).toFixed(2),
            })),
          );
        } else {
          setAmount('');
          setCadence('monthly');
          setItemDrafts([]);
        }
      } else {
        // Create mode - reset to defaults
        setSelectedCategoryId('');
        setAmount('');
        setCadence('monthly');
        setItemDrafts([]);
      }
      setFormError(null);
    }
  }, [open, category, existingRule]);

  // Focus the limit input when requested
  useEffect(() => {
    if (open && focusLimit) {
      // Small delay to ensure dialog is rendered
      const timer = setTimeout(() => {
        limitInputRef.current?.focus();
        limitInputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open, focusLimit]);

  const handleSave = async () => {
    setFormError(null);

    if (!selectedCategoryId) {
      setFormError('Please choose a category');
      return;
    }

    const items: AllowanceItem[] = itemDrafts.map((itemDraft) => ({
      id: itemDraft.id,
      name: itemDraft.name.trim(),
      amountCents: parseCentsFromInput(itemDraft.amount),
    }));
    const hasUnfinishedItem = items.some((item) => item.name === '' || item.amountCents <= 0);
    if (hasUnfinishedItem) {
      setFormError('Give every item a name and an amount');
      return;
    }

    try {
      const amountCents = enteredAmountCents;

      if (!isEditing && amountCents <= 0) {
        setFormError('Please enter an allowance');
        return;
      }

      if (amountCents === 0) {
        // Only reachable in edit mode: clearing the amount removes the allowance
        if (existingRule && deleteBudgetRule) {
          await deleteBudgetRule(existingRule.id);
        }
      } else if (amountCents > 0 && scenarioId) {
        await setBudgetForCategory(selectedCategoryId, amountCents, cadence, items);

        // The allowance was moved to another category, so take it off the old one
        const movedToAnotherCategory =
          existingRule && existingRule.categoryId !== selectedCategoryId;
        if (movedToAnotherCategory && deleteBudgetRule) {
          await deleteBudgetRule(existingRule.id);
        }
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
              : 'Pick a category, or type a new one, and set its allowance.'}
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
            <CategorySelect
              value={selectedCategoryId}
              onChange={setSelectedCategoryId}
              excludeIds={otherBudgetedCategoryIds}
              excludedMessage="This category already has an allowance"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget-amount" className="select-none">
                Allowance ($)
              </Label>
              <Input
                ref={limitInputRef}
                id="budget-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={isItemised ? (itemisedTotalCents / 100).toFixed(2) : amount}
                onChange={(e) => setAmount(e.target.value)}
                readOnly={isItemised}
                className={isItemised ? 'bg-muted' : undefined}
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

          {/* Items: the named parts of the allowance */}
          <div className="space-y-2">
            {isItemised && (
              <>
                <Label className="select-none">Items</Label>
                {itemDrafts.map((itemDraft) => (
                  <div key={itemDraft.id} className="flex items-center gap-2">
                    <Input
                      aria-label="Item name"
                      placeholder="Name"
                      maxLength={100}
                      value={itemDraft.name}
                      onChange={(e) => updateItemDraft(itemDraft.id, { name: e.target.value })}
                      className="flex-1"
                    />
                    <Input
                      aria-label="Item amount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={itemDraft.amount}
                      onChange={(e) => updateItemDraft(itemDraft.id, { amount: e.target.value })}
                      className="w-28"
                    />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Remove item"
                            onClick={() => removeItemDraft(itemDraft.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove item</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  The allowance is the items added together, each at the frequency above.
                </p>
              </>
            )}
            <Button type="button" variant="outline" size="sm" onClick={addItemDraft}>
              <Plus className="h-4 w-4" />
              {isItemised ? 'Add item' : 'Split into items'}
            </Button>
          </div>

          {averageSpendingHint && (
            <p className="text-xs text-muted-foreground">{averageSpendingHint}</p>
          )}

          {/* Budget impact indicator */}
          {hasIncome &&
            unallocatedAmount !== undefined &&
            (() => {
              const enteredAmount = enteredAmountCents;
              const existingAmount = existingRule?.amountCents ?? 0;
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
