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
import { Target, Plus, RefreshCw } from 'lucide-react';
import {
  cn,
  formatCents,
  toMonthlyCents,
  CADENCE_SHORT_LABELS,
  type CadenceType,
} from '@/lib/utils';
import type { Transaction, BudgetRule, Cadence } from '@/lib/types';

type UpdateMode = 'add' | 'replace';

interface AddToBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  categoryName: string;
  existingBudget: BudgetRule | null;
  onCreateRecurringBudget: (amountCents: number, cadence: Cadence, updateMode: UpdateMode) => void;
}

export function AddToBudgetDialog({
  open,
  onOpenChange,
  transaction,
  categoryName,
  existingBudget,
  onCreateRecurringBudget,
}: AddToBudgetDialogProps) {
  const [amount, setAmount] = useState('');
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [updateMode, setUpdateMode] = useState<UpdateMode>('add');
  const [formError, setFormError] = useState<string | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open && transaction) {
      setAmount((transaction.amountCents / 100).toFixed(2));
      setCadence('monthly');
      setUpdateMode(existingBudget ? 'add' : 'replace');
      setFormError(null);
    }
  }, [open, transaction, existingBudget]);

  if (!transaction) return null;

  const amountCents = Math.round(parseFloat(amount || '0') * 100);
  const amountMonthly = toMonthlyCents(amountCents, cadence);
  const existingMonthly = existingBudget
    ? toMonthlyCents(existingBudget.amountCents, existingBudget.cadence as CadenceType)
    : 0;
  const newTotalMonthly = existingMonthly + amountMonthly;

  const handleSave = () => {
    setFormError(null);

    if (amountCents <= 0) {
      setFormError('Please enter a valid amount');
      return;
    }

    onCreateRecurringBudget(amountCents, cadence, updateMode);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Add to Budget
          </DialogTitle>
          <DialogDescription>
            Create or update a budget based on this transaction.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-4 pt-2"
        >
          {formError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          {/* Transaction info */}
          <div className="rounded-lg bg-muted p-3 text-sm">
            <div className="font-medium">{transaction.description}</div>
            <div className="mt-1 flex items-center justify-between text-muted-foreground">
              <span>{categoryName}</span>
              <span className="font-mono">{formatCents(transaction.amountCents)}</span>
            </div>
          </div>

          {/* Amount and cadence */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget-amount" className="select-none">
                Amount ($)
              </Label>
              <Input
                id="budget-amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label className="select-none">Frequency</Label>
              <Select value={cadence} onValueChange={(v) => setCadence(v as Cadence)}>
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

          {/* Update mode if existing budget */}
          {existingBudget && (
            <div className="space-y-2">
              <Label className="select-none">Update Mode</Label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setUpdateMode('add')}
                  className={cn(
                    'w-full cursor-pointer rounded-lg border p-3 text-left transition-colors',
                    updateMode === 'add' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Plus className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Add to existing</div>
                      <div className="text-xs text-muted-foreground">
                        {formatCents(existingMonthly)}/mo + {formatCents(amountMonthly)}/mo ={' '}
                        {formatCents(newTotalMonthly)}/mo
                      </div>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setUpdateMode('replace')}
                  className={cn(
                    'w-full cursor-pointer rounded-lg border p-3 text-left transition-colors',
                    updateMode === 'replace' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Replace existing</div>
                      <div className="text-xs text-muted-foreground">
                        Set budget to {formatCents(amountMonthly)}/mo
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Preview */}
          {!existingBudget && amountCents > 0 && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">New budget:</span>
                <span className="font-mono">
                  {formatCents(amountCents)}
                  {CADENCE_SHORT_LABELS[cadence]}
                  {cadence !== 'monthly' && (
                    <span className="text-muted-foreground">
                      {' '}
                      ({formatCents(amountMonthly)}/mo)
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {existingBudget ? 'Update Budget' : 'Create Budget'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
