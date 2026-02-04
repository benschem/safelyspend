import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tags } from 'lucide-react';

interface BulkCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description: string;
  categoryName: string;
  matchingCount: number;
  onApply: (createRule: boolean) => void;
}

export function BulkCategoryDialog({
  open,
  onOpenChange,
  description,
  categoryName,
  matchingCount,
  onApply,
}: BulkCategoryDialogProps) {
  const [createRule, setCreateRule] = useState(true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5" />
            Apply Category to Matching Transactions
          </DialogTitle>
          <DialogDescription>
            Apply <span className="font-medium text-foreground">{categoryName}</span> to{' '}
            <span className="font-medium text-foreground">{matchingCount}</span> other{' '}
            {matchingCount === 1 ? 'transaction' : 'transactions'} matching{' '}
            <span className="font-medium text-foreground">&lsquo;{description}&rsquo;</span>?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <label htmlFor="bulk-create-rule" className="flex cursor-pointer items-center gap-2">
            <Checkbox id="bulk-create-rule" checked={createRule} onCheckedChange={(v) => setCreateRule(v === true)} />
            <span className="text-sm">Also create an import rule for future imports</span>
          </label>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Skip
            </Button>
            <Button
              onClick={() => {
                onApply(createRule);
                onOpenChange(false);
              }}
            >
              Apply to All
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
