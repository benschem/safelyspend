import { useState, useEffect, useRef } from 'react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { parseCentsFromInput, formatCents } from '@/lib/utils';
import type { Cadence, Category, CreateEntity, BudgetRule } from '@/lib/types';

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
  // Callbacks
  addCategory: (data: CreateEntity<Category>) => Promise<Category>;
  updateCategory?: (id: string, updates: Partial<Omit<Category, 'id' | 'userId' | 'createdAt'>>) => Promise<void>;
  deleteCategory?: (id: string) => Promise<void>;
  setBudgetForCategory: (
    categoryId: string,
    amountCents: number,
    cadence: Cadence,
    dayOfWeek?: number,
    dayOfMonth?: number,
    monthOfQuarter?: number,
    monthOfYear?: number
  ) => Promise<void>;
  deleteBudgetRule?: (id: string) => Promise<void>;
}

// Ordered Monday-first for display, with correct JS dayOfWeek values (0=Sun, 1=Mon, etc.)
const DAYS_OF_WEEK = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];
const MONTH_OF_QUARTER_LABELS = ['1st month', '2nd month', '3rd month'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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
  addCategory,
  updateCategory,
  deleteCategory,
  setBudgetForCategory,
  deleteBudgetRule,
}: CategoryBudgetDialogProps) {
  const isEditing = !!category;
  const limitInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [day, setDay] = useState('1');
  const [monthOfQuarter, setMonthOfQuarter] = useState('0');
  const [monthOfYear, setMonthOfYear] = useState('0');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (open) {
      if (category) {
        // Edit mode - pre-fill with existing values
        setName(category.name);
        if (existingRule) {
          setAmount((existingRule.amountCents / 100).toFixed(2));
          setCadence(existingRule.cadence);
          if (existingRule.cadence === 'weekly' || existingRule.cadence === 'fortnightly') {
            setDay(String(existingRule.dayOfWeek ?? 1));
          } else {
            setDay(String(existingRule.dayOfMonth ?? 1));
          }
          setMonthOfQuarter(String(existingRule.monthOfQuarter ?? 0));
          setMonthOfYear(String(existingRule.monthOfYear ?? 0));
        } else {
          setAmount('');
          setCadence('monthly');
          setDay('1');
          setMonthOfQuarter('0');
          setMonthOfYear('0');
        }
      } else {
        // Create mode - reset to defaults
        setName('');
        setAmount('');
        setCadence('monthly');
        setDay('1');
        setMonthOfQuarter('0');
        setMonthOfYear('0');
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

    if (!name.trim()) {
      setFormError('Please enter a category name');
      return;
    }

    try {
      const amountCents = parseCentsFromInput(amount);
      const isWeekly = cadence === 'weekly' || cadence === 'fortnightly';
      const isQuarterly = cadence === 'quarterly';

      if (isEditing && category && updateCategory) {
        // Update existing category name
        await updateCategory(category.id, { name: name.trim() });

        // Handle budget rule changes
        if (amountCents > 0 && scenarioId) {
          // Set or update budget
          await setBudgetForCategory(
            category.id,
            amountCents,
            cadence,
            isWeekly ? parseInt(day) : undefined,
            isWeekly ? undefined : parseInt(day),
            isQuarterly ? parseInt(monthOfQuarter) : undefined,
            isYearlyCadence ? parseInt(monthOfYear) : undefined,
          );
        } else if (amountCents === 0 && existingRule && deleteBudgetRule) {
          // Remove budget if amount is cleared
          await deleteBudgetRule(existingRule.id);
        }
      } else {
        // Create new category
        const newCategory = await addCategory({ name: name.trim(), isArchived: false });

        // If amount is provided, create the budget rule
        if (amountCents > 0 && scenarioId) {
          await setBudgetForCategory(
            newCategory.id,
            amountCents,
            cadence,
            isWeekly ? parseInt(day) : undefined,
            isWeekly ? undefined : parseInt(day),
            isQuarterly ? parseInt(monthOfQuarter) : undefined,
            isYearlyCadence ? parseInt(monthOfYear) : undefined,
          );
        }
      }
      onOpenChange(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : `Failed to ${isEditing ? 'update' : 'create'} category. Please try again.`);
    }
  };

  const isWeeklyCadence = cadence === 'weekly' || cadence === 'fortnightly';
  const isQuarterlyCadence = cadence === 'quarterly';
  const isYearlyCadence = cadence === 'yearly';

  const handleArchiveToggle = async () => {
    if (category && updateCategory) {
      await updateCategory(category.id, { isArchived: !category.isArchived });
      onOpenChange(false);
    }
  };

  const handleDelete = async () => {
    if (confirmingDelete && category && deleteCategory) {
      await deleteCategory(category.id);
      onOpenChange(false);
    } else {
      setConfirmingDelete(true);
    }
  };

  // Reset confirmingDelete when dialog closes
  useEffect(() => {
    if (!open) {
      setConfirmingDelete(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Category' : 'Add Category'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the category name and budget limit.'
              : 'Create a new category and optionally set a budget limit.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="category-name" className="select-none">Category Name</Label>
            <Input
              id="category-name"
              placeholder="e.g., Groceries, Transport"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget-amount" className="select-none">
                Budget Limit ($)
                {!isEditing && <span className="ml-1 font-normal text-muted-foreground">(opt.)</span>}
              </Label>
              <Input
                ref={limitInputRef}
                id="budget-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {!isEditing && (
                <p className="text-xs text-muted-foreground">Leave blank for no limit</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="select-none">Frequency</Label>
              <Select
                value={cadence}
                onValueChange={(v) => {
                  setCadence(v as Cadence);
                  if (v === 'weekly' || v === 'fortnightly') {
                    setDay('1'); // Monday
                  } else {
                    setDay('1'); // 1st of month
                  }
                }}
              >
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

          {/* Budget impact indicator */}
          {hasIncome && unallocatedAmount !== undefined && (() => {
            const enteredAmount = parseCentsFromInput(amount);
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
                <p className="text-xs text-amber-600">
                  Overcommitting by {formatCents(Math.abs(newUnallocated))}
                </p>
              );
            }
          })()}

          {isYearlyCadence && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="select-none">Month</Label>
                <Select value={monthOfYear} onValueChange={setMonthOfYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="select-none">Day</Label>
                <Select value={day} onValueChange={setDay}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {isQuarterlyCadence && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="select-none">Month of Quarter</Label>
                <Select value={monthOfQuarter} onValueChange={setMonthOfQuarter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_OF_QUARTER_LABELS.map((label, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="select-none">Day</Label>
                <Select value={day} onValueChange={setDay}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {isWeeklyCadence && (
            <div className="space-y-2">
              <Label className="select-none">Day of Week</Label>
              <Select value={day} onValueChange={setDay}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((d) => (
                    <SelectItem key={d.value} value={String(d.value)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!isWeeklyCadence && !isQuarterlyCadence && !isYearlyCadence && (
            <div className="space-y-2">
              <Label className="select-none">Day of Month</Label>
              <Select value={day} onValueChange={setDay}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            {/* Left side: Archive/Delete buttons (edit mode only) */}
            <div className="flex gap-1">
              {isEditing && category && updateCategory && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
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
                      <Button
                        variant={confirmingDelete ? 'destructive' : 'ghost'}
                        size="icon"
                        onClick={handleDelete}
                        onBlur={() => setTimeout(() => setConfirmingDelete(false), 200)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {confirmingDelete ? 'Click again to confirm deletion' : 'Delete category'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Right side: Cancel/Save buttons */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                {isEditing ? 'Save Changes' : 'Add Category'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
