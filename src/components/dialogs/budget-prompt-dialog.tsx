import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Target, Plus, RefreshCw, Check } from 'lucide-react';
import {
  cn,
  formatCents,
  toMonthlyCents,
  CADENCE_SHORT_LABELS,
  type CadenceType,
} from '@/lib/utils';
import type { BudgetRule } from '@/lib/types';

interface BudgetPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  categoryName: string;
  forecastAmountCents: number;
  forecastCadence: CadenceType;
  existingBudget: BudgetRule | null;
  onAddToBudget: (dontAskAgain: boolean) => void;
  onReplaceBudget: (dontAskAgain: boolean) => void;
  onSkip: (dontAskAgain: boolean) => void;
}

export function BudgetPromptDialog({
  open,
  onOpenChange,
  categoryName,
  forecastAmountCents,
  forecastCadence,
  existingBudget,
  onAddToBudget,
  onReplaceBudget,
  onSkip,
}: BudgetPromptDialogProps) {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  // Convert forecast to monthly for comparison
  const forecastMonthly = toMonthlyCents(forecastAmountCents, forecastCadence);

  // Get existing budget info
  const existingMonthly = existingBudget
    ? toMonthlyCents(existingBudget.amountCents, existingBudget.cadence as CadenceType)
    : 0;

  const newTotalMonthly = existingMonthly + forecastMonthly;

  const handleAddToBudget = () => {
    onAddToBudget(dontAskAgain);
    onOpenChange(false);
  };

  const handleReplaceBudget = () => {
    onReplaceBudget(dontAskAgain);
    onOpenChange(false);
  };

  const handleSkip = () => {
    onSkip(dontAskAgain);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Update Budget?
          </DialogTitle>
          <DialogDescription>
            You&apos;ve added a recurring expense. Would you like to update your budget for{' '}
            <span className="font-medium text-foreground">{categoryName}</span>?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Show the math */}
          <div className="rounded-lg bg-muted p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">New expense:</span>
              <span className="font-mono">
                {formatCents(forecastAmountCents)}
                {CADENCE_SHORT_LABELS[forecastCadence]}
                {forecastCadence !== 'monthly' && (
                  <span className="text-muted-foreground">
                    {' '}
                    ({formatCents(forecastMonthly)}/mo)
                  </span>
                )}
              </span>
            </div>
            {existingBudget && (
              <>
                <div className="mt-2 flex justify-between">
                  <span className="text-muted-foreground">Current budget:</span>
                  <span className="font-mono">
                    {formatCents(existingBudget.amountCents)}
                    {CADENCE_SHORT_LABELS[existingBudget.cadence as CadenceType]}
                    {existingBudget.cadence !== 'monthly' && (
                      <span className="text-muted-foreground">
                        {' '}
                        ({formatCents(existingMonthly)}/mo)
                      </span>
                    )}
                  </span>
                </div>
                <div className="mt-2 border-t pt-2 flex justify-between font-medium">
                  <span>New total:</span>
                  <span className="font-mono">{formatCents(newTotalMonthly)}/mo</span>
                </div>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            {existingBudget ? (
              <>
                <button
                  type="button"
                  onClick={handleAddToBudget}
                  className="w-full cursor-pointer rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Plus className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Add to existing budget</div>
                      <div className="text-sm text-muted-foreground">
                        Increase budget to {formatCents(newTotalMonthly)}/mo
                      </div>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={handleReplaceBudget}
                  className="w-full cursor-pointer rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <RefreshCw className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Replace budget</div>
                      <div className="text-sm text-muted-foreground">
                        Set budget to {formatCents(forecastMonthly)}/mo
                      </div>
                    </div>
                  </div>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleAddToBudget}
                className="w-full cursor-pointer rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Create budget</div>
                    <div className="text-sm text-muted-foreground">
                      Set {categoryName} budget to {formatCents(forecastMonthly)}/mo
                    </div>
                  </div>
                </div>
              </button>
            )}
          </div>

          {/* Don't ask again + Skip */}
          <div className="flex items-center justify-between pt-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <button
                type="button"
                role="checkbox"
                aria-checked={dontAskAgain}
                onClick={() => setDontAskAgain(!dontAskAgain)}
                className={cn(
                  'flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border transition-colors',
                  dontAskAgain
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background',
                )}
              >
                {dontAskAgain && <Check className="h-3 w-3" />}
              </button>
              Don&apos;t ask again
            </label>
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              Skip
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
