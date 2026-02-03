import { useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  clearAllData,
  getAvailablePersonas,
  getDemoPersonaId,
  switchPersona,
} from '@/lib/demo-data';
import { debug } from '@/lib/debug';

export function DemoBanner() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentPersonaId, setCurrentPersonaId] = useState(getDemoPersonaId);
  const [isLoading, setIsLoading] = useState(false);
  const personas = getAvailablePersonas();

  const handleReset = () => {
    clearAllData();
    // Redirect to root to restart the wizard
    window.location.href = '/';
  };

  const handlePersonaChange = async (personaId: string) => {
    if (personaId === currentPersonaId) return;

    setIsLoading(true);
    try {
      await switchPersona(personaId);
      setCurrentPersonaId(personaId);
      // Reload the page to reflect new data
      window.location.reload();
    } catch (error) {
      debug.error('db', 'Failed to switch persona', error);
      setIsLoading(false);
    }
  };

  const currentPersona = personas.find((p) => p.id === currentPersonaId);

  return (
    <>
      <Alert
        variant="warning"
        hideIcon
        className="items-center rounded-none border-x-0 border-t-0 py-2"
        action={
          <>
            {/* Full button on larger screens */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="hidden border-yellow-600 bg-transparent hover:bg-yellow-200 dark:border-yellow-500 dark:hover:bg-yellow-900 sm:inline-flex"
            >
              Start your own budget
            </Button>
            {/* Icon button on mobile */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="h-7 w-7 border-yellow-600 bg-transparent p-0 hover:bg-yellow-200 dark:border-yellow-500 dark:hover:bg-yellow-900 sm:hidden"
              title="Start your own budget"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </>
        }
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 w-7 shrink-0 p-0 hover:bg-yellow-200 dark:hover:bg-yellow-900"
            title="Back to landing page"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="hidden font-medium sm:inline">Demo:</span>
          <Select value={currentPersonaId} onValueChange={handlePersonaChange} disabled={isLoading}>
            <SelectTrigger className="h-7 w-auto gap-1 border-yellow-600/50 bg-transparent text-sm hover:bg-yellow-200 dark:border-yellow-500/50 dark:hover:bg-yellow-900 sm:gap-2">
              <SelectValue>
                {isLoading ? 'Loading...' : (currentPersona?.name ?? 'Select')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {personas.map((persona) => (
                <SelectItem key={persona.id} value={persona.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{persona.name}</span>
                    <span className="text-xs text-muted-foreground">{persona.tagline}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
            <AlertDialogAction onClick={handleReset}>Delete demo data</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
