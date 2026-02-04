import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Repeat, CalendarX, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import type { ExpandedForecast, ForecastRule } from '@/lib/types';

interface DeleteForecastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forecast: ExpandedForecast | null;
  onDeleteOccurrence: () => void;
  onDeleteAll: () => void;
  /** For undo support on "delete all" */
  deleteRule?: (id: string) => Promise<void>;
  restoreRule?: (rule: ForecastRule) => Promise<ForecastRule>;
  /** The full rule object (needed for undo) */
  rule?: ForecastRule | null;
}

export function DeleteForecastDialog({
  open,
  onOpenChange,
  forecast,
  onDeleteOccurrence,
  onDeleteAll,
  deleteRule,
  restoreRule,
  rule,
}: DeleteForecastDialogProps) {
  if (!forecast) return null;

  const handleDeleteAll = async () => {
    if (deleteRule && restoreRule && rule) {
      const capturedRule = { ...rule };
      await deleteRule(rule.id);
      onOpenChange(false);
      toast('Recurring forecast deleted', {
        action: {
          label: 'Undo',
          onClick: () => {
            restoreRule(capturedRule);
          },
        },
        duration: 5000,
      });
    } else {
      onDeleteAll();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            Delete Recurring Transaction
          </DialogTitle>
          <DialogDescription>
            &quot;{forecast.description}&quot; is a recurring transaction. What would you like to
            delete?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={onDeleteOccurrence}
            className="w-full cursor-pointer rounded-lg border p-4 text-left transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <CalendarX className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium">Delete this occurrence</div>
                <div className="text-sm text-muted-foreground">
                  Only remove the {formatDate(forecast.date)} occurrence. Future occurrences will
                  remain.
                </div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={handleDeleteAll}
            className="w-full cursor-pointer rounded-lg border border-destructive/50 p-4 text-left transition-colors hover:bg-destructive/10"
          >
            <div className="flex items-center gap-3">
              <Trash2 className="h-5 w-5 text-destructive" />
              <div>
                <div className="font-medium text-destructive">Delete all occurrences</div>
                <div className="text-sm text-muted-foreground">
                  Remove the recurring expectation entirely. All past and future occurrences will be
                  deleted.
                </div>
              </div>
            </div>
          </button>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
