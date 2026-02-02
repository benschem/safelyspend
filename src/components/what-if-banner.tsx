import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWhatIf } from '@/contexts/what-if-context';
import { useScenarios } from '@/hooks/use-scenarios';

export function WhatIfBanner() {
  const { isWhatIfMode, resetAdjustments, saveAsPreset } = useWhatIf();
  const { setActiveScenarioId } = useScenarios();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isWhatIfMode) return null;

  const handleSave = async () => {
    if (!presetName.trim()) return;

    setIsSaving(true);
    try {
      const newScenario = await saveAsPreset(presetName.trim());
      // Switch to the new preset
      await setActiveScenarioId(newScenario.id);
      setSaveDialogOpen(false);
      setPresetName('');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="sticky top-0 z-50 flex items-center justify-between border-b bg-violet-50 px-4 py-2 dark:bg-violet-950/30">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          <span className="font-medium text-violet-900 dark:text-violet-100">What-If Mode</span>
          <span className="text-sm text-violet-600 dark:text-violet-400">
            Exploring changes...
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetAdjustments}
            className="text-violet-700 hover:bg-violet-100 hover:text-violet-900 dark:text-violet-300 dark:hover:bg-violet-900/50"
          >
            Reset
          </Button>
          <Button
            size="sm"
            onClick={() => setSaveDialogOpen(true)}
            className="bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500"
          >
            Save as Preset
          </Button>
        </div>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Save as Preset</DialogTitle>
            <DialogDescription>
              Save your current adjustments as a new preset. You can switch between presets anytime.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="preset-name">Preset Name</Label>
              <Input
                id="preset-name"
                placeholder="e.g., Budget v2, Savings Focus, etc."
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && presetName.trim()) {
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
            <Button onClick={handleSave} disabled={!presetName.trim() || isSaving}>
              {isSaving ? 'Saving...' : 'Save Preset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
