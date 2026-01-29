import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
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
import { clearAllData, getAvailablePersonas, getDemoPersonaId, switchPersona } from '@/lib/demo-data';

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
      console.error('Failed to switch persona:', error);
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
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 w-7 p-0 hover:bg-yellow-200 dark:hover:bg-yellow-900"
            title="Back to landing page"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium">Exploring demo data:</span>
          <Select value={currentPersonaId} onValueChange={handlePersonaChange} disabled={isLoading}>
            <SelectTrigger className="h-7 w-auto gap-2 border-yellow-600/50 bg-transparent text-sm hover:bg-yellow-200 dark:border-yellow-500/50 dark:hover:bg-yellow-900">
              <SelectValue>
                {isLoading ? 'Loading...' : currentPersona?.name ?? 'Select persona'}
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
            <AlertDialogAction onClick={handleReset}>
              Delete demo data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
