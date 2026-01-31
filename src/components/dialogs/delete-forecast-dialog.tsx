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
import type { ExpandedForecast } from '@/lib/types';

interface DeleteForecastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forecast: ExpandedForecast | null;
  onDeleteOccurrence: () => void;
  onDeleteAll: () => void;
}

export function DeleteForecastDialog({
  open,
  onOpenChange,
  forecast,
  onDeleteOccurrence,
  onDeleteAll,
}: DeleteForecastDialogProps) {
  if (!forecast) return null;

  const isRecurring = forecast.sourceType === 'rule';

  // For non-recurring (events), just confirm deletion
  if (!isRecurring) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Expected Transaction</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{forecast.description}&quot; on {formatDate(forecast.date)}?
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDeleteAll}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // For recurring rules, offer choice
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            Delete Recurring Transaction
          </DialogTitle>
          <DialogDescription>
            &quot;{forecast.description}&quot; is a recurring transaction. What would you like to delete?
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
                  Only remove the {formatDate(forecast.date)} occurrence. Future occurrences will remain.
                </div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onDeleteAll}
            className="w-full cursor-pointer rounded-lg border border-destructive/50 p-4 text-left transition-colors hover:bg-destructive/10"
          >
            <div className="flex items-center gap-3">
              <Trash2 className="h-5 w-5 text-destructive" />
              <div>
                <div className="font-medium text-destructive">Delete all occurrences</div>
                <div className="text-sm text-muted-foreground">
                  Remove the recurring rule entirely. All past and future occurrences will be deleted.
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
