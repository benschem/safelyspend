import { useState, useEffect } from 'react';
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
import { useCategories } from '@/hooks/use-categories';
import { useBudgetRules } from '@/hooks/use-budget-rules';
import { parseCentsFromInput } from '@/lib/utils';
import type { Cadence } from '@/lib/types';

interface CategoryBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenarioId: string | null;
}

const DAY_OF_WEEK_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_OF_QUARTER_LABELS = ['1st month', '2nd month', '3rd month'];

export function CategoryBudgetDialog({ open, onOpenChange, scenarioId }: CategoryBudgetDialogProps) {
  const { addCategory } = useCategories();
  const { setBudgetForCategory } = useBudgetRules(scenarioId);

  // Form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [day, setDay] = useState('1');
  const [monthOfQuarter, setMonthOfQuarter] = useState('0');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setAmount('');
      setCadence('monthly');
      setDay('1');
      setMonthOfQuarter('0');
      setFormError(null);
    }
  }, [open]);

  const handleSave = async () => {
    setFormError(null);

    if (!name.trim()) {
      setFormError('Please enter a category name');
      return;
    }

    // Create the category first
    const newCategory = await addCategory({ name: name.trim(), isArchived: false });

    // If amount is provided, create the budget rule
    const amountCents = parseCentsFromInput(amount);
    if (amountCents > 0 && scenarioId) {
      const isWeekly = cadence === 'weekly' || cadence === 'fortnightly';
      const isQuarterly = cadence === 'quarterly';
      await setBudgetForCategory(
        newCategory.id,
        amountCents,
        cadence,
        isWeekly ? parseInt(day) : undefined,
        isWeekly ? undefined : parseInt(day),
        isQuarterly ? parseInt(monthOfQuarter) : undefined,
      );
    }

    onOpenChange(false);
  };

  const isWeeklyCadence = cadence === 'weekly' || cadence === 'fortnightly';
  const isQuarterlyCadence = cadence === 'quarterly';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Category with Budget</DialogTitle>
          <DialogDescription>
            Create a new category and optionally set a budget limit for it.
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
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget-amount" className="select-none">
                Budget Amount ($)
                <span className="ml-1 font-normal text-muted-foreground">(opt.)</span>
              </Label>
              <Input
                id="budget-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="select-none">Cadence</Label>
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
                  {DAY_OF_WEEK_LABELS.map((label, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!isWeeklyCadence && !isQuarterlyCadence && (
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

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Add Category</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
