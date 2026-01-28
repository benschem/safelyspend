import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
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
      <Alert
        variant="warning"
        hideIcon
        className="items-center rounded-none border-x-0 border-t-0 py-2"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="border-yellow-600 bg-transparent hover:bg-yellow-200 dark:border-yellow-500 dark:hover:bg-yellow-900"
          >
            Start your own budget
          </Button>
        }
      >
        <span className="font-medium">You&apos;re exploring demo data</span>
      </Alert>

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
