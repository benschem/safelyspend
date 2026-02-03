import { useState, useEffect } from 'react';
import { Sparkles, Star, X } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWhatIf } from '@/contexts/what-if-context';
import { useScenarios } from '@/hooks/use-scenarios';

export function WhatIfBanner() {
  const {
    isWhatIfMode,
    isBannerCollapsed,
    setBannerCollapsed,
    resetAdjustments,
    saveAsPreset,
    saveToCurrentScenario,
  } = useWhatIf();
  const { scenarios, activeScenarioId, activeScenario, setActiveScenarioId } = useScenarios();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveCurrentConfirmOpen, setSaveCurrentConfirmOpen] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);
  const [pendingScenarioId, setPendingScenarioId] = useState<string | null>(null);

  // Auto-expand when in what-if mode (has unsaved changes)
  useEffect(() => {
    if (isWhatIfMode) {
      setBannerCollapsed(false);
    }
  }, [isWhatIfMode, setBannerCollapsed]);

  const isDefaultSelected = activeScenario?.isDefault ?? true;

  const handleSave = async () => {
    if (!scenarioName.trim()) return;

    setIsSaving(true);
    try {
      const newScenario = await saveAsPreset(scenarioName.trim());
      // Switch to the new scenario
      await setActiveScenarioId(newScenario.id);
      setSaveDialogOpen(false);
      setScenarioName('');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveToCurrentScenario = async () => {
    setIsSaving(true);
    try {
      await saveToCurrentScenario();
      setSaveCurrentConfirmOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetClick = () => {
    if (isWhatIfMode) {
      setShowResetConfirm(true);
    } else {
      resetAdjustments();
    }
  };

  const handleResetConfirm = () => {
    resetAdjustments();
    setShowResetConfirm(false);
  };

  const handleScenarioChange = (newScenarioId: string) => {
    if (isWhatIfMode && newScenarioId !== activeScenarioId) {
      setPendingScenarioId(newScenarioId);
      setShowSwitchConfirm(true);
    } else {
      setActiveScenarioId(newScenarioId);
    }
  };

  const handleSwitchConfirm = () => {
    if (pendingScenarioId) {
      resetAdjustments();
      setActiveScenarioId(pendingScenarioId);
    }
    setShowSwitchConfirm(false);
    setPendingScenarioId(null);
  };

  const handleSaveAndSwitch = () => {
    setShowSwitchConfirm(false);
    setSaveDialogOpen(true);
  };

  // Build select props conditionally to avoid passing undefined value
  const selectProps = activeScenarioId
    ? { value: activeScenarioId, onValueChange: handleScenarioChange }
    : { onValueChange: handleScenarioChange };

  // Helper to render dialogs (needed in both collapsed and expanded states)
  const renderDialogs = () => (
    <>
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Save as New Scenario</DialogTitle>
            <DialogDescription>
              Save your current adjustments as a new scenario. You can switch between scenarios
              anytime.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="scenario-name">Scenario Name</Label>
              <Input
                id="scenario-name"
                placeholder="e.g., Frugal Mode, Side Hustle, etc."
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && scenarioName.trim()) {
                    handleSave();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!scenarioName.trim() || isSaving}>
              {isSaving ? 'Saving...' : 'Save Scenario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved adjustments. Would you like to save them as a new scenario first?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                setShowResetConfirm(false);
                setSaveDialogOpen(true);
              }}
            >
              Save as Scenario
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Scenario Switch Confirmation Dialog */}
      <AlertDialog open={showSwitchConfirm} onOpenChange={setShowSwitchConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch Scenario?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved adjustments. Would you like to save them as a new scenario first?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel onClick={() => setPendingScenarioId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSwitchConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard & Switch
            </AlertDialogAction>
            <AlertDialogAction onClick={handleSaveAndSwitch}>Save as Scenario</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save to Current Scenario Confirmation Dialog */}
      <AlertDialog open={saveCurrentConfirmOpen} onOpenChange={setSaveCurrentConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update &quot;{activeScenario?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite the saved values in this scenario with your current adjustments.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveToCurrentScenario} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Update Scenario'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  // Don't show banner if no scenarios exist
  if (scenarios.length === 0) return null;

  // Show purple styling when: viewing non-default scenario OR has unsaved adjustments
  const showPurple = !isDefaultSelected || isWhatIfMode;

  // Determine styling based on mode
  const bannerBgClass = showPurple
    ? 'border-violet-500/50 bg-violet-500/10'
    : 'border-border bg-muted/50';

  const bannerTextClass = showPurple
    ? 'text-violet-800 dark:text-violet-200'
    : 'text-muted-foreground';

  const iconClass = showPurple ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground';

  const selectTriggerClass = showPurple
    ? 'border-violet-500 bg-violet-600 text-white hover:bg-violet-700 dark:border-violet-400 dark:bg-violet-600 dark:hover:bg-violet-700 [&>svg]:text-white'
    : 'border-border bg-background hover:bg-muted';

  const collapseButtonClass = showPurple
    ? 'text-violet-600 hover:bg-violet-200 dark:text-violet-400 dark:hover:bg-violet-800'
    : 'text-muted-foreground hover:bg-muted';

  // Collapsed state: shrink to sidebar width
  if (isBannerCollapsed) {
    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setBannerCollapsed(false)}
              className={`flex h-11 w-56 cursor-pointer items-center gap-2 border-b border-r px-4 transition-colors ${
                showPurple
                  ? 'border-violet-500/50 bg-violet-500/10 text-violet-800 hover:bg-violet-500/20 dark:text-violet-200 dark:hover:bg-violet-500/20'
                  : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              <Sparkles className={`h-4 w-4 shrink-0 ${iconClass}`} />
              <span className="truncate text-sm font-medium">
                {activeScenario?.name ?? 'Scenario'}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Click to expand scenario controls</TooltipContent>
        </Tooltip>

        {renderDialogs()}
      </>
    );
  }

  // Full banner
  return (
    <>
      <div
        role="alert"
        className={`flex h-11 items-center gap-3 border-b px-4 text-sm ${bannerBgClass} ${bannerTextClass}`}
      >
        <button
          type="button"
          onClick={() => setBannerCollapsed(true)}
          className={`flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 transition-colors sm:gap-3 ${
            showPurple ? 'hover:bg-violet-200 dark:hover:bg-violet-800' : 'hover:bg-muted'
          }`}
        >
          <Sparkles className={`h-4 w-4 shrink-0 ${iconClass}`} />
          <span className="hidden font-medium sm:inline">Scenario:</span>
        </button>
        <Select {...selectProps}>
          <SelectTrigger className={`h-7 w-auto gap-1 text-sm sm:gap-2 ${selectTriggerClass}`}>
            <SelectValue placeholder="Select scenario" />
          </SelectTrigger>
          <SelectContent>
            {/* Sort scenarios: default first, then alphabetically */}
            {[...scenarios]
              .sort((a, b) => {
                if (a.isDefault) return -1;
                if (b.isDefault) return 1;
                return a.name.localeCompare(b.name);
              })
              .map((scenario) => (
                <SelectItem key={scenario.id} value={scenario.id}>
                  <span className="flex items-center gap-1.5">
                    {scenario.isDefault && (
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                    )}
                    {scenario.name}
                  </span>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {isWhatIfMode && (
          <span className="hidden text-sm text-violet-600 dark:text-violet-400 sm:inline">
            Exploring changes...
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {isWhatIfMode ? (
            <>
              {/* Full buttons on larger screens */}
              <div className="hidden gap-2 sm:flex">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetClick}
                  className="border-violet-600 bg-transparent hover:bg-violet-200 dark:border-violet-500 dark:hover:bg-violet-900"
                >
                  Reset
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSaveCurrentConfirmOpen(true)}
                  className="border-violet-600 bg-transparent hover:bg-violet-200 dark:border-violet-500 dark:hover:bg-violet-900"
                >
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSaveDialogOpen(true)}
                  className="border-violet-600 bg-transparent hover:bg-violet-200 dark:border-violet-500 dark:hover:bg-violet-900"
                >
                  Save as New
                </Button>
              </div>
              {/* Compact buttons on mobile */}
              <div className="flex gap-1 sm:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetClick}
                  className="h-7 border-violet-600 bg-transparent px-2 text-xs hover:bg-violet-200 dark:border-violet-500 dark:hover:bg-violet-900"
                >
                  Reset
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSaveCurrentConfirmOpen(true)}
                  className="h-7 border-violet-600 bg-transparent px-2 text-xs hover:bg-violet-200 dark:border-violet-500 dark:hover:bg-violet-900"
                >
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSaveDialogOpen(true)}
                  className="h-7 border-violet-600 bg-transparent px-2 text-xs hover:bg-violet-200 dark:border-violet-500 dark:hover:bg-violet-900"
                >
                  New
                </Button>
              </div>
            </>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setBannerCollapsed(true)}
                className={`cursor-pointer rounded p-1 transition-colors ${collapseButtonClass}`}
                aria-label="Collapse banner"
              >
                <X className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Collapse to sidebar</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {renderDialogs()}
    </>
  );
}
