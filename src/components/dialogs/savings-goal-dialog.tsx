import { useState, useEffect } from 'react';
import { Ambulance } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { today, parseCentsFromInput } from '@/lib/utils';
import type { SavingsGoal, CompoundingFrequency, CreateEntity, Transaction } from '@/lib/types';

interface SavingsGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: SavingsGoal | null;
  addSavingsGoal: (data: CreateEntity<SavingsGoal>) => Promise<SavingsGoal>;
  updateSavingsGoal: (id: string, updates: Partial<Omit<SavingsGoal, 'id' | 'userId' | 'createdAt'>>) => Promise<void>;
  addTransaction: (data: CreateEntity<Transaction>) => Promise<Transaction>;
}

export function SavingsGoalDialog({ open, onOpenChange, goal, addSavingsGoal, updateSavingsGoal, addTransaction }: SavingsGoalDialogProps) {
  const isEditing = !!goal;

  // Form state
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [startingBalance, setStartingBalance] = useState('');
  const [deadline, setDeadline] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [compoundingFrequency, setCompoundingFrequency] = useState<CompoundingFrequency>('monthly');
  const [isEmergencyFund, setIsEmergencyFund] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (goal) {
        setName(goal.name);
        setTargetAmount((goal.targetAmountCents / 100).toFixed(2));
        setStartingBalance('');
        setDeadline(goal.deadline ?? '');
        setInterestRate(goal.annualInterestRate?.toString() ?? '');
        setCompoundingFrequency(goal.compoundingFrequency ?? 'monthly');
        setIsEmergencyFund(goal.isEmergencyFund ?? false);
      } else {
        setName('');
        setTargetAmount('');
        setStartingBalance('');
        setDeadline('');
        setInterestRate('');
        setCompoundingFrequency('monthly');
        setIsEmergencyFund(false);
      }
      setFormError(null);
    }
  }, [open, goal]);

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

    if (isEditing && goal) {
      const updates: Parameters<typeof updateSavingsGoal>[1] = {
        name: name.trim(),
        targetAmountCents,
        isEmergencyFund,
        ...(deadline ? { deadline } : {}),
        ...(parsedInterestRate ? { annualInterestRate: parsedInterestRate, compoundingFrequency } : {}),
      };
      await updateSavingsGoal(goal.id, updates);
    } else {
      const newGoal = await addSavingsGoal({
        name: name.trim(),
        targetAmountCents,
        isEmergencyFund,
        ...(deadline ? { deadline } : {}),
        ...(parsedInterestRate ? { annualInterestRate: parsedInterestRate, compoundingFrequency } : {}),
      });

      // Create starting balance transaction if amount > 0
      const startingBalanceCents = parseCentsFromInput(startingBalance);
      if (startingBalanceCents > 0) {
        await addTransaction({
          type: 'savings',
          date: today(),
          amountCents: startingBalanceCents,
          description: 'Starting balance',
          categoryId: null,
          savingsGoalId: newGoal.id,
        });
      }
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Add'} Savings Goal</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the savings goal details.' : 'Create a new savings target to track your progress.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="goal-name" className="select-none">Goal Name</Label>
            <Input
              id="goal-name"
              placeholder="e.g., Emergency Fund, Holiday"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="goal-target" className="select-none">Target Amount ($)</Label>
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
                  Starting Balance
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="goal-interest" className="select-none">
                Interest Rate
                <span className="ml-1 font-normal text-muted-foreground">(opt.)</span>
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
                  className="pr-8"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  %
                </span>
              </div>
            </div>

            {interestRate && (
              <div className="space-y-2">
                <Label htmlFor="goal-compounding" className="select-none">Compounding</Label>
                <Select value={compoundingFrequency} onValueChange={(v) => setCompoundingFrequency(v as CompoundingFrequency)}>
                  <SelectTrigger id="goal-compounding">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {isEditing ? 'Save' : 'Create'} Goal
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
