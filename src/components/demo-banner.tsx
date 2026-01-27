import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { clearAllData } from '@/lib/demo-data';

export function DemoBanner() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleReset = () => {
    clearAllData();
    // Redirect to root to restart the wizard
    window.location.href = '/';
  };

  return (
    <>
      <div className="flex items-center justify-between bg-amber-100 px-4 py-2 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
        <span className="text-sm font-medium">
          You&apos;re exploring demo data
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="border-amber-600 bg-transparent text-amber-900 hover:bg-amber-200 dark:border-amber-600 dark:text-amber-200 dark:hover:bg-amber-800"
        >
          Start your own budget
        </Button>
      </div>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start your own budget?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all demo data and restart the setup wizard. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>
              Delete demo data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
