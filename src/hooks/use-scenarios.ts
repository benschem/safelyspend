import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './use-local-storage';
import type { Scenario, CreateEntity } from '@/lib/types';
import { generateId, now } from '@/lib/utils';

const STORAGE_KEY = 'budget:scenarios';
const ACTIVE_SCENARIO_KEY = 'budget:activeScenarioId';
const USER_ID = 'local';

export function useScenarios() {
  const [scenarios, setScenarios] = useLocalStorage<Scenario[]>(STORAGE_KEY, []);
  const [activeScenarioId, setActiveScenarioId] = useLocalStorage<string | null>(
    ACTIVE_SCENARIO_KEY,
    null,
  );

  const defaultScenario = useMemo(
    () => scenarios.find((s) => s.isDefault) ?? null,
    [scenarios],
  );

  const activeScenario = useMemo(
    () => scenarios.find((s) => s.id === activeScenarioId) ?? defaultScenario,
    [scenarios, activeScenarioId, defaultScenario],
  );

  const addScenario = useCallback(
    (data: CreateEntity<Scenario>) => {
      const timestamp = now();
      // If this is the first scenario or marked as default, ensure it's the only default
      const isDefault = data.isDefault || scenarios.length === 0;

      const newScenario: Scenario = {
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...data,
        isDefault,
      };

      setScenarios((prev) => {
        // If new scenario is default, unset other defaults
        if (isDefault) {
          return [...prev.map((s) => ({ ...s, isDefault: false })), newScenario];
        }
        return [...prev, newScenario];
      });

      // Auto-select if first scenario
      if (scenarios.length === 0) {
        setActiveScenarioId(newScenario.id);
      }

      return newScenario;
    },
    [scenarios.length, setScenarios, setActiveScenarioId],
  );

  const updateScenario = useCallback(
    (id: string, updates: Partial<Omit<Scenario, 'id' | 'userId' | 'createdAt'>>) => {
      setScenarios((prev) => {
        let updated = prev.map((scenario) =>
          scenario.id === id ? { ...scenario, ...updates, updatedAt: now() } : scenario,
        );

        // If setting this scenario as default, unset others
        if (updates.isDefault) {
          updated = updated.map((s) =>
            s.id === id ? s : { ...s, isDefault: false },
          );
        }

        return updated;
      });
    },
    [setScenarios],
  );

  const deleteScenario = useCallback(
    (id: string) => {
      const scenarioToDelete = scenarios.find((s) => s.id === id);

      setScenarios((prev) => {
        const remaining = prev.filter((scenario) => scenario.id !== id);

        // If we deleted the default, make the first remaining one default
        if (scenarioToDelete?.isDefault && remaining.length > 0) {
          remaining[0] = { ...remaining[0]!, isDefault: true };
        }

        return remaining;
      });

      if (activeScenarioId === id) {
        // Switch to default or first scenario
        const remaining = scenarios.filter((s) => s.id !== id);
        const newActive = remaining.find((s) => s.isDefault) ?? remaining[0];
        setActiveScenarioId(newActive?.id ?? null);
      }
    },
    [scenarios, activeScenarioId, setScenarios, setActiveScenarioId],
  );

  const duplicateScenario = useCallback(
    (id: string, newName: string) => {
      const source = scenarios.find((s) => s.id === id);
      if (!source) return null;

      const timestamp = now();
      const newScenario: Scenario = {
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        name: newName,
        ...(source.description !== undefined && { description: source.description }),
        isDefault: false,
      };

      setScenarios((prev) => [...prev, newScenario]);
      return newScenario;
    },
    [scenarios, setScenarios],
  );

  return {
    scenarios,
    activeScenarioId,
    activeScenario,
    defaultScenario,
    setActiveScenarioId,
    addScenario,
    updateScenario,
    deleteScenario,
    duplicateScenario,
  };
}
