import { useState, useEffect, useCallback } from 'react';
import { Ambulance, Trash2, Info, Plus, X, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { today, parseCentsFromInput } from '@/lib/utils';
import type { SavingsGoal, SavingsAnchor, CreateEntity, Transaction, InterestRateEntry } from '@/lib/types';

interface SavingsGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: SavingsGoal | null;
  addSavingsGoal: (data: CreateEntity<SavingsGoal>) => Promise<SavingsGoal>;
  updateSavingsGoal: (
    id: string,
    updates: Partial<Omit<SavingsGoal, 'id' | 'userId' | 'createdAt'>>,
  ) => Promise<void>;
  deleteSavingsGoal?: (id: string) => void;
  addTransaction: (data: CreateEntity<Transaction>) => Promise<Transaction>;
  addSavingsAnchor?: (data: CreateEntity<SavingsAnchor>) => Promise<SavingsAnchor>;
  /** Number of transactions linked to this goal, for delete warning */
  transactionCount?: number;
  /** Earliest balance anchor date - used to determine if starting balance should be backdated */
  earliestAnchorDate?: string | null;
}

export function SavingsGoalDialog({
  open,
  onOpenChange,
  goal,
  addSavingsGoal,
  updateSavingsGoal,
  deleteSavingsGoal,
  addTransaction,
  addSavingsAnchor,
  transactionCount = 0,
}: SavingsGoalDialogProps) {
  const isEditing = !!goal;

  // Form state
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [startingBalance, setStartingBalance] = useState('');
  const [balanceType, setBalanceType] = useState<'already-saved' | 'transfer-now'>('already-saved');
  const [balanceDate, setBalanceDate] = useState(today());
  const [deadline, setDeadline] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [isEmergencyFund, setIsEmergencyFund] = useState(false);
  const [rateSchedule, setRateSchedule] = useState<InterestRateEntry[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      if (goal) {
        setName(goal.name);
        setTargetAmount((goal.targetAmountCents / 100).toFixed(2));
        setStartingBalance('');
        setBalanceType('already-saved');
        setBalanceDate(today());
        setDeadline(goal.deadline ?? '');
        setInterestRate(goal.annualInterestRate?.toString() ?? '');
        setIsEmergencyFund(goal.isEmergencyFund ?? false);
        const schedule = goal.interestRateSchedule ?? [];
        setRateSchedule(schedule);
        setScheduleOpen(schedule.length > 0);
      } else {
        setName('');
        setTargetAmount('');
        setStartingBalance('');
        setBalanceType('already-saved');
        setBalanceDate(today());
        setDeadline('');
        setInterestRate('');
        setIsEmergencyFund(false);
        setRateSchedule([]);
        setScheduleOpen(false);
      }
      setFormError(null);
      setIsDeleting(false);
    }
  }, [open, goal]);

  const handleDeleteConfirm = useCallback(() => {
    if (!goal || !deleteSavingsGoal) return;
    deleteSavingsGoal(goal.id);
    setIsDeleting(false);
    onOpenChange(false);
  }, [goal, deleteSavingsGoal, onOpenChange]);

  const handleSave = async () => {
    setFormError(null);

    if (!name.trim()) {
      setFormError('Please enter a goal name');
      return;
    }

    const targetAmountCents = parseCentsFromInput(targetAmount);
    if (targetAmountCents <= 0) {
      setFormError('Please enter a valid target amount');
      return;
    }

    const parsedInterestRate = interestRate ? parseFloat(interestRate) : null;

    // Sort schedule by date and filter out invalid entries
    const sortedSchedule = rateSchedule
      .filter((e) => e.effectiveDate && !isNaN(e.annualRate))
      .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

    try {
      if (isEditing && goal) {
        const updates: Parameters<typeof updateSavingsGoal>[1] = {
          name: name.trim(),
          targetAmountCents,
          isEmergencyFund,
          ...(deadline ? { deadline } : { deadline: undefined as never }),
          ...(parsedInterestRate ? { annualInterestRate: parsedInterestRate } : { annualInterestRate: undefined as never }),
          ...(sortedSchedule.length > 0 ? { interestRateSchedule: sortedSchedule } : { interestRateSchedule: undefined as never }),
        };
        await updateSavingsGoal(goal.id, updates);
      } else {
        const newGoal = await addSavingsGoal({
          name: name.trim(),
          targetAmountCents,
          isEmergencyFund,
          ...(deadline ? { deadline } : {}),
          ...(parsedInterestRate ? { annualInterestRate: parsedInterestRate } : {}),
          ...(sortedSchedule.length > 0 ? { interestRateSchedule: sortedSchedule } : {}),
        });

        // Create starting balance if amount > 0
        const startingBalanceCents = parseCentsFromInput(startingBalance);
        if (startingBalanceCents > 0) {
          if (balanceType === 'already-saved' && addSavingsAnchor) {
            // Use a savings anchor - simpler than backdated transactions
            await addSavingsAnchor({
              savingsGoalId: newGoal.id,
              date: balanceDate || today(),
              balanceCents: startingBalanceCents,
              label: 'Starting balance',
            });
          } else {
            // Transfer now - create a regular transaction
            await addTransaction({
              type: 'savings',
              date: today(),
              amountCents: startingBalanceCents,
              description: 'Transfer to savings',
              categoryId: null,
              savingsGoalId: newGoal.id,
            });
          }
        }
      }
      onOpenChange(false);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Failed to save goal. Please try again.',
      );
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Add'} Savings Goal</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the savings goal details.'
              : 'Create a new savings target to track your progress.'}
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
            <Label htmlFor="goal-name" className="select-none">
              Goal Name
            </Label>
            <Input
              id="goal-name"
              placeholder="e.g., Emergency Fund, Holiday"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="goal-target" className="select-none">
                Target Amount ($)
              </Label>
              <Input
                id="goal-target"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
              />
            </div>

            {!isEditing && (
              <div className="space-y-2">
                <Label htmlFor="goal-starting" className="select-none">
                  Current Balance
                  <span className="ml-1 font-normal text-muted-foreground">(opt.)</span>
                </Label>
                <Input
                  id="goal-starting"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={startingBalance}
                  onChange={(e) => setStartingBalance(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Balance type selector - only show when creating with a starting balance */}
          {!isEditing && parseCentsFromInput(startingBalance) > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/50">
              <div className="mb-2 flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Is this money you&apos;ve <strong>already saved</strong>, or are you{' '}
                  <strong>transferring it now</strong> from your bank account?
                </p>
              </div>
              <RadioGroup
                value={balanceType}
                onValueChange={(v) => setBalanceType(v as 'already-saved' | 'transfer-now')}
                className="mt-2 space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="already-saved" id="already-saved" />
                  <Label htmlFor="already-saved" className="cursor-pointer font-normal">
                    Already in savings account
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="transfer-now" id="transfer-now" />
                  <Label htmlFor="transfer-now" className="cursor-pointer font-normal">
                    Transferring from bank account now
                  </Label>
                </div>
              </RadioGroup>
              {balanceType === 'already-saved' && (
                <div className="mt-3 space-y-2">
                  <Label
                    htmlFor="balance-date"
                    className="text-sm font-normal text-blue-800 dark:text-blue-200"
                  >
                    As of date
                  </Label>
                  <Input
                    id="balance-date"
                    type="date"
                    value={balanceDate}
                    onChange={(e) => setBalanceDate(e.target.value)}
                    max={today()}
                    className="bg-white dark:bg-gray-900"
                  />
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="goal-deadline" className="select-none">
              Deadline
              <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="goal-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Ambulance className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="emergency-fund" className="cursor-pointer select-none">
                Emergency Fund
              </Label>
            </div>
            <Switch
              id="emergency-fund"
              checked={isEmergencyFund}
              onCheckedChange={setIsEmergencyFund}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal-interest" className="select-none">
              Interest Rate
              <span className="ml-1 font-normal text-muted-foreground">(optional, p.a.)</span>
            </Label>
            <div className="relative">
              <Input
                id="goal-interest"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="e.g., 4.5"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                className="pr-12"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                % p.a.
              </span>
            </div>
          </div>

          {/* Scheduled Rate Changes - only show when interest rate has a value */}
          {interestRate && parseFloat(interestRate) > 0 && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setScheduleOpen(!scheduleOpen)}
                className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {scheduleOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                Scheduled Rate Changes
                {rateSchedule.length > 0 && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({rateSchedule.length})
                  </span>
                )}
              </button>

              {scheduleOpen && (
                <div className="space-y-2 rounded-lg border p-3">
                  {rateSchedule.length > 0 && (
                    <div className="space-y-2">
                      {rateSchedule.map((entry, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
                            type="date"
                            value={entry.effectiveDate}
                            onChange={(e) => {
                              const updated = [...rateSchedule];
                              updated[index] = { ...entry, effectiveDate: e.target.value };
                              setRateSchedule(updated);
                            }}
                            className="flex-1"
                          />
                          <div className="relative flex-1">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={entry.annualRate}
                              onChange={(e) => {
                                const updated = [...rateSchedule];
                                updated[index] = {
                                  ...entry,
                                  annualRate: parseFloat(e.target.value) || 0,
                                };
                                setRateSchedule(updated);
                              }}
                              className="pr-12"
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              % p.a.
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setRateSchedule(rateSchedule.filter((_, i) => i !== index));
                            }}
                            className="cursor-pointer p-1 text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
                      setRateSchedule([
                        ...rateSchedule,
                        {
                          effectiveDate: tomorrowStr,
                          annualRate: parseFloat(interestRate) || 0,
                        },
                      ]);
                    }}
                    className="w-full"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Rate Change
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            {isEditing && deleteSavingsGoal ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsDeleting(true)}
                className="gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">{isEditing ? 'Save' : 'Create'} Goal</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{goal?.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>This will permanently delete this savings goal.</p>
              {transactionCount > 0 && (
                <p>
                  Your {transactionCount} past transaction{transactionCount === 1 ? '' : 's'} will
                  be kept in your history.
                </p>
              )}
              <p>Any remaining balance will be returned to your cash.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete Goal
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
